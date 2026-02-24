"""
Data Splitter Module
====================

Creates stratified train/validation/test splits of ticket data.
Ensures proper class distribution across all splits.
"""

import os
import json
import random
from typing import Dict, List, Tuple, Any
from collections import Counter
import csv


class DataSplitter:
    """
    Splits ticket data into train/validation/test sets with stratification.
    
    Ensures that class distributions are maintained across all splits,
    which is critical for training robust classification models.
    
    Usage:
        splitter = DataSplitter(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15)
        train, val, test = splitter.split(tickets, stratify_by='category')
        splitter.save_splits(train, val, test, output_dir='../data/splits/')
    """
    
    def __init__(self,
                 train_ratio: float = 0.70,
                 val_ratio: float = 0.15,
                 test_ratio: float = 0.15,
                 random_seed: int = 42):
        """
        Initialize the data splitter.
        
        Args:
            train_ratio: Proportion of data for training (default 0.70)
            val_ratio: Proportion of data for validation (default 0.15)
            test_ratio: Proportion of data for testing (default 0.15)
            random_seed: Random seed for reproducibility
        """
        # Validate ratios
        total = train_ratio + val_ratio + test_ratio
        if abs(total - 1.0) > 0.001:
            raise ValueError(f"Ratios must sum to 1.0, got {total}")
        
        self.train_ratio = train_ratio
        self.val_ratio = val_ratio
        self.test_ratio = test_ratio
        self.random_seed = random_seed
        
        # Store split information
        self.split_info = {}
    
    def _stratified_split(self, 
                          data: List[Any], 
                          labels: List[str],
                          ratios: Tuple[float, float, float]) -> Tuple[List[Any], List[Any], List[Any]]:
        """
        Perform stratified split maintaining class distribution.
        
        Args:
            data: List of items to split
            labels: List of class labels (same length as data)
            ratios: Tuple of (train_ratio, val_ratio, test_ratio)
            
        Returns:
            Tuple of (train, val, test) splits
        """
        random.seed(self.random_seed)
        
        # Group data by label
        groups = {}
        for item, label in zip(data, labels):
            if label not in groups:
                groups[label] = []
            groups[label].append(item)
        
        train, val, test = [], [], []
        
        # Split each group proportionally
        for label, items in groups.items():
            random.shuffle(items)
            n = len(items)
            
            # Calculate split points
            n_train = int(n * ratios[0])
            n_val = int(n * ratios[1])
            
            # Ensure at least 1 item per split if possible
            if n >= 3:
                n_train = max(n_train, 1)
                n_val = max(n_val, 1)
            
            train.extend(items[:n_train])
            val.extend(items[n_train:n_train + n_val])
            test.extend(items[n_train + n_val:])
        
        # Shuffle each split
        random.shuffle(train)
        random.shuffle(val)
        random.shuffle(test)
        
        return train, val, test
    
    def split(self, 
              tickets: List[Dict],
              stratify_by: str = 'category') -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Split tickets into train/validation/test sets with stratification.
        
        Args:
            tickets: List of ticket dictionaries
            stratify_by: Field to use for stratification ('category' or 'priority')
            
        Returns:
            Tuple of (train_tickets, val_tickets, test_tickets)
        """
        if not tickets:
            raise ValueError("Cannot split empty data")
        
        # Extract labels for stratification
        labels = [ticket.get(stratify_by, 'unknown') for ticket in tickets]
        
        # Check class distribution
        class_counts = Counter(labels)
        min_count = min(class_counts.values())
        
        if min_count < 3:
            print(f"⚠ Warning: Some classes have fewer than 3 samples")
            print(f"  Class distribution: {dict(class_counts)}")
        
        # Perform stratified split
        train, val, test = self._stratified_split(
            tickets, 
            labels,
            (self.train_ratio, self.val_ratio, self.test_ratio)
        )
        
        # Store split information
        self.split_info = {
            'total_samples': len(tickets),
            'train_samples': len(train),
            'val_samples': len(val),
            'test_samples': len(test),
            'stratify_by': stratify_by,
            'random_seed': self.random_seed,
            'ratios': {
                'train': self.train_ratio,
                'validation': self.val_ratio,
                'test': self.test_ratio
            },
            'actual_ratios': {
                'train': len(train) / len(tickets),
                'validation': len(val) / len(tickets),
                'test': len(test) / len(tickets)
            },
            'train_distribution': dict(Counter(t.get(stratify_by) for t in train)),
            'val_distribution': dict(Counter(t.get(stratify_by) for t in val)),
            'test_distribution': dict(Counter(t.get(stratify_by) for t in test))
        }
        
        print(f"✓ Split {len(tickets)} tickets:")
        print(f"  - Train: {len(train)} ({len(train)/len(tickets)*100:.1f}%)")
        print(f"  - Validation: {len(val)} ({len(val)/len(tickets)*100:.1f}%)")
        print(f"  - Test: {len(test)} ({len(test)/len(tickets)*100:.1f}%)")
        
        return train, val, test
    
    def validate_splits(self,
                        train: List[Dict],
                        val: List[Dict],
                        test: List[Dict],
                        stratify_by: str = 'category') -> Dict[str, Any]:
        """
        Validate the quality of the splits.
        
        Args:
            train: Training set
            val: Validation set
            test: Test set
            stratify_by: Field used for stratification
            
        Returns:
            Dictionary with validation results
        """
        results = {
            'no_overlap': True,
            'distribution_balanced': True,
            'all_classes_present': True,
            'issues': []
        }
        
        # Check for overlap
        train_ids = {t.get('id') or t.get('ticket_number') for t in train}
        val_ids = {t.get('id') or t.get('ticket_number') for t in val}
        test_ids = {t.get('id') or t.get('ticket_number') for t in test}
        
        if train_ids & val_ids:
            results['no_overlap'] = False
            results['issues'].append(f"Train/Val overlap: {len(train_ids & val_ids)} items")
        
        if train_ids & test_ids:
            results['no_overlap'] = False
            results['issues'].append(f"Train/Test overlap: {len(train_ids & test_ids)} items")
        
        if val_ids & test_ids:
            results['no_overlap'] = False
            results['issues'].append(f"Val/Test overlap: {len(val_ids & test_ids)} items")
        
        # Check class distribution
        train_dist = Counter(t.get(stratify_by) for t in train)
        val_dist = Counter(t.get(stratify_by) for t in val)
        test_dist = Counter(t.get(stratify_by) for t in test)
        
        all_classes = set(train_dist.keys()) | set(val_dist.keys()) | set(test_dist.keys())
        
        # Check if all classes are present in all splits
        if set(train_dist.keys()) != all_classes:
            results['all_classes_present'] = False
            missing = all_classes - set(train_dist.keys())
            results['issues'].append(f"Train missing classes: {missing}")
        
        if set(val_dist.keys()) != all_classes:
            results['all_classes_present'] = False
            missing = all_classes - set(val_dist.keys())
            results['issues'].append(f"Val missing classes: {missing}")
        
        if set(test_dist.keys()) != all_classes:
            results['all_classes_present'] = False
            missing = all_classes - set(test_dist.keys())
            results['issues'].append(f"Test missing classes: {missing}")
        
        # Check distribution similarity (chi-square-like check)
        for class_name in all_classes:
            train_pct = train_dist.get(class_name, 0) / len(train) if train else 0
            val_pct = val_dist.get(class_name, 0) / len(val) if val else 0
            test_pct = test_dist.get(class_name, 0) / len(test) if test else 0
            
            # Check if distributions differ by more than 20%
            if max(train_pct, val_pct, test_pct) - min(train_pct, val_pct, test_pct) > 0.20:
                results['distribution_balanced'] = False
                results['issues'].append(
                    f"Class '{class_name}' imbalanced: train={train_pct:.2f}, val={val_pct:.2f}, test={test_pct:.2f}"
                )
        
        results['valid'] = results['no_overlap'] and results['all_classes_present']
        
        if results['valid']:
            print("✓ Splits validated successfully")
        else:
            print(f"⚠ Split validation issues: {len(results['issues'])}")
            for issue in results['issues'][:5]:  # Show first 5 issues
                print(f"  - {issue}")
        
        return results
    
    def save_splits(self,
                    train: List[Dict],
                    val: List[Dict],
                    test: List[Dict],
                    output_dir: str,
                    format: str = 'json'):
        """
        Save split data to files.
        
        Args:
            train: Training set
            val: Validation set
            test: Test set
            output_dir: Directory to save splits
            format: 'json' or 'csv'
        """
        os.makedirs(output_dir, exist_ok=True)
        
        splits = {
            'train': train,
            'val': val,
            'test': test
        }
        
        for split_name, data in splits.items():
            if format == 'json':
                filepath = os.path.join(output_dir, f'{split_name}.json')
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, default=str)
            else:
                filepath = os.path.join(output_dir, f'{split_name}.csv')
                if data:
                    fieldnames = data[0].keys()
                    with open(filepath, 'w', newline='', encoding='utf-8') as f:
                        writer = csv.DictWriter(f, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(data)
            
            print(f"  ✓ Saved {split_name}: {filepath} ({len(data)} samples)")
        
        # Save split metadata
        meta_path = os.path.join(output_dir, 'split_metadata.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(self.split_info, f, indent=2)
        
        print(f"  ✓ Saved split metadata: {meta_path}")
    
    def load_splits(self, 
                    input_dir: str,
                    format: str = 'json') -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Load previously saved splits.
        
        Args:
            input_dir: Directory containing saved splits
            format: 'json' or 'csv'
            
        Returns:
            Tuple of (train, val, test) data
        """
        splits = {}
        
        for split_name in ['train', 'val', 'test']:
            if format == 'json':
                filepath = os.path.join(input_dir, f'{split_name}.json')
                with open(filepath, 'r', encoding='utf-8') as f:
                    splits[split_name] = json.load(f)
            else:
                filepath = os.path.join(input_dir, f'{split_name}.csv')
                with open(filepath, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    splits[split_name] = list(reader)
        
        # Load metadata if available
        meta_path = os.path.join(input_dir, 'split_metadata.json')
        if os.path.exists(meta_path):
            with open(meta_path, 'r', encoding='utf-8') as f:
                self.split_info = json.load(f)
        
        print(f"✓ Loaded splits from {input_dir}")
        print(f"  - Train: {len(splits['train'])}")
        print(f"  - Val: {len(splits['val'])}")
        print(f"  - Test: {len(splits['test'])}")
        
        return splits['train'], splits['val'], splits['test']
    
    def get_split_report(self) -> str:
        """Generate a formatted report of the splits."""
        if not self.split_info:
            return "No split information available. Run split() first."
        
        report = []
        report.append("=" * 60)
        report.append("DATA SPLIT REPORT")
        report.append("=" * 60)
        report.append("")
        
        report.append(f"Total Samples: {self.split_info['total_samples']}")
        report.append(f"Stratified By: {self.split_info['stratify_by']}")
        report.append(f"Random Seed: {self.split_info['random_seed']}")
        report.append("")
        
        report.append("Split Sizes:")
        report.append(f"  Training:   {self.split_info['train_samples']:5d} "
                      f"({self.split_info['actual_ratios']['train']*100:5.1f}%)")
        report.append(f"  Validation: {self.split_info['val_samples']:5d} "
                      f"({self.split_info['actual_ratios']['validation']*100:5.1f}%)")
        report.append(f"  Test:       {self.split_info['test_samples']:5d} "
                      f"({self.split_info['actual_ratios']['test']*100:5.1f}%)")
        report.append("")
        
        report.append("Class Distribution (Training Set):")
        for cls, count in sorted(self.split_info['train_distribution'].items()):
            pct = count / self.split_info['train_samples'] * 100
            report.append(f"  {cls:20s}: {count:4d} ({pct:5.1f}%)")
        report.append("")
        
        report.append("Class Distribution (Validation Set):")
        for cls, count in sorted(self.split_info['val_distribution'].items()):
            pct = count / self.split_info['val_samples'] * 100
            report.append(f"  {cls:20s}: {count:4d} ({pct:5.1f}%)")
        report.append("")
        
        report.append("Class Distribution (Test Set):")
        for cls, count in sorted(self.split_info['test_distribution'].items()):
            pct = count / self.split_info['test_samples'] * 100
            report.append(f"  {cls:20s}: {count:4d} ({pct:5.1f}%)")
        
        report.append("")
        report.append("=" * 60)
        
        return "\n".join(report)


if __name__ == "__main__":
    # Example usage
    from synthetic_generator import SyntheticDataGenerator
    from preprocessor import DataPreprocessor
    
    # Generate and preprocess data
    generator = SyntheticDataGenerator(seed=42)
    raw_tickets = generator.generate(n_samples=1000)
    
    preprocessor = DataPreprocessor()
    clean_tickets = preprocessor.preprocess(raw_tickets)
    
    # Split data
    splitter = DataSplitter(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15)
    train, val, test = splitter.split(clean_tickets, stratify_by='category')
    
    # Validate splits
    validation = splitter.validate_splits(train, val, test, stratify_by='category')
    
    # Print report
    print("\n" + splitter.get_split_report())
    
    # Save splits
    splitter.save_splits(train, val, test, '../data/splits/', format='json')
