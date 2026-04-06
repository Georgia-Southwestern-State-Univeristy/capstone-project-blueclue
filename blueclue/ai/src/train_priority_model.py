"""
Priority Classification Model Training Script
=============================================

Trains and evaluates multi-class classification models for ticket priority prediction.
Uses ticket description, predicted category, and metadata features.

Usage:
    python src/train_priority_model.py
    python src/train_priority_model.py --model random_forest --tune
    python src/train_priority_model.py --all --tune
"""

import os
import sys
import json
import time
import argparse
import warnings
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional
from collections import Counter

import numpy as np
import joblib

# Suppress warnings during grid search
warnings.filterwarnings('ignore', category=UserWarning)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, cross_val_score, StratifiedKFold
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score
)
from sklearn.preprocessing import LabelEncoder, StandardScaler, label_binarize
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.sparse import hstack, csr_matrix

from ml.data_loader import load_tickets


# Priority levels in order
PRIORITY_ORDER = ['low', 'medium', 'high', 'critical']

# Model configurations
MODEL_CONFIGS = {
    'dummy': {
        'name': 'Dummy Classifier (Baseline)',
        'class': DummyClassifier,
        'params': {'strategy': 'stratified'},
        'grid': {},
        'description': 'Baseline that predicts based on class distribution'
    },
    'logistic': {
        'name': 'Logistic Regression',
        'class': LogisticRegression,
        'params': {
            'max_iter': 1000,
            'random_state': 42,
            'solver': 'lbfgs'
        },
        'grid': {
            'C': [0.1, 1.0, 10.0],
            'class_weight': [None, 'balanced']
        },
        'description': 'Linear model, good baseline for structured features'
    },
    'random_forest': {
        'name': 'Random Forest',
        'class': RandomForestClassifier,
        'params': {
            'random_state': 42,
            'n_jobs': -1
        },
        'grid': {
            'n_estimators': [100, 200],
            'max_depth': [10, 20, None],
            'class_weight': ['balanced', 'balanced_subsample']
        },
        'grid_small': {
            'n_estimators': [100, 200],
            'max_depth': [15],
            'class_weight': ['balanced']
        },
        'description': 'Ensemble method, handles mixed feature types well'
    },
    'svm': {
        'name': 'Support Vector Machine',
        'class': SVC,
        'params': {
            'random_state': 42,
            'probability': True
        },
        'grid': {
            'C': [1.0, 10.0],
            'kernel': ['linear', 'rbf'],
            'class_weight': ['balanced']
        },
        'grid_small': {
            'C': [1.0],
            'kernel': ['linear'],
            'class_weight': ['balanced']
        },
        'description': 'Effective for imbalanced classification'
    },
    'gradient_boosting': {
        'name': 'Gradient Boosting',
        'class': GradientBoostingClassifier,
        'params': {
            'random_state': 42
        },
        'grid': {
            'n_estimators': [100, 200],
            'learning_rate': [0.05, 0.1],
            'max_depth': [3, 5]
        },
        'grid_small': {
            'n_estimators': [100],
            'learning_rate': [0.1],
            'max_depth': [5]
        },
        'description': 'Sequential boosting, often best for tabular data'
    }
}


