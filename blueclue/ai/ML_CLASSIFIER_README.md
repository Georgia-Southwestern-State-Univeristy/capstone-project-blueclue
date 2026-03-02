# BlueClue ML Category Classifier

Multi-class classification model for IT support ticket categorization.

## Model Summary

| Metric | Value |
|--------|-------|
| **Model Type** | Random Forest Classifier |
| **Version** | v1_20260224 |
| **Accuracy** | 100.00% |
| **F1-Score (macro)** | 1.0000 |
| **Inference Time** | ~47ms per prediction |
| **Categories** | 8 |

## Quick Start

### Basic Usage

```python
from src.ml_classifier import MLCategoryClassifier

# Load the trained model
classifier = MLCategoryClassifier()

# Classify a ticket
result = classifier.predict(
    text="I can't connect to the company WiFi network",
    subject="WiFi issue"
)

print(f"Category: {result['category']}")  # network
print(f"Confidence: {result['confidence']:.2%}")  # 77.95%
```

### Batch Prediction

```python
tickets = [
    {"description": "My laptop screen is cracked", "subject": "Broken laptop"},
    {"description": "Can't log into my account", "subject": "Login issue"},
]

results = classifier.predict_batch(tickets)
for r in results:
    print(f"{r['category']}: {r['confidence']:.2%}")
```

## Model Architecture

### Algorithm Selection

| Algorithm | Val Accuracy | CV Score | Train Time | Inference |
|-----------|-------------|----------|------------|-----------|
| **Random Forest** ★ | 100.00% | 99.89% | 5.79s | 47ms |
| SVM (Linear) | 100.00% | 100.00% | 27.94s | 1.3ms |
| Gradient Boosting | 99.44% | 99.89% | 270s | 0.5ms |
| Dummy (Baseline) | 20.22% | 18.72% | 0.08s | 0.01ms |

**Random Forest was selected** because:
- Best balance of accuracy and training speed
- Handles high-dimensional sparse data well
- Provides probability estimates for confidence scoring
- No convergence issues like some alternatives

### Feature Engineering

Total features: **2,796**

| Feature Type | Count | Description |
|-------------|-------|-------------|
| TF-IDF (1,2-grams) | 2,737 | Text vectorization of descriptions |
| Text Statistics | 9 | Length, word count, sentence count |
| Urgency Indicators | 3 | Critical/emergency keyword presence |
| IT Terms | 30 | Domain-specific terminology |
| Temporal | 7 | Hour, day of week, business hours |
| User History | 3 | Repeat user, ticket count |
| Metadata | 6 | AI confidence, overrides |

### Categories

| Category | Description | Test Samples |
|----------|-------------|--------------|
| software | OS, applications, installations | 74 |
| network | WiFi, VPN, connectivity | 63 |
| hardware | Computers, peripherals, damage | 55 |
| login | Password reset, access issues | 54 |
| other | Miscellaneous requests | 36 |
| billing | Invoices, subscriptions, charges | 30 |
| account | Profile, permissions, roles | 30 |
| feature_request | New features, enhancements | 23 |

## Training Instructions

### Retrain Model

```bash
cd blueclue/ai

# Train with all algorithms and hyperparameter tuning
python src/train_category_model.py --all --tune

# Train specific model
python src/train_category_model.py --model random_forest --tune

# Quick training (smaller hyperparameter grid)
python src/train_category_model.py --all --tune --quick
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--data PATH` | Data directory (default: ./data) |
| `--model NAME` | Specific model to train |
| `--all` | Train and compare all models |
| `--tune` | Enable hyperparameter tuning |
| `--quick` | Use smaller grid for faster tuning |
| `--seed INT` | Random seed (default: 42) |
| `--output PATH` | Model output directory |

## Success Criteria Status

| Criterion | Target | Achieved | Status |
|-----------|--------|----------|--------|
| Test Accuracy | > 85% | 100.00% | ✅ PASS |
| All F1 Scores | > 0.75 | 1.0 (all) | ✅ PASS |
| Inference Time | < 100ms | 47ms | ✅ PASS |
| Beat Baseline | by 15%+ | +79.78% | ✅ PASS |
| Model Saved | Yes | Yes | ✅ PASS |

## Files

```
blueclue/ai/
├── src/
│   ├── train_category_model.py   # Training script
│   └── ml_classifier.py          # Inference module
├── models/
│   ├── category_classifier_latest.pkl      # Latest model
│   ├── category_classifier_v1_20260224.pkl # Versioned model
│   ├── model_card_v1_20260224.json         # Model metadata
│   └── training_log_v1_20260224.json       # Training details
└── data/
    ├── features/
    │   └── feature_extractor.pkl  # Required for inference
    └── splits/
        └── split_metadata.json    # Dataset info
```

## Integration Guide

### Replace Keyword Classifier

To use the ML model as the primary classifier:

```python
# In your API or service
from src.ml_classifier import MLCategoryClassifier

# Initialize once
classifier = MLCategoryClassifier()

def classify_ticket(description, subject=None):
    result = classifier.predict(description, subject)
    return {
        'category': result['category'],
        'confidence': result['confidence'],
        'all_categories': result['all_scores']
    }
```

### Hybrid Approach

Use ML with keyword fallback for low-confidence predictions:

```python
from src.ml_classifier import HybridClassifier

classifier = HybridClassifier(confidence_threshold=0.7)
result = classifier.classify(description, subject)

# result includes:
# - category
# - confidence
# - method ('ml' or 'keyword')
# - fallback_used (bool)
```

## Known Limitations

1. **Synthetic Data Performance**: The 100% accuracy is achieved on synthetic data with distinct templates. Real-world performance may differ.

2. **Out-of-Vocabulary**: New terminology not in training data may reduce confidence.

3. **Category Overlap**: Some categories (e.g., "login" vs "account") may have semantic overlap in real tickets.

## Recommendations for Production

1. **Collect Real Data**: Replace or augment synthetic data with actual support tickets.

2. **Monitor Confidence**: Log predictions with confidence < 70% for review.

3. **Periodic Retraining**: Retrain model monthly with new ticket data.

4. **A/B Testing**: Compare ML vs keyword classifier on real traffic before full replacement.

5. **Error Tracking**: Monitor misclassifications to identify systematic issues.

## Model Card

```json
{
  "model_name": "Random Forest",
  "version": "v1_20260224",
  "training_date": "2026-02-24",
  "accuracy": 1.0,
  "f1_macro": 1.0,
  "inference_time_ms": 47.3,
  "training_samples": 1816,
  "test_samples": 365,
  "features": 2796,
  "hyperparameters": {
    "n_estimators": 200,
    "max_depth": 20,
    "class_weight": "balanced"
  }
}
```

## Changelog

### v1_20260224
- Initial model trained on synthetic data
- Random Forest classifier with hyperparameter tuning
- 8 category classification
- Feature extraction pipeline with TF-IDF + metadata
