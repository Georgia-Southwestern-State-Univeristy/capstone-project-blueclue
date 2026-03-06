# BlueClue LLM + RAG Integration Guide

## Overview

BlueClue's chatbot uses **Retrieval-Augmented Generation (RAG)** to deliver accurate, grounded responses. Instead of relying on a large language model's memorized knowledge alone, every answer is pulled directly from the live Knowledge Base — eliminating hallucinations and keeping information current without any model retraining.

```
User message
     │
     ▼
[chatService.js]
     │
     ├─── LLM path (primary) ────────────────────────────────────────────────┐
     │          │                                                             │
     │    [llmService.js]  ──HTTP──▶  Python AI service (/rag/chat)         │
     │                                     │                                 │
     │                               1. Embed query                         │
     │                               2. pgvector search (top-5 articles)    │
     │                               3. Build grounded prompt                │
     │                               4. Call GPT-3.5/4 API                  │
     │                               5. Return answer + citations            │
     │                                     │                                 │
     │    ◀─────── answer + citations ──────┘                                │
     │                                                                       │
     └─── Rule-based fallback (if LLM service is down / OPENAI_API_KEY unset)
```

---

## How RAG Works

### Step 1 — Embed the user's query
The user message is converted to a vector (list of numbers) using OpenAI's `text-embedding-ada-002` model (or the free MiniLM model if no API key is set). This captures the *meaning* of the question, not just the keywords.

### Step 2 — Semantic search over the Knowledge Base
That vector is compared against pre-computed vectors for every published KB article using **cosine similarity** in PostgreSQL with the `pgvector` extension. The top 5 most relevant articles are retrieved.

### Step 3 — Construct a grounded prompt
The retrieved articles are injected into the LLM prompt:
```
System: You are BlueClue Assistant. Answer using ONLY the knowledge base
        articles below. If the answer isn't there, say you don't have
        enough information and offer to create a ticket.

Knowledge Base Articles:
[Article 1] Title: How to Reset Your Password
  To reset your password, go to the login page and click "Forgot Password"...

[Article 2] Title: WiFi Setup Guide
  ...

User Question: I forgot my password and can't log in
```

### Step 4 — Generate a response
The LLM reads only the provided articles and generates a concise answer with source citations.

### Why RAG instead of a plain LLM?

| Problem | Solution |
|---------|----------|
| LLM makes up facts (hallucination) | Prompt explicitly restricts to provided articles |
| KB content changes frequently | Re-embed articles on update, no model retraining |
| Can't know company-specific procedures | Articles are in the prompt — model reads them live |
| Hard to know where info came from | Every response cites the source article |

---

## Architecture

### Files Added / Modified

```
blueclue/
├── ai/
│   ├── src/
│   │   ├── llm_service.py          ← OpenAI client + MiniLM fallback, moderation
│   │   └── rag_pipeline.py         ← Full RAG pipeline (embed → search → prompt → LLM)
│   ├── generate_embeddings.py      ← CLI: embed all KB articles into pgvector
│   ├── test_llm.py                 ← Test suite for LLM + RAG validation
│   ├── requirements.txt            ← Added: openai, sentence-transformers, pgvector
│   └── Dockerfile                  ← Added: libpq-dev, MiniLM pre-download
│
├── backend/src/
│   ├── services/
│   │   ├── llmService.js           ← Node bridge: rate limit, cache, ticket summarize
│   │   └── chatService.js          ← LLM-first with rule-based fallback
│   ├── controllers/
│   │   └── chatController.js       ← LLM ticket summarization, /llm/health endpoint
│   └── routes/
│       └── chat.js                 ← Added GET /api/chat/llm/health
│
└── database/migrations/
    └── 029_add_pgvector_rag.sql    ← pgvector extension + 3 new tables
```

### New Database Tables

| Table | Purpose |
|-------|---------|
| `article_embeddings` | Stores one 1536-dim (or 384-dim) vector per KB article |
| `llm_response_cache` | Caches LLM answers by query hash (TTL: 1 hour) |
| `llm_usage_logs` | Token + cost tracking per request for spend monitoring |

---

## Railway Setup

### Which service gets which variables?

Your Railway project has this layout:

```
ml-service   (root dir: blueclue/ai)    ← OPENAI_API_KEY goes HERE
backend      (root dir: blueclue/backend)
frontend     (root dir: blueclue/frontend)
database     (Railway Postgres plugin)
```

The Python code (`llm_service.py`, `rag_pipeline.py`) runs in `ml-service` — so all OpenAI and embedding configuration lives there. The Node.js backend only needs lightweight control flags.

---

### Variables for `ml-service` (Railway → ml-service → Variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | — | From [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `DATABASE_URL` | ✅ Yes | (auto-injected) | Railway auto-provides this from the Postgres plugin |
| `LLM_MODEL` | Recommended | `gpt-3.5-turbo` | See model comparison below |
| `LLM_TEMPERATURE` | No | `0.7` | 0 = consistent, 1 = creative |
| `LLM_MAX_TOKENS` | No | `250` | Max response length |
| `LLM_TIMEOUT_SEC` | No | `15` | Hard timeout per OpenAI call |
| `EMBEDDING_MODEL` | No | `text-embedding-ada-002` | OpenAI embedding model |
| `EMBEDDING_DIM` | No | `1536` | Must match embedding model |
| `RAG_TOP_K` | No | `5` | Articles retrieved per query |
| `RAG_MIN_SIMILARITY` | No | `0.35` | Min cosine similarity (0–1) |
| `RAG_CACHE_TTL` | No | `3600` | LLM response cache TTL (seconds) |

> **`DATABASE_URL` is auto-injected by Railway** when your service is linked to the Postgres plugin. You should already have it — it's the same one used by the backend.

---

### Variables for `backend` (Railway → backend → Variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_SERVICE_URL` | ✅ Yes | — | Internal Railway URL of the ml-service |
| `LLM_ENABLED` | No | `true` | Set to `false` to disable LLM (rule-based only) |
| `LLM_RATE_LIMIT` | No | `10` | Max messages per user per minute |
| `LLM_DAILY_BUDGET` | No | `1.00` | Max USD per user per day |
| `LLM_HISTORY_TURNS` | No | `5` | Prior turns passed as context |
| `LLM_TIMEOUT_MS` | No | `15000` | HTTP timeout to RAG endpoint |

---

### Choosing a model

| Model | Cost (input/output) | Quality | Speed | Recommendation |
|-------|---------------------|---------|-------|----------------|
| `gpt-3.5-turbo` | $0.0005 / $0.0015 per 1K tokens | Good | Fast | ✅ **Start here** |
| `gpt-4o-mini` | $0.00015 / $0.0006 per 1K tokens | Very Good | Fast | ✅ Best value |
| `gpt-4-turbo` | $0.01 / $0.03 per 1K tokens | Excellent | Slower | For quality-critical use |
| `gpt-4o` | $0.005 / $0.015 per 1K tokens | Excellent | Fast | Production upgrade |

**Estimated monthly cost (1,000 conversations, 10 messages each):**
- `gpt-3.5-turbo`: ~$6–12/month
- `gpt-4o-mini`: ~$2–4/month ← **cheapest good option**
- `gpt-4-turbo`: ~$150–300/month

---

## First-Time Deployment

### 1. Run the database migration

```powershell
$db = "postgresql://postgres:PASSWORD@caboose.proxy.rlwy.net:PORT/railway"
psql $db -f blueclue/database/migrations/029_add_pgvector_rag.sql
```

This enables `pgvector` and creates the three new tables. Safe to run on an existing database.

### 2. Add environment variables on Railway

Go to: **Railway Dashboard → ml-service → Variables**

Add at minimum:
```
OPENAI_API_KEY   =  sk-...
LLM_MODEL        =  gpt-4o-mini
```

`DATABASE_URL` should already be there (auto-injected by Railway).

### 3. Deploy

Push your branch to trigger a Railway deploy. On startup, the ML service:
1. Loads all ML models (existing behaviour)
2. Initialises the LLM service (new)
3. Starts a background thread that auto-embeds any KB articles missing embeddings

### 4. Verify embeddings

```powershell
# Check coverage via the API
curl https://your-ml-service.railway.app/rag/embeddings/status
```

