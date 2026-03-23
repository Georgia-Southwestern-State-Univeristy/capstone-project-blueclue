"""
BlueClue LLM Service
====================
Provides embedding generation and chat completion over:
  - OpenAI (gpt-3.5-turbo, gpt-4-turbo, gpt-4o-mini, text-embedding-ada-002)
  - Sentence-transformers MiniLM fallback (free, no API key required)

Designed to be injected into the RAG pipeline so that the embedding and chat
backends can be swapped without modifying the pipeline logic.

Usage example (from FastAPI startup):
    from src.llm_service import LLMService
    llm = LLMService()        # auto-detects from env vars
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("blueclue.llm")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL        = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
LLM_BASE_URL     = os.getenv("LLM_BASE_URL", "")           # e.g. Azure OpenAI endpoint
LLM_TEMPERATURE  = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS   = int(os.getenv("LLM_MAX_TOKENS", "250"))
LLM_TIMEOUT_SEC  = int(os.getenv("LLM_TIMEOUT_SEC", "15"))
LLM_MAX_RETRIES  = int(os.getenv("LLM_MAX_RETRIES", "2"))

EMBEDDING_MODEL  = os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002")
EMBEDDING_DIM    = int(os.getenv("EMBEDDING_DIM", "1536"))

# Cost per 1K tokens (USD) — used for spend tracking
_COST_TABLE: Dict[str, Dict[str, float]] = {
    "gpt-3.5-turbo":             {"input": 0.001,   "output": 0.002},
    "gpt-3.5-turbo-0125":        {"input": 0.0005,  "output": 0.0015},
    "gpt-4-turbo":               {"input": 0.01,    "output": 0.03},
    "gpt-4o":                    {"input": 0.005,   "output": 0.015},
    "gpt-4o-mini":               {"input": 0.00015, "output": 0.0006},
    # Embedding models
    "text-embedding-ada-002":    {"input": 0.0001,  "output": 0.0},
    # text-embedding-3-small: ~5× cheaper than ada-002, MTEB score 62.3 vs 61.0
    "text-embedding-3-small":    {"input": 0.00002, "output": 0.0},
    # text-embedding-3-large: highest quality, 3072-dim (truncated to 1536 here)
    "text-embedding-3-large":    {"input": 0.00013, "output": 0.0},
}

# Dimension produced by each embedding model
# text-embedding-3-small and ada-002 both output 1536-dim by default
_EMBEDDING_DIMS: Dict[str, int] = {
    "text-embedding-ada-002":  1536,
    "text-embedding-3-small":  1536,   # default; can request lower via 'dimensions'
    "text-embedding-3-large":  1536,   # capped at 1536 to match existing DB columns
    "all-MiniLM-L6-v2":        384,
    "minilm-local":            384,
}


def _estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    rates = _COST_TABLE.get(model, {"input": 0.001, "output": 0.002})
    return (prompt_tokens * rates["input"] + completion_tokens * rates["output"]) / 1000.0


# ---------------------------------------------------------------------------
# Sentence-transformers fallback embedder (free, local)
# ---------------------------------------------------------------------------

class _MiniLMEmbedder:
    """
    Free local sentence-transformer embedder.
    Produces 384-dim vectors (requires sentence-transformers installed).
    Falls back to zero-vectors if sentence-transformers is unavailable.
    """
    _model = None
    _available: Optional[bool] = None

    @classmethod
    def _load(cls):
        if cls._available is not None:
            return cls._available
        try:
            from sentence_transformers import SentenceTransformer  # noqa: F401
            cls._model = SentenceTransformer("all-MiniLM-L6-v2")
            cls._available = True
            logger.info("MiniLM embedder loaded (384-dim, free)")
        except Exception as exc:
            logger.warning("sentence-transformers not available: %s — embeddings disabled", exc)
            cls._available = False
        return cls._available

    @classmethod
    def embed(cls, text: str) -> List[float]:
        if not cls._load():
            return [0.0] * 384          # zero-vector fallback
        return cls._model.encode(text, normalize_embeddings=True).tolist()


# ---------------------------------------------------------------------------
# Main LLM service class
# ---------------------------------------------------------------------------

class LLMService:
    """
    Unified LLM + Embedding service.

    Auto-selects backend based on environment:
      - OPENAI_API_KEY set  → OpenAI API (embeddings + chat)
      - No API key          → MiniLM embeddings + rule-based (no chat)
    """

    def __init__(self):
        self._openai_client = None
        self._use_openai = bool(OPENAI_API_KEY)
        self._model = LLM_MODEL
        self._embedding_model = EMBEDDING_MODEL

        if self._use_openai:
            self._init_openai()
        else:
            logger.warning(
                "OPENAI_API_KEY not set — LLM chat disabled, "
                "using MiniLM embeddings (free)"
            )
            # Warm up MiniLM embedder in background
            _MiniLMEmbedder._load()

    # ------------------------------------------------------------------
    # Internal OpenAI initialisation
    # ------------------------------------------------------------------

    def _init_openai(self):
        try:
            from openai import OpenAI, AzureOpenAI
            if LLM_BASE_URL:
                # Azure OpenAI or custom endpoint
                self._openai_client = AzureOpenAI(
                    api_key=OPENAI_API_KEY,
                    azure_endpoint=LLM_BASE_URL,
                    api_version="2024-02-01",
                )
                logger.info("OpenAI client (Azure) initialised — model=%s", self._model)
            else:
                self._openai_client = OpenAI(
                    api_key=OPENAI_API_KEY,
                    timeout=LLM_TIMEOUT_SEC,
                    max_retries=LLM_MAX_RETRIES,
                )
                logger.info("OpenAI client initialised — model=%s", self._model)
        except ImportError:
            logger.error("openai package not installed — run: pip install openai")
            self._use_openai = False
            self._openai_client = None

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def is_llm_available(self) -> bool:
        return self._use_openai and self._openai_client is not None

    def get_model_name(self) -> str:
        if self._use_openai:
            return self._model
        return "minilm-local"

    def get_embedding_dim(self) -> int:
        if self._use_openai:
            return _EMBEDDING_DIMS.get(self._embedding_model, 1536)
        return 384

    # ------------------------------------------------------------------
    # Embedding
    # ------------------------------------------------------------------

    def get_embedding_model_name(self) -> str:
        """Return the name of the active embedding model."""
        if self._use_openai:
            return self._embedding_model
        return "all-MiniLM-L6-v2"

    def embed_text(self, text: str) -> List[float]:
        """
        Generate an embedding vector for `text`.
        - OpenAI ada-002 (1536-dim): legacy default
        - OpenAI text-embedding-3-small (1536-dim): recommended upgrade
        - OpenAI text-embedding-3-large (truncated to 1536-dim)
        - MiniLM (384-dim): free local fallback
        """
        if not self._use_openai or self._openai_client is None:
            return _MiniLMEmbedder.embed(text)

        try:
            kwargs: Dict[str, Any] = {
                "model": self._embedding_model,
                "input": text[:8191],   # token limit for all OpenAI embedding models
            }
            # text-embedding-3-large defaults to 3072 dims; cap at 1536 to match DB
            if self._embedding_model == "text-embedding-3-large":
                kwargs["dimensions"] = 1536
            resp = self._openai_client.embeddings.create(**kwargs)
            return resp.data[0].embedding
        except Exception as exc:
            logger.warning("OpenAI embed_text failed (%s) — using MiniLM fallback", exc)
            return _MiniLMEmbedder.embed(text)

    def embed_batch(self, texts: List[str], batch_size: int = 20) -> List[List[float]]:
        """
        Embed a list of texts in batches.
        Returns a list of embedding vectors in the same order as inputs.
        """
        results: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            chunk = texts[i: i + batch_size]
            if self._use_openai and self._openai_client:
                try:
                    kwargs: Dict[str, Any] = {
                        "model": self._embedding_model,
                        "input": [t[:8191] for t in chunk],
                    }
                    if self._embedding_model == "text-embedding-3-large":
                        kwargs["dimensions"] = 1536
                    resp = self._openai_client.embeddings.create(**kwargs)
                    results.extend([d.embedding for d in resp.data])
                    continue
                except Exception as exc:
                    logger.warning("Batch embed OpenAI failed (%s) — MiniLM fallback", exc)
            # Fallback: MiniLM one-by-one
            results.extend([_MiniLMEmbedder.embed(t) for t in chunk])
        return results

    # ------------------------------------------------------------------
    # Chat completion
    # ------------------------------------------------------------------

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Send messages to the chat model and return a result dict:
          {content, model, prompt_tokens, completion_tokens, cost_usd, fallback}
        """
        if not self._use_openai or self._openai_client is None:
            return self._rule_based_fallback(messages)

        temp = temperature if temperature is not None else LLM_TEMPERATURE
        max_tok = max_tokens if max_tokens is not None else LLM_MAX_TOKENS

        # Safety: strip prompt-injection attempts from user messages
        safe_messages = []
        for m in messages:
            content = m["content"]
            if m["role"] == "user":
                content = _sanitise_user_input(content)
            safe_messages.append({"role": m["role"], "content": content})

        try:
            resp = self._openai_client.chat.completions.create(
                model=self._model,
                messages=safe_messages,
                temperature=temp,
                max_tokens=max_tok,
            )
            content = resp.choices[0].message.content.strip()
            usage = resp.usage
            pt = usage.prompt_tokens if usage else 0
            ct = usage.completion_tokens if usage else 0
            cost = _estimate_cost(self._model, pt, ct)

            return {
                "content": content,
                "model": self._model,
                "prompt_tokens": pt,
                "completion_tokens": ct,
                "cost_usd": cost,
                "fallback": False,
            }

        except Exception as exc:
            logger.error("OpenAI chat_completion error: %s — falling back", exc, exc_info=True)
            return self._rule_based_fallback(messages)

    # ------------------------------------------------------------------
    # Moderation (optional — call before storing user messages)
    # ------------------------------------------------------------------

    def moderate_text(self, text: str) -> Dict[str, Any]:
        """
        Run OpenAI moderation API.
        Returns {"flagged": bool, "categories": dict}.
        """
        if not self._use_openai or self._openai_client is None:
            return {"flagged": False, "categories": {}}
        try:
            resp = self._openai_client.moderations.create(input=text)
            result = resp.results[0]
            return {
                "flagged": result.flagged,
                "categories": {k: v for k, v in result.categories.__dict__.items() if v},
            }
        except Exception as exc:
            logger.warning("Moderation API failed: %s", exc)
            return {"flagged": False, "categories": {}}

    # ------------------------------------------------------------------
    # Rule-based fallback (no LLM available)
    # ------------------------------------------------------------------

    @staticmethod
    def _rule_based_fallback(messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        When OpenAI is unavailable, return a safe canned response
        that signals the frontend to fall back to rule-based matching.
        """
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            "",
        )
        fallback_text = (
            "I'm having trouble connecting to the AI service right now. "
            "Let me still try to help — could you describe your issue in a bit more detail, "
            "or I can create a support ticket for you."
        )
        return {
            "content": fallback_text,
            "model": "rule-based-fallback",
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "cost_usd": 0.0,
            "fallback": True,
        }


# ---------------------------------------------------------------------------
# Input sanitisation (prompt injection prevention)
# ---------------------------------------------------------------------------

_INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore all previous",
    "disregard the above",
    "forget everything",
    "new instructions:",
    "system prompt:",
    "you are now",
    "act as",
    "jailbreak",
    "dan mode",
]


def _sanitise_user_input(text: str) -> str:
    """
    Strip obvious prompt-injection attempts from user input.
    The text is still passed to the LLM but the malicious framing is removed.
    """
    lc = text.lower()
    flagged = any(p in lc for p in _INJECTION_PATTERNS)
    if flagged:
        logger.warning("Prompt injection attempt detected and sanitised")
        # Replace full message with a safe version
        return "[User input was sanitised for security reasons] " + text[:200]
    return text


# ---------------------------------------------------------------------------
# Module-level singleton (imported by app.py)
# ---------------------------------------------------------------------------

_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Return the module-level LLMService singleton, creating it if needed."""
    global _service
    if _service is None:
        _service = LLMService()
    return _service
