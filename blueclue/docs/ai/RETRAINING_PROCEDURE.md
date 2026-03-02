# ML Retraining Procedure

This document describes how to export data, retrain models, evaluate, deploy, and roll back.

---

## Prerequisites

- Python 3.10+ with the `ai/` virtualenv activated
- Access to the PostgreSQL database (set `DATABASE_URL` or individual `DB_*` env vars)
- At least **200 labelled tickets** in the database (400+ recommended for good generalisation)

---

## 1. Continuous Learning Pipeline Overview

```
┌─────────────────┐   weekly     ┌──────────────────┐   monthly    ┌──────────────────────┐
│ Tickets created │ ──────────►  │ export_training_ │ ──────────►  │  retrain_pipeline.py │
│ by agents       │              │ data.py          │              │  (per model type)    │
└─────────────────┘              └──────────────────┘              └──────────┬───────────┘
                                                                               │
              ┌─────────────────────────────────────────────────────────────── ▼ ──────────────┐
              │  Improvement ≥ threshold?  YES → auto-deploy    NO → notify, keep old version   │
              └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step Manual Retraining

### Step 1 — Export labelled data

```bash
cd blueclue/ai
python scripts/export_training_data.py
```

This connects to PostgreSQL, fetches tickets created since the last export, and appends them to:
```
data/raw/tickets_exported.jsonl
```

Environment variables:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/blueclue
# OR individual overrides:
DB_HOST=localhost  DB_PORT=5432  DB_NAME=blueclue  DB_USER=...  DB_PASSWORD=...
```

### Step 2 — Prepare training data

```bash
python scripts/prepare_ml_data.py
```

Converts the JSONL export into train/val/test splits under `data/splits/`.

### Step 3 — Retrain models

Run one or all:

```bash
python src/train_category_model.py
python src/train_priority_model.py
python src/train_time_model.py
```

Or run all three via the pipeline script:

```bash
python scripts/retrain_pipeline.py
# Environment overrides:
RETRAIN_MODELS=category,priority,time
RETRAIN_AUTO_DEPLOY=true
RETRAIN_THRESHOLD=0.02
```

Model artefacts save to `models/`.

### Step 4 — Register new version

The pipeline script registers each new model automatically using `src/model_registry.py`.

To register manually:

```python
from src.model_registry import ModelRegistry
reg = ModelRegistry('models')
reg.register('category', version='v2_20260301', model_path='models/category_model.pkl',
             accuracy=0.89, training_sample_count=1200)
```

### Step 5 — Deploy

**Via dashboard**: Models tab → click **Deploy** next to the version you want active.

**Via API**:
```bash
curl -X POST http://localhost:3001/api/ml-admin/models/deploy \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model_type":"category","version":"v2_20260301"}'
```

**Via Python**:
```python
reg.deploy('category', 'v2_20260301')
```

### Step 6 — Verify

After deploying, the `/health` endpoint should reflect the new version.
Check the Overview tab → Avg Confidence trend for the next 24 hours.

---

## 3. Auto-Deploy Criteria

Auto-deploy fires when:
1. `retrain_pipeline.py` is run with `auto_deploy=True`.
2. New model accuracy > active model accuracy by `threshold` (default 2%).
3. Registered to the `ModelRegistry`.

```python
if registry.should_auto_deploy('category', 'v2_20260301', improvement_threshold=0.02):
    registry.deploy('category', 'v2_20260301')
```

---

## 4. Rollback Procedure

### Dashboard rollback

Models tab → click **↩ Rollback** for the model type.

### API rollback

```bash
curl -X POST http://localhost:3001/api/ml-admin/models/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model_type":"category"}'
```

### Manual rollback (Python)

```python
reg.rollback('category')              # rolls back to last-deployed version
reg.rollback('category', 'v1_20260224')  # rolls back to specific version
```

Rollback restores the model at the canonical path (`models/category_model_latest.pkl`) used by the ML service.

The ML service reads the new file on the **next startup** or when `/models/deploy` is called (which triggers a live reload).

---

## 5. Retraining Schedule (Recommended)

| Task | Frequency | Command |
|---|---|---|
| Export tickets | Weekly (Sun 02:00) | `python scripts/export_training_data.py` |
| Full retrain | Monthly (1st day 03:00) | `python scripts/retrain_pipeline.py` |
| Drift detection | Monthly (1st day 04:00) | `POST /api/ml-admin/drift/run` |

Add to crontab (Linux):
```cron
0 2 * * 0   cd /app/ai && python scripts/export_training_data.py >> logs/export.log 2>&1
0 3 1 * *   cd /app/ai && RETRAIN_AUTO_DEPLOY=true python scripts/retrain_pipeline.py >> logs/retrain.log 2>&1
```

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Export fails with "no such table" | Migration 028 not run | Run `database/migrations/028_add_ml_monitoring_tables.sql` |
| Low accuracy after retraining | Insufficient data | Export more data; check label quality |
| SHAP import error | `shap` not installed | `pip install shap>=0.45.0` |
| Auto-deploy not triggering | Accuracy delta too small | Lower `RETRAIN_THRESHOLD` or add more data |
| Rollback leaves service on old model | Service not reloaded | `POST /models/rollback` via API (triggers live reload) |
