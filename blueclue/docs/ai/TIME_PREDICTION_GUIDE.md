# Resolution Time Prediction — Developer Guide

This document covers the resolution time prediction model (v2): its current accuracy baseline,
the v2 feature additions, how to retrain, the API contracts, and the ticket-detail UI display.

---

## 1. Baseline Metrics (v1 — do not accept regressions below these)

These are documented in `blueclue/ai/models/time_model_card_v1_20260224.json`.

| Metric | v1 Value | Interpretation |
|---|---|---|
| **MAE** | **34.0 hours** | Average prediction is off by ~34 h |
| **RMSE** | **47.8 hours** | Heavily penalises large errors |
| **R²** | **0.388** | Model explains ~39% of variance |
| Within 4 h | 10.4% | Only 1 in 10 predictions within a 4-hour window |
| Within 8 h | 20.7% | Only 1 in 5 within an 8-hour window |
| Training samples | 1 374 | Resolved tickets used for training |
| Test samples | 299 | Held-out evaluation set |

**Key insight:** An MAE of 34 h on a model used for SLA scheduling is too imprecise for tight
commitments. The model was identified as needing new features and fresh data.

---

## 2. v2 Feature Set Changes

The v2 feature engineering adds two new signals and refines an existing one.

### 2.1 New features

#### `technician_workload` (float, normalized ÷ 20)
The number of currently-open, non-terminal tickets assigned to the same technician who would
handle this ticket. A high queue depth predicts slower resolution because the technician's
attention is split.

- Extracted at training time from the ticket's `technician_workload` field (populated by the
  backend `/predict-resolution-time` route via a subquery).
- At inference time the backend fetches this live value before calling the AI service.
- Default: `0` (no assigned technician or unassigned queue).

#### `day_of_week` (float, 0.0 – 1.0 mapped from Mon=0 … Sun=6)
Captures weekly staffing patterns. Monday morning and Friday afternoon have measurably different
resolution speeds in IT support datasets. Complements the existing `hour_of_day` feature.

### 2.2 Refined feature

`created_at` now emits **four** features instead of three:

| Feature (position) | v1 | v2 |
|---|---|---|
| `business_hours` | ✓ | ✓ |
| `is_weekend` | ✓ | ✓ |
| `hour_of_day` | ✓ | ✓ |
| `day_of_week` | — | ✓ (new) |

### 2.3 Retained features

- TF-IDF text representation (up to 500 bigrams, English stop-words removed)
- Category one-hot encoding
- Priority one-hot + numeric `priority_factor` (critical=0.25 … low=2.0)
- Complexity keyword scores (high / low complexity)
- `ai_confidence`, `user_previous_tickets`
- `text_len`, `word_count`, `question_count`, `sentence_count`
- `comment_count`, `reopen_count`

Total feature count (v2): **528** (500 TF-IDF + 28 structured)

---

## 3. Retraining the Model

### Prerequisites

```bash
cd blueclue/ai
pip install -r requirements.txt
```

Data must be prepared first (`data/splits/{train,val,test}.json` must exist):

```bash
python scripts/prepare_ml_data.py
```

### 3.1 Quick retrain (default settings)

```bash
python src/train_time_model.py
```

Trains `random_forest` + baseline `dummy` models, evaluates on val and test sets, then saves
artefacts to `models/`.

### 3.2 Retrain with hyperparameter tuning (recommended before a release)

```bash
python src/train_time_model.py --model random_forest --tune
```

### 3.3 Train and compare all model types

```bash
python src/train_time_model.py --all --tune
```

### 3.4 Saved artefacts

| File | Description |
|---|---|
| `models/time_predictor_v2_<YYYYMMDD>.pkl` | Versioned model |
| `models/time_predictor_latest.pkl` | Symlink used by `app.py` at startup |
| `models/time_feature_extractor_v2_<YYYYMMDD>.pkl` | Fitted feature extractor |
| `models/time_feature_extractor_latest.pkl` | Used by `app.py` |
| `models/time_model_card_v2_<YYYYMMDD>.json` | Metrics, feature notes, hyperparameters |

### 3.5 Acceptance criteria for a new model card to replace the baseline

A new trained version is considered an improvement when **all** of the following are true on the
**test** set:

- MAE < 30 hours (improvement over the v1 baseline of 34 h)
- RMSE < 44 hours (improvement over 47.8 h)
- R² > 0.40 (improvement over 0.388)

---

