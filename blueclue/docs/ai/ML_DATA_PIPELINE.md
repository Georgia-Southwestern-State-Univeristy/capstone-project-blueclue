# BlueClue ML Data Pipeline

Complete machine learning data pipeline for ticket classification model training.

## Overview

This pipeline prepares historical ticket data for training ML models to classify:
- **Category**: hardware, software, network, login, billing, account, feature_request, other
- **Priority**: low, medium, high, critical

## Quick Start

### 1. Install Dependencies

```bash
cd blueclue/ai
pip install -r requirements-ml.txt
```

### 2. Generate Training Data

Since you may not have sufficient real data, start with synthetic data:

```bash
# Generate 1000 synthetic tickets and prepare for ML
python scripts/prepare_ml_data.py --synthetic --samples 1000
```

### 3. Use Prepared Data

```python
from ml.data_loader import DataLoader

# Load all prepared data
loader = DataLoader('./data')
loader.summary()

# Get training data
X_train, y_train = loader.get_features('train')
X_val, y_val = loader.get_features('val')
X_test, y_test = loader.get_features('test')

# Or get ticket dictionaries
train, val, test = loader.get_splits()
```

## Pipeline Commands

```bash
# Full pipeline with synthetic data (recommended for starting)
python scripts/prepare_ml_data.py --synthetic --samples 1000

# Export from database (requires PostgreSQL connection)
python scripts/prepare_ml_data.py --export

# Use existing raw data file
python scripts/prepare_ml_data.py --input data/raw/tickets.json

# Custom options
python scripts/prepare_ml_data.py --synthetic --samples 2000 --seed 123 --skip-eda
```

## Directory Structure

After running the pipeline:

```
blueclue/ai/data/
├── raw/                          # Original/exported data
│   ├── synthetic_tickets.json    # Generated synthetic data
│   └── synthetic_tickets.csv     # Same data in CSV format
├── processed/                    # Cleaned data
│   ├── tickets_clean.json        # Preprocessed tickets
│   └── preprocessing_report.json # Preprocessing statistics
├── splits/                       # Train/val/test splits
│   ├── train.json                # 70% training data
│   ├── val.json                  # 15% validation data
│   ├── test.json                 # 15% test data
│   └── split_metadata.json       # Split statistics
├── features/                     # ML-ready feature matrices
│   ├── feature_extractor.pkl     # Fitted TF-IDF + feature extractor
│   ├── train_features.npz        # Training feature matrix
│   ├── val_features.npz          # Validation feature matrix
│   ├── test_features.npz         # Test feature matrix
│   └── feature_documentation.json # Feature descriptions
└── reports/                      # EDA analysis
    ├── EDA_REPORT.md             # Markdown report
    ├── eda_analysis.json         # Raw analysis data
    └── visualizations/           # Charts and plots
        ├── category_distribution.png
        ├── priority_distribution.png
        ├── text_length_distribution.png
        ├── temporal_patterns.png
        └── category_priority_heatmap.png
```

## Pipeline Modules

### 1. Data Exporter (`ml/data_exporter.py`)

Exports ticket data from PostgreSQL database.

```python
from ml.data_exporter import DataExporter

exporter = DataExporter()
exporter.connect()
tickets = exporter.export_tickets(limit=1000)
stats = exporter.get_ticket_statistics()
exporter.save_to_csv(tickets, 'tickets.csv')
exporter.disconnect()
```

### 2. Synthetic Generator (`ml/synthetic_generator.py`)

Generates realistic synthetic IT support tickets for training.

```python
from ml.synthetic_generator import SyntheticDataGenerator

generator = SyntheticDataGenerator(seed=42)
tickets = generator.generate(n_samples=1000)
generator.save_to_json(tickets, 'synthetic.json')
```

Features:
- 8 categories with realistic templates
- 4 priority levels with appropriate distribution
- Realistic text patterns and IT terminology
- Proper metadata (timestamps, user history, etc.)

### 3. Preprocessor (`ml/preprocessor.py`)

Cleans and normalizes ticket data.

```python
from ml.preprocessor import DataPreprocessor

preprocessor = DataPreprocessor(
    remove_pii=True,          # Mask emails, phones, SSNs
    handle_missing='impute',  # Fill missing values
    remove_duplicates=True    # Remove duplicate tickets
)

clean_tickets = preprocessor.preprocess(raw_tickets)
balanced_tickets = preprocessor.balance_classes(clean_tickets, target_field='category')
```

Features:
- PII removal (emails, phone numbers, SSNs, credit cards)
- Missing value imputation
- Duplicate detection
- Category/priority normalization
- Class balancing (oversampling/undersampling)

### 4. Feature Extractor (`ml/feature_extractor.py`)

Extracts ML features from ticket text and metadata.