class PriorityFeatureExtractor:
    """
    Feature extractor for priority classification.
    
    Extracts features from:
    - Text (subject + description) using TF-IDF
    - Category (one-hot encoded)
    - Metadata (numerical features)
    - Urgency indicators from text
    """
    
    # Urgency keywords by priority level
    URGENCY_KEYWORDS = {
        'critical': [
            'urgent', 'emergency', 'critical', 'immediately', 'asap', 'down',
            'outage', 'security breach', 'data loss', 'cannot work', 'blocked',
            'production', 'all users', 'company-wide', 'server down'
        ],
        'high': [
            'important', 'priority', 'soon', 'deadline', 'presentation',
            'meeting', 'client', 'manager', 'cannot access', 'failing',
            'spreading', 'multiple', 'affecting team', 'broken'
        ],
        'medium': [
            'issue', 'problem', 'help', 'please', 'when possible',
            'slow', 'intermittent', 'sometimes', 'error'
        ],
        'low': [
            'question', 'wondering', 'curious', 'eventually', 'no rush',
            'minor', 'cosmetic', 'nice to have', 'feedback', 'suggestion'
        ]
    }
    
    def __init__(self, max_tfidf_features: int = 1000):
        """
        Initialize the feature extractor.
        
        Args:
            max_tfidf_features: Maximum TF-IDF features
        """
        self.max_tfidf_features = max_tfidf_features
        self.tfidf = TfidfVectorizer(
            max_features=max_tfidf_features,
            ngram_range=(1, 2),
            min_df=2,
            max_df=0.95,
            stop_words='english'
        )
        self.category_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.categories = []
        self.feature_names = []
        
    def _extract_text(self, ticket: Dict) -> str:
        """Combine subject and description."""
        subject = ticket.get('subject', '') or ''
        description = ticket.get('description', '') or ''
        return f"{subject} {description}".strip().lower()
    
    def _extract_urgency_scores(self, text: str) -> List[float]:
        """Calculate urgency scores based on keywords."""
        text_lower = text.lower()
        scores = []
        
        for priority in PRIORITY_ORDER:
            keywords = self.URGENCY_KEYWORDS.get(priority, [])
            count = sum(1 for kw in keywords if kw in text_lower)
            # Normalize by number of keywords
            score = count / len(keywords) if keywords else 0
            scores.append(score)
        
        return scores
    
    def _extract_metadata_features(self, ticket: Dict) -> List[float]:
        """Extract numerical metadata features."""
        features = []
        
        # AI confidence (handle empty strings from CSV)
        try:
            ai_conf = ticket.get('ai_confidence', 0.5)
            features.append(float(ai_conf) if ai_conf not in ('', None) else 0.5)
        except (ValueError, TypeError):
            features.append(0.5)
        
        # User history (handle string values from CSV)
        try:
            prev = ticket.get('user_previous_tickets', 0)
            features.append(float(prev) if prev not in ('', None) else 0.0)
        except (ValueError, TypeError):
            features.append(0.0)
        
        # Priority override indicator (True/False may be strings from CSV)
        po_raw = ticket.get('priority_overridden', False)
        features.append(1.0 if str(po_raw).lower() in ('true', '1', 'yes') else 0.0)
        
        # Text length features
        text = self._extract_text(ticket)
        features.append(len(text) / 1000.0)  # Normalized length
        features.append(text.count('!') / 10.0)  # Exclamation marks (urgency)
        features.append(text.count('?') / 10.0)  # Question marks
        features.append(len(text.split()) / 100.0)  # Word count
        
        # Time features if available
        created_at = ticket.get('created_at', '')
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                # Is it business hours
                features.append(1.0 if 9 <= dt.hour <= 17 else 0.0)
                # Is it weekend
                features.append(1.0 if dt.weekday() >= 5 else 0.0)
            except:
                features.extend([0.5, 0.5])
        else:
            features.extend([0.5, 0.5])
        
        return features
    
    def fit(self, tickets: List[Dict]):
        """
        Fit the feature extractor on training data.
        
        Args:
            tickets: List of ticket dictionaries
        """
        print(f"Fitting priority feature extractor on {len(tickets)} tickets...")
        
        # Fit TF-IDF on text
        texts = [self._extract_text(t) for t in tickets]
        self.tfidf.fit(texts)
        
        # Fit category encoder
        categories = [t.get('category', 'other') for t in tickets]
        self.category_encoder.fit(categories)
        self.categories = list(self.category_encoder.classes_)
        
        # Fit scaler on metadata
        metadata = np.array([self._extract_metadata_features(t) for t in tickets])
        self.scaler.fit(metadata)
        
        # Build feature names
        self.feature_names = (
            list(self.tfidf.get_feature_names_out()) +
            [f'category_{c}' for c in self.categories] +
            ['urgency_low', 'urgency_medium', 'urgency_high', 'urgency_critical'] +
            ['ai_confidence', 'user_tickets', 'priority_override', 'text_len',
             'exclamation', 'question', 'word_count', 'business_hours', 'is_weekend']
        )
        
        self.is_fitted = True
        print(f"✓ Feature extractor fitted. Total features: {len(self.feature_names)}")
        
    def transform(self, tickets: List[Dict]) -> np.ndarray:
        """
        Transform tickets into feature matrix.
        
        Args:
            tickets: List of ticket dictionaries
            
        Returns:
            Feature matrix as numpy array
        """
        if not self.is_fitted:
            raise ValueError("Feature extractor not fitted. Call fit() first.")
        
        # TF-IDF features
        texts = [self._extract_text(t) for t in tickets]
        tfidf_features = self.tfidf.transform(texts)
        
        # Category one-hot encoding
        categories = [t.get('category', 'other') for t in tickets]
        # Handle unseen categories
        cat_encoded = []
        for cat in categories:
            if cat in self.categories:
                idx = self.categories.index(cat)
                one_hot = [0.0] * len(self.categories)
                one_hot[idx] = 1.0
                cat_encoded.append(one_hot)
            else:
                cat_encoded.append([0.0] * len(self.categories))
        category_features = np.array(cat_encoded)
        
        # Urgency scores
        urgency_features = np.array([self._extract_urgency_scores(self._extract_text(t)) for t in tickets])
        
        # Metadata features
        metadata = np.array([self._extract_metadata_features(t) for t in tickets])
        metadata_scaled = self.scaler.transform(metadata)
        
        # Combine all features
        features = hstack([
            tfidf_features,
            csr_matrix(category_features),
            csr_matrix(urgency_features),
            csr_matrix(metadata_scaled)
        ])
        
        return features.toarray()
    
    def fit_transform(self, tickets: List[Dict]) -> np.ndarray:
        """Fit and transform in one step."""
        self.fit(tickets)
        return self.transform(tickets)
    
    def extract_labels(self, tickets: List[Dict]) -> np.ndarray:
        """Extract priority labels from tickets."""
        labels = [t.get('priority', 'medium') for t in tickets]
        return np.array(labels)
    
    def save(self, filepath: str):
        """Save the fitted extractor."""
        state = {
            'tfidf': self.tfidf,
            'category_encoder': self.category_encoder,
            'scaler': self.scaler,
            'categories': self.categories,
            'feature_names': self.feature_names,
            'max_tfidf_features': self.max_tfidf_features,
            'is_fitted': self.is_fitted
        }
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        joblib.dump(state, filepath)
        print(f"✓ Priority feature extractor saved to {filepath}")
    
    @classmethod
    def load(cls, filepath: str) -> 'PriorityFeatureExtractor':
        """Load a fitted extractor."""
        state = joblib.load(filepath)
        extractor = cls(max_tfidf_features=state['max_tfidf_features'])
        extractor.tfidf = state['tfidf']
        extractor.category_encoder = state['category_encoder']
        extractor.scaler = state['scaler']
        extractor.categories = state['categories']
        extractor.feature_names = state['feature_names']
        extractor.is_fitted = state['is_fitted']
        print(f"[OK] Priority feature extractor loaded from {filepath}")
        return extractor


