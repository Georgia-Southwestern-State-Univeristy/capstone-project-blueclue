#!/usr/bin/env python
"""
BlueClue ML Data Pipeline
=========================

Main script to prepare data for machine learning model training.
Executes the full pipeline: generate/export → preprocess → split → extract features → EDA

Usage:
    # Generate synthetic data and run full pipeline
    python prepare_ml_data.py --synthetic --samples 1000

    # Export from database and run pipeline  
    python prepare_ml_data.py --export

    # Run pipeline on existing data
    python prepare_ml_data.py --input ../data/raw/tickets.json

    # Generate only synthetic data
    python prepare_ml_data.py --synthetic --samples 2000 --output ../data/raw/synthetic.json

Options:
    --synthetic     Generate synthetic training data
    --samples N     Number of synthetic samples to generate (default: 1000)
    --export        Export data from PostgreSQL database
    --input FILE    Use existing data file as input
    --output DIR    Output directory (default: ../data)
    --skip-eda      Skip EDA report generation
    --seed N        Random seed for reproducibility (default: 42)
"""

import os
import sys
import argparse
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.synthetic_generator import SyntheticDataGenerator
from ml.data_exporter import DataExporter
from ml.preprocessor import DataPreprocessor
from ml.feature_extractor import FeatureExtractor
from ml.data_splitter import DataSplitter
from ml.eda import EDAReporter


