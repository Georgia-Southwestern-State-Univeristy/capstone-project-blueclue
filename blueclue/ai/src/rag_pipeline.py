"""
BlueClue RAG Pipeline
=====================
Retrieval-Augmented Generation pipeline for the chatbot.

Workflow:
  1. Embed the user query (OpenAI ada-002 or local MiniLM fallback)
  2. Retrieve top-k most relevant KB articles via pgvector cosine similarity
  3. Construct a grounded system + user prompt
  4. Call the LLM (via llm_service) and return the structured response

All heavy work lives here so the FastAPI endpoint layer stays thin.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import math

import psycopg2
import psycopg2.extras

try:
    import numpy as _np
    _USE_NUMPY = True
except ImportError:
    _USE_NUMPY = False


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors (pure Python or numpy)."""
    if _USE_NUMPY:
        va = _np.array(a, dtype=_np.float32)
        vb = _np.array(b, dtype=_np.float32)
        norm_a = _np.linalg.norm(va)
        norm_b = _np.linalg.norm(vb)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(_np.dot(va, vb) / (norm_a * norm_b))
    # Pure Python fallback
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

logger = logging.getLogger("blueclue.rag")

# ---------------------------------------------------------------------------
# Configuration (from environment)
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL", "")
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
RAG_MIN_SIMILARITY = float(os.getenv("RAG_MIN_SIMILARITY", "0.35"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1536"))   # 1536=OpenAI, 384=MiniLM
CACHE_TTL_SECONDS = int(os.getenv("RAG_CACHE_TTL", "3600"))

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class RetrievedArticle:
    id: int
    title: str
    slug: str
    category: str
    content: str           # full content for prompt construction
    excerpt: str           # short excerpt for display
    similarity: float      # cosine similarity score [0, 1]


@dataclass
class RAGResponse:
    answer: str
    articles: List[RetrievedArticle] = field(default_factory=list)
    citations: List[Dict[str, Any]] = field(default_factory=list)
    model_used: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
    cache_hit: bool = False
    fallback_used: bool = False
    escalate: bool = False          # True → bot can't help, suggest ticket


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _get_conn():
    """Create a psycopg2 connection from DATABASE_URL."""
    db_url = DATABASE_URL
    if not db_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)


def get_all_published_articles(conn) -> List[Dict[str, Any]]:
    """Return all published, public KB articles (id, title, slug, category, content, excerpt)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT  id, title, slug, category,
                    content,
                    COALESCE(excerpt, LEFT(content, 300)) AS excerpt
            FROM    knowledge_articles
            WHERE   deleted_at  IS NULL
              AND   is_published = TRUE
              AND   is_public    = TRUE
            ORDER   BY id
            """
        )
        return [dict(r) for r in cur.fetchall()]


def get_article_embedding_status(conn) -> Dict[str, int]:
    """Return counts: total, embedded, missing."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(ka.id)                                        AS total,
              COUNT(ae.id)                                        AS embedded,
              COUNT(ka.id) - COUNT(ae.id)                        AS missing
            FROM  knowledge_articles ka
            LEFT  JOIN article_embeddings ae ON ae.article_id = ka.id
            WHERE ka.deleted_at IS NULL
              AND ka.is_published = TRUE
              AND ka.is_public    = TRUE
            """
        )
        row = cur.fetchone()
        return dict(row) if row else {"total": 0, "embedded": 0, "missing": 0}


