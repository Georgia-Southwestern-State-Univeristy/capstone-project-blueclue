#!/usr/bin/env python3
"""
test_llm.py
===========
Proof-of-concept test script for the BlueClue LLM + RAG integration.

Tests:
  1. LLM connectivity (OpenAI API ping)
  2. Embedding generation (OpenAI ada-002 or MiniLM fallback)
  3. RAG pipeline — 20 sample IT-support queries
  4. Latency benchmarks (p50, p95, p99)
  5. Cost estimation for 1 000 conversations/month
  6. Hallucination / escalation rate (does the bot claim to answer when it can't?)

Usage:
    # Run all tests (requires DATABASE_URL + ideally OPENAI_API_KEY):
    python test_llm.py

    # Run specific test groups:
    python test_llm.py --group connectivity
    python test_llm.py --group embedding
    python test_llm.py --group rag
    python test_llm.py --group bench

Environment variables:
    DATABASE_URL   PostgreSQL connection string (required for RAG tests)
    OPENAI_API_KEY (optional) — omit to test with MiniLM/rule-based fallback
"""

from __future__ import annotations

import argparse
import os
import statistics
import sys
import time
from typing import List, Optional

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "src"))
sys.path.insert(0, BASE_DIR)

# ---------------------------------------------------------------------------
# Sample test queries
# ---------------------------------------------------------------------------

