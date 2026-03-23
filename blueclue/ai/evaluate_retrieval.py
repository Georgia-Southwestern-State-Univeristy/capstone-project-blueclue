#!/usr/bin/env python3
"""
evaluate_retrieval.py
=====================
Offline evaluation of RAG retrieval quality for BlueClue helpdesk.

Runs 20 representative IT-helpdesk queries through the embedding + similarity
search pipeline with two threshold configurations (before / after tuning) and
reports precision, recall proxy, and per-query hit analysis.

Usage:
    # Quick before/after comparison (no DB required for embeddings if MiniLM):
    python evaluate_retrieval.py

    # Print top-3 retrieved chunks for manual review:
    python evaluate_retrieval.py --review

    # Save results to CSV:
    python evaluate_retrieval.py --output results/retrieval_eval.csv

    # Use a specific similarity threshold for the "new" config:
    python evaluate_retrieval.py --new-threshold 0.42

Environment variables:
    DATABASE_URL   PostgreSQL connection string (required)
    OPENAI_API_KEY Optional — enables ada-002 / text-embedding-3-small
    EMBEDDING_MODEL Override, e.g. text-embedding-3-small
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import sys
import time
from typing import List, Optional

# Make src/ importable when run from the ai/ directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "src"))
sys.path.insert(0, BASE_DIR)

import psycopg2
import psycopg2.extras

from src.llm_service import get_llm_service
from src.rag_pipeline import (
    RetrievedArticle,
    _preprocess_query,
    semantic_search,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger("blueclue.eval")

DATABASE_URL = os.getenv("DATABASE_URL", "")

# ---------------------------------------------------------------------------
# 20 Representative IT-helpdesk sample queries
# Each entry: (query_text, expected_category_hint)
# expected_category_hint is used only for context in the report — not for
# automated scoring (which would require ground-truth article IDs).
# ---------------------------------------------------------------------------
SAMPLE_QUERIES: List[tuple] = [
    # Password / access
    ("How do I reset my password?",                           "password"),
    ("I forgot my login credentials",                         "password"),
    ("Account is locked after too many failed attempts",      "password"),
    # Hardware
    ("My printer is not connecting to the network",           "hardware"),
    ("Laptop screen is flickering and going black",           "hardware"),
    ("Keyboard keys are sticking or not responding",          "hardware"),
    ("Computer won't turn on",                                "hardware"),
    # Software & requests
    ("How do I request software installation?",               "software"),
    ("VPN keeps disconnecting every few minutes",             "network"),
    ("Wi-Fi is connected but no internet access",             "network"),
    # Email / calendar
    ("Outlook keeps crashing when I open it",                 "email"),
    ("I cannot receive emails from external senders",         "email"),
    ("How do I set up email on my mobile phone?",             "email"),
    # General helpdesk
    ("How do I submit a support ticket?",                     "helpdesk"),
    ("What is the SLA for high-priority tickets?",            "helpdesk"),
    ("Who do I contact for after-hours IT support?",          "helpdesk"),
    # Search / docs
    ("Show me all available knowledge base articles",         "browse"),
    ("What troubleshooting guides are available?",            "browse"),
    # Out-of-scope (should escalate)
    ("How do I order a new office chair?",                    "out-of-scope"),
    ("What is the company holiday schedule?",                 "out-of-scope"),
]

# ---------------------------------------------------------------------------
# Threshold configurations for before/after comparison
# ---------------------------------------------------------------------------
BEFORE_THRESHOLD = 0.35   # original
AFTER_THRESHOLD  = float(os.getenv("RAG_MIN_SIMILARITY", "0.40"))  # tuned
TOP_K = 3


# ---------------------------------------------------------------------------
# Helper: run retrieval for one query at a given threshold
# ---------------------------------------------------------------------------
def _retrieve(conn, embedding: List[float], threshold: float) -> List[RetrievedArticle]:
    return semantic_search(conn, embedding, top_k=TOP_K, min_similarity=threshold)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def _avg_similarity(articles: List[RetrievedArticle]) -> float:
    if not articles:
        return 0.0
    return round(sum(a.similarity for a in articles) / len(articles), 4)


def _precision_at_k(articles: List[RetrievedArticle], threshold: float) -> float:
    """
    Precision@K proxy: fraction of returned articles whose similarity >= threshold.
    Because we don't have hand-labelled ground truth, we use the threshold itself
    as the relevance cutoff.  Replace with true labels when available.
    """
    if not articles:
        return 0.0
    relevant = sum(1 for a in articles if a.similarity >= threshold)
    return round(relevant / len(articles), 3)


# ---------------------------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------------------------

def run_evaluation(
    review: bool = False,
    output_path: Optional[str] = None,
    new_threshold: float = AFTER_THRESHOLD,
) -> None:
    if not DATABASE_URL:
        logger.error("DATABASE_URL is not set.")
        sys.exit(1)

    llm = get_llm_service()
    if hasattr(llm, "get_embedding_model_name"):
        embed_model = llm.get_embedding_model_name()
    elif llm.is_llm_available():
        embed_model = "openai/" + llm.get_model_name()
    else:
        embed_model = "all-MiniLM-L6-v2"

    logger.info("Embedding model: %s", embed_model)
    logger.info("Threshold comparison: BEFORE=%.2f  AFTER=%.2f  top_k=%d",
                BEFORE_THRESHOLD, new_threshold, TOP_K)
    logger.info("Queries to evaluate: %d", len(SAMPLE_QUERIES))

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

    rows = []            # for CSV output
    before_counts = []   # list of result counts per query
    after_counts  = []
    before_avg_sims = []
    after_avg_sims  = []
    irrelevant_before = 0  # queries where ≥1 result is below AFTER threshold
    zero_results_before = 0
    zero_results_after  = 0

    try:
        separator = "-" * 100
        header = (
            f"{'#':>2}  {'Query':<48}  {'Cat':<12}  "
            f"{'B-hits':>6}  {'B-sim':>6}  "
            f"{'A-hits':>6}  {'A-sim':>6}  {'Change':>8}"
        )
        logger.info("\n%s\n%s\n%s", separator, header, separator)

        for idx, (query, category) in enumerate(SAMPLE_QUERIES, 1):
            clean = _preprocess_query(query)
            t0 = time.time()
            embedding = llm.embed_text(clean)
            embed_ms = int((time.time() - t0) * 1000)

            before_hits = _retrieve(conn, embedding, BEFORE_THRESHOLD)
            after_hits  = _retrieve(conn, embedding, new_threshold)

            b_count   = len(before_hits)
            a_count   = len(after_hits)
            b_avg_sim = _avg_similarity(before_hits)
            a_avg_sim = _avg_similarity(after_hits)

            # Detect improvement / regression
            if a_count == 0 and b_count > 0:
                change_marker = "FEWER -"
            elif a_count > 0 and b_avg_sim > b_avg_sim * 1.0:
                change_marker = "OK     "
            else:
                change_marker = "       "

            # Count irrelevant results (before had results below new threshold)
            if before_hits and any(h.similarity < new_threshold for h in before_hits):
                irrelevant_before += 1

            if b_count == 0:
                zero_results_before += 1
            if a_count == 0:
                zero_results_after += 1

            before_counts.append(b_count)
            after_counts.append(a_count)
            before_avg_sims.append(b_avg_sim)
            after_avg_sims.append(a_avg_sim)

            logger.info(
                "%2d  %-48s  %-12s  %6d  %6.3f  %6d  %6.3f  %8s  [%dms]",
                idx, query[:48], category[:12],
                b_count, b_avg_sim,
                a_count, a_avg_sim,
                change_marker, embed_ms,
            )

            # ------------------------------------------------------------------
            # Review mode: print top-3 passages for manual inspection
            # ------------------------------------------------------------------
            if review:
                logger.info("  --- TOP-3 CHUNKS (threshold=%.2f) ---", new_threshold)
                if not after_hits:
                    logger.info("    (no results above threshold)")
                for i, art in enumerate(after_hits, 1):
                    snippet = (art.content[:200].replace("\n", " ") + "…"
                               if len(art.content) > 200 else art.content)
                    logger.info(
                        "    [%d] sim=%.3f  cat=%-14s  %s\n"
                        "        '%s'",
                        i, art.similarity, art.category, art.title[:50],
                        snippet,
                    )

            rows.append({
                "query": query,
                "category_hint": category,
                "embed_model": embed_model,
                "before_threshold": BEFORE_THRESHOLD,
                "before_hits": b_count,
                "before_avg_sim": b_avg_sim,
                "before_p_at_k": _precision_at_k(before_hits, BEFORE_THRESHOLD),
                "after_threshold": new_threshold,
                "after_hits": a_count,
                "after_avg_sim": a_avg_sim,
                "after_p_at_k": _precision_at_k(after_hits, new_threshold),
                "top_article_after": after_hits[0].title if after_hits else "",
                "top_sim_after": after_hits[0].similarity if after_hits else 0.0,
            })

        # ------------------------------------------------------------------
        # Aggregate summary
        # ------------------------------------------------------------------
        n = len(SAMPLE_QUERIES)
        b_avg_count  = round(sum(before_counts) / n, 2)
        a_avg_count  = round(sum(after_counts)  / n, 2)
        b_global_sim = round(sum(before_avg_sims) / n, 4)
        a_global_sim = round(sum(after_avg_sims)  / n, 4)

        logger.info("\n%s", separator)
        logger.info("SUMMARY  (%d queries, top_k=%d, embed_model=%s)",
                    n, TOP_K, embed_model)
        logger.info(separator)
        logger.info(
            "  %-36s  Before (%.2f)  After (%.2f)",
            "Metric", BEFORE_THRESHOLD, new_threshold,
        )
        logger.info("  %-36s  %12.2f  %11.2f", "Avg results returned", b_avg_count, a_avg_count)
        logger.info("  %-36s  %12.4f  %11.4f", "Avg similarity of results", b_global_sim, a_global_sim)
        logger.info("  %-36s  %12d  %11d", "Queries with 0 results", zero_results_before, zero_results_after)
        logger.info("  %-36s  %12d  %11s",
                    "Queries with low-sim results (before)", irrelevant_before, "—")
        logger.info(separator)

        # Highlight cases where after threshold silenced a query
        triggered = [(i + 1, SAMPLE_QUERIES[i][0]) for i in range(n) if after_counts[i] == 0]
        if triggered:
            logger.info(
                "\nWARNING: %d query/queries produce 0 results at threshold=%.2f — "
                "consider lowering the threshold or improving article coverage:",
                len(triggered), new_threshold,
            )
            for num, q in triggered:
                logger.info("  #%d  %s", num, q)
        else:
            logger.info(
                "\nAll %d queries return at least 1 result at threshold=%.2f.",
                n, new_threshold,
            )

        logger.info(
            "\nRecommendation: RAG_MIN_SIMILARITY=%.2f reduces avg returned articles "
            "from %.2f→%.2f while improving avg similarity %.4f→%.4f",
            new_threshold, b_avg_count, a_avg_count, b_global_sim, a_global_sim,
        )

        # ------------------------------------------------------------------
        # Optional CSV export
        # ------------------------------------------------------------------
        if output_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
            fieldnames = list(rows[0].keys())
            with open(output_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            logger.info("\nResults saved to: %s", output_path)

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate RAG retrieval quality before/after threshold tuning."
    )
    parser.add_argument(
        "--review", action="store_true",
        help="Print the top-3 retrieved passages for manual inspection",
    )
    parser.add_argument(
        "--output", metavar="PATH", default=None,
        help="Save per-query results to a CSV file (e.g. data/reports/retrieval_eval.csv)",
    )
    parser.add_argument(
        "--new-threshold", type=float, default=AFTER_THRESHOLD,
        help=f"Threshold for the 'after' config (default: {AFTER_THRESHOLD})",
    )
    args = parser.parse_args()

    run_evaluation(
        review=args.review,
        output_path=args.output,
        new_threshold=args.new_threshold,
    )