def upsert_embedding(conn, article_id: int, embedding: List[float],
                     embedding_text: str, model: str) -> None:
    """Insert or update an article's embedding vector (stored as FLOAT[])."""
    dim = len(embedding)
    col = "embedding" if dim == 1536 else "embedding_384"
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO article_embeddings
              (article_id, {col}, embedding_model, embedding_text)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (article_id) DO UPDATE SET
              {col}           = EXCLUDED.{col},
              embedding_model = EXCLUDED.embedding_model,
              embedding_text  = EXCLUDED.embedding_text,
              updated_at      = NOW()
            """,
            (article_id, embedding, model, embedding_text),
        )
    conn.commit()


def semantic_search(
    conn,
    query_embedding: List[float],
    top_k: int = RAG_TOP_K,
    min_similarity: float = RAG_MIN_SIMILARITY,
) -> List[RetrievedArticle]:
    """
    Cosine similarity search over article_embeddings.
    Embeddings are stored as FLOAT[] — similarity is computed in Python.
    Returns up to top_k articles above min_similarity threshold.
    """
    dim = len(query_embedding)
    col = "embedding" if dim == 1536 else "embedding_384"

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
              ka.id,
              ka.title,
              ka.slug,
              ka.category,
              ka.content,
              COALESCE(ka.excerpt, LEFT(ka.content, 300)) AS excerpt,
              ae.{col} AS embedding
            FROM   article_embeddings ae
            JOIN   knowledge_articles ka ON ka.id = ae.article_id
            WHERE  ka.deleted_at  IS NULL
              AND  ka.is_published = TRUE
              AND  ka.is_public    = TRUE
              AND  ae.{col} IS NOT NULL
            """,
        )
        rows = cur.fetchall()

    # Compute cosine similarity in Python and filter
    scored: List[Tuple[float, Any]] = []
    for r in rows:
        emb = r["embedding"]
        if emb and len(emb) == dim:
            sim = _cosine_similarity(query_embedding, emb)
            if sim >= min_similarity:
                scored.append((sim, r))

    # Sort descending, take top_k
    scored.sort(key=lambda x: x[0], reverse=True)
    scored = scored[:top_k]

    return [
        RetrievedArticle(
            id=r["id"],
            title=r["title"],
            slug=r["slug"],
            category=r["category"],
            content=r["content"] or "",
            excerpt=r["excerpt"] or "",
            similarity=round(sim, 4),
        )
        for sim, r in scored
    ]


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_key(query: str, model: str, top_k: int) -> str:
    payload = f"{query.lower().strip()}|{model}|{top_k}"
    return hashlib.sha256(payload.encode()).hexdigest()


def get_cached_response(conn, cache_key: str) -> Optional[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT response_text, article_ids, model_used,
                   prompt_tokens, completion_tokens
            FROM   llm_response_cache
            WHERE  query_hash = %s
              AND  expires_at > NOW()
            LIMIT 1
            """,
            (cache_key,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def save_cached_response(
    conn,
    cache_key: str,
    query_text: str,
    response_text: str,
    article_ids: List[int],
    model_used: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO llm_response_cache
              (query_hash, query_text, response_text, article_ids, model_used,
               prompt_tokens, completion_tokens,
               expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s,
                    NOW() + INTERVAL '1 hour')
            ON CONFLICT (query_hash) DO UPDATE SET
              response_text     = EXCLUDED.response_text,
              article_ids       = EXCLUDED.article_ids,
              prompt_tokens     = EXCLUDED.prompt_tokens,
              completion_tokens = EXCLUDED.completion_tokens,
              expires_at        = NOW() + INTERVAL '1 hour'
            """,
            (
                cache_key, query_text, response_text, article_ids,
                model_used, prompt_tokens, completion_tokens,
            ),
        )
    conn.commit()


def log_llm_usage(
    conn,
    user_id: Optional[int],
    conversation_id: Optional[int],
    prompt_tokens: int,
    completion_tokens: int,
    model_used: str,
    cost_usd: float,
    latency_ms: int,
    rag_articles_used: int,
    cache_hit: bool,
    fallback_used: bool,
) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO llm_usage_logs
                  (user_id, conversation_id, prompt_tokens, completion_tokens,
                   total_tokens, model_used, cost_usd, latency_ms,
                   rag_articles_used, cache_hit, fallback_used)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id, conversation_id,
                    prompt_tokens, completion_tokens,
                    prompt_tokens + completion_tokens,
                    model_used, cost_usd, latency_ms,
                    rag_articles_used, cache_hit, fallback_used,
                ),
            )
        conn.commit()
    except Exception as exc:
        logger.warning("Failed to log LLM usage: %s", exc)


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are BlueClue Assistant, a helpful and friendly IT support chatbot.

