# ML Model Deployment & Integration Guide

## Architecture Decision

**Decision: Option A — FastAPI Microservice**

### Rationale

| Criterion | Option A: FastAPI | Option B: Embedded | Option C: Cloud ML |
|-----------|-------------------|---------------------|---------------------|
| Language fit | Python ML → Python service ✓ | Python child-process in Node.js ✗ | Managed ✓ |
| Scalability | Independent scaling ✓ | Coupled ✗ | Elastic ✓ |
| Latency | Low (local) ✓ | Process spawn overhead ✗ | Network hop ≈ |
| Cost | Infrastructure only ✓ | Free ✓ | Pay-per-inference ✗ |
| Complexity | Moderate | Simple | High (vendor lock-in) |
| Model updates | Restart service / volume mount | Restart backend | API call |

FastAPI was chosen because:
- All three models are Python/sklearn — no language bridge needed
- Independent scaling of ML inference vs Node.js API
- Automatic OpenAPI documentation at `/docs`
- Pydantic for request/response validation
- Async-ready with built-in CORS, lifespan hooks, etc.

---

## Service Architecture

```
┌──────────────┐       ┌───────────────────────┐       ┌──────────────┐
│   Frontend   │──────▶│  Backend (Express.js)  │──────▶│ ML Service   │
│   (Vite)     │       │  Port 3000             │       │ (FastAPI)    │
│              │       │                        │       │ Port 5000    │
│              │       │  aiService.js:          │       │              │
│              │       │  - circuit breaker      │       │ Endpoints:   │
│              │       │  - retry logic          │       │ /classify/*  │
│              │       │  - in-memory cache      │       │ /predict/*   │
│              │       │  - rule-based fallback  │       │ /health      │
└──────────────┘       └───────────────────────┘       │ /models/info │
                                                        │ /metrics     │
                                                        └──────────────┘
```

---

## Endpoints Reference

### ML Service (FastAPI — Port 5000)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Health check with model status |
| `GET`  | `/models/info` | Model metadata + cache stats |
| `GET`  | `/metrics` | Latency, confidence, distributions |
| `POST` | `/classify/category` | Category classification |
| `POST` | `/classify/priority` | Priority classification |
| `POST` | `/predict/resolution_time` | Resolution time prediction |
| `POST` | `/classify` | Combined (all three models) |
| `POST` | `/classify/legacy` | Flask-compatible response shape |
| `GET`  | `/docs` | Auto-generated OpenAPI docs |

### Request Schema (all POST endpoints)

```json
{
  "text": "Ticket description (required)",
  "subject": "Optional subject line",
  "category": "Optional pre-determined category",
  "priority": "Optional pre-determined priority",
  "metadata": {}
}
```

### Response Examples

**Category (`POST /classify/category`)**
```json
{
  "category": "hardware",
  "confidence": 0.9523,
  "all_scores": {
    "hardware": 0.9523,
    "software": 0.0312,
    "network": 0.0101,
    ...
  },
  "model_version": "v1_20260224",
  "low_confidence": false
}
```

**Priority (`POST /classify/priority`)**
```json
{
  "priority": "high",
  "confidence": 0.7812,
  "all_scores": { "critical": 0.05, "high": 0.78, "medium": 0.12, "low": 0.05 },
  "model_version": "v1_20260224",
  "low_confidence": false
}
```

**Time (`POST /predict/resolution_time`)**
```json
{
  "estimated_hours": 16.5,
  "confidence_range": { "lower_hours": 11.55, "upper_hours": 21.45 },
  "model_version": "v1_20260224"
}
```

---

## Models Deployed

| Model | Type | Version | Accuracy/Metric | Features |
|-------|------|---------|-----------------|----------|
| Category | Random Forest | v1_20260224 | 100% accuracy | 2796 TF-IDF + metadata |
| Priority | Logistic Regression | v1_20260224 | 79.2% accuracy | 1021 features |
| Time | Random Forest Regressor | v1_20260224 | R²=0.39, MAE=34h | 526 features |