```python
from ml.feature_extractor import FeatureExtractor

extractor = FeatureExtractor(max_features=3000)
extractor.fit(train_tickets)

X_train = extractor.transform(train_tickets)
y_train = extractor.extract_labels(train_tickets, target='category')

extractor.save('feature_extractor.pkl')
```

Features extracted:
- **TF-IDF vectors** from text (up to 5000 n-grams)
- **Text statistics**: length, word count, sentence count
- **Urgency indicators**: critical/high keywords presence
- **IT terms**: presence of 30+ domain-specific terms
- **Temporal features**: hour, day of week, business hours
- **User features**: previous ticket count, repeat user flag
- **Metadata**: AI confidence, priority override flags

### 5. Data Splitter (`ml/data_splitter.py`)

Creates stratified train/val/test splits.

```python
from ml.data_splitter import DataSplitter

splitter = DataSplitter(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15)
train, val, test = splitter.split(tickets, stratify_by='category')

splitter.validate_splits(train, val, test)
splitter.save_splits(train, val, test, 'splits/')
```

Features:
- Stratified splitting (maintains class distribution)
- Overlap validation
- Distribution comparison
- Detailed split reports

### 6. EDA Reporter (`ml/eda.py`)

Generates comprehensive exploratory data analysis.

```python
from ml.eda import EDAReporter

eda = EDAReporter(use_matplotlib=True)
analysis = eda.analyze(tickets)
eda.generate_report(tickets, 'reports/')
```

Generates:
- Category/priority distribution plots
- Text length histograms
- Temporal pattern charts
- Category-priority heatmap
- Data quality assessment
- Key insights and recommendations

## Data Schema

### Input Ticket Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Ticket ID |
| `ticket_number` | str | Reference number (TICK-2026-00001) |
| `subject` | str | Ticket subject line |
| `description` | str | Full ticket description |
| `category` | str | Category (hardware, software, etc.) |
| `priority` | str | Priority level (low, medium, high, critical) |
| `status` | str | Current status |
| `ai_classified` | bool | Whether AI classified this ticket |
| `ai_confidence` | float | AI confidence score (0-1) |
| `created_at` | datetime | Creation timestamp |
| `resolved_at` | datetime | Resolution timestamp (if resolved) |

### Output Feature Matrix

The feature extractor produces a dense matrix with:
- ~3000 TF-IDF features from text
- 9 text statistics features
- 3 urgency indicator features
- 30 IT term presence features
- 7 temporal features
- 3 user history features
- 6 metadata features

Total: ~3050 features per ticket

## Pipeline Best Practices

### Data Leakage Prevention

The pipeline is designed to prevent data leakage:

1. **Split BEFORE balancing**: Data is split into train/val/test BEFORE class balancing
2. **Balance training only**: Only the training set is oversampled/balanced
3. **Val/test remain natural**: Validation and test sets keep original distribution

This ensures:
- No duplicate samples leak across splits
- Test performance reflects real-world distribution
- Model evaluation is unbiased

### Recommended Workflow

```
Raw Data (2500+)
    ↓
Preprocessing (PII removal, dedup)
    ↓
Clean Data (~2400)
    ↓
Stratified Split (70/15/15)
    ├── Training (1670) → Balance to ~1800
    ├── Validation (350) → Keep original
    └── Test (365) → Keep original
    ↓
Feature Extraction (fit on train only)
    ↓
Feature Matrices Ready
```

## Success Criteria

After running the pipeline, verify:

- [ ] Dataset contains 1000+ tickets
- [ ] No PII in processed data (check for emails, phones)
- [ ] Balanced category distribution (<2:1 ratio)
- [ ] Train/val/test splits created (70/15/15)
- [ ] Feature matrices ready in .npz format
- [ ] EDA report generated with insights

## Next Steps

After preparing the data:

1. **Train Classification Model**
   ```python
   from sklearn.ensemble import RandomForestClassifier
   
   model = RandomForestClassifier(n_estimators=100)
   model.fit(X_train, y_train)
   
   val_accuracy = model.score(X_val, y_val)
   ```

2. **Evaluate on Test Set**
   ```python
   from sklearn.metrics import classification_report
   
   y_pred = model.predict(X_test)
   print(classification_report(y_test, y_pred))
   ```

3. **Integrate with Existing Classifier**
   - Update `src/classifier.py` to use trained model
   - Add ML model as fallback/enhancement to keyword matching

## Troubleshooting

### Database Connection Failed
- Check `.env` file has correct DB credentials
- Ensure PostgreSQL is running
- Use `--synthetic` flag to generate data without database

### Not Enough Data
- Run with `--samples 2000` for more synthetic data
- Collect more real tickets before training production model

### Memory Issues
- Reduce `--samples` count
- Reduce `max_features` in FeatureExtractor
- Process data in batches

### Missing Dependencies
```bash
pip install scikit-learn pandas numpy matplotlib seaborn psycopg2-binary
```
