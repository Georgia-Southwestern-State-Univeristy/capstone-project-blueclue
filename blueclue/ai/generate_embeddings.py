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

    # Chunk mode: split articles into sections and embed each chunk separately
    # (stores results in article_chunks table — run migration 040 first):
    python generate_embeddings.py --chunk-mode section

    # Compare embedding quality: run both ada-002 (or 3-small) AND MiniLM
    # and report cosine similarity distributions for 5 sample queries:
    python generate_embeddings.py --compare-models

Environment variables required:
    DATABASE_URL   PostgreSQL connection string
    OPENAI_API_KEY (optional) Use OpenAI ada-002/3-small; falls back to MiniLM if absent.
    EMBEDDING_MODEL (optional) Override model name, e.g. text-embedding-3-small

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
    Concatenate category + title + content into a single string for embedding.
    Leading with category and title gives stronger topical signal.
    The 8 191-token OpenAI limit is handled by the caller (6 000 char cap here).
    """
    category = (article.get("category") or "").strip()
    title = (article.get("title") or "").strip()
    content = (article.get("content") or "").strip()
    # Truncate content to 6000 chars to stay within OpenAI's 8191-token limit
    if len(content) > 6000:
        content = content[:6000] + "\u2026"
    parts = []
    if category:
        parts.append(f"Category: {category}")
    parts.append(title)
    parts.append("")         # blank line separator
    parts.append(content)
    return "\n".join(parts)


import re as _re

_SECTION_HEADING_RE = _re.compile(r"^#{1,3}\s+(.+)$", _re.MULTILINE)
_MIN_CHUNK_CHARS = 80       # discard chunks shorter than this


def _split_into_sections(article: dict) -> list:
    """
    Split article content into (section_heading, chunk_text) pairs by markdown headings.
    Falls back to fixed-window chunks if no headings are found.

    Returns:
        List of dicts: {chunk_index, section_heading, chunk_text, embedding_text}
    """
    title = (article.get("title") or "").strip()
    category = (article.get("category") or "").strip()
    content = (article.get("content") or "").strip()

    # ---- Try section splitting ----
    matches = list(_SECTION_HEADING_RE.finditer(content))
    sections = []
    if matches:
        # Text before the first heading (intro)
        intro = content[: matches[0].start()].strip()
        if intro and len(intro) >= _MIN_CHUNK_CHARS:
            sections.append(("Introduction", intro))

        for i, m in enumerate(matches):
            heading = m.group(1).strip()
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
            body = content[start:end].strip()
            if body and len(body) >= _MIN_CHUNK_CHARS:
                sections.append((heading, body))

    # ---- Fall back to fixed window ----
    if not sections:
        window, overlap = 1200, 200
        start = 0
        idx = 0
        while start < len(content):
            end = start + window
            body = content[start:end].strip()
            if len(body) >= _MIN_CHUNK_CHARS:
                heading = f"Chunk {idx + 1}"
                sections.append((heading, body))
            start += window - overlap
            idx += 1

    results = []
    for i, (heading, body) in enumerate(sections):
        prefix = []
        if category:
            prefix.append(f"Category: {category}")
        prefix.append(f"Article: {title}")
        prefix.append(f"Section: {heading}")
        prefix.append("")
        emb_text = "\n".join(prefix) + body[:4000]   # keep chunks within token limit
        results.append({
            "chunk_index": i,
            "section_heading": heading,
            "chunk_text": body,
            "embedding_text": emb_text,
        })
    return results


def _upsert_chunk(conn, article_id: int, chunk: dict,
                  embedding: list, model_name: str) -> None:
    """Insert or update a single article chunk embedding."""
    dim = len(embedding)
    col = "embedding" if dim == 1536 else "embedding_384"
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO article_chunks
              (article_id, chunk_index, section_heading, chunk_text,
               {col}, embedding_model, embedding_text)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (article_id, chunk_index) DO UPDATE SET
              section_heading = EXCLUDED.section_heading,
              chunk_text      = EXCLUDED.chunk_text,
              {col}           = EXCLUDED.{col},
              embedding_model = EXCLUDED.embedding_model,
              embedding_text  = EXCLUDED.embedding_text,
              updated_at      = NOW()
            """,
            (
                article_id,
                chunk["chunk_index"],
                chunk["section_heading"],
                chunk["chunk_text"],
                embedding,
                model_name,
                chunk["embedding_text"],
            ),
        )
    conn.commit()


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
    # Use get_embedding_model_name() if available (upgraded llm_service), else fallback
    if hasattr(llm, "get_embedding_model_name"):
        model_name = llm.get_embedding_model_name()
    elif llm.is_llm_available():
        model_name = llm.get_model_name()
    else:
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
                "Embedding batch %d\u2013%d / %d \u2026",
                batch_start + 1,
                min(batch_start + BATCH_SIZE, total),
                total,
            )

            try:
                vectors = llm.embed_batch(batch_texts, batch_size=BATCH_SIZE)
            except Exception as exc:
                logger.error("Batch embed failed: %s \u2014 skipping batch", exc)
                errors += BATCH_SIZE
                continue

            for art, vec, txt in zip(batch_arts, vectors, batch_texts):
                try:
                    upsert_embedding(conn, art["id"], vec, txt, model_name)
                    logger.info("  \u2713 %4d  %s", art["id"], art["title"][:60])
                    success += 1
                except Exception as exc:
                    logger.error("  \u2717 %4d  %s  ERROR: %s", art["id"], art["title"][:60], exc)
                    errors += 1

            # Be polite to the OpenAI rate limiter
            if llm.is_llm_available() and batch_start + BATCH_SIZE < total:
                time.sleep(0.5)

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        status_after = get_article_embedding_status(conn)
        logger.info(
            "Done \u2014 success: %d, errors: %d | DB total: %d, embedded: %d, missing: %d",
            success, errors,
            status_after["total"], status_after["embedded"], status_after["missing"],
        )

    finally:
        conn.close()


