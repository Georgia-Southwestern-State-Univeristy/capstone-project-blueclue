"""
Category Classification Model Training Script
=============================================

Trains and evaluates multi-class classification models for ticket categorization.
Supports multiple algorithms with hyperparameter tuning and comprehensive evaluation.

Usage:
    python src/train_category_model.py
    python src/train_category_model.py --model logistic
    python src/train_category_model.py --all --tune
"""

import os
import sys
import json
import time
import argparse
import warnings
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional

import numpy as np
import joblib

# Suppress convergence warnings during grid search
warnings.filterwarnings('ignore', category=UserWarning)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, cross_val_score
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score
)
from sklearn.preprocessing import label_binarize

from ml.data_loader import DataLoader


# Model configurations with hyperparameter grids
MODEL_CONFIGS = {
    'dummy': {
        'name': 'Dummy Classifier (Baseline)',
        'class': DummyClassifier,
        'params': {'strategy': 'most_frequent'},
        'grid': {},  # No tuning needed
        'description': 'Baseline that predicts most frequent class'
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
            'C': [0.01, 0.1, 1.0, 10.0],
            'class_weight': [None, 'balanced']
        },
        'description': 'Simple linear model, good baseline for text classification'
    },
    'random_forest': {
        'name': 'Random Forest',
        'class': RandomForestClassifier,
        'params': {
            'random_state': 42,
            'n_jobs': -1
        },
        'grid': {
            'n_estimators': [50, 100, 200],
            'max_depth': [10, 20, None],
            'min_samples_split': [2, 5, 10],
            'class_weight': [None, 'balanced']
        },
        'grid_small': {  # Smaller grid for quick testing
            'n_estimators': [100, 200],
            'max_depth': [10, 20],
            'class_weight': ['balanced']
        },
        'description': 'Ensemble of decision trees, handles high-dimensional sparse data well'
    },
    'svm': {
        'name': 'Support Vector Machine',
        'class': SVC,
        'params': {
            'random_state': 42,
            'probability': True  # For confidence scores
        },
        'grid': {
            'C': [0.1, 1.0, 10.0],
            'kernel': ['linear', 'rbf'],
            'gamma': ['scale', 'auto'],
            'class_weight': [None, 'balanced']
        },
        'grid_small': {
            'C': [1.0, 10.0],
            'kernel': ['linear'],
            'class_weight': ['balanced']
        },
        'description': 'Effective for high-dimensional text data'
    },
    'gradient_boosting': {
        'name': 'Gradient Boosting',
        'class': GradientBoostingClassifier,
        'params': {
            'random_state': 42
        },
        'grid': {
            'n_estimators': [50, 100, 200],
            'learning_rate': [0.01, 0.1, 0.2],
            'max_depth': [3, 5, 7],
            'min_samples_split': [2, 5]
        },
        'grid_small': {
            'n_estimators': [100],
            'learning_rate': [0.1],
            'max_depth': [5]
        },
        'description': 'Sequential ensemble, often achieves best accuracy'
    },
    'mlp': {
        'name': 'Neural Network (MLP)',
        'class': MLPClassifier,
        'params': {
            'random_state': 42,
            'max_iter': 500,
            'early_stopping': False,  # Disabled due to sklearn compatibility issues
            'validation_fraction': 0.1
        },
        'grid': {
            'hidden_layer_sizes': [(100,), (100, 50), (200, 100)],
            'alpha': [0.0001, 0.001, 0.01],
            'learning_rate_init': [0.001, 0.01]
        },
        'grid_small': {
            'hidden_layer_sizes': [(100,), (100, 50)],
            'alpha': [0.001]
        },
        'description': 'Deep learning approach, good for complex patterns'
    }
}