---

## Running Locally

### 1. Start the ML Service

```bash
cd blueclue/ai
pip install -r requirements.txt
python app.py
# Service starts at http://localhost:5000
# OpenAPI docs at http://localhost:5000/docs
```

### 2. Start the Backend

```bash
cd blueclue/backend
npm install
npm run dev
# Backend at http://localhost:3000
# Connects to ML service at AI_SERVICE_URL (default: http://localhost:5000)
```

### 3. Using Docker Compose

```bash
# From project root
docker compose up --build
# ML service: http://localhost:5000
# Backend:    http://localhost:3000
```

---

## Environment Variables

### ML Service

| Variable | Default | Description |
|----------|---------|-------------|
| `ML_SERVICE_PORT` | `5000` | Service port |
| `ML_SERVICE_HOST` | `0.0.0.0` | Bind address |
| `ML_ENV` | `development` | `development` enables hot-reload |
| `ML_WORKERS` | `1` | Uvicorn worker count (use 2-4 in prod) |
| `CONFIDENCE_THRESHOLD` | `0.5` | Below this → `low_confidence: true` |
| `CACHE_MAX_SIZE` | `1024` | Max cached predictions |
| `CACHE_TTL_SECONDS` | `3600` | Cache entry lifetime |

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_SERVICE_URL` | `http://localhost:5000` | ML service URL |
| `AI_SERVICE_TIMEOUT` | `5000` | Request timeout (ms) |
| `AI_MAX_RETRIES` | `2` | Retry attempts for transient failures |

---

## Resilience Features

### Circuit Breaker (Backend)
- Opens after **5 consecutive failures**
- In OPEN state: all requests routed to **rule-based fallback** immediately
- After **30 seconds**: transitions to HALF_OPEN, allows one probe request
- On success: circuit CLOSES; on failure: re-OPENS

### Retry Logic
- Exponential backoff: 200ms → 400ms → 800ms
- Client errors (4xx) are NOT retried
- Max 2 retries by default

### Caching
- **ML Service**: In-memory TTL cache (SHA-256 keyed, 1h TTL, 1024 entries)
- **Backend**: In-memory TTL cache (1h TTL, 500 entries)
- Identical ticket text returns cached prediction instantly

### Fallback Chain
1. **ML Model** → primary (FastAPI service)
2. **Rule-based keywords** → if ML service down or models not loaded
3. **Default values** → `category: "general"`, `priority: "low"`

---

## Testing

### Unit & Integration Tests

```bash
cd blueclue/ai
pip install pytest httpx anyio
pytest tests/test_ml_service.py -v
```

### Load Test

```bash
# Start ML service first, then:
cd blueclue/ai
python tests/test_load.py --requests 200 --concurrency 10
```

**Targets:**
- Throughput ≥ 100 req/min
- p95 latency < 200ms
- Error rate < 1%

---

## Monitoring

### Built-in Metrics (`GET /metrics`)

```json
{
  "total_requests": 1523,
  "total_errors": 2,
  "fallback_count": 0,
  "latency_ms": { "mean": 45.2, "p50": 38.1, "p95": 112.3, "p99": 185.4 },
  "confidence": { "mean": 0.87, "min": 0.31, "below_threshold_pct": 4.2 },
  "category_distribution": { "hardware": 312, "software": 289, ... },
  "priority_distribution": { "high": 198, "medium": 521, ... }
}
```

### Health Check (`GET /health`)

Returns model load status, uptime, and overall service status (`OK` or `DEGRADED`).

### Logging

All requests are logged with method, path, status code, and latency:
```
2026-02-27 10:15:23 | INFO    | blueclue.ml | POST /classify -> 200 (47.3ms)
```

---

## Updating Models

1. Train new models using the existing training scripts
2. Copy new `.pkl` files to `blueclue/ai/models/`
3. Update the `*_latest.pkl` symlinks/copies
4. Restart the ML service (or the Docker container)
5. Verify via `GET /models/info` that new versions are loaded