def run_chunks(force: bool = False, dry_run: bool = False, article_id: int | None = None):
    """
    Section-based chunk embedding pipeline.
    Splits each article into sections (by markdown headings) or fixed windows,
    then embeds each chunk individually and writes to the article_chunks table.

    Requires migration 040_add_article_chunks.sql to be applied first.
    """
    if not DATABASE_URL:
        logger.error("DATABASE_URL is not set. Exiting.")
        sys.exit(1)

    llm = get_llm_service()
    dim = llm.get_embedding_dim()
    if hasattr(llm, "get_embedding_model_name"):
        model_name = llm.get_embedding_model_name()
    elif llm.is_llm_available():
        model_name = llm.get_model_name()
    else:
        model_name = "all-MiniLM-L6-v2"

    logger.info("[CHUNKS] model=%s  dim=%d", model_name, dim)

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        # Verify the article_chunks table exists
        with conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'article_chunks')"
            )
            row = cur.fetchone()
            if not row["exists"]:
                logger.error(
                    "article_chunks table not found. "
                    "Run: psql ... < database/migrations/040_add_article_chunks.sql"
                )
                sys.exit(1)

        all_articles = get_all_published_articles(conn)
        if article_id is not None:
            all_articles = [a for a in all_articles if a["id"] == article_id]
            if not all_articles:
                logger.error("Article %d not found.", article_id)
                sys.exit(1)

        if not force:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT article_id FROM article_chunks")
                done_ids = {r["article_id"] for r in cur.fetchall()}
            all_articles = [a for a in all_articles if a["id"] not in done_ids]

        if dry_run:
            for a in all_articles:
                chunks = _split_into_sections(a)
                logger.info("[DRY RUN] %d: %s \u2192 %d chunk(s)", a["id"], a["title"], len(chunks))
            return

        total_chunks = 0
        for art in all_articles:
            chunks = _split_into_sections(art)
            if not chunks:
                logger.warning("No chunks produced for article %d: %s", art["id"], art["title"])
                continue

            chunk_texts = [c["embedding_text"] for c in chunks]
            try:
                vectors = llm.embed_batch(chunk_texts, batch_size=20)
            except Exception as exc:
                logger.error("Embed failed for article %d: %s", art["id"], exc)
                continue

            for chunk, vec in zip(chunks, vectors):
                try:
                    _upsert_chunk(conn, art["id"], chunk, vec, model_name)
                    total_chunks += 1
                except Exception as exc:
                    logger.error("Upsert chunk error art=%d idx=%d: %s",
                                 art["id"], chunk["chunk_index"], exc)

            logger.info("  \u2713 article %4d (%d chunks): %s",
                        art["id"], len(chunks), art["title"][:55])
            if llm.is_llm_available():
                time.sleep(0.3)

        logger.info("[CHUNKS] Done \u2014 total chunks upserted: %d", total_chunks)

    finally:
        conn.close()


