"""
Resolution Time Prediction Model Training Script
=================================================

Trains and evaluates regression models for predicting ticket resolution time.
Uses ticket features including category, priority, and metadata.

Usage:
    python src/train_time_model.py
    python src/train_time_model.py --model random_forest --tune
    python src/train_time_model.py --all --tune
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

# Suppress warnings
warnings.filterwarnings('ignore', category=UserWarning)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.linear_model import Ridge, Lasso, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.dummy import DummyRegressor
from sklearn.model_selection import GridSearchCV, cross_val_score, KFold
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    median_absolute_error
)
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.sparse import hstack, csr_matrix

from ml.data_loader import load_tickets


# Priority weights for time estimation
PRIORITY_TIME_FACTORS = {
    'critical': 0.25,  # Critical tickets resolved faster
    'high': 0.5,
    'medium': 1.0,
    'low': 2.0
}

# Model configurations
MODEL_CONFIGS = {
    'dummy': {
        'name': 'Dummy Regressor (Baseline)',
        'class': DummyRegressor,
        'params': {'strategy': 'median'},
        'grid': {},
        'description': 'Baseline that predicts median resolution time'
    },
    'ridge': {
        'name': 'Ridge Regression',
        'class': Ridge,
        'params': {'random_state': 42},
        'grid': {
            'alpha': [0.1, 1.0, 10.0, 100.0]
        },
        'description': 'L2 regularized linear regression'
    },
    'random_forest': {
        'name': 'Random Forest Regressor',
        'class': RandomForestRegressor,
        'params': {
            'random_state': 42,
            'n_jobs': -1
        },
        'grid': {
            'n_estimators': [100, 200],
            'max_depth': [10, 20, None],
            'min_samples_split': [2, 5]
        },
        'grid_small': {
            'n_estimators': [100, 200],
            'max_depth': [15],
        },
        'description': 'Ensemble of decision trees for regression'
    },
    'gradient_boosting': {
        'name': 'Gradient Boosting Regressor',
        'class': GradientBoostingRegressor,
        'params': {'random_state': 42},
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
        'description': 'Sequential boosting for regression'
    },
    'svr': {
        'name': 'Support Vector Regressor',
        'class': SVR,
        'params': {},
        'grid': {
            'C': [1.0, 10.0],
            'kernel': ['linear', 'rbf'],
            'epsilon': [0.1, 0.5]
        },
        'grid_small': {
            'C': [1.0],
            'kernel': ['rbf'],
            'epsilon': [0.1]
        },
        'description': 'SVM for regression tasks'
    }
}


class TimeFeatureExtractor:
    """
    Feature extractor for resolution time prediction.
    
    Extracts features from:
    - Text (subject + description)
    - Category and priority
    - Ticket metadata
    - Complexity indicators
    """
    
    # Complexity keywords that might indicate longer resolution
    COMPLEXITY_KEYWORDS = {
        'high_complexity': [
            'multiple', 'several', 'various', 'complex', 'complicated',
            'integration', 'migration', 'upgrade', 'installation',
            'security', 'database', 'server', 'infrastructure'
        ],
        'low_complexity': [
            'simple', 'quick', 'easy', 'password reset', 'restart',
            'turn on', 'turn off', 'log in', 'login', 'forgot'
        ]
    }
    
    def __init__(self, max_tfidf_features: int = 500, use_log_transform: bool = True):
        """
        Initialize the feature extractor.
        
        Args:
            max_tfidf_features: Maximum TF-IDF features
            use_log_transform: Whether to log-transform target variable
        """
        self.max_tfidf_features = max_tfidf_features
        self.use_log_transform = use_log_transform
        
        self.tfidf = TfidfVectorizer(
            max_features=max_tfidf_features,
            ngram_range=(1, 2),
            min_df=2,
            max_df=0.95,
            stop_words='english'
        )
        self.category_encoder = LabelEncoder()
        self.priority_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        self.target_mean = 0
        self.target_std = 1
        self.is_fitted = False
        self.categories = []
        self.priorities = []
        self.feature_names = []
        
    def _extract_text(self, ticket: Dict) -> str:
        """Combine subject and description."""
        subject = ticket.get('subject', '') or ''
        description = ticket.get('description', '') or ''
        return f"{subject} {description}".strip().lower()
    
    def _extract_complexity_scores(self, text: str) -> List[float]:
        """Calculate complexity scores based on keywords."""
        text_lower = text.lower()
        scores = []
        
        for level in ['high_complexity', 'low_complexity']:
            keywords = self.COMPLEXITY_KEYWORDS.get(level, [])
            count = sum(1 for kw in keywords if kw in text_lower)
            score = count / len(keywords) if keywords else 0
            scores.append(score)
        
        return scores
    
    def _extract_metadata_features(self, ticket: Dict) -> List[float]:
        """Extract numerical metadata features."""
        features = []
        
        # Priority factor (critical = fast, low = slow)
        priority = ticket.get('priority', 'medium')
        features.append(PRIORITY_TIME_FACTORS.get(priority, 1.0))
        
        # AI confidence (higher confidence might mean clearer issue)
        features.append(float(ticket.get('ai_confidence', 0.5)))
        
        # User history (experienced users might have simpler issues)
        features.append(float(ticket.get('user_previous_tickets', 0)) / 10.0)
        
        # Text complexity indicators
        text = self._extract_text(ticket)
        features.append(len(text) / 500.0)  # Normalized length
        features.append(len(text.split()) / 50.0)  # Word count
        features.append(text.count('?') / 5.0)  # Questions
        features.append(text.count('.') / 10.0)  # Sentences
        
        # Time of creation (business hours vs off-hours)
        created_at = ticket.get('created_at', '')
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                features.append(1.0 if 9 <= dt.hour <= 17 else 0.5)  # Business hours
                features.append(1.0 if dt.weekday() >= 5 else 0.5)  # Weekend
                features.append(dt.hour / 24.0)  # Hour of day
            except:
                features.extend([0.5, 0.5, 0.5])
        else:
            features.extend([0.5, 0.5, 0.5])
        
        # Comment count (more comments = longer resolution typically)
        features.append(float(ticket.get('comment_count', 0)) / 10.0)
        
        # Reopen count
        features.append(float(ticket.get('reopen_count', 0)))
        
        return features
    
    def fit(self, tickets: List[Dict]):
        """Fit the feature extractor on training data."""
        print(f"Fitting time feature extractor on {len(tickets)} tickets...")
        
        # Fit TF-IDF
        texts = [self._extract_text(t) for t in tickets]
        self.tfidf.fit(texts)
        
        # Fit category encoder
        categories = [t.get('category', 'other') for t in tickets]
        self.category_encoder.fit(categories)
        self.categories = list(self.category_encoder.classes_)
        
        # Fit priority encoder  
        priorities = [t.get('priority', 'medium') for t in tickets]
        self.priority_encoder.fit(priorities)
        self.priorities = list(self.priority_encoder.classes_)
        
        # Fit scaler
        metadata = np.array([self._extract_metadata_features(t) for t in tickets])
        self.scaler.fit(metadata)
        
        # Compute target statistics for normalization
        times = self.extract_target(tickets, transform=False)
        valid_times = times[times > 0]
        if len(valid_times) > 0:
            self.target_mean = np.mean(valid_times)
            self.target_std = np.std(valid_times)
            if self.use_log_transform:
                log_times = np.log1p(valid_times)
                self.target_mean = np.mean(log_times)
                self.target_std = np.std(log_times)
        
        # Build feature names
        self.feature_names = (
            list(self.tfidf.get_feature_names_out()) +
            [f'category_{c}' for c in self.categories] +
            [f'priority_{p}' for p in self.priorities] +
            ['complexity_high', 'complexity_low'] +
            ['priority_factor', 'ai_confidence', 'user_tickets', 'text_len',
             'word_count', 'questions', 'sentences', 'business_hours',
             'is_weekend', 'hour_of_day', 'comment_count', 'reopen_count']
        )
        
        self.is_fitted = True
        print(f"✓ Feature extractor fitted. Total features: {len(self.feature_names)}")
    
    def transform(self, tickets: List[Dict]) -> np.ndarray:
        """Transform tickets into feature matrix."""
        if not self.is_fitted:
            raise ValueError("Feature extractor not fitted")
        
        # TF-IDF
        texts = [self._extract_text(t) for t in tickets]
        tfidf_features = self.tfidf.transform(texts)
        
        # Category one-hot
        cat_encoded = []
        for t in tickets:
            cat = t.get('category', 'other')
            one_hot = [0.0] * len(self.categories)
            if cat in self.categories:
                idx = self.categories.index(cat)
                one_hot[idx] = 1.0
            cat_encoded.append(one_hot)
        category_features = np.array(cat_encoded)
        
        # Priority one-hot
        pri_encoded = []
        for t in tickets:
            pri = t.get('priority', 'medium')
            one_hot = [0.0] * len(self.priorities)
            if pri in self.priorities:
                idx = self.priorities.index(pri)
                one_hot[idx] = 1.0
            pri_encoded.append(one_hot)
        priority_features = np.array(pri_encoded)
        
        # Complexity
        complexity_features = np.array([self._extract_complexity_scores(self._extract_text(t)) for t in tickets])
        
        # Metadata
        metadata = np.array([self._extract_metadata_features(t) for t in tickets])
        metadata_scaled = self.scaler.transform(metadata)
        
        # Combine
        features = hstack([
            tfidf_features,
            csr_matrix(category_features),
            csr_matrix(priority_features),
            csr_matrix(complexity_features),
            csr_matrix(metadata_scaled)
        ])
        
        return features.toarray()
    
    def fit_transform(self, tickets: List[Dict]) -> np.ndarray:
        """Fit and transform."""
        self.fit(tickets)
        return self.transform(tickets)
    
    def extract_target(self, tickets: List[Dict], transform: bool = True) -> np.ndarray:
        """Extract resolution time target variable."""
        times = []
        for t in tickets:
            time_val = t.get('time_to_resolution_hours', 0)
            if time_val is None or time_val <= 0:
                time_val = 24.0  # Default to 24 hours if missing
            times.append(float(time_val))
        
        times = np.array(times)
        
        if transform and self.use_log_transform:
            # Log transform to handle skewed distribution
            times = np.log1p(times)
        
        return times
    
    def inverse_transform_target(self, times: np.ndarray) -> np.ndarray:
        """Inverse transform predictions back to hours."""
        if self.use_log_transform:
            return np.expm1(times)
        return times
    
    def save(self, filepath: str):
        """Save the fitted extractor."""
        state = {
            'tfidf': self.tfidf,
            'category_encoder': self.category_encoder,
            'priority_encoder': self.priority_encoder,
            'scaler': self.scaler,
            'categories': self.categories,
            'priorities': self.priorities,
            'feature_names': self.feature_names,
            'max_tfidf_features': self.max_tfidf_features,
            'use_log_transform': self.use_log_transform,
            'target_mean': self.target_mean,
            'target_std': self.target_std,
            'is_fitted': self.is_fitted
        }
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        joblib.dump(state, filepath)
        print(f"✓ Time feature extractor saved to {filepath}")
    
    @classmethod
    def load(cls, filepath: str) -> 'TimeFeatureExtractor':
        """Load a fitted extractor."""
        state = joblib.load(filepath)
        extractor = cls(
            max_tfidf_features=state['max_tfidf_features'],
            use_log_transform=state['use_log_transform']
        )
        extractor.tfidf = state['tfidf']
        extractor.category_encoder = state['category_encoder']
        extractor.priority_encoder = state['priority_encoder']
        extractor.scaler = state['scaler']
        extractor.categories = state['categories']
        extractor.priorities = state['priorities']
        extractor.feature_names = state['feature_names']
        extractor.target_mean = state['target_mean']
        extractor.target_std = state['target_std']
        extractor.is_fitted = state['is_fitted']
        print(f"✓ Time feature extractor loaded from {filepath}")
        return extractor


class TimeModelTrainer:
    """Trainer for resolution time prediction models."""
    
    def __init__(self, data_dir: str, random_seed: int = 42, outlier_percentile: float = 95):
        """
        Initialize the trainer.
        
        Args:
            data_dir: Directory containing split data
            random_seed: Random seed
            outlier_percentile: Percentile threshold for outlier removal
        """
        self.data_dir = data_dir
        self.random_seed = random_seed
        self.outlier_percentile = outlier_percentile
        np.random.seed(random_seed)
        
        self.feature_extractor = TimeFeatureExtractor(max_tfidf_features=500, use_log_transform=True)
        self.results = {}
        self.best_model = None
        self.best_model_name = None
        self.best_rmse = float('inf')
        
        self._load_data()
    
    def _load_data(self):
        """Load and prepare training data."""
        print("\n" + "=" * 60)
        print("Loading Data for Time Prediction")
        print("=" * 60)
        
        # Load splits
        splits_dir = os.path.join(self.data_dir, 'splits')
        all_train = load_tickets(os.path.join(splits_dir, 'train.json'))
        all_val = load_tickets(os.path.join(splits_dir, 'val.json'))
        all_test = load_tickets(os.path.join(splits_dir, 'test.json'))
        
        # Filter tickets with resolution time (handle None values)
        self.train_tickets = [t for t in all_train if (t.get('time_to_resolution_hours') or 0) > 0]
        self.val_tickets = [t for t in all_val if (t.get('time_to_resolution_hours') or 0) > 0]
        self.test_tickets = [t for t in all_test if (t.get('time_to_resolution_hours') or 0) > 0]
        
        print(f"\nTickets with resolution time:")
        print(f"  - Train: {len(self.train_tickets)} / {len(all_train)}")
        print(f"  - Val: {len(self.val_tickets)} / {len(all_val)}")
        print(f"  - Test: {len(self.test_tickets)} / {len(all_test)}")
        
        # Handle outliers in training data
        train_times = np.array([t['time_to_resolution_hours'] for t in self.train_tickets])
        threshold = np.percentile(train_times, self.outlier_percentile)
        
        original_count = len(self.train_tickets)
        self.train_tickets = [t for t in self.train_tickets if t['time_to_resolution_hours'] <= threshold]
        
        print(f"\nOutlier handling (>{self.outlier_percentile}th percentile):")
        print(f"  - Threshold: {threshold:.1f} hours")
        print(f"  - Removed: {original_count - len(self.train_tickets)} outliers")
        print(f"  - Remaining: {len(self.train_tickets)} train tickets")
        
        # Time distribution
        train_times = np.array([t['time_to_resolution_hours'] for t in self.train_tickets])
        print(f"\nResolution time distribution (hours):")
        print(f"  - Mean: {np.mean(train_times):.2f}")
        print(f"  - Median: {np.median(train_times):.2f}")
        print(f"  - Std: {np.std(train_times):.2f}")
        print(f"  - Min: {np.min(train_times):.2f}")
        print(f"  - Max: {np.max(train_times):.2f}")
        
        # Extract features
        print("\nExtracting features...")
        self.X_train = self.feature_extractor.fit_transform(self.train_tickets)
        self.y_train = self.feature_extractor.extract_target(self.train_tickets)
        
        self.X_val = self.feature_extractor.transform(self.val_tickets)
        self.y_val = self.feature_extractor.extract_target(self.val_tickets)
        
        self.X_test = self.feature_extractor.transform(self.test_tickets)
        self.y_test = self.feature_extractor.extract_target(self.test_tickets)
        
        # Store original (untransformed) test targets for evaluation
        self.y_test_original = np.array([t['time_to_resolution_hours'] for t in self.test_tickets])
        self.y_val_original = np.array([t['time_to_resolution_hours'] for t in self.val_tickets])
        
        print(f"\nDataset Summary:")
        print(f"  - Training samples: {len(self.y_train)}")
        print(f"  - Validation samples: {len(self.y_val)}")
        print(f"  - Test samples: {len(self.y_test)}")
        print(f"  - Features: {self.X_train.shape[1]}")
    
    def train_model(self, 
                    model_key: str,
                    tune: bool = False,
                    use_small_grid: bool = True) -> Dict[str, Any]:
        """Train a single model."""
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
            
            cv = KFold(n_splits=5, shuffle=True, random_state=self.random_seed)
            
            grid_search = GridSearchCV(
                base_model,
                grid,
                cv=cv,
                scoring='neg_root_mean_squared_error',
                n_jobs=-1,
                verbose=1
            )
            
            grid_search.fit(self.X_train, self.y_train)
            
            model = grid_search.best_estimator_
            result['best_params'] = grid_search.best_params_
            result['cv_score'] = -grid_search.best_score_  # Convert back to positive RMSE
            
            print(f"\nBest parameters: {grid_search.best_params_}")
            print(f"Best CV RMSE (log-transformed): {-grid_search.best_score_:.4f}")
        else:
            print(f"\nTraining with default parameters...")
            model = model_class(**base_params)
            
            cv = KFold(n_splits=5, shuffle=True, random_state=self.random_seed)
            cv_scores = cross_val_score(model, self.X_train, self.y_train, 
                                       cv=cv, scoring='neg_root_mean_squared_error')
            result['cv_scores'] = (-cv_scores).tolist()
            result['cv_score'] = -cv_scores.mean()
            print(f"5-fold CV RMSE scores: {-cv_scores}")
            print(f"Mean CV RMSE: {-cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
            
            model.fit(self.X_train, self.y_train)
        
        training_time = time.time() - start_time
        result['training_time'] = training_time
        print(f"\nTraining time: {training_time:.2f}s")
        
        # Evaluate on validation set
        print(f"\nValidation Set Evaluation:")
        val_results = self._evaluate(model, self.X_val, self.y_val, self.y_val_original)
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
        
        if val_results['rmse_hours'] < self.best_rmse:
            self.best_rmse = val_results['rmse_hours']
            self.best_model = model
            self.best_model_name = model_key
        
        return result
    
    def _evaluate(self, model, X: np.ndarray, y: np.ndarray, y_original: np.ndarray) -> Dict[str, Any]:
        """Evaluate model and return metrics."""
        # Predict in transformed space
        y_pred_transformed = model.predict(X)
        
        # Transform back to hours
        y_pred_hours = self.feature_extractor.inverse_transform_target(y_pred_transformed)
        
        # Clip negative predictions
        y_pred_hours = np.maximum(y_pred_hours, 0)
        
        # Metrics in original hours space
        rmse = np.sqrt(mean_squared_error(y_original, y_pred_hours))
        mae = mean_absolute_error(y_original, y_pred_hours)
        median_ae = median_absolute_error(y_original, y_pred_hours)
        r2 = r2_score(y_original, y_pred_hours)
        
        # Within 4 hours accuracy
        within_4h = np.mean(np.abs(y_original - y_pred_hours) <= 4) * 100
        within_8h = np.mean(np.abs(y_original - y_pred_hours) <= 8) * 100
        
        result = {
            'rmse_hours': rmse,
            'mae_hours': mae,
            'median_ae_hours': median_ae,
            'r2_score': r2,
            'within_4h_pct': within_4h,
            'within_8h_pct': within_8h,
            'predictions': y_pred_hours.tolist()
        }
        
        print(f"  RMSE: {rmse:.2f} hours")
        print(f"  MAE: {mae:.2f} hours")
        print(f"  Median AE: {median_ae:.2f} hours")
        print(f"  R² Score: {r2:.4f}")
        print(f"  Within 4 hours: {within_4h:.1f}%")
        print(f"  Within 8 hours: {within_8h:.1f}%")
        
        return result
    
    def train_all_models(self, tune: bool = False, use_small_grid: bool = True):
        """Train all available models."""
        print("\n" + "=" * 60)
        print("TRAINING ALL TIME PREDICTION MODELS")
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
        report.append("TIME PREDICTION MODEL COMPARISON REPORT")
        report.append("=" * 80)
        
        baseline_rmse = self.results.get('dummy', {}).get('validation', {}).get('rmse_hours', 999)
        
        rows = []
        for key, result in self.results.items():
            if 'error' in result:
                continue
            val = result.get('validation', {})
            rows.append({
                'model': result.get('model_name', key)[:25],
                'rmse': val.get('rmse_hours', 999),
                'mae': val.get('mae_hours', 999),
                'r2': val.get('r2_score', 0),
                'within_4h': val.get('within_4h_pct', 0),
                'time': result.get('training_time', 0),
                'inference': result.get('inference_time_ms', 0)
            })
        
        # Sort by RMSE (lower is better)
        rows.sort(key=lambda x: x['rmse'])
        
        report.append(f"\n{'Model':<28} {'RMSE(h)':>10} {'MAE(h)':>10} {'R²':>8} {'<4h(%)':>8} {'Inf(ms)':>10}")
        report.append("-" * 80)
        
        for row in rows:
            marker = " ★" if row['model'] == self.results.get(self.best_model_name, {}).get('model_name', '') else ""
            report.append(
                f"{row['model']:<28} {row['rmse']:>10.2f} {row['mae']:>10.2f} "
                f"{row['r2']:>8.4f} {row['within_4h']:>8.1f} {row['inference']:>10.2f}{marker}"
            )
        
        report.append("-" * 80)
        report.append(f"Baseline RMSE: {baseline_rmse:.2f} hours")
        if self.best_model_name:
            best_result = self.results[self.best_model_name]
            improvement = baseline_rmse - best_result['validation']['rmse_hours']
            report.append(f"Best model: {best_result['model_name']} (★)")
            report.append(f"Best RMSE: {self.best_rmse:.2f} hours ({improvement:.2f}h improvement)")
        
        return '\n'.join(report)
    
    def evaluate_best_on_test(self) -> Dict[str, Any]:
        """Evaluate best model on test set."""
        if self.best_model is None:
            raise ValueError("No model trained yet")
        
        print("\n" + "=" * 60)
        print(f"TEST SET EVALUATION: {self.results[self.best_model_name]['model_name']}")
        print("=" * 60)
        
        test_results = self._evaluate(self.best_model, self.X_test, self.y_test, self.y_test_original)
        self.results[self.best_model_name]['test'] = test_results
        
        # Success criteria
        baseline_rmse = self.results.get('dummy', {}).get('validation', {}).get('rmse_hours', 999)
        rmse = test_results['rmse_hours']
        
        print("\n" + "=" * 60)
        print("SUCCESS CRITERIA CHECK")
        print("=" * 60)
        
        criteria = [
            (f"RMSE < 4 hours", rmse < 4, f"{rmse:.2f} hours"),
            (f"R² > 0.5", test_results['r2_score'] > 0.5, f"{test_results['r2_score']:.4f}"),
            (f"Beats baseline significantly", rmse < baseline_rmse * 0.8, f"Baseline: {baseline_rmse:.2f}h")
        ]
        
        for criterion, passed, value in criteria:
            status = "✓" if passed else "✗"
            print(f"  {status} {criterion}: {value}")
        
        return test_results
    
    def error_analysis(self) -> Dict[str, Any]:
        """Analyze prediction errors."""
        if self.best_model is None:
            raise ValueError("No model trained yet")
        
        print("\n" + "=" * 60)
        print("TIME PREDICTION ERROR ANALYSIS")
        print("=" * 60)
        
        # Predict
        y_pred_transformed = self.best_model.predict(self.X_test)
        y_pred_hours = self.feature_extractor.inverse_transform_target(y_pred_transformed)
        y_pred_hours = np.maximum(y_pred_hours, 0)
        
        errors = y_pred_hours - self.y_test_original
        abs_errors = np.abs(errors)
        
        print(f"\nError Distribution:")
        print(f"  Mean error: {np.mean(errors):.2f} hours")
        print(f"  Std error: {np.std(errors):.2f} hours")
        print(f"  Mean absolute error: {np.mean(abs_errors):.2f} hours")
        print(f"  Median absolute error: {np.median(abs_errors):.2f} hours")
        
        # Error percentiles
        print(f"\nError Percentiles (absolute):")
        for pct in [25, 50, 75, 90, 95]:
            val = np.percentile(abs_errors, pct)
            print(f"  {pct}th percentile: {val:.2f} hours")
        
        # Analyze by category
        print(f"\nError by Category:")
        print(f"{'Category':<20} {'MAE':>10} {'Count':>8}")
        print("-" * 40)
        
        cat_errors = {}
        for i, ticket in enumerate(self.test_tickets):
            cat = ticket.get('category', 'other')
            if cat not in cat_errors:
                cat_errors[cat] = []
            cat_errors[cat].append(abs_errors[i])
        
        for cat in sorted(cat_errors.keys()):
            mae = np.mean(cat_errors[cat])
            count = len(cat_errors[cat])
            print(f"{cat:<20} {mae:>10.2f} {count:>8}")
        
        # Analyze by priority
        print(f"\nError by Priority:")
        print(f"{'Priority':<15} {'MAE':>10} {'Count':>8}")
        print("-" * 35)
        
        pri_errors = {}
        for i, ticket in enumerate(self.test_tickets):
            pri = ticket.get('priority', 'medium')
            if pri not in pri_errors:
                pri_errors[pri] = []
            pri_errors[pri].append(abs_errors[i])
        
        for pri in ['low', 'medium', 'high', 'critical']:
            if pri in pri_errors:
                mae = np.mean(pri_errors[pri])
                count = len(pri_errors[pri])
                print(f"{pri:<15} {mae:>10.2f} {count:>8}")
        
        # Large error analysis
        large_error_threshold = 20  # hours
        large_errors_idx = np.where(abs_errors > large_error_threshold)[0]
        
        print(f"\nLarge Errors (> {large_error_threshold}h): {len(large_errors_idx)} cases")
        
        if len(large_errors_idx) > 0:
            print(f"\nExample large errors:")
            for idx in large_errors_idx[:5]:
                ticket = self.test_tickets[idx]
                print(f"  - Actual: {self.y_test_original[idx]:.1f}h, "
                      f"Predicted: {y_pred_hours[idx]:.1f}h, "
                      f"Category: {ticket.get('category')}, "
                      f"Priority: {ticket.get('priority')}")
        
        # Recommendations
        print("\n" + "=" * 60)
        print("RECOMMENDATIONS FOR IMPROVEMENT")
        print("=" * 60)
        
        recommendations = [
            "• Add SLA deadline features if available",
            "• Include technician workload/availability data",
            "• Consider time series patterns (day of week effects)",
            "• Add customer tier/priority multipliers",
            "• Use confidence intervals instead of point predictions"
        ]
        
        if np.mean(abs_errors) > 10:
            recommendations.insert(0, "⚠ High average error - consider larger training dataset")
        
        for rec in recommendations:
            print(rec)
        
        return {
            'mean_error': float(np.mean(errors)),
            'std_error': float(np.std(errors)),
            'mae': float(np.mean(abs_errors)),
            'median_ae': float(np.median(abs_errors)),
            'large_errors_count': int(len(large_errors_idx)),
            'category_errors': {k: float(np.mean(v)) for k, v in cat_errors.items()},
            'priority_errors': {k: float(np.mean(v)) for k, v in pri_errors.items()},
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
        model_filename = f"time_predictor_{version}.pkl"
        model_path = os.path.join(output_dir, model_filename)
        joblib.dump(self.best_model, model_path)
        print(f"\n✓ Model saved to: {model_path}")
        
        latest_path = os.path.join(output_dir, "time_predictor_latest.pkl")
        joblib.dump(self.best_model, latest_path)
        
        # Save feature extractor
        extractor_path = os.path.join(output_dir, f"time_feature_extractor_{version}.pkl")
        self.feature_extractor.save(extractor_path)
        
        latest_extractor = os.path.join(output_dir, "time_feature_extractor_latest.pkl")
        self.feature_extractor.save(latest_extractor)
        
        # Model card
        model_card = {
            'model_name': result['model_name'],
            'model_key': self.best_model_name,
            'version': version,
            'task': 'resolution_time_prediction',
            'training_date': datetime.now().isoformat(),
            'training_samples': len(self.y_train),
            'test_samples': len(self.y_test),
            'n_features': self.X_train.shape[1],
            'uses_log_transform': self.feature_extractor.use_log_transform,
            'outlier_percentile': self.outlier_percentile,
            'metrics': {
                'rmse_hours': test_results.get('rmse_hours', 0),
                'mae_hours': test_results.get('mae_hours', 0),
                'median_ae_hours': test_results.get('median_ae_hours', 0),
                'r2_score': test_results.get('r2_score', 0),
                'within_4h_pct': test_results.get('within_4h_pct', 0),
                'within_8h_pct': test_results.get('within_8h_pct', 0)
            },
            'inference_time_ms': result.get('inference_time_ms', 0),
            'hyperparameters': result.get('best_params', {}),
            'random_seed': self.random_seed,
            'notes': [
                f"Trained on {len(self.y_train)} resolved tickets",
                "Uses log-transformed target for skewed distribution",
                f"Outliers >{self.outlier_percentile}th percentile removed from training"
            ]
        }
        
        card_path = os.path.join(output_dir, f"time_model_card_{version}.json")
        with open(card_path, 'w') as f:
            json.dump(model_card, f, indent=2)
        print(f"✓ Model card saved to: {card_path}")
        
        # Training log
        log_path = os.path.join(output_dir, f"time_training_log_{version}.json")
        log_results = {k: {kk: vv for kk, vv in v.items() if kk != 'model'}
                       for k, v in self.results.items() if isinstance(v, dict)}
        with open(log_path, 'w') as f:
            json.dump(log_results, f, indent=2)
        print(f"✓ Training log saved to: {log_path}")
        
        print("\n" + "=" * 60)
        print("TIME PREDICTOR MODEL CARD SUMMARY")
        print("=" * 60)
        print(f"Model: {model_card['model_name']}")
        print(f"Version: {model_card['version']}")
        print(f"RMSE: {model_card['metrics']['rmse_hours']:.2f} hours")
        print(f"MAE: {model_card['metrics']['mae_hours']:.2f} hours")
        print(f"R²: {model_card['metrics']['r2_score']:.4f}")
        print(f"Within 4h: {model_card['metrics']['within_4h_pct']:.1f}%")
        print(f"Inference time: {model_card['inference_time_ms']:.2f}ms")
        
        return model_path


def main():
    """Main training script."""
    parser = argparse.ArgumentParser(description='Train resolution time prediction model')
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
    parser.add_argument('--outlier-pct', type=float, default=95,
                       help='Percentile for outlier removal')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("BlueClue Resolution Time Predictor Training")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    
    trainer = TimeModelTrainer(args.data, random_seed=args.seed, outlier_percentile=args.outlier_pct)
    
    if args.all:
        trainer.train_all_models(tune=args.tune, use_small_grid=args.quick or not args.tune)
        print(trainer.compare_models())
    elif args.model:
        trainer.train_model(args.model, tune=args.tune, use_small_grid=args.quick or not args.tune)
    else:
        print("\nTraining recommended models...")
        trainer.train_model('dummy', tune=False)
        trainer.train_model('ridge', tune=args.tune, use_small_grid=True)
        trainer.train_model('random_forest', tune=args.tune, use_small_grid=True)
        print(trainer.compare_models())
    
    if trainer.best_model:
        trainer.evaluate_best_on_test()
        trainer.error_analysis()
        trainer.save_best_model(args.output)
    
    print(f"\n✓ Training complete at: {datetime.now().isoformat()}")


if __name__ == '__main__':
    main()
