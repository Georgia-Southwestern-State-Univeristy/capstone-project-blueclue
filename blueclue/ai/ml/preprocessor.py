"""
Data Preprocessor Module
========================

Cleans and preprocesses ticket data for ML training.
Handles PII removal, missing values, duplicates, and label normalization.
"""

import re
import os
import json
import hashlib
from typing import Dict, List, Optional, Tuple
from collections import Counter
from datetime import datetime
import csv


class DataPreprocessor:
    """
    Preprocesses ticket data for machine learning.
    
    Handles:
    - PII removal (emails, phone numbers, names, etc.)
    - Missing value imputation/removal
    - Duplicate detection and removal
    - Label normalization and consistency
    - Class balancing (oversampling/undersampling)
    
    Usage:
        preprocessor = DataPreprocessor()
        clean_data = preprocessor.preprocess(raw_tickets)
        balanced_data = preprocessor.balance_classes(clean_data, target='category')
    """
    
    # Valid values for categorical fields
    VALID_CATEGORIES = ['general', 'technical', 'billing', 'account', 
                        'feature_request', 'hardware', 'software', 
                        'network', 'login', 'other']
    
    VALID_PRIORITIES = ['low', 'medium', 'high', 'critical']
    
    VALID_STATUSES = ['open', 'in_progress', 'waiting_on_customer', 
                      'resolved', 'closed', 'cancelled', 'reopened']
    
    # PII patterns for removal
    PII_PATTERNS = {
        'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'phone': r'(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        'ssn': r'\b\d{3}[-.]?\d{2}[-.]?\d{4}\b',
        'credit_card': r'\b(?:\d{4}[-.\s]?){3}\d{4}\b',
        'ip_address': r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
        'date_of_birth': r'\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b',
    }
    
    # Common name patterns (basic)
    NAME_INDICATORS = [
        r'\bMr\.?\s+\w+',
        r'\bMs\.?\s+\w+', 
        r'\bMrs\.?\s+\w+',
        r'\bDr\.?\s+\w+',
    ]
    
    def __init__(self, 
                 remove_pii: bool = True,
                 handle_missing: str = 'impute',
                 remove_duplicates: bool = True,
                 min_description_length: int = 10,
                 max_description_length: int = 10000):
        """
        Initialize the preprocessor.
        
        Args:
            remove_pii: Whether to remove personally identifiable information
            handle_missing: Strategy for missing values ('impute', 'remove', 'keep')
            remove_duplicates: Whether to remove duplicate tickets
            min_description_length: Minimum description length (remove shorter)
            max_description_length: Maximum description length (truncate longer)
        """
        self.remove_pii = remove_pii
        self.handle_missing = handle_missing
        self.remove_duplicates = remove_duplicates
        self.min_description_length = min_description_length
        self.max_description_length = max_description_length
        
        # Compile regex patterns
        self.pii_regexes = {
            name: re.compile(pattern, re.IGNORECASE) 
            for name, pattern in self.PII_PATTERNS.items()
        }
        self.name_regexes = [re.compile(p, re.IGNORECASE) for p in self.NAME_INDICATORS]
        
        # Track preprocessing stats
        self.stats = {
            'original_count': 0,
            'pii_removed': 0,
            'missing_handled': 0,
            'duplicates_removed': 0,
            'invalid_labels_fixed': 0,
            'final_count': 0
        }
    
    def _mask_pii(self, text: str) -> Tuple[str, int]:
        """
        Remove PII from text, returning masked text and count of items masked.
        
        Args:
            text: Input text that may contain PII
            
        Returns:
            Tuple of (masked_text, count_of_pii_items_found)
        """
        if not text:
            return text, 0
        
        count = 0
        result = text
        
        # Mask each PII type
        for pii_type, regex in self.pii_regexes.items():
            matches = regex.findall(result)
            count += len(matches)
            replacement = f"[{pii_type.upper()}_REDACTED]"
            result = regex.sub(replacement, result)
        
        # Mask potential names
        for name_regex in self.name_regexes:
            matches = name_regex.findall(result)
            count += len(matches)
            result = name_regex.sub("[NAME_REDACTED]", result)
        
        return result, count
    
    def _normalize_text(self, text: str) -> str:
        """
        Normalize text by cleaning whitespace and special characters.
        
        Args:
            text: Input text
            
        Returns:
            Normalized text
        """
        if not text:
            return text
        
        # Replace multiple whitespace with single space
        text = re.sub(r'\s+', ' ', text)
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        # Truncate if too long
        if len(text) > self.max_description_length:
            text = text[:self.max_description_length] + "..."
        
        return text
    
    def _normalize_category(self, category: str) -> str:
        """Normalize category to valid value."""
        if not category:
            return 'other'
        
        category = category.lower().strip()
        
        # Handle common variations
        mappings = {
            'tech': 'technical',
            'technical support': 'technical',
            'hw': 'hardware',
            'sw': 'software',
            'net': 'network',
            'wifi': 'network',
            'auth': 'login',
            'authentication': 'login',
            'password': 'login',
            'money': 'billing',
            'payment': 'billing',
            'invoice': 'billing',
            'subscription': 'billing',
            'profile': 'account',
            'user': 'account',
            'enhancement': 'feature_request',
            'suggestion': 'feature_request',
            'request': 'feature_request',
        }
        
        if category in mappings:
            category = mappings[category]
        
        if category in self.VALID_CATEGORIES:
            return category
        
        # Try to match partial
        for valid in self.VALID_CATEGORIES:
            if valid in category or category in valid:
                return valid
        
        return 'other'
    
    def _normalize_priority(self, priority: str) -> str:
        """Normalize priority to valid value."""
        if not priority:
            return 'medium'
        
        priority = priority.lower().strip()
        
        # Handle common variations
        mappings = {
            'urgent': 'critical',
            'emergency': 'critical',
            'asap': 'critical',
            'important': 'high',
            'hi': 'high',
            'normal': 'medium',
            'med': 'medium',
            'standard': 'medium',
            'lo': 'low',
            'minor': 'low',
            'when possible': 'low',
        }
        
        if priority in mappings:
            priority = mappings[priority]
        
        if priority in self.VALID_PRIORITIES:
            return priority
        
        return 'medium'
    
    def _compute_text_hash(self, ticket: Dict) -> str:
        """Compute a hash for duplicate detection."""
        # Combine subject and description for hashing
        text = f"{ticket.get('subject', '')}{ticket.get('description', '')}".lower()
        text = re.sub(r'\s+', '', text)  # Remove all whitespace
        return hashlib.md5(text.encode()).hexdigest()
    
    def _impute_missing(self, ticket: Dict) -> Dict:
        """Impute missing values with reasonable defaults."""
        result = ticket.copy()
        
        # Text fields
        if not result.get('subject'):
            result['subject'] = 'No subject provided'
        
        if not result.get('description'):
            result['description'] = result.get('subject', 'No description provided')
        
        # Categorical fields
        if not result.get('category'):
            result['category'] = 'other'
        
        if not result.get('priority'):
            result['priority'] = 'medium'
        
        if not result.get('status'):
            result['status'] = 'open'
        
        # Numerical fields
        if result.get('ai_confidence') is None:
            result['ai_confidence'] = 0.0
        
        if result.get('user_previous_tickets') is None:
            result['user_previous_tickets'] = 0
        
        if result.get('comment_count') is None:
            result['comment_count'] = 0
        
        if result.get('reopen_count') is None:
            result['reopen_count'] = 0
        
        # Boolean fields
        if result.get('ai_classified') is None:
            result['ai_classified'] = False
        
        if result.get('priority_overridden') is None:
            result['priority_overridden'] = False
        
        return result
    
    def _has_required_fields(self, ticket: Dict) -> bool:
        """Check if ticket has required fields for training."""
        required = ['description', 'category', 'priority']
        return all(ticket.get(field) for field in required)
    
    def preprocess_ticket(self, ticket: Dict) -> Optional[Dict]:
        """
        Preprocess a single ticket.
        
        Args:
            ticket: Raw ticket dictionary
            
        Returns:
            Preprocessed ticket dictionary or None if invalid
        """
        result = ticket.copy()
        
        # Handle missing values
        if self.handle_missing == 'impute':
            result = self._impute_missing(result)
        elif self.handle_missing == 'remove':
            if not self._has_required_fields(result):
                self.stats['missing_handled'] += 1
                return None
        
        # Remove PII
        if self.remove_pii:
            if result.get('subject'):
                result['subject'], count = self._mask_pii(result['subject'])
                self.stats['pii_removed'] += count
            
            if result.get('description'):
                result['description'], count = self._mask_pii(result['description'])
                self.stats['pii_removed'] += count
            
            if result.get('resolution'):
                result['resolution'], count = self._mask_pii(result['resolution'])
                self.stats['pii_removed'] += count
        
        # Normalize text fields
        result['subject'] = self._normalize_text(result.get('subject', ''))
        result['description'] = self._normalize_text(result.get('description', ''))
        
        # Check description length
        if len(result.get('description', '')) < self.min_description_length:
            return None
        
        # Normalize categorical fields
        original_category = result.get('category')
        result['category'] = self._normalize_category(result.get('category'))
        if original_category and original_category != result['category']:
            self.stats['invalid_labels_fixed'] += 1
        
        original_priority = result.get('priority')
        result['priority'] = self._normalize_priority(result.get('priority'))
        if original_priority and original_priority != result['priority']:
            self.stats['invalid_labels_fixed'] += 1
        
        # Normalize AI priority if present
        if result.get('ai_priority'):
            result['ai_priority'] = self._normalize_priority(result['ai_priority'])
        if result.get('user_priority'):
            result['user_priority'] = self._normalize_priority(result['user_priority'])
        
        # Add text hash for duplicate detection
        result['_text_hash'] = self._compute_text_hash(result)
        
        return result
    
    def preprocess(self, tickets: List[Dict]) -> List[Dict]:
        """
        Preprocess a list of tickets.
        
        Args:
            tickets: List of raw ticket dictionaries
            
        Returns:
            List of preprocessed ticket dictionaries
        """
        self.stats = {
            'original_count': len(tickets),
            'pii_removed': 0,
            'missing_handled': 0,
            'duplicates_removed': 0,
            'invalid_labels_fixed': 0,
            'final_count': 0
        }
        
        processed = []
        seen_hashes = set()
        
        for ticket in tickets:
            result = self.preprocess_ticket(ticket)
            
            if result is None:
                continue
            
            # Check for duplicates
            if self.remove_duplicates:
                text_hash = result.get('_text_hash')
                if text_hash in seen_hashes:
                    self.stats['duplicates_removed'] += 1
                    continue
                seen_hashes.add(text_hash)
            
            # Remove internal hash field
            result.pop('_text_hash', None)
            
            processed.append(result)
        
        self.stats['final_count'] = len(processed)
        
        print(f"✓ Preprocessed {self.stats['original_count']} tickets → {self.stats['final_count']} clean tickets")
        print(f"  - PII items masked: {self.stats['pii_removed']}")
        print(f"  - Duplicates removed: {self.stats['duplicates_removed']}")
        print(f"  - Invalid labels fixed: {self.stats['invalid_labels_fixed']}")
        
        return processed
    
    def get_class_distribution(self, tickets: List[Dict], field: str) -> Dict[str, int]:
        """Get distribution of a categorical field."""
        return Counter(t.get(field) for t in tickets if t.get(field))
    
    def balance_classes(self, 
                        tickets: List[Dict], 
                        target_field: str = 'category',
                        strategy: str = 'oversample',
                        max_ratio: float = 2.0) -> List[Dict]:
        """
        Balance class distribution in the dataset.
        
        Args:
            tickets: List of ticket dictionaries
            target_field: Field to balance ('category' or 'priority')
            strategy: 'oversample' (duplicate minority) or 'undersample' (reduce majority)
            max_ratio: Maximum allowed ratio between largest and smallest class
            
        Returns:
            Balanced list of tickets
        """
        import random
        
        distribution = self.get_class_distribution(tickets, target_field)
        
        if not distribution:
            print("✗ Cannot balance: no valid target field values")
            return tickets
        
        max_count = max(distribution.values())
        min_count = min(distribution.values())
        
        if max_count / min_count <= max_ratio:
            print(f"✓ Classes already balanced (ratio: {max_count/min_count:.2f})")
            return tickets
        
        # Group tickets by target field
        groups = {value: [] for value in distribution.keys()}
        for ticket in tickets:
            value = ticket.get(target_field)
            if value:
                groups[value].append(ticket)
        
        balanced = []
        
        if strategy == 'oversample':
            target_count = int(max_count / max_ratio)  # Don't oversample too much
            target_count = max(target_count, min_count)
            
            for value, group_tickets in groups.items():
                if len(group_tickets) >= target_count:
                    balanced.extend(group_tickets)
                else:
                    # Oversample minority class
                    balanced.extend(group_tickets)
                    needed = target_count - len(group_tickets)
                    balanced.extend(random.choices(group_tickets, k=needed))
        
        elif strategy == 'undersample':
            target_count = int(min_count * max_ratio)
            target_count = min(target_count, max_count)
            
            for value, group_tickets in groups.items():
                if len(group_tickets) <= target_count:
                    balanced.extend(group_tickets)
                else:
                    # Undersample majority class
                    balanced.extend(random.sample(group_tickets, target_count))
        
        random.shuffle(balanced)
        
        new_distribution = self.get_class_distribution(balanced, target_field)
        new_max = max(new_distribution.values())
        new_min = min(new_distribution.values())
        
        print(f"✓ Balanced {target_field}: {len(tickets)} → {len(balanced)} tickets")
        print(f"  - Original ratio: {max_count}:{min_count} ({max_count/min_count:.2f})")
        print(f"  - New ratio: {new_max}:{new_min} ({new_max/new_min:.2f})")
        
        return balanced
    
    def save_preprocessed(self, tickets: List[Dict], filepath: str):
        """Save preprocessed data to file."""
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        
        if filepath.endswith('.json'):
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(tickets, f, indent=2, default=str)
        else:
            fieldnames = tickets[0].keys() if tickets else []
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(tickets)
        
        print(f"✓ Saved preprocessed data to {filepath}")
    
    def get_preprocessing_report(self) -> Dict:
        """Get a report of preprocessing statistics."""
        return {
            'preprocessing_stats': self.stats,
            'pii_patterns_used': list(self.PII_PATTERNS.keys()),
            'valid_categories': self.VALID_CATEGORIES,
            'valid_priorities': self.VALID_PRIORITIES,
            'settings': {
                'remove_pii': self.remove_pii,
                'handle_missing': self.handle_missing,
                'remove_duplicates': self.remove_duplicates,
                'min_description_length': self.min_description_length,
                'max_description_length': self.max_description_length
            }
        }


if __name__ == "__main__":
    # Example usage
    from synthetic_generator import SyntheticDataGenerator
    
    # Generate some test data
    generator = SyntheticDataGenerator(seed=42)
    raw_tickets = generator.generate(n_samples=100)
    
    # Add some fake PII to test removal
    raw_tickets[0]['description'] += " Contact me at john.doe@example.com or 555-123-4567"
    raw_tickets[1]['description'] += " My SSN is 123-45-6789"
    
    # Preprocess
    preprocessor = DataPreprocessor()
    clean_tickets = preprocessor.preprocess(raw_tickets)
    
    # Balance classes
    balanced_tickets = preprocessor.balance_classes(clean_tickets, target_field='category')
    
    # Show report
    report = preprocessor.get_preprocessing_report()
    print("\nPreprocessing Report:")
    print(json.dumps(report, indent=2))
