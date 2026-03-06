# LLM + RAG Setup Guide

This guide walks you through deploying the LLM and RAG features on Railway from start to finish.

---

## Quick Answer: Where do OpenAI keys go?

**Railway → ml-service → Variables** — not the backend.

Your Railway project layout:
```
ml-service   (root dir: blueclue/ai)    ← OPENAI_API_KEY lives here
backend      (root dir: blueclue/backend)
database     (Railway Postgres plugin)
frontend     (root dir: blueclue/frontend)
```

The Python code that calls OpenAI runs in `ml-service`. The Node.js backend only needs the URL of the ml-service and a few toggles.

---

## Prerequisites

Before starting:
- [ ] Railway project is running (all 4 services deployed)
- [ ] PostgreSQL plugin is active and connected to the backend and ml-service
- [ ] You have an [OpenAI account](https://platform.openai.com/) with billing enabled
- [ ] Your OpenAI account has at least $5 credit loaded

---

## Step 1 — Run the Database Migration

Connect to your Railway Postgres instance and run the pgvector migration:

```powershell
# Get your connection string from Railway → database → Connect
$db = "postgresql://postgres:PASSWORD@HOST:PORT/railway"

# Run the migration
psql $db -f blueclue/database/migrations/029_add_pgvector_rag.sql
```

This migration:
- Enables the `pgvector` extension
- Creates `article_embeddings` (stores KB article vectors)
- Creates `llm_response_cache` (1-hour answer cache)
- Creates `llm_usage_logs` (token/cost tracking)
- Creates `kb_embedding_coverage` view

> **Safe to run on a live database** — uses `CREATE TABLE IF NOT EXISTS`. No existing tables are modified.

---

## Step 2 — Add Variables to `ml-service`

Go to: **Railway Dashboard → ml-service → Variables**

### Required variables

| Variable | Where to get it |
|----------|----------------|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → Create new secret key |
| `DATABASE_URL` | Already there (Railway auto-injects from the Postgres plugin) |

Click **New Variable** for each, paste the values, click **Add**.

### Recommended variables

| Variable | Recommended Value | Notes |
|----------|------------------|-------|
| `LLM_MODEL` | `gpt-4o-mini` | Best cost/quality ratio. See model table below. |
| `LLM_MAX_TOKENS` | `250` | Keeps responses concise |
| `RAG_TOP_K` | `5` | Articles returned per query |

### Optional variables (full list in `blueclue/ai/.env.example`)

```
LLM_TEMPERATURE=0.7
LLM_TIMEOUT_SEC=15
LLM_MAX_RETRIES=2
EMBEDDING_MODEL=text-embedding-ada-002
EMBEDDING_DIM=1536
RAG_MIN_SIMILARITY=0.35
RAG_CACHE_TTL=3600
```

---

## Step 3 — Add Variables to `backend`

Go to: **Railway Dashboard → backend → Variables**

| Variable | Value | Notes |
|----------|-------|-------|
| `AI_SERVICE_URL` | `https://your-ml-service.up.railway.app` | Copy from ml-service → Settings → Domain |
| `LLM_ENABLED` | `true` | Set `false` to disable LLM entirely |

### Optional backend variables

```
LLM_RATE_LIMIT=10         # Max messages per user per minute
LLM_DAILY_BUDGET=1.00     # Max USD per user per day
LLM_HISTORY_TURNS=5       # How many prior messages to include as context
LLM_TIMEOUT_MS=15000      # HTTP timeout connecting to ml-service
LLM_CACHE_TTL_MS=3600000  # Node-side cache (same query within 1hr reuses cached answer)
```

---

## Step 4 — Getting the `AI_SERVICE_URL`

1. Go to **Railway Dashboard → ml-service**
2. Click **Settings** tab
3. Under **Domains**, copy the generated URL (e.g. `https://ml-service-production-xxxx.up.railway.app`)
4. Paste it as `AI_SERVICE_URL` in the backend variables

---

## Step 5 — Choose a Model

| Model | Cost | Quality | Best for |
|-------|------|---------|---------|
| `gpt-4o-mini` | ~$2–4/month | Very good | ✅ Recommended — best value |
| `gpt-3.5-turbo` | ~$6–12/month | Good | Budget option |
| `gpt-4-turbo` | ~$150–300/month | Excellent | Enterprise/production |
| `gpt-4o` | ~$60–120/month | Excellent | High-quality production |

*Cost estimates based on 1,000 conversations/month × 10 messages each.*

For a capstone demo, **`gpt-4o-mini` is ideal** — fast, cheap, and high quality.

---

## Step 6 — Deploy

Railway deploys automatically when you push a commit. If you've already pushed the LLM/RAG code:

1. Go to Railway → **ml-service** → **Deployments**
2. Click **Redeploy** on the latest deployment (or wait for the next git push)

On startup the ml-service will:
1. Load the existing ML classifier (unchanged — same as before)
2. Initialise the LLM service with your OpenAI key
3. Start a background thread that auto-embeds any KB articles that don't have embeddings yet

This means **embeddings generate automatically** — no manual step required after the first deploy.

---

## Step 7 — Verify the Integration

### Check the health endpoint

```powershell
# Via the backend (requires auth normally, but useful for testing)
$url = "https://your-backend.railway.app"

# Or directly on the ml-service
curl https://your-ml-service.railway.app/rag/health
```

Expected response:
```json
{
  "llm_ready": true,
  "embedding_ready": true,
  "model": "gpt-4o-mini",
  "embedding_model": "text-embedding-ada-002",
  "articles_total": 47,
  "articles_embedded": 47,
  "articles_missing": 0
}
```

If `llm_ready: false`:
- Check that `OPENAI_API_KEY` is set correctly on the ml-service (no trailing spaces)
- Check Railway → ml-service → Logs for error messages

If `articles_missing > 0`:
- Embeddings are still generating (takes ~1–2 min for 50 articles)
- Or run them manually (see Step 8)

---

## Step 8 — Manual Embedding Generation (Optional)

Embeddings are auto-generated on startup, but you can also run them manually:

### Via the API:
```powershell
curl -X POST https://your-ml-service.railway.app/rag/embeddings/generate \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

Use `{"force": true}` to re-embed all articles (useful if you changed the embedding model).

### Via the CLI (locally):
```powershell
cd blueclue/ai

# Copy your vars from Railway
$env:DATABASE_URL   = "postgresql://..."
$env:OPENAI_API_KEY = "sk-..."

# Embed only missing articles
python generate_embeddings.py

# Re-embed everything
python generate_embeddings.py --force

# Embed a specific article (by ID)
python generate_embeddings.py --article-id 15

# Preview what would run without making changes
python generate_embeddings.py --dry-run
```

---

## Step 9 — Run the Test Suite

Validate the full integration end-to-end:

```powershell
cd blueclue/ai

$env:DATABASE_URL   = "postgresql://..."
$env:OPENAI_API_KEY = "sk-..."

# Run all tests
python test_llm.py

# Run only connectivity tests (fastest)
python test_llm.py --group connectivity

# Run only RAG tests (20 sample queries)
python test_llm.py --group rag

# Latency benchmark
python test_llm.py --group bench
```

Successful output looks like:
```
══════════════════════════════════════════════════════
  BlueClue LLM + RAG Integration Tests
══════════════════════════════════════════════════════

  Connectivity Tests
  ──────────────────
  ✓ Chat completion OK in 843ms

  Embedding Tests
  ───────────────
  ✓ Embedding OK — dim=1536, magnitude=1.000, latency=210ms
  ✓ Batch embedding OK — 3 vectors, consistent

  RAG Tests (20 queries)
  ──────────────────────
  [ 921ms] OK     articles=3  Q: How do I reset my password?
  [ 807ms] OK     articles=2  Q: My printer won't print anything
  ...

  Latency Summary
  ───────────────
  p50=880ms   p95=2120ms   p99=2800ms
  Answered: 17/20 (85%)   Escalated: 3/20 (15%)

══════════════════════════════════════════════════════
  PASS  All tests completed successfully
══════════════════════════════════════════════════════
```

---

## Troubleshooting

### `OPENAI_API_KEY` errors

```
openai.AuthenticationError: Incorrect API key provided
```
→ Double-check the key in Railway → ml-service → Variables. Keys start with `sk-`. Make sure there are no extra spaces.

---

### `DATABASE_URL` not found

```
KeyError: 'DATABASE_URL'
```
→ Go to Railway → ml-service. Under **Variables**, look for `DATABASE_URL`. If it's not there, click **Add Reference** → select your Postgres plugin.

---

### LLM health returns `llm_ready: false`

Check Railway ml-service logs:
```
LLM service initialisation failed: ...
```

Common causes:
- Invalid API key
- OpenAI account billing not set up (no payment method)
- Organisation quota exceeded

---

### Responses are still rule-based

`chatService.js` falls back to rule-based when the LLM returns `fallbackUsed: true`. Confirm:
1. `LLM_ENABLED=true` in backend variables
2. `AI_SERVICE_URL` points to the correct ml-service URL
3. `/rag/health` returns `llm_ready: true`

---

### Articles not being found by the bot

If the bot says "I don't have enough information" for questions that should be in the KB:
1. Check `articles_embedded` in `/rag/health` — should equal `articles_total`
2. If there are missing embeddings, run: `POST /rag/embeddings/generate`
3. If similarity scores are too low, lower `RAG_MIN_SIMILARITY` to `0.25`

---

### Rate limit errors from OpenAI

```
openai.RateLimitError: You exceeded your current quota
```
→ Your OpenAI account has run out of credits. Add more at [platform.openai.com/billing](https://platform.openai.com/billing).

During development: set `LLM_MODEL=gpt-3.5-turbo` (cheapest) and increase `RAG_CACHE_TTL=7200` to cache more responses.

---

### Slow responses (>5 seconds)

- Switch to `gpt-4o-mini` (faster than gpt-3.5-turbo at peak hours)
- Reduce `RAG_TOP_K` to `3` (fewer articles = shorter prompt = faster)
- Reduce `LLM_HISTORY_TURNS` to `3` in the backend

---

## Feature Flags

You can disable LLM at runtime without redeploying:

| Action | How |
|--------|-----|
| Disable LLM (use rule-based only) | Set `LLM_ENABLED=false` on backend, redeploy |
| Switch models without redeploy | Change `LLM_MODEL` on ml-service, redeploy |
| Clear response cache | Restart ml-service (cache is in-memory on the Node side; DB cache clears by TTL) |

---

## Environment Variable Reference (Complete)

### `ml-service` (Railway root: `blueclue/ai`)

```dotenv
# ─── OpenAI ────────────────────────────────────────────────
OPENAI_API_KEY=sk-...                # REQUIRED
LLM_MODEL=gpt-4o-mini               # Recommended
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=250
LLM_TIMEOUT_SEC=15
LLM_MAX_RETRIES=2

# ─── Embeddings ────────────────────────────────────────────
EMBEDDING_MODEL=text-embedding-ada-002
EMBEDDING_DIM=1536                  # Must match EMBEDDING_MODEL

# ─── RAG ───────────────────────────────────────────────────
RAG_TOP_K=5
RAG_MIN_SIMILARITY=0.35
RAG_CACHE_TTL=3600                  # seconds

# ─── Database (usually auto-injected by Railway) ───────────
DATABASE_URL=postgresql://...
```

### `backend` (Railway root: `blueclue/backend`)

```dotenv
# ─── AI Service ────────────────────────────────────────────
AI_SERVICE_URL=https://your-ml-service.up.railway.app   # REQUIRED

# ─── LLM Controls ──────────────────────────────────────────
LLM_ENABLED=true
LLM_RATE_LIMIT=10                   # messages per user per minute
LLM_DAILY_BUDGET=1.00               # USD per user per day
LLM_HISTORY_TURNS=5                 # prior turns sent as context
LLM_TIMEOUT_MS=15000                # HTTP request timeout
LLM_CACHE_TTL_MS=3600000            # Node response cache TTL
```