Or run the script locally (one-time):
```powershell
cd blueclue/ai
$env:DATABASE_URL = "postgresql://..."
$env:OPENAI_API_KEY = "sk-..."
python generate_embeddings.py
```

### 5. Test the integration

```powershell
cd blueclue/ai
$env:DATABASE_URL = "postgresql://..."
$env:OPENAI_API_KEY = "sk-..."
python test_llm.py
```

Expected output:
```
✓ Chat completion OK in 843ms
✓ Embedding OK — dim=1536, latency=210ms
  [ 921ms] OK         articles=2  Q: 'How do I reset my password?'
  [ 807ms] OK         articles=3  Q: 'My printer won't print anything'
  ...
  Latency: p50=850ms  p95=1920ms  p99=2400ms
```

---

## API Reference

### `POST /rag/chat`
**Service:** ml-service (Python)

Embeds the user message, retrieves relevant articles, and returns a grounded LLM response.

**Request:**
```json
{
  "message": "How do I reset my password?",
  "user_id": 42,
  "conversation_id": 7,
  "conversation_history": [
    { "role": "user",      "content": "I can't log in" },
    { "role": "assistant", "content": "Have you tried resetting your password?" }
  ],
  "user_role": "customer",
  "use_cache": true,
  "top_k": 5
}
```

**Response:**
```json
{
  "answer": "To reset your password:\n1. Go to the login page and click **Forgot Password**...\n📖 Source: [How to Reset Your Password]",
  "citations": [
    {
      "id": 3,
      "title": "How to Reset Your Password",
      "slug": "how-to-reset-your-password",
      "category": "account-management",
      "excerpt": "To reset your password, navigate to...",
      "similarity": 0.921
    }
  ],
  "escalate": false,
  "model_used": "gpt-4o-mini",
  "prompt_tokens": 412,
  "completion_tokens": 87,
  "total_tokens": 499,
  "cost_usd": 0.000097,
  "latency_ms": 1243,
  "cache_hit": false,
  "fallback_used": false
}
```

When `escalate: true`, the bot could not find relevant articles and suggests creating a support ticket.

---

### `POST /rag/summarize-ticket`
**Service:** ml-service (Python)

Generates a ticket title and description from a chat transcript using the LLM.

**Request:**
```json
{ "transcript": "User: My printer won't print\nBot: Have you checked the paper tray?..." }
```

**Response:**
```json
{
  "title": "Printer not printing after refill",
  "description": "User reports printer stopped working after replacing ink cartridges.",
  "suggested_category": "hardware"
}
```

---

### `GET /rag/health`
**Service:** ml-service (Python)

```json
{
  "llm_ready": true,
  "embedding_ready": true,
  "model": "gpt-4o-mini",
  "embedding_model": "text-embedding-ada-002",
  "embedding_dim": 1536,
  "articles_total": 47,
  "articles_embedded": 47,
  "articles_missing": 0
}
```

---

### `GET /api/chat/llm/health`
**Service:** backend (Node.js) — proxies to `/rag/health`

Accessible to authenticated users. Returns the same data as above plus wrapper status.

---

### `POST /rag/embeddings/generate`
**Service:** ml-service (Python)

Triggers background re-embedding. Useful after bulk-publishing new KB articles.

**Request:**
```json
{ "force": false, "article_id": null }
```
- `force: true` — re-embed all articles, not just missing ones
- `article_id: 42` — re-embed a single article

---

## Fallback Behaviour

The system degrades gracefully at every level:

```
OPENAI_API_KEY not set
  └─▶ Embeddings: MiniLM (384-dim, free, local)
      Chat: rule-based keyword matching (existing chatService behaviour)

OpenAI API call fails / times out
  └─▶ LLM returns fallbackUsed=true
      chatService falls back to rule-based path automatically

Python AI service unreachable
  └─▶ llmService returns fallbackUsed=true
      chatService falls back to rule-based path automatically

LLM_ENABLED=false
  └─▶ llmService skips LLM entirely, chatService uses rule-based only
```

Users never see an error — they get a slightly less conversational but still functional response.

---

## Updating the Knowledge Base

When new articles are published:

1. **Automatic** — the ML service embeds missing articles on startup
2. **On-demand via API:**
   ```bash
   curl -X POST https://your-ml-service.railway.app/rag/embeddings/generate \
     -H 'Content-Type: application/json' \
     -d '{"force": false}'
   ```