def compare_models():
    """
    Compare retrieval quality between the active embedding model and MiniLM.
    For 5 sample queries, embeds with each model and reports top-3 cosine
    similarity scores from the article_embeddings table.
    """
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set.")
        sys.exit(1)

    SAMPLE_QUERIES = [
        "How do I reset my password?",
        "Printer is not connecting to the network",
        "My laptop screen is flickering",
        "Request software installation for a new employee",
        "VPN connection keeps dropping",
    ]

    from src.rag_pipeline import semantic_search, RAG_MIN_SIMILARITY

    llm = get_llm_service()

    # MiniLM comparison embedder
    try:
        from sentence_transformers import SentenceTransformer
        minilm = SentenceTransformer("all-MiniLM-L6-v2")

        def minilm_embed(text: str):
            return minilm.encode(text, normalize_embeddings=True).tolist()
    except ImportError:
        logger.error("sentence-transformers not installed \u2014 cannot compare MiniLM.")
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        logger.info("")
        logger.info("=" * 70)
        logger.info("  MODEL COMPARISON: %s vs all-MiniLM-L6-v2",
                    getattr(llm, "get_embedding_model_name", lambda: "OpenAI")())
        logger.info("  threshold=%.2f, top_k=3", RAG_MIN_SIMILARITY)
        logger.info("=" * 70)

        for q in SAMPLE_QUERIES:
            logger.info("\nQuery: %r", q)

            # Primary model (OpenAI or configured)
            emb_primary = llm.embed_text(q)
            hits_primary = semantic_search(conn, emb_primary, top_k=3, min_similarity=0.0)

            # MiniLM
            emb_mini = minilm_embed(q)
            hits_mini = semantic_search(conn, emb_mini, top_k=3, min_similarity=0.0)

            logger.info("  %-30s | Top sim: %.3f | Top article: %s",
                        "Primary model",
                        hits_primary[0].similarity if hits_primary else 0.0,
                        hits_primary[0].title[:40] if hits_primary else "(none)")
            logger.info("  %-30s | Top sim: %.3f | Top article: %s",
                        "MiniLM",
                        hits_mini[0].similarity if hits_mini else 0.0,
                        hits_mini[0].title[:40] if hits_mini else "(none)")

            # Show whether they agree on top result
            if hits_primary and hits_mini:
                agree = hits_primary[0].id == hits_mini[0].id
                logger.info("  Agreement on top result: %s", "\u2713 YES" if agree else "\u2717 NO")

        logger.info("")
        logger.info("Tip: set EMBEDDING_MODEL=text-embedding-3-small "
                    "and re-run --force to upgrade embeddings.")
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
    parser.add_argument(
        "--chunk-mode",
        choices=["full", "section"],
        default="full",
        help=(
            "full (default): one embedding per article; "
            "section: embed each section separately into article_chunks table "
            "(requires migration 040_add_article_chunks.sql)"
        ),
    )
    parser.add_argument(
        "--compare-models",
        action="store_true",
        help="Compare primary embedding model vs MiniLM on 5 sample queries and exit",
    )
    args = parser.parse_args()

    if args.compare_models:
        compare_models()
    elif args.chunk_mode == "section":
        run_chunks(force=args.force, dry_run=args.dry_run, article_id=args.article_id)
    else:
        run(force=args.force, dry_run=args.dry_run, article_id=args.article_id)