class ModelTrainer:
    """
    Trains and evaluates classification models for ticket categorization.
    
    Features:
    - Multiple algorithm support
    - Hyperparameter tuning with cross-validation
    - Comprehensive evaluation metrics
    - Model comparison and selection
    - Error analysis
    """
    
    def __init__(self, data_dir: str, random_seed: int = 42):
        """
        Initialize the trainer.
        
        Args:
            data_dir: Directory containing prepared data
            random_seed: Random seed for reproducibility
        """
        self.data_dir = data_dir
        self.random_seed = random_seed
        np.random.seed(random_seed)
        
        # Load data
        self.loader = DataLoader(data_dir)
        self._load_data()
        
        # Store results
        self.results = {}
        self.best_model = None
        self.best_model_name = None
        self.best_accuracy = 0.0
        
    def _load_data(self):
        """Load training, validation, and test data."""
        print("\n" + "=" * 60)
        print("Loading Data")
        print("=" * 60)
        
        # Load feature matrices
        self.X_train, self.y_train = self.loader.get_features('train')
        self.X_val, self.y_val = self.loader.get_features('val')
        self.X_test, self.y_test = self.loader.get_features('test')
        
        # Get class names
        self.classes = sorted(list(set(self.y_train)))
        self.n_classes = len(self.classes)
        
        print(f"\nDataset Summary:")
        print(f"  - Training samples: {len(self.y_train)}")
        print(f"  - Validation samples: {len(self.y_val)}")
        print(f"  - Test samples: {len(self.y_test)}")
        print(f"  - Features: {self.X_train.shape[1]}")
        print(f"  - Classes ({self.n_classes}): {', '.join(self.classes)}")
        
    def train_model(self, 
                    model_key: str,
                    tune: bool = False,
                    use_small_grid: bool = True) -> Dict[str, Any]:
        """
        Train a single model with optional hyperparameter tuning.
        
        Args:
            model_key: Key from MODEL_CONFIGS
            tune: Whether to perform hyperparameter tuning
            use_small_grid: Use smaller grid for faster tuning
            
        Returns:
            Dictionary with training results
        """
        if model_key not in MODEL_CONFIGS:
            raise ValueError(f"Unknown model: {model_key}. Available: {list(MODEL_CONFIGS.keys())}")
        
        config = MODEL_CONFIGS[model_key]
        print(f"\n{'=' * 60}")
        print(f"Training: {config['name']}")
        print(f"{'=' * 60}")
        print(f"Description: {config['description']}")
        
        result = {
            'model_key': model_key,
            'model_name': config['name'],
            'tuned': tune,
            'timestamp': datetime.now().isoformat()
        }
        
        start_time = time.time()
        
        # Create base model
        model_class = config['class']
        base_params = config['params'].copy()
        
        if tune and config.get('grid'):
            # Hyperparameter tuning
            grid = config.get('grid_small', config['grid']) if use_small_grid else config['grid']
            print(f"\nHyperparameter tuning with GridSearchCV...")
            print(f"Grid: {grid}")
            
            base_model = model_class(**base_params)
            
            grid_search = GridSearchCV(
                base_model,
                grid,
                cv=5,
                scoring='accuracy',
                n_jobs=-1,
                verbose=1,
                return_train_score=True
            )
            
            grid_search.fit(self.X_train, self.y_train)
            
            model = grid_search.best_estimator_
            result['best_params'] = grid_search.best_params_
            result['cv_score'] = grid_search.best_score_
            result['cv_results'] = {
                'mean_train_score': grid_search.cv_results_['mean_train_score'].tolist(),
                'mean_test_score': grid_search.cv_results_['mean_test_score'].tolist(),
                'params': [str(p) for p in grid_search.cv_results_['params']]
            }
            
            print(f"\nBest parameters: {grid_search.best_params_}")
            print(f"Best CV score: {grid_search.best_score_:.4f}")
        else:
            # Train with default parameters
            print(f"\nTraining with default parameters...")
            model = model_class(**base_params)
            
            # Cross-validation
            cv_scores = cross_val_score(model, self.X_train, self.y_train, cv=5, scoring='accuracy')
            result['cv_scores'] = cv_scores.tolist()
            result['cv_score'] = cv_scores.mean()
            print(f"5-fold CV scores: {cv_scores}")
            print(f"Mean CV score: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
            
            # Fit on full training data
            model.fit(self.X_train, self.y_train)
        
        training_time = time.time() - start_time
        result['training_time'] = training_time
        print(f"\nTraining time: {training_time:.2f}s")
        
        # Evaluate on validation set
        print(f"\nValidation Set Evaluation:")
        val_results = self._evaluate(model, self.X_val, self.y_val)
        result['validation'] = val_results
        
        # Quick inference time test
        inference_start = time.time()
        for _ in range(100):
            _ = model.predict(self.X_val[:1])
        inference_time = (time.time() - inference_start) / 100 * 1000  # ms per prediction
        result['inference_time_ms'] = inference_time
        print(f"Inference time: {inference_time:.2f}ms per prediction")
        
        # Store model
        result['model'] = model
        self.results[model_key] = result
        
        # Update best model
        if val_results['accuracy'] > self.best_accuracy:
            self.best_accuracy = val_results['accuracy']
            self.best_model = model
            self.best_model_name = model_key
            
        return result
    
    def _evaluate(self, model, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """
        Evaluate model and return comprehensive metrics.
        
        Args:
            model: Trained model
            X: Feature matrix
            y: True labels
            
        Returns:
            Dictionary with evaluation metrics
        """
        # Predictions
        y_pred = model.predict(X)
        
        # Get probabilities if available
        if hasattr(model, 'predict_proba'):
            y_proba = model.predict_proba(X)
        else:
            y_proba = None
        
        # Calculate metrics
        accuracy = accuracy_score(y, y_pred)
        f1_macro = f1_score(y, y_pred, average='macro')
        f1_weighted = f1_score(y, y_pred, average='weighted')
        precision_macro = precision_score(y, y_pred, average='macro')
        recall_macro = recall_score(y, y_pred, average='macro')
        
        # Per-class metrics
        report = classification_report(y, y_pred, output_dict=True)
        
        # Confusion matrix
        cm = confusion_matrix(y, y_pred, labels=self.classes)
        
        # ROC-AUC (multi-class)
        if y_proba is not None:
            try:
                y_bin = label_binarize(y, classes=self.classes)
                if y_bin.shape[1] > 1:
                    roc_auc = roc_auc_score(y_bin, y_proba, average='macro', multi_class='ovr')
                else:
                    roc_auc = None
            except Exception:
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
            'predictions': y_pred.tolist(),
            'classes': self.classes
        }
        
        # Print summary
        print(f"  Accuracy: {accuracy:.4f}")
        print(f"  F1 (macro): {f1_macro:.4f}")
        print(f"  F1 (weighted): {f1_weighted:.4f}")
        print(f"  Precision (macro): {precision_macro:.4f}")
        print(f"  Recall (macro): {recall_macro:.4f}")
        if roc_auc:
            print(f"  ROC-AUC (macro): {roc_auc:.4f}")
        
        return result
    
    def train_all_models(self, tune: bool = False, use_small_grid: bool = True) -> Dict[str, Any]:
        """
        Train all available models and compare.
        
        Args:
            tune: Whether to perform hyperparameter tuning
            use_small_grid: Use smaller grid for faster tuning
            
        Returns:
            Dictionary with all results
        """
        print("\n" + "=" * 60)
        print("TRAINING ALL MODELS")
        print("=" * 60)
        
        # Always train baseline first
        self.train_model('dummy', tune=False)
        
        # Train all other models
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
        """
        Generate a comparison report of all trained models.
        
        Returns:
            Comparison report as string
        """
        report = []
        report.append("\n" + "=" * 80)
        report.append("MODEL COMPARISON REPORT")
        report.append("=" * 80)
        
        # Create comparison table
        headers = ['Model', 'Accuracy', 'F1 (macro)', 'CV Score', 'Train Time', 'Inference']
        rows = []
        
        baseline_accuracy = self.results.get('dummy', {}).get('validation', {}).get('accuracy', 0)
        
        for key, result in self.results.items():
            if 'error' in result:
                continue
            val = result.get('validation', {})
            rows.append({
                'model': result.get('model_name', key)[:25],
                'accuracy': val.get('accuracy', 0),
                'f1': val.get('f1_macro', 0),
                'cv': result.get('cv_score', 0),
                'time': result.get('training_time', 0),
                'inference': result.get('inference_time_ms', 0)
            })
        
        # Sort by accuracy
        rows.sort(key=lambda x: x['accuracy'], reverse=True)
        
        # Print table
        report.append(f"\n{'Model':<28} {'Accuracy':>10} {'F1-Macro':>10} {'CV Score':>10} {'Train(s)':>10} {'Inf(ms)':>10}")
        report.append("-" * 80)
        
        for row in rows:
            improvement = row['accuracy'] - baseline_accuracy
            marker = " ★" if row['model'] == self.results.get(self.best_model_name, {}).get('model_name', '') else ""
            report.append(
                f"{row['model']:<28} {row['accuracy']:>10.4f} {row['f1']:>10.4f} "
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
        """
        Evaluate the best model on the held-out test set.
        
        Returns:
            Test evaluation results
        """
        if self.best_model is None:
            raise ValueError("No model has been trained yet")
        
        print("\n" + "=" * 60)
        print(f"TEST SET EVALUATION: {self.results[self.best_model_name]['model_name']}")
        print("=" * 60)
        
        test_results = self._evaluate(self.best_model, self.X_test, self.y_test)
        
        # Store in results
        self.results[self.best_model_name]['test'] = test_results
        
        # Print detailed classification report
        print("\nDetailed Classification Report:")
        report = test_results['classification_report']
        print(f"\n{'Category':<20} {'Precision':>10} {'Recall':>10} {'F1-Score':>10} {'Support':>10}")
        print("-" * 62)
        
        low_f1_categories = []
        for cls in self.classes:
            if cls in report:
                metrics = report[cls]
                f1 = metrics['f1-score']
                print(f"{cls:<20} {metrics['precision']:>10.4f} {metrics['recall']:>10.4f} "
                      f"{f1:>10.4f} {int(metrics['support']):>10}")
                if f1 < 0.75:
                    low_f1_categories.append((cls, f1))
        
        print("-" * 62)
        print(f"{'macro avg':<20} {report['macro avg']['precision']:>10.4f} "
              f"{report['macro avg']['recall']:>10.4f} {report['macro avg']['f1-score']:>10.4f}")
        print(f"{'weighted avg':<20} {report['weighted avg']['precision']:>10.4f} "
              f"{report['weighted avg']['recall']:>10.4f} {report['weighted avg']['f1-score']:>10.4f}")
        
        # Print confusion matrix
        print("\nConfusion Matrix:")
        cm = np.array(test_results['confusion_matrix'])
        print(f"\n{'':>15}", end='')
        for cls in self.classes:
            print(f"{cls[:8]:>10}", end='')
        print()
        
        for i, cls in enumerate(self.classes):
            print(f"{cls:<15}", end='')
            for j in range(len(self.classes)):
                print(f"{cm[i, j]:>10}", end='')
            print()
        
        # Print success criteria check
        baseline_acc = self.results.get('dummy', {}).get('validation', {}).get('accuracy', 0)
        acc = test_results['accuracy']
        improvement = acc - baseline_acc
        
        print("\n" + "=" * 60)
        print("SUCCESS CRITERIA CHECK")
        print("=" * 60)
        
        criteria = [
            (f"Accuracy > 85%", acc > 0.85, f"{acc:.2%}"),
            (f"All categories F1 > 0.75", len(low_f1_categories) == 0, 
             "PASS" if len(low_f1_categories) == 0 else f"FAIL: {low_f1_categories}"),
            (f"Inference < 100ms", test_results.get('inference_time_ms', 999) < 100, 
             f"{self.results[self.best_model_name].get('inference_time_ms', 0):.1f}ms"),
            (f"Beats baseline by 15%+", improvement >= 0.15, f"+{improvement:.2%}")
        ]
        
        for criterion, passed, value in criteria:
            status = "✓" if passed else "✗"
            print(f"  {status} {criterion}: {value}")
        
        if low_f1_categories:
            print(f"\n⚠ Categories with low F1-score (< 0.75):")
            for cat, f1 in low_f1_categories:
                print(f"    - {cat}: {f1:.4f}")
        
        return test_results
    
    def error_analysis(self) -> Dict[str, Any]:
        """
        Perform error analysis on the best model's predictions.
        
        Returns:
            Dictionary with error analysis results
        """
        if self.best_model is None:
            raise ValueError("No model has been trained yet")
        
        print("\n" + "=" * 60)
        print("ERROR ANALYSIS")
        print("=" * 60)
        
        # Get predictions
        y_pred = self.best_model.predict(self.X_test)
        
        # Find misclassifications
        errors = []
        for i, (true, pred) in enumerate(zip(self.y_test, y_pred)):
            if true != pred:
                errors.append({
                    'index': i,
                    'true_label': true,
                    'predicted_label': pred
                })
        
        print(f"\nTotal test samples: {len(self.y_test)}")
        print(f"Correct predictions: {len(self.y_test) - len(errors)}")
        print(f"Misclassifications: {len(errors)} ({len(errors)/len(self.y_test)*100:.1f}%)")
        
        # Analyze confusion patterns
        confusion_patterns = {}
        for err in errors:
            key = (err['true_label'], err['predicted_label'])
            confusion_patterns[key] = confusion_patterns.get(key, 0) + 1
        
        # Sort by frequency
        sorted_patterns = sorted(confusion_patterns.items(), key=lambda x: x[1], reverse=True)
        
        print(f"\nMost Common Confusion Patterns:")
        print(f"{'True Category':<20} {'Predicted As':<20} {'Count':>8}")
        print("-" * 50)
        
        for (true, pred), count in sorted_patterns[:10]:
            print(f"{true:<20} {pred:<20} {count:>8}")
        
        # Category-level error rates
        print(f"\nError Rate by Category:")
        category_errors = {}
        category_counts = {}
        
        for true, pred in zip(self.y_test, y_pred):
            category_counts[true] = category_counts.get(true, 0) + 1
            if true != pred:
                category_errors[true] = category_errors.get(true, 0) + 1
        
        print(f"{'Category':<20} {'Errors':<10} {'Total':<10} {'Error Rate':>12}")
        print("-" * 55)
        
        for cat in sorted(category_counts.keys()):
            errors_count = category_errors.get(cat, 0)
            total = category_counts[cat]
            rate = errors_count / total * 100
            print(f"{cat:<20} {errors_count:<10} {total:<10} {rate:>11.1f}%")
        
        # Recommendations
        print("\n" + "=" * 60)
        print("RECOMMENDATIONS FOR IMPROVEMENT")
        print("=" * 60)
        
        recommendations = []
        
        # Check for commonly confused categories
        if sorted_patterns:
            top_confusion = sorted_patterns[0]
            if top_confusion[1] >= 3:
                recommendations.append(
                    f"• Most confusion between '{top_confusion[0][0]}' and '{top_confusion[0][1]}' "
                    f"({top_confusion[1]} cases). Consider:"
                )
                recommendations.append(f"  - Adding more distinctive features for these categories")
                recommendations.append(f"  - Collecting more training examples")
                recommendations.append(f"  - Potentially merging if semantically similar")
        
        # Check for high error rate categories
        high_error_cats = [(cat, category_errors.get(cat, 0) / category_counts[cat]) 
                           for cat in category_counts 
                           if category_errors.get(cat, 0) / category_counts[cat] > 0.25]
        
        if high_error_cats:
            for cat, rate in sorted(high_error_cats, key=lambda x: x[1], reverse=True):
                recommendations.append(f"• '{cat}' has high error rate ({rate:.1%}). Consider:")
                recommendations.append(f"  - Adding more training examples")
                recommendations.append(f"  - Improving feature extraction for this category")
        
        # General recommendations
        recommendations.append("• Consider using ensemble methods to combine top models")
        recommendations.append("• Experiment with different text preprocessing (stemming, lemmatization)")
        recommendations.append("• Try character n-grams in addition to word n-grams")
        
        for rec in recommendations:
            print(rec)
        
        return {
            'total_errors': len(errors),
            'error_rate': len(errors) / len(self.y_test),
            'confusion_patterns': dict([(f"{k[0]}->{k[1]}", v) for k, v in sorted_patterns]),
            'category_error_rates': {cat: category_errors.get(cat, 0) / category_counts[cat] 
                                     for cat in category_counts},
            'recommendations': recommendations
        }
    
    def save_best_model(self, output_dir: str = None) -> str:
        """
        Save the best trained model with metadata.
        
        Args:
            output_dir: Directory to save model (default: data/models)
            
        Returns:
            Path to saved model
        """
        if self.best_model is None:
            raise ValueError("No model has been trained yet")
        
        # Create output directory
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(self.data_dir), 'models')
        os.makedirs(output_dir, exist_ok=True)
        
        # Get model info
        result = self.results[self.best_model_name]
        test_results = result.get('test', result.get('validation', {}))
        
        # Create version string
        version = f"v1_{datetime.now().strftime('%Y%m%d')}"
        
        # Save model
        model_filename = f"category_classifier_{version}.pkl"
        model_path = os.path.join(output_dir, model_filename)
        joblib.dump(self.best_model, model_path)
        print(f"\n✓ Model saved to: {model_path}")
        
        # Also save as latest
        latest_path = os.path.join(output_dir, "category_classifier_latest.pkl")
        joblib.dump(self.best_model, latest_path)
        
        # Create model card
        model_card = {
            'model_name': result['model_name'],
            'model_key': self.best_model_name,
            'version': version,
            'training_date': datetime.now().isoformat(),
            'training_samples': len(self.y_train),
            'test_samples': len(self.y_test),
            'categories': self.classes,
            'n_features': self.X_train.shape[1],
            'metrics': {
                'accuracy': test_results.get('accuracy', 0),
                'f1_macro': test_results.get('f1_macro', 0),
                'f1_weighted': test_results.get('f1_weighted', 0),
                'precision_macro': test_results.get('precision_macro', 0),
                'recall_macro': test_results.get('recall_macro', 0)
            },
            'inference_time_ms': result.get('inference_time_ms', 0),
            'hyperparameters': result.get('best_params', {}),
            'random_seed': self.random_seed,
            'notes': [
                f"Trained on synthetic data ({len(self.y_train)} samples)",
                "Classes are balanced via oversampling",
                f"Model type: {result['model_name']}"
            ]
        }
        
        # Save model card
        card_path = os.path.join(output_dir, f"model_card_{version}.json")
        with open(card_path, 'w') as f:
            json.dump(model_card, f, indent=2)
        print(f"✓ Model card saved to: {card_path}")
        
        # Save training log
        log_path = os.path.join(output_dir, f"training_log_{version}.json")
        # Remove model objects before saving
        log_results = {}
        for key, res in self.results.items():
            log_results[key] = {k: v for k, v in res.items() if k != 'model'}
        
        with open(log_path, 'w') as f:
            json.dump(log_results, f, indent=2)
        print(f"✓ Training log saved to: {log_path}")
        
        # Print model card summary
        print("\n" + "=" * 60)
        print("MODEL CARD SUMMARY")
        print("=" * 60)
        print(f"Model: {model_card['model_name']}")
        print(f"Version: {model_card['version']}")
        print(f"Accuracy: {model_card['metrics']['accuracy']:.4f}")
        print(f"F1 (macro): {model_card['metrics']['f1_macro']:.4f}")
        print(f"Inference time: {model_card['inference_time_ms']:.2f}ms")
        print(f"Categories: {', '.join(model_card['categories'])}")
        
        return model_path


def main():
    """Main training script."""
    parser = argparse.ArgumentParser(description='Train category classification model')
    parser.add_argument('--data', type=str, default='./data',
                       help='Directory containing prepared data')
    parser.add_argument('--model', type=str, choices=list(MODEL_CONFIGS.keys()),
                       help='Specific model to train')
    parser.add_argument('--all', action='store_true',
                       help='Train and compare all models')
    parser.add_argument('--tune', action='store_true',
                       help='Perform hyperparameter tuning')
    parser.add_argument('--quick', action='store_true',
                       help='Use smaller hyperparameter grid for faster tuning')
    parser.add_argument('--seed', type=int, default=42,
                       help='Random seed')
    parser.add_argument('--output', type=str, default='./models',
                       help='Directory to save trained model')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("BlueClue Category Classifier Training")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    
    # Initialize trainer
    trainer = ModelTrainer(args.data, random_seed=args.seed)
    
    # Train model(s)
    if args.all:
        trainer.train_all_models(tune=args.tune, use_small_grid=args.quick or not args.tune)
        print(trainer.compare_models())
    elif args.model:
        trainer.train_model(args.model, tune=args.tune, use_small_grid=args.quick or not args.tune)
    else:
        # Default: train recommended models
        print("\nTraining recommended models (baseline + logistic + random_forest)...")
        trainer.train_model('dummy', tune=False)
        trainer.train_model('logistic', tune=args.tune, use_small_grid=True)
        trainer.train_model('random_forest', tune=args.tune, use_small_grid=True)
        print(trainer.compare_models())
    
    # Evaluate best model on test set
    if trainer.best_model:
        trainer.evaluate_best_on_test()
        trainer.error_analysis()
        trainer.save_best_model(args.output)
    
    print(f"\n✓ Training complete at: {datetime.now().isoformat()}")


if __name__ == '__main__':
    main()
