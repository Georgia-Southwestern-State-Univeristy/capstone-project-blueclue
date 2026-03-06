#!/usr/bin/env python3
"""
generate_embeddings.py
======================
One-shot (and incremental) script to generate embeddings for all published
KB articles and store them in the `article_embeddings` table via pgvector.

Usage:
    # Generate embeddings for articles that don't have one yet (incremental):
    python generate_embeddings.py

    # Regenerate ALL embeddings (force re-embed everything):
    python generate_embeddings.py --force

    # Only embed a specific article by ID:
    python generate_embeddings.py --article-id 42

    # Dry-run (show what would be done, don't write to DB):
    python generate_embeddings.py --dry-run

Environment variables required:
    DATABASE_URL   PostgreSQL connection string
    OPENAI_API_KEY (optional) Use OpenAI ada-002; falls back to MiniLM if absent.

The script is safe to re-run at any time.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Path setup — make src/ importable
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "src"))
sys.path.insert(0, BASE_DIR)

from src.llm_service import get_llm_service   # noqa: E402
from src.rag_pipeline import (               # noqa: E402
    get_all_published_articles,
    get_article_embedding_status,
    upsert_embedding,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger("blueclue.embeddings")

DATABASE_URL = os.getenv("DATABASE_URL", "")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_embedding_text(article: dict) -> str:
    """
    Concatenate title + content into a single string for embedding.
    Leading with the title gives more weight to the topic.
    """
    title = (article.get("title") or "").strip()
    content = (article.get("content") or "").strip()
    # Truncate content to 6000 chars to stay within OpenAI's 8192-token limit
    if len(content) > 6000:
        content = content[:6000] + "…"
    return f"{title}\n\n{content}"


def _get_embedded_ids(conn) -> set:
    """Return the set of article IDs that already have embeddings."""
    with conn.cursor() as cur:
        cur.execute("SELECT article_id FROM article_embeddings")
        return {row["article_id"] for row in cur.fetchall()}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def run(force: bool = False, dry_run: bool = False, article_id: int | None = None):
    if not DATABASE_URL:
        logger.error("DATABASE_URL is not set. Exiting.")
        sys.exit(1)

    llm = get_llm_service()
    dim = llm.get_embedding_dim()
    model_name = llm.get_model_name() if llm.is_llm_available() else "all-MiniLM-L6-v2"
    if not llm.is_llm_available():
        model_name = "all-MiniLM-L6-v2"

    logger.info("Embedding model: %s  |  dimension: %d", model_name, dim)
    logger.info("Force re-embed: %s  |  Dry run: %s", force, dry_run)

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        status = get_article_embedding_status(conn)
        logger.info(
            "Coverage before run — total: %d, embedded: %d, missing: %d",
            status["total"], status["embedded"], status["missing"],
        )

        all_articles = get_all_published_articles(conn)

        if article_id is not None:
            all_articles = [a for a in all_articles if a["id"] == article_id]
            if not all_articles:
                logger.error("Article ID %d not found among published public articles.", article_id)
                sys.exit(1)

        if not force:
            embedded_ids = _get_embedded_ids(conn)
            all_articles = [a for a in all_articles if a["id"] not in embedded_ids]

        total = len(all_articles)
        logger.info("Articles to embed: %d", total)

        if total == 0:
            logger.info("Nothing to do — all articles are already embedded.")
            return

        if dry_run:
            for a in all_articles:
                logger.info("[DRY RUN] Would embed article %d: %s", a["id"], a["title"])
            return

        # ------------------------------------------------------------------
        # Batch embed for efficiency (rate limit: ~3000 RPM for OpenAI free)
        # ------------------------------------------------------------------
        BATCH_SIZE = 20
        texts = [_build_embedding_text(a) for a in all_articles]
        ids   = [a["id"] for a in all_articles]

        success = 0
        errors  = 0

        for batch_start in range(0, total, BATCH_SIZE):
            batch_texts = texts[batch_start: batch_start + BATCH_SIZE]
            batch_ids   = ids[batch_start:   batch_start + BATCH_SIZE]
            batch_arts  = all_articles[batch_start: batch_start + BATCH_SIZE]

            logger.info(
                "Embedding batch %d–%d / %d …",
                batch_start + 1,
                min(batch_start + BATCH_SIZE, total),
                total,
            )

            try:
                vectors = llm.embed_batch(batch_texts, batch_size=BATCH_SIZE)
            except Exception as exc:
                logger.error("Batch embed failed: %s — skipping batch", exc)
                errors += BATCH_SIZE
                continue

            for art, vec, txt in zip(batch_arts, vectors, batch_texts):
                try:
                    upsert_embedding(conn, art["id"], vec, txt, model_name)
                    logger.info("  ✓ %4d  %s", art["id"], art["title"][:60])
                    success += 1
                except Exception as exc:
                    logger.error("  ✗ %4d  %s  ERROR: %s", art["id"], art["title"][:60], exc)
                    errors += 1

            # Be polite to the OpenAI rate limiter
            if llm.is_llm_available() and batch_start + BATCH_SIZE < total:
                time.sleep(0.5)

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        status_after = get_article_embedding_status(conn)
        logger.info(
            "Done — success: %d, errors: %d | DB total: %d, embedded: %d, missing: %d",
            success, errors,
            status_after["total"], status_after["embedded"], status_after["missing"],
        )

    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate pgvector embeddings for BlueClue KB articles."
    )
    parser.add_argument("--force", action="store_true",
                        help="Re-embed all articles, not just missing ones")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be embedded without writing to DB")
    parser.add_argument("--article-id", type=int, default=None,
                        help="Embed only a single article by ID")
    args = parser.parse_args()

    run(force=args.force, dry_run=args.dry_run, article_id=args.article_id)
