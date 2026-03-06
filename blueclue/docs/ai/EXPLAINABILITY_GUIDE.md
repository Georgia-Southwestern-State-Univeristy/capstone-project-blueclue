# SHAP Explainability Guide

BlueClue's ML service generates a natural-language explanation for every classification using SHAP (SHapley Additive exPlanations).  
This guide explains what SHAP is, how to read the output, and how to surface explanations in the UI.

---

## What is SHAP?

SHAP attributes the model's prediction to individual input features.  
Each feature receives a *SHAP value* representing how much it pushed the prediction toward (positive) or away (negative) from the predicted class.

For text classification in BlueClue the "features" are TF-IDF terms extracted from ticket subjects and descriptions.

---

## Explanation Object Format

```json
{
  "model_type": "category",
  "predicted_label": "Software",
  "confidence": 0.87,
  "top_features": [
    ["windows error",    0.42],
    ["application crash",0.31],
    ["blue screen",      0.19],
    ["install failed",   0.08],
    ["driver update",    0.05]
  ],
  "summary": "Software (87% confident) because: windows error, application crash, blue screen",
  "method": "shap_tree"
}
```

### Fields

| Field | Type | Meaning |
|---|---|---|
| `model_type` | string | `"category"`, `"priority"`, or `"time"` |
| `predicted_label` | string | The class the model chose |
| `confidence` | float 0–1 | Model's self-reported certainty |
| `top_features` | list of [term, weight] | Most influential text terms, sorted by weight |
| `summary` | string | One-line human-readable explanation |
| `method` | string | How the explanation was generated (see below) |

---

## Method Types

| Method | When used | Quality |
|---|---|---|
| `shap_tree` | Random Forest / Gradient Boosting (default) | Best — exact Shapley values |
| `shap_linear` | Logistic Regression / Ridge | Exact for linear models |
| `shap_kernel` | Any model as fallback | Approximate, slower |
| `feature_importance` | SHAP unavailable, tree model | Good — uses impurity importances |
| `keyword_fallback` | All else fails | Approximate — uses raw TF-IDF term weights |

---

## Interpreting Feature Weights

```
0.0                0.2               0.4
│──── minor ────│──── moderate ────│──── strong ────►
```

- **> 0.35** — this term was a dominant driver of the prediction.
- **0.15–0.35** — meaningful supporting evidence.
- **< 0.15** — minor contributor; may appear just because it's common in that category.

---

## Confidence Colour Coding (UI)

| Level | Range | Colour |
|---|---|---|
| High | ≥ 80% | 🟢 Green |
| Medium | 60–79% | 🟡 Yellow |
| Low | < 60% | 🔴 Red |

When the confidence is **Low**, the `ExplainabilityPanel` shows a warning badge.  
Consider routing these tickets to a senior technician for manual review.

---

## Embedding the ExplainabilityPanel in a Ticket Page

```jsx
import ExplainabilityPanel from '../components/ml/ExplainabilityPanel'

// Minimal usage — provide the stored explanation
<ExplainabilityPanel explanation={ticket.ai_explanation} />

// Auto-fetch via SHAP API on mount
<ExplainabilityPanel
  ticketId={ticket.id}
  subject={ticket.subject}
  description={ticket.description}
  autoLoad={true}
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `explanation` | object | `null` | Pre-fetched explanation JSON (see format above) |
| `ticketId` | string/number | — | Used for caching; optional |
| `subject` | string | — | Ticket subject to explain |
| `description` | string | — | Ticket description to explain |
| `autoLoad` | bool | `false` | If true, fetches SHAP explanation on mount |
| `className` | string | `''` | Extra CSS classes |

---

## API Endpoint

```bash
POST http://localhost:5000/explain
Content-Type: application/json

{
  "ticket_id": 42,
  "subject": "Cannot open Outlook after Windows update",
  "description": "Getting a crash every time I launch Outlook.",
  "model_type": "category"
}
```

Response:
```json
{
  "ticket_id": 42,
  "model_type": "category",
  "predicted_label": "Software",
  "confidence": 0.87,
  "top_features": [...],
  "summary": "Software (87% confident) because: outlook, crash, windows update",
  "method": "shap_tree",
  "cache_hit": false
}
```

The explanation is **cached in-memory for 10 minutes** (keyed by MD5 of subject+description+model_type), so repeated calls for the same ticket are free.

---

## When to Audit Explanations

1. **Override rate spike**: When agents start overriding more than 25%, look at recent explanations to understand what the model is picking up on.
2. **Low confidence cluster**: If many predictions score < 60% for a new ticket type, the model may need more training data for that topic.
3. **New ticket category**: Explanations for predicted categories you don't recognise suggest new topics are emerging in your ticket stream.

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| `method: keyword_fallback` always | SHAP not installed | `pip install shap>=0.45.0` and restart service |
| Empty `top_features` | Model not loaded | Check `/health` — confirm model is loaded |
| Explanation doesn't match human expectation | Feature noise or too little data | Retrain with more labelled examples |
| Very slow `/explain` calls | KernelExplainer being used | Switch to a tree-based model (RF/GBT) |
