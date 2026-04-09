"""
Feature Extractor Module
========================

Extracts features from preprocessed ticket data for ML model training.
Handles text features (TF-IDF, statistics) and metadata features.
"""

import os
import re
import json
import pickle
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from collections import Counter
import csv


class FeatureExtractor:
    """
    Extracts features from ticket data for machine learning.
    
    Features extracted:
    - Text features: TF-IDF vectors, text length, word count, special characters
    - Metadata features: time of day, day of week, user history
    - Derived features: urgency indicators, technical terms
    
    Usage:
        extractor = FeatureExtractor()
        extractor.fit(train_tickets)
        features = extractor.transform(tickets)
        extractor.save('../data/features/feature_extractor.pkl')
    """
    
    # Technical/urgency keywords that indicate priority
    # Expanded in v2_20260320: added account-lockout, MFA, expired credentials,
    # repeated failures, and deadline-driven urgency patterns.
    URGENCY_KEYWORDS = {
        'critical': [
            'urgent', 'asap', 'emergency', 'critical', 'immediately',
            'down', 'outage', 'crashed', 'broken', 'not working',
            'production', 'all users', 'company-wide', 'blocking',
            'locked out', 'account locked', 'password expired',
            'mfa not working', '2fa not working', 'no one can work',
            'blocking my work', 'blocked from working',
        ],
        'high': [
            'important', 'soon', 'quickly', 'help needed', 'stuck',
            'error', 'problem', 'failed', 'cannot access', 'deadline',
            'not responding', 'keeps crashing', 'keeps restarting',
            'update failed', 'remote access not working',
            'authentication stopped working', 'presentation in',
            'meeting in', 'in 30 minutes', 'in an hour',
        ],
        'technical': [
            'error code', 'stack trace', 'log', 'debug', 'exception',
            'crash', 'blue screen', 'bsod', 'memory', 'cpu', 'disk',
            'server', 'database', 'api', 'authentication',
            'driver', 'firmware', 'registry', 'event log',
        ],
    }
    
    # Common IT terms for feature extraction
    IT_TERMS = [
        'network', 'wifi', 'internet', 'vpn', 'connection',
        'password', 'login', 'account', 'access', 'permission',
        'software', 'application', 'install', 'update', 'upgrade',
        'hardware', 'computer', 'laptop', 'monitor', 'printer',
        'email', 'outlook', 'teams', 'office', 'excel', 'word',
        'server', 'database', 'backup', 'restore', 'security'
    ]
    
    def __init__(self, 
                 max_features: int = 5000,
                 ngram_range: Tuple[int, int] = (1, 2),
                 min_df: int = 2,
                 max_df: float = 0.95,
                 use_temporal_features: bool = True):
        """
        Initialize the feature extractor.
        
        Args:
            max_features: Maximum number of TF-IDF features
            ngram_range: Range of n-grams to extract (min, max)
            min_df: Minimum document frequency for terms
            max_df: Maximum document frequency (as proportion)
            use_temporal_features: If False, exclude time-of-day/day-of-week
                features.  Set to False for category models where submission
                time has no semantic relationship to the ticket type.
        """
        self.max_features = max_features
        self.ngram_range = ngram_range
        self.min_df = min_df
        self.max_df = max_df
        self.use_temporal_features = use_temporal_features
        
        # Will be initialized on fit
        self.tfidf_vectorizer = None
        self.feature_names = []
        self.is_fitted = False
        
        # Feature statistics (computed on fit)
        self.text_length_mean = 0
        self.text_length_std = 1
        self.word_count_mean = 0
        self.word_count_std = 1
        
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for TF-IDF extraction."""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Replace common abbreviations
        abbreviations = {
            r'\bwont\b': 'will not',
            r'\bcant\b': 'cannot',
            r'\bdont\b': 'do not',
            r'\bisnt\b': 'is not',
            r'\bpc\b': 'computer',
            r'\bwifi\b': 'wireless network',
            r'\basap\b': 'as soon as possible',
            r'\bpw\b': 'password',
            r'\bpls\b': 'please',
            r'\bthx\b': 'thanks',
            r'\binfo\b': 'information',
        }
        
        for pattern, replacement in abbreviations.items():
            text = re.sub(pattern, replacement, text)
        
        # Remove special characters except alphanumeric and spaces
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def _extract_text_stats(self, text: str) -> Dict[str, float]:
        """Extract statistical features from text."""
        if not text:
            return {
                'text_length': 0,
                'word_count': 0,
                'avg_word_length': 0,
                'sentence_count': 0,
                'question_marks': 0,
                'exclamation_marks': 0,
                'uppercase_ratio': 0,
                'digit_ratio': 0,
                'special_char_ratio': 0,
            }
        
        words = text.split()
        sentences = re.split(r'[.!?]+', text)
        
        return {
            'text_length': len(text),
            'word_count': len(words),
            'avg_word_length': np.mean([len(w) for w in words]) if words else 0,
            'sentence_count': len([s for s in sentences if s.strip()]),
            'question_marks': text.count('?'),
            'exclamation_marks': text.count('!'),
            'uppercase_ratio': sum(1 for c in text if c.isupper()) / len(text) if text else 0,
            'digit_ratio': sum(1 for c in text if c.isdigit()) / len(text) if text else 0,
            'special_char_ratio': sum(1 for c in text if not c.isalnum() and not c.isspace()) / len(text) if text else 0,
        }
    
    def _extract_urgency_features(self, text: str) -> Dict[str, int]:
        """Extract urgency-related features from text."""
        if not text:
            return {f'has_{k}_keywords': 0 for k in self.URGENCY_KEYWORDS}
        
        text_lower = text.lower()
        features = {}
        
        for urgency_level, keywords in self.URGENCY_KEYWORDS.items():
            count = sum(1 for kw in keywords if kw in text_lower)
            features[f'has_{urgency_level}_keywords'] = min(count, 5)  # Cap at 5
        
        return features
    
    def _extract_it_term_features(self, text: str) -> Dict[str, int]:
        """Extract IT domain-specific term features."""
        if not text:
            return {f'has_term_{term}': 0 for term in self.IT_TERMS}
        
        text_lower = text.lower()
        features = {}
        
        for term in self.IT_TERMS:
            features[f'has_term_{term}'] = 1 if term in text_lower else 0
        
        return features
    
    def _extract_time_features(self, created_at: str) -> Dict[str, Any]:
        """Extract time-based features from creation timestamp.
        
        Returns an empty dict when ``use_temporal_features=False`` so that
        time-of-day noise is excluded from models where it is not meaningful
        (e.g. category classification).
        """
        if not self.use_temporal_features:
            return {}

        features = {
            'hour_of_day': 12,
            'day_of_week': 0,
            'is_business_hours': 1,
            'is_weekend': 0,
            'is_morning': 0,
            'is_afternoon': 0,
            'is_evening': 0,
        }
        
        if not created_at:
            return features
        
        try:
            if isinstance(created_at, str):
                # Handle ISO format
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            elif isinstance(created_at, datetime):
                dt = created_at
            else:
                return features
            
            hour = dt.hour
            day = dt.weekday()  # 0=Monday, 6=Sunday
            
            features['hour_of_day'] = hour
            features['day_of_week'] = day
            features['is_business_hours'] = 1 if 9 <= hour <= 17 else 0
            features['is_weekend'] = 1 if day >= 5 else 0
            features['is_morning'] = 1 if 6 <= hour < 12 else 0
            features['is_afternoon'] = 1 if 12 <= hour < 18 else 0
            features['is_evening'] = 1 if 18 <= hour < 22 else 0
            
        except Exception:
            pass
        
        return features
    
    def _extract_user_features(self, ticket: Dict) -> Dict[str, Any]:
        """Extract user-related features."""
        try:
            prev = int(ticket.get('user_previous_tickets', 0) or 0)
        except (ValueError, TypeError):
            prev = 0
        return {
            'user_previous_tickets': prev,
            'is_repeat_user': 1 if prev > 0 else 0,
            'is_frequent_user': 1 if prev >= 5 else 0,
        }
    
    def _extract_metadata_features(self, ticket: Dict) -> Dict[str, Any]:
        """Extract additional metadata features."""
        try:
            comment_count = int(ticket.get('comment_count', 0) or 0)
        except (ValueError, TypeError):
            comment_count = 0
        try:
            reopen_count = int(ticket.get('reopen_count', 0) or 0)
        except (ValueError, TypeError):
            reopen_count = 0
        ai_classified_raw = ticket.get('ai_classified', False)
        ai_classified = 1 if str(ai_classified_raw).lower() in ('true', '1', 'yes') else 0
        priority_overridden_raw = ticket.get('priority_overridden', False)
        priority_overridden = 1 if str(priority_overridden_raw).lower() in ('true', '1', 'yes') else 0
        return {
            'ai_classified': ai_classified,
            'ai_confidence': float(ticket.get('ai_confidence', 0) or 0),
            'priority_overridden': priority_overridden,
            'has_user_priority': 1 if ticket.get('user_priority') else 0,
            'comment_count': comment_count,
            'reopen_count': reopen_count,
        }
    
    def fit(self, tickets: List[Dict]) -> 'FeatureExtractor':
        """
        Fit the feature extractor on training data.
        
        Args:
            tickets: List of preprocessed ticket dictionaries
            
        Returns:
            self (for chaining)
        """
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
        except ImportError:
            raise ImportError("scikit-learn is required. Install with: pip install scikit-learn")
        
        # Prepare text data
        # Subject is prepended twice to give it 2x weight vs description body
        texts = []
        for ticket in tickets:
            subj = ticket.get('subject', '')
            combined_text = f"{subj} {subj} {ticket.get('description', '')}" if subj else ticket.get('description', '')
            texts.append(self._preprocess_text(combined_text))
        
        # Fit TF-IDF vectorizer
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=self.max_features,
            ngram_range=self.ngram_range,
            min_df=self.min_df,
            max_df=self.max_df,
            stop_words='english'
        )
        self.tfidf_vectorizer.fit(texts)
        
        # Compute text statistics for normalization
        text_lengths = [len(t) for t in texts]
        word_counts = [len(t.split()) for t in texts]
        
        self.text_length_mean = np.mean(text_lengths)
        self.text_length_std = np.std(text_lengths) or 1
        self.word_count_mean = np.mean(word_counts)
        self.word_count_std = np.std(word_counts) or 1
        
        # Store feature names
        self.feature_names = (
            list(self.tfidf_vectorizer.get_feature_names_out()) +
            list(self._extract_text_stats("sample").keys()) +
            list(self._extract_urgency_features("sample").keys()) +
            list(self._extract_it_term_features("sample").keys()) +
            list(self._extract_time_features("2024-01-01T12:00:00").keys()) +
            list(self._extract_user_features({}).keys()) +
            list(self._extract_metadata_features({}).keys())
        )
        
        self.is_fitted = True
        
        print(f"[OK] Feature extractor fitted on {len(tickets)} tickets")
        print(f"  - TF-IDF features: {len(self.tfidf_vectorizer.get_feature_names_out())}")
        print(f"  - Total features: {len(self.feature_names)}")
        
        return self
    
    def transform(self, tickets: List[Dict]) -> np.ndarray:
        """
        Transform tickets into feature matrix.
        
        Args:
            tickets: List of preprocessed ticket dictionaries
            
        Returns:
            Feature matrix of shape (n_samples, n_features)
        """
        if not self.is_fitted:
            raise RuntimeError("FeatureExtractor must be fitted before transform")
        
        features_list = []
        
        for ticket in tickets:
            # Combined text for TF-IDF
            # Subject is prepended twice to give it 2x weight vs description body
            subj = ticket.get('subject', '')
            combined_text = f"{subj} {subj} {ticket.get('description', '')}" if subj else ticket.get('description', '')
            processed_text = self._preprocess_text(combined_text)
            
            # TF-IDF features
            tfidf_vector = self.tfidf_vectorizer.transform([processed_text]).toarray()[0]
            
            # Text statistics
            text_stats = self._extract_text_stats(combined_text)
            # Normalize
            text_stats['text_length'] = (text_stats['text_length'] - self.text_length_mean) / self.text_length_std
            text_stats['word_count'] = (text_stats['word_count'] - self.word_count_mean) / self.word_count_std
            
            # Urgency features
            urgency_features = self._extract_urgency_features(combined_text)
            
            # IT term features
            it_features = self._extract_it_term_features(combined_text)
            
            # Time features
            time_features = self._extract_time_features(ticket.get('created_at'))
            
            # User features
            user_features = self._extract_user_features(ticket)
            
            # Metadata features
            meta_features = self._extract_metadata_features(ticket)
            
            # Combine all features
            all_features = np.concatenate([
                tfidf_vector,
                list(text_stats.values()),
                list(urgency_features.values()),
                list(it_features.values()),
                list(time_features.values()),
                list(user_features.values()),
                list(meta_features.values())
            ])
            
            features_list.append(all_features)
        
        feature_matrix = np.array(features_list)
        
        # Only log transform stats for batch operations, not single-ticket inference
        if len(tickets) > 1:
            print(f"[OK] Transformed {len(tickets)} tickets into {feature_matrix.shape} feature matrix")
        
        return feature_matrix
    
    def fit_transform(self, tickets: List[Dict]) -> np.ndarray:
        """Fit and transform in one step."""
        self.fit(tickets)
        return self.transform(tickets)
    
    def extract_labels(self, tickets: List[Dict], target: str = 'category') -> np.ndarray:
        """
        Extract target labels for training.
        
        Args:
            tickets: List of ticket dictionaries
            target: Target field ('category' or 'priority')
            
        Returns:
            Array of labels
        """
        labels = [ticket.get(target, 'unknown') for ticket in tickets]
        return np.array(labels)
    
    def get_feature_documentation(self) -> Dict[str, str]:
        """Get documentation for all features."""
        docs = {}
        
        # TF-IDF features
        if self.tfidf_vectorizer:
            for name in self.tfidf_vectorizer.get_feature_names_out():
                docs[name] = f"TF-IDF weight for term/ngram: {name}"
        
        # Text statistics
        docs.update({
            'text_length': 'Normalized length of combined subject and description',
            'word_count': 'Normalized word count of combined text',
            'avg_word_length': 'Average length of words in text',
            'sentence_count': 'Number of sentences detected',
            'question_marks': 'Count of question marks (indicates questions)',
            'exclamation_marks': 'Count of exclamation marks (indicates urgency)',
            'uppercase_ratio': 'Ratio of uppercase characters (indicates emphasis)',
            'digit_ratio': 'Ratio of digits (indicates error codes, IDs)',
            'special_char_ratio': 'Ratio of special characters',
        })
        
        # Urgency features
        for level in self.URGENCY_KEYWORDS:
            docs[f'has_{level}_keywords'] = f'Count of {level}-level urgency keywords found'
        
        # IT terms
        for term in self.IT_TERMS:
            docs[f'has_term_{term}'] = f'Binary: 1 if "{term}" appears in text'
        
        # Time features
        docs.update({
            'hour_of_day': 'Hour of ticket creation (0-23)',
            'day_of_week': 'Day of week (0=Monday, 6=Sunday)',
            'is_business_hours': 'Binary: 1 if created during 9am-5pm',
            'is_weekend': 'Binary: 1 if created on Saturday/Sunday',
            'is_morning': 'Binary: 1 if created 6am-12pm',
            'is_afternoon': 'Binary: 1 if created 12pm-6pm',
            'is_evening': 'Binary: 1 if created 6pm-10pm',
        })
        
        # User features
        docs.update({
            'user_previous_tickets': 'Number of tickets user submitted in past 30 days',
            'is_repeat_user': 'Binary: 1 if user has submitted tickets before',
            'is_frequent_user': 'Binary: 1 if user has >= 5 previous tickets',
        })
        
        # Metadata features
        docs.update({
            'ai_classified': 'Binary: 1 if AI classified this ticket',
            'ai_confidence': 'AI classification confidence score (0-1)',
            'priority_overridden': 'Binary: 1 if priority was manually overridden',
            'has_user_priority': 'Binary: 1 if user explicitly set priority',
            'comment_count': 'Number of comments on ticket',
            'reopen_count': 'Number of times ticket was reopened',
        })
        
        return docs
    
    def save(self, filepath: str):
        """Save the fitted feature extractor."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted FeatureExtractor")
        
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        
        state = {
            'tfidf_vectorizer': self.tfidf_vectorizer,
            'feature_names': self.feature_names,
            'max_features': self.max_features,
            'ngram_range': self.ngram_range,
            'min_df': self.min_df,
            'max_df': self.max_df,
            'text_length_mean': self.text_length_mean,
            'text_length_std': self.text_length_std,
            'word_count_mean': self.word_count_mean,
            'word_count_std': self.word_count_std,
            'is_fitted': self.is_fitted,
            'use_temporal_features': self.use_temporal_features,
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(state, f)
        
        print(f"[OK] Feature extractor saved to {filepath}")
    
    @classmethod
    def load(cls, filepath: str) -> 'FeatureExtractor':
        """Load a fitted feature extractor."""
        with open(filepath, 'rb') as f:
            state = pickle.load(f)
        
        extractor = cls(
            max_features=state['max_features'],
            ngram_range=state['ngram_range'],
            min_df=state['min_df'],
            max_df=state['max_df'],
            use_temporal_features=state.get('use_temporal_features', True),  # backward compat
        )
        extractor.tfidf_vectorizer = state['tfidf_vectorizer']
        extractor.feature_names = state['feature_names']
        extractor.text_length_mean = state['text_length_mean']
        extractor.text_length_std = state['text_length_std']
        extractor.word_count_mean = state['word_count_mean']
        extractor.word_count_std = state['word_count_std']
        extractor.is_fitted = state['is_fitted']
        
        print(f"[OK] Feature extractor loaded from {filepath}")
        
        return extractor
    
    def save_feature_matrix(self, 
                            features: np.ndarray, 
                            labels: np.ndarray,
                            filepath: str,
                            format: str = 'npz'):
        """
        Save feature matrix and labels to file.
        
        Args:
            features: Feature matrix
            labels: Label array
            filepath: Output file path
            format: 'npz' or 'csv'
        """
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        
        if format == 'npz':
            np.savez(filepath, features=features, labels=labels, 
                     feature_names=self.feature_names)
            print(f"[OK] Saved feature matrix ({features.shape}) to {filepath}")
        elif format == 'csv':
            # Create DataFrame-like structure
            header = self.feature_names + ['label']
            with open(filepath, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(header)
                for i in range(len(features)):
                    row = list(features[i]) + [labels[i]]
                    writer.writerow(row)
            print(f"[OK] Saved feature matrix ({features.shape}) to {filepath}")


if __name__ == "__main__":
    # Example usage
    from synthetic_generator import SyntheticDataGenerator
    from preprocessor import DataPreprocessor
    
    # Generate and preprocess data
    generator = SyntheticDataGenerator(seed=42)
    raw_tickets = generator.generate(n_samples=200)
    
    preprocessor = DataPreprocessor()
    clean_tickets = preprocessor.preprocess(raw_tickets)
    
    # Extract features
    extractor = FeatureExtractor(max_features=1000)
    features = extractor.fit_transform(clean_tickets)
    labels = extractor.extract_labels(clean_tickets, target='category')
    
    print(f"\nFeature matrix shape: {features.shape}")
    print(f"Labels shape: {labels.shape}")
    print(f"Unique labels: {set(labels)}")
    
    # Show some feature names
    print(f"\nFirst 20 feature names:")
    for name in extractor.feature_names[:20]:
        print(f"  - {name}")
    
    # Save
    extractor.save('../data/features/feature_extractor.pkl')
    extractor.save_feature_matrix(features, labels, '../data/features/train_features.npz')