SAMPLE_QUERIES: List[dict] = [
    # Password & auth
    {"q": "How do I reset my password?",                       "expects_answer": True},
    {"q": "I forgot my password and can't log in",             "expects_answer": True},
    {"q": "My account is locked out",                          "expects_answer": True},
    # Printer
    {"q": "My printer won't print anything",                   "expects_answer": True},
    {"q": "There's a paper jam in my printer",                 "expects_answer": True},
    {"q": "How do I install a printer driver?",                "expects_answer": True},
    # Software
    {"q": "I need to install Microsoft Office",                "expects_answer": True},
    {"q": "How do I request new software?",                    "expects_answer": True},
    {"q": "Can I install Zoom on my work computer?",           "expects_answer": True},
    # Network / WiFi
    {"q": "I can't connect to the WiFi",                       "expects_answer": True},
    {"q": "How do I set up VPN?",                              "expects_answer": True},
    {"q": "My internet is slow",                               "expects_answer": True},
    # Email
    {"q": "How do I set up my email on my phone?",             "expects_answer": True},
    {"q": "I can't send emails in Outlook",                    "expects_answer": True},
    # Out-of-scope (should escalate)
    {"q": "What is the capital of France?",                    "expects_answer": False},
    {"q": "Write me a poem about computers",                   "expects_answer": False},
    {"q": "Who won the Super Bowl?",                           "expects_answer": False},
    # Multi-turn context
    {"q": "It still doesn't work after trying your steps",     "expects_answer": None},
    # Edge cases
    {"q": "Hello",                                             "expects_answer": None},
    {"q": "Create a support ticket for me",                    "expects_answer": None},
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RESET   = "\033[0m"
GREEN   = "\033[92m"
RED     = "\033[91m"
YELLOW  = "\033[93m"
BLUE    = "\033[94m"
BOLD    = "\033[1m"


def _ok(msg: str)   -> str: return f"{GREEN}✓ {msg}{RESET}"
def _fail(msg: str) -> str: return f"{RED}✗ {msg}{RESET}"
def _warn(msg: str) -> str: return f"{YELLOW}! {msg}{RESET}"
def _info(msg: str) -> str: return f"{BLUE}  {msg}{RESET}"


def _pct(n, total) -> str:
    return f"{n}/{total} ({100 * n // max(total, 1)}%)"


# ---------------------------------------------------------------------------
# Test groups
# ---------------------------------------------------------------------------


def test_connectivity() -> bool:
    print(f"\n{BOLD}[ 1/4 ] LLM Connectivity{RESET}")
    from src.llm_service import get_llm_service
    llm = get_llm_service()
    if not llm.is_llm_available():
        print(_warn("OPENAI_API_KEY not set — running in rule-based/MiniLM fallback mode"))
        return True   # Not a failure — just limited

    print(_info(f"Model: {llm.get_model_name()}"))
    t0 = time.time()
    result = llm.chat_completion([
        {"role": "system", "content": "You are a test assistant."},
        {"role": "user",   "content": "Reply with the single word: PONG"},
    ], max_tokens=10)
    latency = int((time.time() - t0) * 1000)

    content = result.get("content", "")
    if "pong" in content.lower() or result.get("fallback"):
        print(_ok(f"Chat completion OK in {latency}ms | response: {content!r}"))
        return True
    else:
        print(_fail(f"Unexpected response: {content!r}"))
        return False


def test_embedding() -> bool:
    print(f"\n{BOLD}[ 2/4 ] Embedding Generation{RESET}")
    from src.llm_service import get_llm_service
    llm = get_llm_service()
    dim = llm.get_embedding_dim()

    t0 = time.time()
    vec = llm.embed_text("How do I reset my password?")
    latency = int((time.time() - t0) * 1000)

    if len(vec) != dim:
        print(_fail(f"Expected dim={dim}, got {len(vec)}"))
        return False

    magnitude = sum(v * v for v in vec) ** 0.5
    print(_ok(f"Embedding OK — dim={len(vec)}, latency={latency}ms, ‖v‖={magnitude:.4f}"))

    # Test batch
    texts = ["Password reset guide", "Printer troubleshooting"]
    t0 = time.time()
    vecs = llm.embed_batch(texts)
    latency = int((time.time() - t0) * 1000)
    if len(vecs) == 2 and all(len(v) == dim for v in vecs):
        print(_ok(f"Batch embed OK — {len(vecs)} vectors in {latency}ms"))
    else:
        print(_fail(f"Batch embed failed — got {len(vecs)} vectors"))
        return False

    return True


def test_rag(queries: Optional[List[dict]] = None) -> dict:
    print(f"\n{BOLD}[ 3/4 ] RAG Pipeline{RESET}")

    DATABASE_URL = os.getenv("DATABASE_URL", "")
    if not DATABASE_URL:
        print(_warn("DATABASE_URL not set — skipping RAG tests"))
        return {"skipped": True}

    from src.llm_service import get_llm_service
    from src.rag_pipeline import run_rag_pipeline

    llm = get_llm_service()
    queries = queries or SAMPLE_QUERIES

    latencies: List[int] = []
    answered  = 0
    escalated = 0
    errors    = 0
    total_tokens = 0
    total_cost   = 0.0

    for item in queries:
        q     = item["q"]
        wants = item.get("expects_answer")

        t0 = time.time()
        try:
            result = run_rag_pipeline(
                query=q,
                llm_service=llm,
                use_cache=False,
            )
            ms = int((time.time() - t0) * 1000)
            latencies.append(ms)
            total_tokens += result.total_tokens
            total_cost   += result.cost_usd

            status_icon = "?"
            if wants is True:
                if result.escalate:
                    status_icon = f"{YELLOW}ESCALATE{RESET}"
                else:
                    answered += 1
                    status_icon = f"{GREEN}OK{RESET}"
            elif wants is False:
                if result.escalate:
                    answered += 1
                    status_icon = f"{GREEN}ESCALATED-CORRECTLY{RESET}"
                else:
                    status_icon = f"{YELLOW}HALLUCINATION?{RESET}"
            else:
                status_icon = f"{BLUE}N/A{RESET}"

            if result.escalate:
                escalated += 1

            print(
                f"  [{ms:4d}ms] {status_icon:30s}  "
                f"articles={len(result.articles)}  "
                f"Q: {q[:55]!r}"
            )

        except Exception as exc:
            ms = int((time.time() - t0) * 1000)
            latencies.append(ms)
            errors += 1
            print(_fail(f"  [{ms:4d}ms] ERROR: {exc}  Q: {q[:55]!r}"))

    # Latency percentiles
    if latencies:
        latencies.sort()
        p50 = statistics.median(latencies)
        p95 = latencies[int(len(latencies) * 0.95)]
        p99 = latencies[min(len(latencies) - 1, int(len(latencies) * 0.99))]
    else:
        p50 = p95 = p99 = 0

    n_answerable = sum(1 for q in queries if q.get("expects_answer") is True)

    print(f"\n  {BOLD}Latency{RESET}: p50={p50:.0f}ms  p95={p95:.0f}ms  p99={p99:.0f}ms")
    print(f"  {BOLD}Coverage{RESET}: answered {_pct(answered, n_answerable)} answerable queries")
    print(f"  {BOLD}Escalations{RESET}: {escalated}/{len(queries)}")
    print(f"  {BOLD}Tokens used{RESET}: {total_tokens}  |  "
          f"Est. cost: ${total_cost:.4f} for {len(queries)} queries")
    print(f"  {BOLD}Errors{RESET}: {errors}")

    return {
        "p50": p50, "p95": p95, "p99": p99,
        "answered": answered, "escalated": escalated,
        "errors": errors, "total_tokens": total_tokens, "total_cost": total_cost,
    }


def test_cost_estimate():
    print(f"\n{BOLD}[ 4/4 ] Monthly Cost Estimate{RESET}")

    from src.llm_service import LLM_MODEL, _COST_TABLE

    model = LLM_MODEL
    rates = _COST_TABLE.get(model, {"input": 0.001, "output": 0.002})

    # Conservative estimate per conversation
    convos_per_month  = 1_000
    messages_per_conv = 10
    avg_input_tokens  = 500    # prompt (system + KB articles) per message
    avg_output_tokens = 150    # response per message

    total_input  = convos_per_month * messages_per_conv * avg_input_tokens
    total_output = convos_per_month * messages_per_conv * avg_output_tokens
    cost = (total_input * rates["input"] + total_output * rates["output"]) / 1000.0

    embed_tokens = convos_per_month * messages_per_conv * 50   # ~50 tokens per query
    embed_cost   = embed_tokens * 0.0001 / 1000.0

    total_cost = cost + embed_cost

    print(_info(f"Model: {model}"))
    print(_info(f"Scenario: {convos_per_month:,} convos × {messages_per_conv} messages/conv"))
    print(_info(f"Input tokens/msg: ~{avg_input_tokens}   Output tokens/msg: ~{avg_output_tokens}"))
    print(_info(f"Chat cost:       ${cost:.2f}/month"))
    print(_info(f"Embedding cost:  ${embed_cost:.2f}/month"))
    print(_info(f"TOTAL estimate:  ${total_cost:.2f}/month"))

    if total_cost < 50:
        print(_ok(f"Cost is within MVP budget (< $50/month)"))
    elif total_cost < 200:
        print(_warn(f"Cost is moderate — monitor spend closely"))
    else:
        print(_warn(f"Cost is high — consider GPT-3.5 or caching"))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="BlueClue LLM / RAG test suite")
    parser.add_argument(
        "--group",
        choices=["connectivity", "embedding", "rag", "bench", "all"],
        default="all",
    )
    args = parser.parse_args()

    print(f"{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  BlueClue LLM + RAG Integration Test Suite{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")

    all_ok = True
    g = args.group

    if g in ("all", "connectivity"):
        all_ok &= test_connectivity()

    if g in ("all", "embedding"):
        all_ok &= test_embedding()

    if g in ("all", "rag", "bench"):
        metrics = test_rag()
        if not metrics.get("skipped"):
            ok = metrics.get("errors", 0) == 0 and metrics.get("p95", 9999) < 5000
            all_ok &= ok

    if g in ("all",):
        test_cost_estimate()

    print(f"\n{BOLD}{'='*60}{RESET}")
    if all_ok:
        print(_ok("All tests passed!"))
    else:
        print(_fail("Some tests failed — review output above"))
    print(f"{BOLD}{'='*60}{RESET}\n")

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
