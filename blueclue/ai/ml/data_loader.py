"""
Data Loading Utilities
======================

Utilities for loading prepared ML data and features.
"""

import os
import json
import pickle
from typing import Dict, List, Tuple, Optional, Any
import numpy as np


def load_tickets(filepath: str) -> List[Dict]:
    """
    Load tickets from file.
    
    Args:
        filepath: Path to JSON or CSV file
        
    Returns:
        List of ticket dictionaries
    """
    if filepath.endswith('.json'):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    elif filepath.endswith('.csv'):
        import csv
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)
    else:
        raise ValueError(f"Unsupported file format: {filepath}")


def load_splits(data_dir: str) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Load train/val/test splits from directory.
    
    Args:
        data_dir: Directory containing split files
        
    Returns:
        Tuple of (train, val, test) ticket lists
    """
    train_path = os.path.join(data_dir, 'train.json')
    val_path = os.path.join(data_dir, 'val.json')
    test_path = os.path.join(data_dir, 'test.json')
    
    train = load_tickets(train_path)
    val = load_tickets(val_path)
    test = load_tickets(test_path)
    
    print(f"✓ Loaded splits: train={len(train)}, val={len(val)}, test={len(test)}")
    
    return train, val, test


def load_features(filepath: str) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Load feature matrix from NPZ file.
    
    Args:
        filepath: Path to .npz file
        
    Returns:
        Tuple of (features, labels, feature_names)
    """
    data = np.load(filepath, allow_pickle=True)
    features = data['features']
    labels = data['labels']
    feature_names = data['feature_names'].tolist() if 'feature_names' in data else []
    
    print(f"✓ Loaded features: {features.shape}")
    
    return features, labels, feature_names


def load_feature_extractor(filepath: str):
    """
    Load a trained feature extractor.
    
    Args:
        filepath: Path to .pkl file
        
    Returns:
        FeatureExtractor instance
    """
    from .feature_extractor import FeatureExtractor
    return FeatureExtractor.load(filepath)


def load_metadata(data_dir: str) -> Dict[str, Any]:
    """
    Load dataset metadata.
    
    Args:
        data_dir: Data directory root
        
    Returns:
        Dictionary of metadata
    """
    metadata = {}
    
    # Load split metadata
    split_meta_path = os.path.join(data_dir, 'splits', 'split_metadata.json')
    if os.path.exists(split_meta_path):
        with open(split_meta_path, 'r') as f:
            metadata['split_info'] = json.load(f)
    
    # Load EDA analysis
    eda_path = os.path.join(data_dir, 'reports', 'eda_analysis.json')
    if os.path.exists(eda_path):
        with open(eda_path, 'r') as f:
            metadata['eda_analysis'] = json.load(f)
    
    return metadata


class DataLoader:
    """
    Convenience class for loading all ML data.
    
    Usage:
        loader = DataLoader('../data')
        train, val, test = loader.get_splits()
        X_train, y_train = loader.get_features('train')
    """
    
    def __init__(self, data_dir: str):
        """
        Initialize data loader.
        
        Args:
            data_dir: Root data directory
        """
        self.data_dir = data_dir
        self.splits_dir = os.path.join(data_dir, 'splits')
        self.features_dir = os.path.join(data_dir, 'features')
        self.raw_dir = os.path.join(data_dir, 'raw')
        self.processed_dir = os.path.join(data_dir, 'processed')
        
        self._feature_extractor = None
        self._splits = None
    
    def get_raw_data(self) -> List[Dict]:
        """Load raw ticket data.

        Priority order:
          1. synthetic_tickets_merged.json  – combined original + augmented data
          2. tickets.json                   – legacy name
          3. synthetic_tickets.json         – original synthetic-only data
        """
        for filename in ['synthetic_tickets_merged.json', 'tickets.json', 'synthetic_tickets.json']:
            path = os.path.join(self.raw_dir, filename)
            if os.path.exists(path):
                return load_tickets(path)
        raise FileNotFoundError("No raw data found")
    
    def get_processed_data(self) -> List[Dict]:
        """Load processed ticket data."""
        path = os.path.join(self.processed_dir, 'tickets_clean.json')
        return load_tickets(path)
    
    def get_splits(self) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """Load train/val/test splits."""
        if self._splits is None:
            self._splits = load_splits(self.splits_dir)
        return self._splits
    
    def get_features(self, split: str = 'train') -> Tuple[np.ndarray, np.ndarray]:
        """
        Load feature matrix for a specific split.
        
        Args:
            split: 'train', 'val', or 'test'
            
        Returns:
            Tuple of (X, y)
        """
        path = os.path.join(self.features_dir, f'{split}_features.npz')
        X, y, _ = load_features(path)
        return X, y
    
    def get_feature_extractor(self):
        """Load the fitted feature extractor."""
        if self._feature_extractor is None:
            path = os.path.join(self.features_dir, 'feature_extractor.pkl')
            self._feature_extractor = load_feature_extractor(path)
        return self._feature_extractor
    
    def get_all_training_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Load all training data (features and labels for train and val).
        
        Returns:
            Tuple of (X_train, y_train, X_val, y_val)
        """
        X_train, y_train = self.get_features('train')
        X_val, y_val = self.get_features('val')
        return X_train, y_train, X_val, y_val
    
    def get_test_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """Load test set features and labels."""
        return self.get_features('test')
    
    def get_metadata(self) -> Dict[str, Any]:
        """Load all metadata."""
        return load_metadata(self.data_dir)
    
    def summary(self):
        """Print summary of available data."""
        print("=" * 50)
        print("BlueClue ML Data Summary")
        print("=" * 50)
        
        # Check splits
        if os.path.exists(self.splits_dir):
            train, val, test = self.get_splits()
            print(f"Splits: train={len(train)}, val={len(val)}, test={len(test)}")
        else:
            print("Splits: Not found")
        
        # Check features
        for split in ['train', 'val', 'test']:
            path = os.path.join(self.features_dir, f'{split}_features.npz')
            if os.path.exists(path):
                X, y, _ = load_features(path)
                print(f"{split.capitalize()} features: {X.shape}")
        
        # Check feature extractor
        extractor_path = os.path.join(self.features_dir, 'feature_extractor.pkl')
        if os.path.exists(extractor_path):
            print("Feature extractor: Available")
        else:
            print("Feature extractor: Not found")
        
        print("=" * 50)


# Label encoders for classification
CATEGORY_LABELS = ['general', 'technical', 'billing', 'account', 
                   'feature_request', 'hardware', 'software', 
                   'network', 'login', 'other']

PRIORITY_LABELS = ['low', 'medium', 'high', 'critical']


def encode_labels(labels: List[str], label_type: str = 'category') -> np.ndarray:
    """
    Encode string labels to integers.
    
    Args:
        labels: List of string labels
        label_type: 'category' or 'priority'
        
    Returns:
        Array of integer labels
    """
    label_map = CATEGORY_LABELS if label_type == 'category' else PRIORITY_LABELS
    mapping = {label: i for i, label in enumerate(label_map)}
    return np.array([mapping.get(l, 0) for l in labels])


def decode_labels(encoded: np.ndarray, label_type: str = 'category') -> List[str]:
    """
    Decode integer labels to strings.
    
    Args:
        encoded: Array of integer labels
        label_type: 'category' or 'priority'
        
    Returns:
        List of string labels
    """
    label_map = CATEGORY_LABELS if label_type == 'category' else PRIORITY_LABELS
    return [label_map[i] if i < len(label_map) else 'unknown' for i in encoded]