def ensure_directories(base_dir: str):
    """Create required directory structure."""
    dirs = [
        os.path.join(base_dir, 'raw'),
        os.path.join(base_dir, 'processed'),
        os.path.join(base_dir, 'splits'),
        os.path.join(base_dir, 'features'),
        os.path.join(base_dir, 'reports'),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    print(f"✓ Created directory structure in {base_dir}")


def run_pipeline(args):
    """Run the full data preparation pipeline."""
    
    print("=" * 60)
    print("BlueClue ML Data Preparation Pipeline")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    print()
    
    # Setup directories
    base_dir = args.output
    ensure_directories(base_dir)
    
    tickets = []
    
    # Step 1: Get raw data
    print("\n" + "=" * 60)
    print("STEP 1: Data Acquisition")
    print("=" * 60)
    
    if args.synthetic:
        # Generate synthetic data
        print(f"Generating {args.samples} synthetic tickets...")
        generator = SyntheticDataGenerator(seed=args.seed)
        tickets = generator.generate(n_samples=args.samples)
        
        # Save raw synthetic data
        raw_path = os.path.join(base_dir, 'raw', 'synthetic_tickets.json')
        generator.save_to_json(tickets, raw_path)
        
        # Also save as CSV
        csv_path = os.path.join(base_dir, 'raw', 'synthetic_tickets.csv')
        generator.save_to_csv(tickets, csv_path)
        
    elif args.export:
        # Export from database
        print("Exporting tickets from database...")
        exporter = DataExporter()
        
        if not exporter.connect():
            print("✗ Failed to connect to database. Check your connection settings.")
            print("  Falling back to synthetic data generation...")
            generator = SyntheticDataGenerator(seed=args.seed)
            tickets = generator.generate(n_samples=args.samples)
            raw_path = os.path.join(base_dir, 'raw', 'synthetic_tickets.json')
            generator.save_to_json(tickets, raw_path)
        else:
            # Get statistics first
            stats = exporter.get_ticket_statistics()
            print(f"Database contains {stats['total_tickets']} tickets")
            
            if stats['total_tickets'] < 100:
                print(f"⚠ Only {stats['total_tickets']} tickets found. Augmenting with synthetic data...")
                
                # Export what we have
                db_tickets = exporter.export_tickets()
                exporter.disconnect()
                
                # Generate additional synthetic data
                needed = max(1000 - len(db_tickets), 500)
                print(f"Generating {needed} additional synthetic tickets...")
                generator = SyntheticDataGenerator(seed=args.seed)
                synthetic = generator.generate(n_samples=needed)
                
                tickets = db_tickets + synthetic
                print(f"Combined: {len(db_tickets)} real + {len(synthetic)} synthetic = {len(tickets)} total")
            else:
                tickets = exporter.export_tickets()
                exporter.disconnect()
            
            # Save raw data
            raw_path = os.path.join(base_dir, 'raw', 'tickets.json')
            exporter.save_to_json(tickets, raw_path)
    
    elif args.input:
        # Load from existing file
        print(f"Loading data from {args.input}...")
        if args.input.endswith('.json'):
            with open(args.input, 'r', encoding='utf-8') as f:
                tickets = json.load(f)
        elif args.input.endswith('.csv'):
            import csv
            with open(args.input, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                tickets = list(reader)
        else:
            print(f"✗ Unsupported file format: {args.input}")
            return False
        
        print(f"✓ Loaded {len(tickets)} tickets")
    
    else:
        print("✗ No data source specified. Use --synthetic, --export, or --input")
        return False
    
    print(f"\n✓ Total raw tickets: {len(tickets)}")
    
    # Step 2: Preprocess data (without balancing - balance after split)
    print("\n" + "=" * 60)
    print("STEP 2: Data Preprocessing")
    print("=" * 60)
    
    preprocessor = DataPreprocessor(
        remove_pii=True,
        handle_missing='impute',
        remove_duplicates=True
    )
    clean_tickets = preprocessor.preprocess(tickets)
    
    # Save cleaned data (before balancing)
    processed_path = os.path.join(base_dir, 'processed', 'tickets_clean.json')
    preprocessor.save_preprocessed(clean_tickets, processed_path)
    
    # Save preprocessing report
    report = preprocessor.get_preprocessing_report()
    report_path = os.path.join(base_dir, 'processed', 'preprocessing_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Step 3: Create data splits BEFORE balancing (to avoid data leakage)
    print("\n" + "=" * 60)
    print("STEP 3: Train/Val/Test Splitting")
    print("=" * 60)
    
    splitter = DataSplitter(
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        random_seed=args.seed
    )
    
    train, val, test = splitter.split(clean_tickets, stratify_by='category')
    
    # Step 3b: Balance ONLY the training set (prevents data leakage)
    print("\n--- Balancing Training Set Only ---")
    train = preprocessor.balance_classes(
        train, 
        target_field='category',
        strategy='oversample',
        max_ratio=2.0
    )
    print("Note: Validation and test sets remain unbalanced to reflect real-world distribution")
    
    # Validate splits
    validation = splitter.validate_splits(train, val, test, stratify_by='category')
    
    # Save splits
    splits_dir = os.path.join(base_dir, 'splits')
    splitter.save_splits(train, val, test, splits_dir, format='json')
    
    # Print split report
    print(splitter.get_split_report())
    
    # Step 4: Feature extraction
    print("\n" + "=" * 60)
    print("STEP 4: Feature Extraction")
    print("=" * 60)
    
    extractor = FeatureExtractor(
        max_features=3000,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95
    )
    
    # Fit on training data only
    print("Fitting feature extractor on training data...")
    extractor.fit(train)
    
    # Transform all splits
    print("Transforming train/val/test sets...")
    
    X_train = extractor.transform(train)
    y_train = extractor.extract_labels(train, target='category')
    
    X_val = extractor.transform(val)
    y_val = extractor.extract_labels(val, target='category')
    
    X_test = extractor.transform(test)
    y_test = extractor.extract_labels(test, target='category')
    
    # Save features
    features_dir = os.path.join(base_dir, 'features')
    
    extractor.save(os.path.join(features_dir, 'feature_extractor.pkl'))
    extractor.save_feature_matrix(X_train, y_train, os.path.join(features_dir, 'train_features.npz'))
    extractor.save_feature_matrix(X_val, y_val, os.path.join(features_dir, 'val_features.npz'))
    extractor.save_feature_matrix(X_test, y_test, os.path.join(features_dir, 'test_features.npz'))
    
    # Save feature documentation
    feature_docs = extractor.get_feature_documentation()
    docs_path = os.path.join(features_dir, 'feature_documentation.json')
    # Only save first 100 feature docs (TF-IDF features are auto-generated)
    limited_docs = dict(list(feature_docs.items())[:100])
    with open(docs_path, 'w') as f:
        json.dump(limited_docs, f, indent=2)
    print(f"✓ Saved feature documentation (first 100 features)")
    
    # Step 5: EDA Report
    if not args.skip_eda:
        print("\n" + "=" * 60)
        print("STEP 5: Exploratory Data Analysis")
        print("=" * 60)
        
        eda = EDAReporter(use_matplotlib=True)
        reports_dir = os.path.join(base_dir, 'reports')
        eda.generate_report(clean_tickets, reports_dir)
    
    # Calculate totals
    total_samples = len(train) + len(val) + len(test)
    
    # Final summary
    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"\nData prepared successfully!")
    print(f"\nOutput directory: {base_dir}")
    print(f"\nDataset summary:")
    print(f"  - Total clean tickets: {len(clean_tickets)}")
    print(f"  - Training set (balanced): {len(train)} ({len(train)/total_samples*100:.1f}%)")
    print(f"  - Validation set:      {len(val)} ({len(val)/total_samples*100:.1f}%)")
    print(f"  - Test set:            {len(test)} ({len(test)/total_samples*100:.1f}%)")
    print(f"\nFeature matrix:")
    print(f"  - Train features:     {X_train.shape}")
    print(f"  - Validation features: {X_val.shape}")
    print(f"  - Test features:      {X_test.shape}")
    print(f"\nGenerated files:")
    print(f"  - {base_dir}/raw/              Raw ticket data")
    print(f"  - {base_dir}/processed/        Cleaned data")
    print(f"  - {base_dir}/splits/           Train/val/test splits")
    print(f"  - {base_dir}/features/         Feature matrices")
    print(f"  - {base_dir}/reports/          EDA report")
    
    print(f"\nCompleted at: {datetime.now().isoformat()}")
    print("=" * 60)
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description='BlueClue ML Data Preparation Pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate 1000 synthetic tickets and prepare for training
  python prepare_ml_data.py --synthetic --samples 1000
  
  # Export real data from database
  python prepare_ml_data.py --export
  
  # Use existing data file
  python prepare_ml_data.py --input ../data/raw/tickets.json
  
  # Generate more samples with custom seed
  python prepare_ml_data.py --synthetic --samples 2000 --seed 123
        """
    )
    
    # Data source options (mutually exclusive)
    source_group = parser.add_mutually_exclusive_group()
    source_group.add_argument('--synthetic', action='store_true',
                             help='Generate synthetic training data')
    source_group.add_argument('--export', action='store_true',
                             help='Export data from PostgreSQL database')
    source_group.add_argument('--input', type=str,
                             help='Path to existing data file (JSON or CSV)')
    
    # Configuration options
    parser.add_argument('--samples', type=int, default=1000,
                       help='Number of synthetic samples to generate (default: 1000)')
    parser.add_argument('--output', type=str, 
                       default=os.path.join(os.path.dirname(__file__), '..', 'data'),
                       help='Output directory for all generated data')
    parser.add_argument('--skip-eda', action='store_true',
                       help='Skip EDA report generation')
    parser.add_argument('--seed', type=int, default=42,
                       help='Random seed for reproducibility (default: 42)')
    
    args = parser.parse_args()
    
    # Default to synthetic if no source specified
    if not (args.synthetic or args.export or args.input):
        args.synthetic = True
        print("No data source specified, defaulting to synthetic data generation")
    
    # Normalize output path
    args.output = os.path.abspath(args.output)
    
    success = run_pipeline(args)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
