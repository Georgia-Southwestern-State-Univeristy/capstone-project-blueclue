# ML Monitoring Guide

This guide describes the metrics collected by the BlueClue ML service, what thresholds to watch, and what actions to take when they breach.

---

## Quick Links

| Dashboard Tab | URL | Who |
|---|---|---|
| ML Admin Dashboard | `/ml-admin` | admin / management |
| API Health | `GET /api/ml-admin/health` | backend |
| Raw metrics | `GET http://localhost:5000/metrics/rolling` | devops |

---

## 1. Key Metrics

### 1.1 Override Rate
The most important signal: what percentage of AI predictions do agents actually change?

| Metric | Target | Warning | Critical |
|---|---|---|---|
| Category override % | < 15% | 15–25% | > 25% |
| Priority override % | < 15% | 15–25% | > 25% |

**Collected from**: `ml_prediction_feedback` table → view `vw_ml_override_rate_7d`

**Action if critical**: Run drift detection, schedule retraining.

---

### 1.2 Confidence Score Distribution

Confidence buckets are shown in the Overview histogram.

| Level | Range | Healthy share |
|---|---|---|
| High | ≥ 80% | > 60% of all predictions |
| Medium | 60–79% | OK |
| Low | < 60% | < 20% of all predictions |

**Low confidence % = `confidence.low_confidence_pct` in `/metrics/rolling`**

**Action if low-confidence > 20%**: Review recent ticket text patterns; retrain or add more training data.

---

### 1.3 Request Volume & Latency

| Metric | Healthy | Warning |
|---|---|---|
| Requests / minute | Any | — |
| p50 latency | < 500 ms | — |
| p95 latency | < 2 000 ms | > 2 000 ms |
| p99 latency | < 5 000 ms | > 5 000 ms |
| Error rate % | < 1% | > 1% |

These are visible under **Overview → Latency** card and `GET /api/ml-admin/health`.

---

## 2. Drift Detection

Drift detection uses two statistical tests:

| Test | Detects | p-value threshold |
|---|---|---|
| KS (Kolmogorov-Smirnov) | Shift in confidence distribution | < 0.05 |
| Chi-squared (χ²) | Shift in category label counts | < 0.05 |

**When to run drift detection:**
- Monthly (automate via cron on the Python service).
- Whenever override rate spikes above 20%.
- After any large batch of new ticket types.

**Dashboard**: Drift tab → "Run Drift" buttons.

**API**: `POST /api/ml-admin/drift/run` with `{ model_type: "category", period_days: 30 }`.

**Results are stored** in `ml_drift_reports`.

**Action when drift is detected:**
1. Examine the distribution comparison chart in the Drift tab.
2. If a new category is dominating, add more labelled data for that category.
3. Trigger retraining (Retraining tab or API).

---

## 3. SHAP Explainability

Every prediction includes a SHAP explanation object (stored as JSONB in `ai_classifications.explanation`).

Example stored JSON:
```json
{
  "model_type": "category",
  "top_features": [
    ["windows error", 0.42],
    ["application crash", 0.31],
    ["blue screen", 0.19]
  ],
  "confidence": 0.87,
  "predicted_label": "Software",
  "summary": "Software (87% confident) because: windows error, application crash, blue screen",
  "method": "shap_tree"
}
```

**Interpretation rules:**
- Feature weight > 0.3 → strong signal.
- Feature weight 0.1–0.3 → moderate signal.
- Feature weight < 0.1 → minor signal.
- `method: keyword_fallback` means SHAP was unavailable; the explanation is based on TF-IDF feature importances from the training phase.

The **ExplainabilityPanel** component is available for embedding in any ticket detail view — import from `components/ml/ExplainabilityPanel`.

---

## 4. Model Versions Registry

The model registry lives at `ai/models/registry.json`.

| Registry field | Meaning |
|---|---|
| `is_active` | Currently serving production traffic |
| `is_deployed` | Was at some point deployed (historical) |
| `rolled_back_at` | ISO timestamp if this was rolled back |
| `accuracy` | Test-set accuracy at registration time |

**Rules**:
- A maximum of **3 versions** per model type are kept (oldest auto-pruned).
- Accuracy must improve by **≥ 2%** for auto-deploy to trigger.

---

## 5. Automated Alerts (recommended setup)

Add these checks to your monitoring tool (e.g., Uptime Robot, Grafana, or a cron script):

```bash
# 1. Health check
curl -f http://localhost:5000/health || alert "ML service down"

# 2. Override rate (via backend API — requires auth token)
# Parse JSON; alert if category_override_pct > 25

# 3. Drift (monthly cron)
curl -X POST http://localhost:3001/api/ml-admin/drift/run \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"modelType":"category","periodDays":30}'
```