## 4. AI Service Endpoint

### `POST /predict/resolution_time`

**Request**

```json
{
  "text": "Cannot connect to VPN after system update.",
  "subject": "VPN broken",
  "category": "network",
  "priority": "high",
  "metadata": {
    "technician_workload": 6,
    "reopen_count": 0,
    "comment_count": 1
  }
}
```

All fields except `text` are optional. Pass `metadata.technician_workload` to let the model
account for queue depth.

**Response**

```json
{
  "estimated_hours": 8.4,
  "confidence_range": {
    "lower_hours": 5.88,
    "upper_hours": 10.92
  },
  "model_version": "v2_20260402",
  "uncertainty_label": "5 hours – 10 hours"
}
```

| Field | Description |
|---|---|
| `estimated_hours` | Point estimate (clamped to 0.5 – 720 h). |
| `confidence_range` | ±30% interval around the estimate. |
| `uncertainty_label` | Human-readable range string for display in UI, e.g. `"5 hours – 10 hours"` or `"1 day – 2 days"`. |
| `model_version` | Model card version that made the prediction. |

When the ML model is not loaded, the endpoint falls back to a priority-table heuristic and still
emits all four fields (with `model_version: "rule-based-fallback"`).

---

## 5. Backend Proxy Endpoint

### `GET /api/tickets/:id/predict-resolution-time`

Fetches the live ticket row (description, category, priority, technician workload) from PostgreSQL
and forwards to the AI service. Requires a valid JWT (`authenticateToken`).

**Success (200)**

```json
{
  "ticket_id": "123",
  "estimated_hours": 8.4,
  "confidence_range": { "lower_hours": 5.88, "upper_hours": 10.92 },
  "uncertainty_label": "5 hours – 10 hours",
  "model_version": "v2_20260402",
  "technician_workload": 6
}
```

**Error responses**

| Status | Condition |
|---|---|
| 404 | Ticket not found |
| 503 | AI service returned `null` (circuit-breaker open or service down) |
| 500 | Unexpected DB or service error |

---

## 6. Frontend Display

The `TicketDetailView` sidebar shows an **"Est. Resolution Time"** section for all staff members
on open (not yet resolved) tickets.

```
Est. Resolution Time
──────────────────────────────
🕐  5 hours – 10 hours
    AI estimate — actual time may vary based on complexity and workload.
```

**Visibility rules**

| Role | Visible? |
|---|---|
| `client` | Hidden |
| `technician`, `senior_technician` | Shown |
| `management`, `admin` | Shown |

The prediction is fetched non-blocking immediately after `getTicketById` resolves.  A spinner is
shown during loading; "Unavailable" is shown on error. The panel is suppressed entirely once the
ticket has a `resolved_at` timestamp.

**Service call**: `predictTicketResolutionTime(ticketId)` in
`blueclue/frontend/src/services/ticketService.js`.

---

## 7. Running Tests

### Python (AI service)

```bash
cd blueclue/ai
pytest tests/test_time_model.py -v
```

Key test classes:

| Class / function | What it covers |
|---|---|
| `TestMetadataFeatures` | Per-feature value correctness including `day_of_week` and `technician_workload` |
| `TestFeatureExtractorFit` | v2 feature names registered; no NaN/Inf in matrix |
| `TestUncertaintyLabel` | `uncertainty_label` presence, format (`–`), and consistent bounds |
| `test_resolution_time_*` | Endpoint contract: schema, validation, caching, fallback |

### Backend (Node.js)

```bash
cd blueclue/backend
npm install   # installs supertest (added to devDependencies)
npm test
```

Key test groups in `tests/predictResolutionTime.test.js`:

| Suite | What it covers |
|---|---|
| success cases | 200 response shape, technician_workload parsing, fallback label |
| error cases | 404 not found, 503 AI unavailable, 500 DB error, 500 AI throws |
| workload parsing | null and string inputs coerce to integer |

---

## 8. Model Card Schema Reference

The v2 model card (`time_model_card_v2_<date>.json`) adds two top-level sections beyond v1:

```jsonc
{
  "baseline_metrics_v1": { ... },   // v1 MAE/RMSE/R² for regression testing
  "feature_changes_v2": {
    "added":    [...],              // new feature names + rationale
    "improved": [...],              // refined features
    "retained": [...]               // unchanged features
  }
}
```

After a successful retrain, populate `metrics` with the test-set results and commit the updated
model card alongside the `.pkl` artefacts.
