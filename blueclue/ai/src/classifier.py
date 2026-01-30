import spacy
from typing import Dict, List, Tuple

class TicketClassifier:
    def __init__(self):
        """Initialize the keyword-based ticket classifier."""
        self.nlp = spacy.load("en_core_web_sm")
        
        # Define keyword patterns for categories
        self.category_keywords = {
            "technical": ["error", "bug", "crash", "not working", "broken", "issue", "problem", 
                         "fails", "failure", "down", "offline", "timeout", "slow", "performance"],
            "billing": ["payment", "charge", "invoice", "refund", "subscription", "credit card",
                       "price", "cost", "billing", "account", "receipt"],
            "account": ["login", "password", "access", "username", "sign in", "authentication",
                       "locked out", "reset", "profile", "settings"],
            "feature_request": ["add", "new feature", "enhancement", "improve", "suggestion",
                               "would like", "can you", "request", "wish"]
        }
        
        # Define keyword patterns for priority
        self.priority_keywords = {
            "high": ["urgent", "critical", "emergency", "asap", "immediately", "production"],
            "medium": ["issue", "problem", "help", "need", "important", "refund", "charge", "payment"],
            "low": ["question", "how to", "wondering", "feature", "suggestion", "enhance"]
        }
    
    def preprocess_text(self, text: str) -> str:
        """Normalize and clean the input text."""
        doc = self.nlp(text.lower())
        # Remove stopwords and lemmatize
        tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct]
        return " ".join(tokens)
    
    def classify_category(self, text: str) -> Tuple[str, float, bool, List[str]]:
        """
        Classify ticket category based on keywords.
        
        Returns:
            Tuple of (category, confidence, fallback_used, keywords_matched)
        """
        processed_text = self.preprocess_text(text)
        original_lower = text.lower()
        
        category_scores = {}
        matched_keywords = {}
        
        for category, keywords in self.category_keywords.items():
            score = 0
            matches = []
            for keyword in keywords:
                if keyword in original_lower or keyword in processed_text:
                    score += 1
                    matches.append(keyword)
            
            category_scores[category] = score
            matched_keywords[category] = matches
        
        # Find best match
        if max(category_scores.values()) > 0:
            best_category = max(category_scores, key=category_scores.get)
            confidence = min(category_scores[best_category] / 3.0, 1.0)  # Normalize to 0-1
            return best_category, confidence, False, matched_keywords[best_category]
        
        # Fallback
        return "general", 0.3, True, []
    
    def classify_priority(self, text: str) -> Tuple[str, List[str]]:
        """
        Classify ticket priority based on keywords.
        
        Returns:
            Tuple of (priority, keywords_matched)
        """
        original_lower = text.lower()
        
        priority_scores = {}
        matched_keywords = {}
        
        for priority, keywords in self.priority_keywords.items():
            score = 0
            matches = []
            for keyword in keywords:
                if keyword in original_lower:
                    score += 1
                    matches.append(keyword)
            
            priority_scores[priority] = score
            matched_keywords[priority] = matches
        
        # High priority takes precedence
        if priority_scores.get("high", 0) > 0:
            return "high", matched_keywords["high"]
        elif priority_scores.get("medium", 0) > 0:
            return "medium", matched_keywords["medium"]
        else:
            return "low", matched_keywords.get("low", [])
    
    def classify(self, ticket_text: str) -> Dict:
        """
        Classify a ticket's category and priority.
        
        Args:
            ticket_text: The ticket description text
            
        Returns:
            Dictionary with classification results
        """
        category, confidence, fallback_used, cat_keywords = self.classify_category(ticket_text)
        priority, pri_keywords = self.classify_priority(ticket_text)
        
        return {
            "category": category,
            "priority": priority,
            "confidence": round(confidence, 2),
            "fallback_used": fallback_used,
            "keywords_matched": {
                "category": cat_keywords,
                "priority": pri_keywords
            }
        }