Rules:
1. Answer using ONLY the knowledge base articles provided below.
2. If the user is asking to browse, list, or see articles/FAQs/topics (e.g. "show me FAQs",
   "what articles do you have", "list topics"), respond with a friendly introduction such as
   "Here are some helpful articles that might assist you:" and cite each retrieved article.
   Do NOT say you don't have enough information in this case.
3. If the articles do not contain enough information to fully answer a specific question,
   say exactly: "I don't have enough information to fully answer that. Let me create a support ticket for you."
4. Be concise — keep responses under 150 words.
5. Be friendly and professional. Avoid jargon when talking to non-technical users.
6. Always cite which article(s) you used at the end of your response in the format:
   📖 Source: [Article Title]
7. Never make up facts, URLs, or procedures that aren't in the provided articles.
8. If the user seems frustrated or the issue persists, suggest creating a support ticket.\
"""

# Few-shot examples appended to the system prompt
FEW_SHOT_EXAMPLES = """
---
Example interactions:

User: How do I reset my password?
Assistant: To reset your password:
1. Go to the login page and click **"Forgot Password"**.
2. Enter your email address and click **Submit**.
3. Check your inbox for a reset link (valid for 24 hours).
4. Click the link and choose a new password.
📖 Source: [How to Reset Your Password]

User: Show me frequently asked questions
Assistant: Here are some helpful articles that might assist you:
📖 Source: [Browser Troubleshooting Guide]
📖 Source: [How to Reset Your Password]
📖 Source: [Printer Troubleshooting Guide]

User: What articles do you have?
Assistant: Here are some helpful articles that might assist you:
📖 Source: [How to Request Software Installation]
📖 Source: [Advanced Search Techniques]
📖 Source: [How to Reset Your Password]