3. **Single article:**
   ```bash
   curl -X POST https://your-ml-service.railway.app/rag/embeddings/generate \
     -H 'Content-Type: application/json' \
     -d '{"article_id": 52}'
   ```

No redeployment needed — embeddings are stored in the database.

---

## Cost Monitoring

Token usage and cost is logged per-request in the `llm_usage_logs` table:

```sql
-- Daily spend per user
SELECT user_id,
       DATE(created_at) AS day,
       SUM(cost_usd)    AS total_cost_usd,
       SUM(total_tokens) AS total_tokens,
       COUNT(*)         AS requests
FROM   llm_usage_logs
GROUP  BY user_id, DATE(created_at)
ORDER  BY day DESC, total_cost_usd DESC;

-- Cache hit rate (less API calls = less cost)
SELECT
  COUNT(*) FILTER (WHERE cache_hit = TRUE)  AS cache_hits,
  COUNT(*) FILTER (WHERE cache_hit = FALSE) AS cache_misses,
  ROUND(AVG(cost_usd)::numeric, 6)           AS avg_cost_per_request
FROM llm_usage_logs
WHERE created_at > NOW() - INTERVAL '7 days';
```

Set a billing alert in your OpenAI dashboard at **$20/month** for the capstone demo.

---

## Local Development (No API Key)

You can run the full chatbot locally without an OpenAI key:

1. Sentence-transformers / MiniLM provides free 384-dim embeddings
2. The chat falls back to the existing rule-based keyword matcher
3. All other features (ticket creation, KB search, ML classification) work normally

```powershell
# Start AI service without OpenAI key (MiniLM + rule-based fallback)
cd blueclue/ai
# No OPENAI_API_KEY needed
$env:DATABASE_URL = "postgresql://..."
uvicorn app:app --port 5000 --reload
```

To enable full LLM locally, add your key to `blueclue/ai/.env`:
```dotenv
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
```

---

## Prompt Engineering Notes

The system prompt (`rag_pipeline.py → SYSTEM_PROMPT`) enforces these rules:

1. **Grounding** — answer using ONLY the provided KB articles
2. **Escalation signal** — if articles don't cover the question, respond with the exact phrase "I don't have enough information" (detected by `should_escalate()`)
3. **Conciseness** — responses capped at 150 words
4. **Citations** — always end with `📖 Source: [Article Title]`
5. **Role-aware** — customers get simplified language; tech staff get diagnostic details
6. **Few-shot examples** — two worked examples are included to anchor style

To update the prompt, edit `SYSTEM_PROMPT` and `FEW_SHOT_EXAMPLES` in [blueclue/ai/src/rag_pipeline.py](../../ai/src/rag_pipeline.py).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| All responses are rule-based, no LLM | `OPENAI_API_KEY` not set on ml-service | Add key in Railway → ml-service → Variables |
| "LLM service not initialised" (503) | AI service failed to start | Check Railway logs for ml-service |
| `embedding_ready: false` in health | Articles haven't been embedded yet | Call `POST /rag/embeddings/generate` or wait for startup |
| Slow responses (>5s) | Too many articles retrieved, or GPT-4 | Reduce `RAG_TOP_K=3` or switch to `gpt-4o-mini` |
| High token costs | Long conversation history | Reduce `LLM_HISTORY_TURNS=3` on backend |
| Answers don't reference KB | Articles not embedded correctly | Run `python test_llm.py --group rag` |
| Rate limit errors from OpenAI | High traffic | Increase `LLM_CACHE_TTL` to cache more responses |

---

## Success Criteria

As defined in the project requirements:

| Metric | Target | How to measure |
|--------|--------|---------------|
| Response time | p95 < 3 seconds | `python test_llm.py --group bench` |
| RAG retrieval accuracy | > 80% relevant articles | Manual review of `test_llm.py` output |
| Hallucination rate | < 5% | Human evaluation of out-of-scope query responses |
| Cost per conversation | < $0.10 | `llm_usage_logs` table |
| User satisfaction | > 80% thumbs-up | Chat feedback table |
| LLM response coverage | 95%+ queries get a response | Monitor `fallback_used` rate in logs |
