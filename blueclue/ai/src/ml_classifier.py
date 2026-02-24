"""
ML Category Classifier Module
==============================

Provides a trained ML-based classifier for ticket categorization.
Can be used as an enhancement or replacement for the keyword-based classifier.

Usage:
    from src.ml_classifier import MLCategoryClassifier
    
    classifier = MLCategoryClassifier()
    result = classifier.predict("I can't connect to WiFi")
    print(result['category'], result['confidence'])
"""

import os
import sys
import json
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

import numpy as np
import joblib

# Add parent directory for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.feature_extractor import FeatureExtractor


class MLCategoryClassifier:
    """
    ML-based ticket category classifier using trained model.
    
    This classifier uses a pre-trained machine learning model (typically
    Random Forest or SVM) to predict ticket categories from text.
    
    Attributes:
        model: Trained sklearn model
        feature_extractor: Fitted FeatureExtractor for text transformation
        categories: List of category labels
        model_version: Version string from model card
    """
    
    def __init__(self, 
                 model_path: str = None, 
                 feature_extractor_path: str = None,
                 base_dir: str = None):
        """
        Initialize the ML classifier.
        
        Args:
            model_path: Path to trained model file (.pkl)
            feature_extractor_path: Path to fitted feature extractor (.pkl)
            base_dir: Base directory containing models/ and data/ folders
        """
        # Determine paths
        if base_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        if model_path is None:
            model_path = os.path.join(base_dir, 'models', 'category_classifier_latest.pkl')
        
        if feature_extractor_path is None:
            feature_extractor_path = os.path.join(base_dir, 'data', 'features', 'feature_extractor.pkl')
        
        # Load model metadata
        model_card_path = os.path.join(os.path.dirname(model_path), 
                                       'model_card_' + os.path.basename(model_path).replace('category_classifier_', '').replace('.pkl', '') + '.json')
        if model_card_path.endswith('latest.json'):
            # Find most recent model card
            models_dir = os.path.dirname(model_path)
            model_cards = [f for f in os.listdir(models_dir) if f.startswith('model_card_') and f.endswith('.json')]
            if model_cards:
                model_card_path = os.path.join(models_dir, sorted(model_cards)[-1])
        
        self.model_card = None
        if os.path.exists(model_card_path):
            with open(model_card_path, 'r') as f:
                self.model_card = json.load(f)
        
        # Load model
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        self.model = joblib.load(model_path)
        self.model_path = model_path
        
        # Load feature extractor using class method
        if not os.path.exists(feature_extractor_path):
            raise FileNotFoundError(f"Feature extractor not found: {feature_extractor_path}")
        
        self.feature_extractor = FeatureExtractor.load(feature_extractor_path)
        
        # Get categories from model
        if hasattr(self.model, 'classes_'):
            self.categories = list(self.model.classes_)
        elif self.model_card:
            self.categories = self.model_card.get('categories', [])
        else:
            self.categories = []
        
        # Model version
        self.model_version = self.model_card.get('version', 'unknown') if self.model_card else 'unknown'
        
        print(f"✓ Loaded ML classifier (version: {self.model_version})")
        print(f"  Categories: {', '.join(self.categories)}")
    
    def predict(self, 
                text: str, 
                subject: str = None,
                metadata: Dict = None) -> Dict[str, Any]:
        """
        Predict category for a ticket.
        
        Args:
            text: Ticket description text
            subject: Optional subject line
            metadata: Optional additional metadata
            
        Returns:
            Dictionary with:
                - category: Predicted category
                - confidence: Confidence score (0-1)
                - all_scores: Dictionary of scores for all categories
                - model_version: Version of the model used
        """
        # Create ticket dict for feature extraction
        ticket = {
            'description': text or '',
            'subject': subject or '',
            'created_at': datetime.now().isoformat()
        }
        
        if metadata:
            ticket.update(metadata)
        
        # Extract features
        features = self.feature_extractor.transform([ticket])
        
        # Predict
        prediction = self.model.predict(features)[0]
        
        # Get confidence scores
        if hasattr(self.model, 'predict_proba'):
            probabilities = self.model.predict_proba(features)[0]
            confidence = float(max(probabilities))
            all_scores = {cat: float(prob) for cat, prob in zip(self.categories, probabilities)}
        else:
            confidence = 1.0
            all_scores = {prediction: 1.0}
        
        return {
            'category': prediction,
            'confidence': confidence,
            'all_scores': all_scores,
            'model_version': self.model_version
        }
    
    def predict_batch(self, 
                      tickets: List[Dict]) -> List[Dict[str, Any]]:
        """
        Predict categories for multiple tickets.
        
        Args:
            tickets: List of ticket dictionaries (must have 'description' field)
            
        Returns:
            List of prediction dictionaries
        """
        if not tickets:
            return []
        
        # Ensure all tickets have required fields
        for ticket in tickets:
            if 'description' not in ticket:
                ticket['description'] = ''
            if 'subject' not in ticket:
                ticket['subject'] = ''
            if 'created_at' not in ticket:
                ticket['created_at'] = datetime.now().isoformat()
        
        # Extract features
        features = self.feature_extractor.transform(tickets)
        
        # Predict
        predictions = self.model.predict(features)
        
        # Get confidence scores
        if hasattr(self.model, 'predict_proba'):
            all_probabilities = self.model.predict_proba(features)
        else:
            all_probabilities = None
        
        results = []
        for i, pred in enumerate(predictions):
            if all_probabilities is not None:
                confidence = float(max(all_probabilities[i]))
                all_scores = {cat: float(prob) for cat, prob in zip(self.categories, all_probabilities[i])}
            else:
                confidence = 1.0
                all_scores = {pred: 1.0}
            
            results.append({
                'category': pred,
                'confidence': confidence,
                'all_scores': all_scores,
                'model_version': self.model_version
            })
        
        return results
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded model.
        
        Returns:
            Dictionary with model metadata
        """
        info = {
            'model_version': self.model_version,
            'model_path': self.model_path,
            'categories': self.categories,
            'n_categories': len(self.categories),
            'model_type': type(self.model).__name__
        }
        
        if self.model_card:
            info.update({
                'training_date': self.model_card.get('training_date'),
                'accuracy': self.model_card.get('metrics', {}).get('accuracy'),
                'f1_macro': self.model_card.get('metrics', {}).get('f1_macro'),
                'inference_time_ms': self.model_card.get('inference_time_ms')
            })
        
        return info


class HybridClassifier:
    """
    Hybrid classifier combining ML and keyword-based approaches.
    
    Uses ML model as primary classifier, with keyword-based fallback
    for low-confidence predictions.
    """
    
    def __init__(self, 
                 ml_classifier: MLCategoryClassifier = None,
                 confidence_threshold: float = 0.7):
        """
        Initialize hybrid classifier.
        
        Args:
            ml_classifier: ML classifier instance (creates new if None)
            confidence_threshold: Minimum confidence to trust ML prediction
        """
        # Lazy import to avoid circular dependency
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        self.ml_classifier = ml_classifier or MLCategoryClassifier()
        self.confidence_threshold = confidence_threshold
        
        # Try to import keyword classifier
        try:
            from classifier import classify_ticket as keyword_classify
            self.keyword_classifier = keyword_classify
        except ImportError:
            self.keyword_classifier = None
    
    def classify(self, 
                 text: str, 
                 subject: str = None) -> Dict[str, Any]:
        """
        Classify ticket using hybrid approach.
        
        Args:
            text: Ticket description
            subject: Optional subject line
            
        Returns:
            Classification result with category, confidence, and method used
        """
        # Get ML prediction
        ml_result = self.ml_classifier.predict(text, subject)
        
        # If confidence is high enough, use ML result
        if ml_result['confidence'] >= self.confidence_threshold:
            return {
                **ml_result,
                'method': 'ml',
                'fallback_used': False
            }
        
        # Otherwise, consult keyword classifier if available
        if self.keyword_classifier:
            try:
                full_text = f"{subject or ''} {text}"
                keyword_result = self.keyword_classifier(full_text)
                
                # Compare and choose better result
                keyword_confidence = keyword_result.get('confidence', 0.5)
                
                if keyword_confidence > ml_result['confidence']:
                    return {
                        'category': keyword_result.get('category', 'other'),
                        'confidence': keyword_confidence,
                        'priority': keyword_result.get('priority'),
                        'method': 'keyword',
                        'fallback_used': True,
                        'ml_prediction': ml_result['category'],
                        'ml_confidence': ml_result['confidence']
                    }
            except Exception:
                pass
        
        # Default to ML result even if low confidence
        return {
            **ml_result,
            'method': 'ml',
            'fallback_used': False,
            'low_confidence_warning': True
        }


# Convenience function
def classify_with_ml(text: str, subject: str = None) -> Dict[str, Any]:
    """
    Convenience function to classify a ticket using ML.
    
    Args:
        text: Ticket description
        subject: Optional subject line
        
    Returns:
        Classification result
    """
    classifier = MLCategoryClassifier()
    return classifier.predict(text, subject)


if __name__ == '__main__':
    # Demo
    print("=" * 60)
    print("ML Category Classifier Demo")
    print("=" * 60)
    
    try:
        classifier = MLCategoryClassifier()
        
        # Test examples
        test_cases = [
            ("My laptop screen is cracked and won't turn on", "Laptop broken"),
            ("I can't connect to the company WiFi network", "WiFi issue"),
            ("Need to reset my password, I've been locked out", "Account access"),
            ("The billing for my subscription is incorrect", "Billing dispute"),
            ("Please add dark mode to the application", "Feature suggestion"),
        ]
        
        print("\nTest Predictions:")
        print("-" * 60)
        
        for description, subject in test_cases:
            result = classifier.predict(description, subject)
            print(f"\nInput: {subject}")
            print(f"  → Category: {result['category']}")
            print(f"  → Confidence: {result['confidence']:.2%}")
            
            # Show top 3 categories
            sorted_scores = sorted(result['all_scores'].items(), key=lambda x: x[1], reverse=True)[:3]
            print(f"  → Top 3: {', '.join([f'{c}:{s:.2%}' for c, s in sorted_scores])}")
        
        # Print model info
        print("\n" + "=" * 60)
        print("Model Info:")
        print("-" * 60)
        info = classifier.get_model_info()
        for key, value in info.items():
            print(f"  {key}: {value}")
            
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Please train a model first: python src/train_category_model.py --all")