User: My laptop screen is blank.
Assistant: I don't have enough information to fully answer that. Let me create a support ticket for you.
---"""


def build_prompt(
    user_message: str,
    articles: List[RetrievedArticle],
    conversation_history: Optional[List[Dict[str, str]]] = None,
    user_role: str = "customer",
) -> Tuple[List[Dict[str, str]], str]:
    """
    Construct the OpenAI messages array for a RAG-grounded response.

    Returns:
        (messages_list, condensed_system_prompt_for_logging)
    """
    # System message
    system_content = SYSTEM_PROMPT

    if user_role in ("tech", "technician", "admin"):
        system_content += (
            "\n\nNote: The user is a technical staff member. "
            "You may include more technical details and diagnostic steps."
        )
    else:
        system_content += (
            "\n\nNote: The user is a non-technical customer. "
            "Keep explanations simple and step-by-step."
        )

    system_content += FEW_SHOT_EXAMPLES

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_content}]

    # Inject conversation history (last N turns, already truncated upstream)
    if conversation_history:
        messages.extend(conversation_history)

    # Knowledge base context block
    if articles:
        kb_block_lines = ["Knowledge Base Articles (use ONLY this information):"]
        for i, art in enumerate(articles, 1):
            # Trim content to ~400 chars per article to stay within token budget
            body = art.content[:400].rstrip()
            if len(art.content) > 400:
                body += "…"
            kb_block_lines.append(
                f"\n[Article {i}] Title: {art.title}\nCategory: {art.category}\n{body}"
            )
        kb_context = "\n".join(kb_block_lines)
    else:
        kb_context = (
            "No relevant knowledge base articles were found for this query. "
            "You MUST say you don't have enough information and offer to create a ticket."
        )

    # User message with KB context
    user_content = f"{kb_context}\n\n---\nUser Question: {user_message}"
    messages.append({"role": "user", "content": user_content})

    return messages, system_content[:80]


# ---------------------------------------------------------------------------
# Escalation detector
# ---------------------------------------------------------------------------

_ESCALATION_PHRASES = [
    "i don't have enough information",
    "don't have enough information",
    "create a support ticket",
    "let me create a",
    "i cannot help",
    "cannot assist",
    "speak to a human",
    "contact support",
]


def should_escalate(response_text: str) -> bool:
    """Return True if the LLM response signals it cannot help."""
    lc = response_text.lower()
    return any(phrase in lc for phrase in _ESCALATION_PHRASES)


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------


def run_rag_pipeline(
    query: str,
    llm_service,           # injected llm_service module (avoids circular import)
    user_id: Optional[int] = None,
    conversation_id: Optional[int] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    user_role: str = "customer",
    top_k: int = RAG_TOP_K,
    use_cache: bool = True,
) -> RAGResponse:
    """
    Execute the full RAG pipeline and return a structured RAGResponse.

    Steps:
      1. Check response cache
      2. Embed query
      3. Vector search for relevant articles
      4. Build prompt
      5. Call LLM
      6. Save to cache + log usage
    """
    start_ms = int(time.time() * 1000)
    conn = None

    try:
        conn = _get_conn()

        # 1. Cache check (skip if conversation history changes context)
        cache_key = _cache_key(query, llm_service.get_model_name(), top_k)
        if use_cache and not conversation_history:
            cached = get_cached_response(conn, cache_key)
            if cached:
                logger.info("RAG cache hit for key=%s", cache_key[:12])
                latency = int(time.time() * 1000) - start_ms
                # Rebuild article objects for display (no content needed from cache)
                return RAGResponse(
                    answer=cached["response_text"],
                    citations=[],
                    model_used=cached.get("model_used", ""),
                    prompt_tokens=cached.get("prompt_tokens", 0),
                    completion_tokens=cached.get("completion_tokens", 0),
                    latency_ms=latency,
                    cache_hit=True,
                    escalate=should_escalate(cached["response_text"]),
                )

        # 2. Embed query
        query_embedding = llm_service.embed_text(query)

        # 3. Vector search
        articles = semantic_search(conn, query_embedding, top_k=top_k,
                                   min_similarity=RAG_MIN_SIMILARITY)
        logger.info("RAG retrieved %d articles for query (first 60 chars): %.60s",
                    len(articles), query)

        # 4. Build prompt
        messages, _ = build_prompt(
            user_message=query,
            articles=articles,
            conversation_history=conversation_history,
            user_role=user_role,
        )

        # 5. Call LLM
        llm_result = llm_service.chat_completion(messages)

        answer = llm_result["content"]
        prompt_tokens = llm_result.get("prompt_tokens", 0)
        completion_tokens = llm_result.get("completion_tokens", 0)
        model_used = llm_result.get("model", llm_service.get_model_name())
        cost_usd = llm_result.get("cost_usd", 0.0)
        fallback_used = llm_result.get("fallback", False)

        latency_ms = int(time.time() * 1000) - start_ms

        # 6a. Save to cache (only for top-level queries without history)
        if use_cache and not conversation_history:
            save_cached_response(
                conn, cache_key, query, answer,
                [a.id for a in articles],
                model_used, prompt_tokens, completion_tokens,
            )

        # 6b. Log usage
        log_llm_usage(
            conn, user_id, conversation_id,
            prompt_tokens, completion_tokens,
            model_used, cost_usd, latency_ms,
            len(articles), False, fallback_used,
        )

        # Build citation list for the frontend
        citations = [
            {
                "id": a.id,
                "title": a.title,
                "slug": a.slug,
                "category": a.category,
                "excerpt": a.excerpt,
                "similarity": round(a.similarity, 3),
            }
            for a in articles
        ]

        return RAGResponse(
            answer=answer,
            articles=articles,
            citations=citations,
            model_used=model_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            cache_hit=False,
            fallback_used=fallback_used,
            escalate=should_escalate(answer),
        )

    except Exception as exc:
        logger.error("RAG pipeline error: %s", exc, exc_info=True)
        raise
    finally:
        if conn:
            conn.close()