class PriorityModelTrainer:
    """
    Trainer for priority classification models.
    """
    
    def __init__(self, data_dir: str, random_seed: int = 42):
        """
        Initialize the trainer.
        
        Args:
            data_dir: Directory containing split data
            random_seed: Random seed for reproducibility
        """
        self.data_dir = data_dir
        self.random_seed = random_seed
        np.random.seed(random_seed)
        
        self.feature_extractor = PriorityFeatureExtractor(max_tfidf_features=1000)
        self.results = {}
        self.best_model = None
        self.best_model_name = None
        self.best_accuracy = 0.0
        
        self._load_data()
    
    def _load_data(self):
        """Load and prepare training data."""
        print("\n" + "=" * 60)
        print("Loading Data for Priority Classification")
        print("=" * 60)
        
        # Load splits
        splits_dir = os.path.join(self.data_dir, 'splits')
        self.train_tickets = load_tickets(os.path.join(splits_dir, 'train.json'))
        self.val_tickets = load_tickets(os.path.join(splits_dir, 'val.json'))
        self.test_tickets = load_tickets(os.path.join(splits_dir, 'test.json'))
        
        # Print priority distribution
        train_priorities = [t.get('priority', 'medium') for t in self.train_tickets]
        print(f"\nTraining set priority distribution:")
        for priority, count in sorted(Counter(train_priorities).items()):
            print(f"  {priority}: {count} ({count/len(train_priorities)*100:.1f}%)")
        
        # Extract features
        print("\nExtracting features...")
        self.X_train = self.feature_extractor.fit_transform(self.train_tickets)
        self.y_train = self.feature_extractor.extract_labels(self.train_tickets)
        
        self.X_val = self.feature_extractor.transform(self.val_tickets)
        self.y_val = self.feature_extractor.extract_labels(self.val_tickets)
        
        self.X_test = self.feature_extractor.transform(self.test_tickets)
        self.y_test = self.feature_extractor.extract_labels(self.test_tickets)
        
        self.classes = PRIORITY_ORDER
        
        print(f"\nDataset Summary:")
        print(f"  - Training samples: {len(self.y_train)}")
        print(f"  - Validation samples: {len(self.y_val)}")
        print(f"  - Test samples: {len(self.y_test)}")
        print(f"  - Features: {self.X_train.shape[1]}")
        print(f"  - Classes: {', '.join(self.classes)}")
    
    def train_model(self, 
                    model_key: str,
                    tune: bool = False,
                    use_small_grid: bool = True) -> Dict[str, Any]:
        """
        Train a single model.
        
        Args:
            model_key: Key from MODEL_CONFIGS
            tune: Whether to perform hyperparameter tuning
            use_small_grid: Use smaller grid for faster tuning
            
        Returns:
            Dictionary with training results
        """
        if model_key not in MODEL_CONFIGS:
            raise ValueError(f"Unknown model: {model_key}")
        
        config = MODEL_CONFIGS[model_key]
        print(f"\n{'=' * 60}")
        print(f"Training: {config['name']}")
        print(f"{'=' * 60}")
        
        result = {
            'model_key': model_key,
            'model_name': config['name'],
            'tuned': tune,
            'timestamp': datetime.now().isoformat()
        }
        
        start_time = time.time()
        
        model_class = config['class']
        base_params = config['params'].copy()
        
        if tune and config.get('grid'):
            grid = config.get('grid_small', config['grid']) if use_small_grid else config['grid']
            print(f"\nHyperparameter tuning...")
            print(f"Grid: {grid}")
            
            base_model = model_class(**base_params)
            
            # Use stratified CV for imbalanced classes
            cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=self.random_seed)
            
            grid_search = GridSearchCV(
                base_model,
                grid,
                cv=cv,
                scoring='f1_weighted',  # Use weighted F1 for imbalanced
                n_jobs=-1,
                verbose=1
            )
            
            grid_search.fit(self.X_train, self.y_train)
            
            model = grid_search.best_estimator_
            result['best_params'] = grid_search.best_params_
            result['cv_score'] = grid_search.best_score_
            
            print(f"\nBest parameters: {grid_search.best_params_}")
            print(f"Best CV score (F1 weighted): {grid_search.best_score_:.4f}")
        else:
            print(f"\nTraining with default parameters...")
            model = model_class(**base_params)
            
            cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=self.random_seed)
            cv_scores = cross_val_score(model, self.X_train, self.y_train, cv=cv, scoring='f1_weighted')
            result['cv_scores'] = cv_scores.tolist()
            result['cv_score'] = cv_scores.mean()
            print(f"5-fold CV F1 scores: {cv_scores}")
            print(f"Mean CV score: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
            
            model.fit(self.X_train, self.y_train)
        
        training_time = time.time() - start_time
        result['training_time'] = training_time
        print(f"\nTraining time: {training_time:.2f}s")
        
        # Evaluate on validation set
        print(f"\nValidation Set Evaluation:")
        val_results = self._evaluate(model, self.X_val, self.y_val)
        result['validation'] = val_results
        
        # Inference time
        inference_start = time.time()
        for _ in range(100):
            _ = model.predict(self.X_val[:1])
        inference_time = (time.time() - inference_start) / 100 * 1000
        result['inference_time_ms'] = inference_time
        print(f"Inference time: {inference_time:.2f}ms per prediction")
        
        # Store
        result['model'] = model
        self.results[model_key] = result
        
        if val_results['accuracy'] > self.best_accuracy:
            self.best_accuracy = val_results['accuracy']
            self.best_model = model
            self.best_model_name = model_key
        
        return result
    
    def _evaluate(self, model, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """Evaluate model and return metrics."""
        y_pred = model.predict(X)
        
        if hasattr(model, 'predict_proba'):
            y_proba = model.predict_proba(X)
        else:
            y_proba = None
        
        accuracy = accuracy_score(y, y_pred)
        f1_macro = f1_score(y, y_pred, average='macro', labels=self.classes)
        f1_weighted = f1_score(y, y_pred, average='weighted', labels=self.classes)
        precision_macro = precision_score(y, y_pred, average='macro', labels=self.classes, zero_division=0)
        recall_macro = recall_score(y, y_pred, average='macro', labels=self.classes, zero_division=0)
        
        report = classification_report(y, y_pred, labels=self.classes, output_dict=True, zero_division=0)
        cm = confusion_matrix(y, y_pred, labels=self.classes)
        
        # ROC-AUC
        if y_proba is not None:
            try:
                y_bin = label_binarize(y, classes=self.classes)
                roc_auc = roc_auc_score(y_bin, y_proba, average='macro', multi_class='ovr')
            except:
                roc_auc = None
        else:
            roc_auc = None
        
        result = {
            'accuracy': accuracy,
            'f1_macro': f1_macro,
            'f1_weighted': f1_weighted,
            'precision_macro': precision_macro,
            'recall_macro': recall_macro,
            'roc_auc': roc_auc,
            'classification_report': report,
            'confusion_matrix': cm.tolist(),
            'predictions': y_pred.tolist()
        }
        
        # False-high-priority rate: LOW/MEDIUM tickets predicted as HIGH or CRITICAL.
        # This tracks the specific behavioral issue documented in the milestone feedback.
        low_medium_mask = np.isin(y, ['low', 'medium'])
        false_high_count = int(np.sum(np.isin(y_pred[low_medium_mask], ['high', 'critical'])))
        false_high_denominator = int(np.sum(low_medium_mask))
        false_high_rate = false_high_count / false_high_denominator if false_high_denominator > 0 else 0.0
        result['false_high_rate'] = round(false_high_rate, 4)
        result['false_high_count'] = false_high_count
        result['false_high_denominator'] = false_high_denominator
        
        print(f"  Accuracy: {accuracy:.4f}")
        print(f"  F1 (macro): {f1_macro:.4f}")
        print(f"  F1 (weighted): {f1_weighted:.4f}")
        print(f"  Precision (macro): {precision_macro:.4f}")
        print(f"  Recall (macro): {recall_macro:.4f}")
        if roc_auc:
            print(f"  ROC-AUC (macro): {roc_auc:.4f}")
        print(f"  False-high rate: {false_high_rate:.2%}  ({false_high_count}/{false_high_denominator} low/medium predicted as high/critical)")
        
        return result
    
    def train_all_models(self, tune: bool = False, use_small_grid: bool = True):
        """Train all available models."""
        print("\n" + "=" * 60)
        print("TRAINING ALL PRIORITY MODELS")
        print("=" * 60)
        
        self.train_model('dummy', tune=False)
        
        for model_key in MODEL_CONFIGS:
            if model_key == 'dummy':
                continue
            try:
                self.train_model(model_key, tune=tune, use_small_grid=use_small_grid)
            except Exception as e:
                print(f"\n✗ Error training {model_key}: {e}")
                self.results[model_key] = {'error': str(e)}
        
        return self.results
    
    def compare_models(self) -> str:
        """Generate comparison report."""
        report = []
        report.append("\n" + "=" * 80)
        report.append("PRIORITY MODEL COMPARISON REPORT")
        report.append("=" * 80)
        
        baseline_accuracy = self.results.get('dummy', {}).get('validation', {}).get('accuracy', 0)
        
        rows = []
        for key, result in self.results.items():
            if 'error' in result:
                continue
            val = result.get('validation', {})
            rows.append({
                'model': result.get('model_name', key)[:25],
                'accuracy': val.get('accuracy', 0),
                'f1_weighted': val.get('f1_weighted', 0),
                'cv': result.get('cv_score', 0),
                'time': result.get('training_time', 0),
                'inference': result.get('inference_time_ms', 0)
            })
        
        rows.sort(key=lambda x: x['accuracy'], reverse=True)
        
        report.append(f"\n{'Model':<28} {'Accuracy':>10} {'F1-Wtd':>10} {'CV Score':>10} {'Train(s)':>10} {'Inf(ms)':>10}")
        report.append("-" * 80)
        
        for row in rows:
            marker = " ★" if row['model'] == self.results.get(self.best_model_name, {}).get('model_name', '') else ""
            report.append(
                f"{row['model']:<28} {row['accuracy']:>10.4f} {row['f1_weighted']:>10.4f} "
                f"{row['cv']:>10.4f} {row['time']:>10.2f} {row['inference']:>10.2f}{marker}"
            )
        
        report.append("-" * 80)
        report.append(f"Baseline accuracy: {baseline_accuracy:.4f}")
        if self.best_model_name:
            best_result = self.results[self.best_model_name]
            improvement = best_result['validation']['accuracy'] - baseline_accuracy
            report.append(f"Best model: {best_result['model_name']} (★)")
            report.append(f"Best accuracy: {self.best_accuracy:.4f} (+{improvement:.4f} vs baseline)")
        
        return '\n'.join(report)
    
    def evaluate_best_on_test(self) -> Dict[str, Any]:
        """Evaluate best model on test set."""
        if self.best_model is None:
            raise ValueError("No model trained yet")
        
        print("\n" + "=" * 60)
        print(f"TEST SET EVALUATION: {self.results[self.best_model_name]['model_name']}")
        print("=" * 60)
        
        test_results = self._evaluate(self.best_model, self.X_test, self.y_test)
        self.results[self.best_model_name]['test'] = test_results
        
        # Detailed report
        print("\nDetailed Classification Report:")
        report = test_results['classification_report']
        print(f"\n{'Priority':<15} {'Precision':>10} {'Recall':>10} {'F1-Score':>10} {'Support':>10}")
        print("-" * 58)
        
        low_f1_priorities = []
        for priority in self.classes:
            if priority in report:
                m = report[priority]
                f1 = m['f1-score']
                print(f"{priority:<15} {m['precision']:>10.4f} {m['recall']:>10.4f} {f1:>10.4f} {int(m['support']):>10}")
                if f1 < 0.70:
                    low_f1_priorities.append((priority, f1))
        
        print("-" * 58)
        print(f"{'macro avg':<15} {report['macro avg']['precision']:>10.4f} "
              f"{report['macro avg']['recall']:>10.4f} {report['macro avg']['f1-score']:>10.4f}")
        print(f"{'weighted avg':<15} {report['weighted avg']['precision']:>10.4f} "
              f"{report['weighted avg']['recall']:>10.4f} {report['weighted avg']['f1-score']:>10.4f}")
        
        # Confusion matrix
        print("\nConfusion Matrix:")
        cm = np.array(test_results['confusion_matrix'])
        print(f"\n{'':>12}", end='')
        for p in self.classes:
            print(f"{p[:8]:>10}", end='')
        print()
        
        for i, priority in enumerate(self.classes):
            print(f"{priority:<12}", end='')
            for j in range(len(self.classes)):
                print(f"{cm[i, j]:>10}", end='')
            print()
        
        # Success criteria
        baseline_acc = self.results.get('dummy', {}).get('validation', {}).get('accuracy', 0)
        acc = test_results['accuracy']
        improvement = acc - baseline_acc
        
        print("\n" + "=" * 60)
        print("SUCCESS CRITERIA CHECK")
        print("=" * 60)
        
        criteria = [
            (f"Accuracy > 80%", acc > 0.80, f"{acc:.2%}"),
            (f"All priorities F1 > 0.70", len(low_f1_priorities) == 0,
             "PASS" if len(low_f1_priorities) == 0 else f"FAIL: {low_f1_priorities}"),
            (f"Beats baseline significantly", improvement >= 0.10, f"+{improvement:.2%}"),
            (f"False-high rate < 15%", test_results.get('false_high_rate', 1.0) < 0.15,
             f"{test_results.get('false_high_rate', 0):.2%} ({test_results.get('false_high_count', 0)}/{test_results.get('false_high_denominator', 0)})"),
        ]
        
        for criterion, passed, value in criteria:
            status = "✓" if passed else "✗"
            print(f"  {status} {criterion}: {value}")
        
        if low_f1_priorities:
            print(f"\n⚠ Priorities with low F1-score (< 0.70):")
            for p, f1 in low_f1_priorities:
                print(f"    - {p}: {f1:.4f}")
        
        return test_results
    
    def error_analysis(self) -> Dict[str, Any]:
        """Analyze misclassifications."""
        if self.best_model is None:
            raise ValueError("No model trained yet")
        
        print("\n" + "=" * 60)
        print("PRIORITY ERROR ANALYSIS")
        print("=" * 60)
        
        y_pred = self.best_model.predict(self.X_test)
        
        errors = []
        for i, (true, pred) in enumerate(zip(self.y_test, y_pred)):
            if true != pred:
                errors.append({
                    'index': i,
                    'true_priority': true,
                    'predicted_priority': pred,
                    'ticket': self.test_tickets[i]
                })
        
        print(f"\nTotal test samples: {len(self.y_test)}")
        print(f"Misclassifications: {len(errors)} ({len(errors)/len(self.y_test)*100:.1f}%)")
        
        # Confusion patterns
        confusion_patterns = {}
        for err in errors:
            key = (err['true_priority'], err['predicted_priority'])
            confusion_patterns[key] = confusion_patterns.get(key, 0) + 1
        
        sorted_patterns = sorted(confusion_patterns.items(), key=lambda x: x[1], reverse=True)
        
        print(f"\nMost Common Confusion Patterns:")
        print(f"{'True Priority':<15} {'Predicted As':<15} {'Count':>8}")
        print("-" * 40)
        
        for (true, pred), count in sorted_patterns[:10]:
            # Check if adjacent priorities
            true_idx = PRIORITY_ORDER.index(true) if true in PRIORITY_ORDER else -1
            pred_idx = PRIORITY_ORDER.index(pred) if pred in PRIORITY_ORDER else -1
            adjacent = "≈" if abs(true_idx - pred_idx) == 1 else ""
            print(f"{true:<15} {pred:<15} {count:>8} {adjacent}")
        
        # Severity of errors
        severe_errors = 0
        for err in errors:
            true_idx = PRIORITY_ORDER.index(err['true_priority'])
            pred_idx = PRIORITY_ORDER.index(err['predicted_priority'])
            if abs(true_idx - pred_idx) >= 2:  # More than one level off
                severe_errors += 1
        
        print(f"\nError Severity:")
        print(f"  - Adjacent level errors: {len(errors) - severe_errors}")
        print(f"  - Severe errors (2+ levels): {severe_errors}")
        
        # Recommendations
        print("\n" + "=" * 60)
        print("RECOMMENDATIONS FOR IMPROVEMENT")
        print("=" * 60)
        
        recommendations = []
        
        if sorted_patterns:
            top = sorted_patterns[0]
            recommendations.append(f"• Most confusion: '{top[0][0]}' → '{top[0][1]}' ({top[1]} cases)")
            if top[0][0] in ['high', 'critical'] and top[0][1] in ['low', 'medium']:
                recommendations.append("  ⚠ High/Critical being under-predicted - check urgent keywords")
            elif top[0][0] in ['low', 'medium'] and top[0][1] in ['high', 'critical']:
                recommendations.append("  ⚠ Low/Medium being over-predicted - reduce false urgency")
        
        recommendations.append("• Consider ordinal regression to respect priority ordering")
        recommendations.append("• Add business context features (customer tier, SLA requirements)")
        recommendations.append("• Use confidence thresholds to flag uncertain predictions for review")
        
        for rec in recommendations:
            print(rec)
        
        return {
            'total_errors': len(errors),
            'error_rate': len(errors) / len(self.y_test),
            'confusion_patterns': dict([(f"{k[0]}->{k[1]}", v) for k, v in sorted_patterns]),
            'severe_errors': severe_errors,
            'recommendations': recommendations
        }
    
    def save_best_model(self, output_dir: str = None) -> str:
        """Save the best trained model."""
        if self.best_model is None:
            raise ValueError("No model trained yet")
        
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(self.data_dir), 'models')
        os.makedirs(output_dir, exist_ok=True)
        
        result = self.results[self.best_model_name]
        test_results = result.get('test', result.get('validation', {}))
        
        version = f"v1_{datetime.now().strftime('%Y%m%d')}"
        
        # Save model
        model_filename = f"priority_classifier_{version}.pkl"
        model_path = os.path.join(output_dir, model_filename)
        joblib.dump(self.best_model, model_path)
        print(f"\n✓ Model saved to: {model_path}")
        
        latest_path = os.path.join(output_dir, "priority_classifier_latest.pkl")
        joblib.dump(self.best_model, latest_path)
        
        # Save feature extractor
        extractor_path = os.path.join(output_dir, f"priority_feature_extractor_{version}.pkl")
        self.feature_extractor.save(extractor_path)
        
        latest_extractor = os.path.join(output_dir, "priority_feature_extractor_latest.pkl")
        self.feature_extractor.save(latest_extractor)
        
        # Model card
        model_card = {
            'model_name': result['model_name'],
            'model_key': self.best_model_name,
            'version': version,
            'task': 'priority_classification',
            'training_date': datetime.now().isoformat(),
            'training_samples': len(self.y_train),
            'test_samples': len(self.y_test),
            'priorities': self.classes,
            'n_features': self.X_train.shape[1],
            'metrics': {
                'accuracy': test_results.get('accuracy', 0),
                'f1_macro': test_results.get('f1_macro', 0),
                'f1_weighted': test_results.get('f1_weighted', 0),
                'precision_macro': test_results.get('precision_macro', 0),
                'recall_macro': test_results.get('recall_macro', 0),
                'false_high_rate': test_results.get('false_high_rate', None),
                'false_high_count': test_results.get('false_high_count', None),
                'false_high_denominator': test_results.get('false_high_denominator', None),
            },
            'inference_time_ms': result.get('inference_time_ms', 0),
            'hyperparameters': result.get('best_params', {}),
            'random_seed': self.random_seed,
            'notes': [
                f"Trained on {len(self.y_train)} samples",
                "Handles imbalanced priority classes",
                f"Model type: {result['model_name']}"
            ]
        }
        
        card_path = os.path.join(output_dir, f"priority_model_card_{version}.json")
        with open(card_path, 'w') as f:
            json.dump(model_card, f, indent=2)
        print(f"✓ Model card saved to: {card_path}")
        
        # Training log
        log_path = os.path.join(output_dir, f"priority_training_log_{version}.json")
        log_results = {k: {kk: vv for kk, vv in v.items() if kk != 'model'} 
                       for k, v in self.results.items() if isinstance(v, dict)}
        with open(log_path, 'w') as f:
            json.dump(log_results, f, indent=2)
        print(f"✓ Training log saved to: {log_path}")
        
        print("\n" + "=" * 60)
        print("PRIORITY MODEL CARD SUMMARY")
        print("=" * 60)
        print(f"Model: {model_card['model_name']}")
        print(f"Version: {model_card['version']}")
        print(f"Accuracy: {model_card['metrics']['accuracy']:.4f}")
        print(f"F1 (weighted): {model_card['metrics']['f1_weighted']:.4f}")
        print(f"Inference time: {model_card['inference_time_ms']:.2f}ms")
        print(f"Priorities: {', '.join(model_card['priorities'])}")
        
        return model_path


def main():
    """Main training script."""
    parser = argparse.ArgumentParser(description='Train priority classification model')
    parser.add_argument('--data', type=str, default='./data',
                       help='Directory containing prepared data')
    parser.add_argument('--model', type=str, choices=list(MODEL_CONFIGS.keys()),
                       help='Specific model to train')
    parser.add_argument('--all', action='store_true',
                       help='Train and compare all models')
    parser.add_argument('--tune', action='store_true',
                       help='Perform hyperparameter tuning')
    parser.add_argument('--quick', action='store_true',
                       help='Use smaller hyperparameter grid')
    parser.add_argument('--seed', type=int, default=42,
                       help='Random seed')
    parser.add_argument('--output', type=str, default='./models',
                       help='Directory to save trained model')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("BlueClue Priority Classifier Training")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    
    trainer = PriorityModelTrainer(args.data, random_seed=args.seed)
    
    if args.all:
        trainer.train_all_models(tune=args.tune, use_small_grid=args.quick or not args.tune)
        print(trainer.compare_models())
    elif args.model:
        trainer.train_model(args.model, tune=args.tune, use_small_grid=args.quick or not args.tune)
    else:
        print("\nTraining recommended models...")
        trainer.train_model('dummy', tune=False)
        trainer.train_model('logistic', tune=args.tune, use_small_grid=True)
        trainer.train_model('random_forest', tune=args.tune, use_small_grid=True)
        print(trainer.compare_models())
    
    if trainer.best_model:
        trainer.evaluate_best_on_test()
        trainer.error_analysis()
        trainer.save_best_model(args.output)
    
    print(f"\n✓ Training complete at: {datetime.now().isoformat()}")


if __name__ == '__main__':
    main()
