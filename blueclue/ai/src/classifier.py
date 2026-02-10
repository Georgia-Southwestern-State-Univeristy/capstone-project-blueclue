try:
    import spacy
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    
from typing import Dict, List, Tuple

class TicketClassifier:
    def __init__(self, use_spacy=True):
        """Initialize the keyword-based ticket classifier."""
        self.use_spacy = use_spacy and SPACY_AVAILABLE
        if self.use_spacy:
            try:
                self.nlp = spacy.load("en_core_web_sm")
            except:
                print("Warning: spaCy model not available, using simple preprocessing")
                self.use_spacy = False
                self.nlp = None
        else:
            self.nlp = None
        
        # Define keyword patterns for categories
        self.category_keywords = {
            "hardware": ["laptop", "computer", "screen", "monitor", "keyboard", "mouse", "printer",
                        "device", "hardware", "broken", "damaged", "physical", "cable", "port",
                        "battery", "power", "charger", "display"],
            "software": ["application", "app", "program", "software", "install", "update", "upgrade",
                        "microsoft", "office", "windows", "excel", "word", "outlook", "adobe",
                        "chrome", "browser", "antivirus"],
            "network": ["wifi", "internet", "connection", "network", "ethernet", "vpn", "router",
                       "disconnect", "slow internet", "can't connect", "connectivity", "bandwidth",
                       "dns", "ip address"],
            "login": ["login", "password", "access", "username", "sign in", "authentication",
                     "locked out", "reset password", "can't login", "account locked", "credentials",
                     "email account"],
            "other": ["question", "policy", "policies", "general", "inquiry", "information",
                     "help", "guidance", "wondering", "clarification"]
        }
        
        # Define keyword patterns for priority
        self.priority_keywords = {
            "high": ["urgent", "urgently", "critical", "emergency", "asap", "immediately", 
                    "production", "down", "broken", "can't work", "need help", "important"],
            "medium": ["issue", "problem", "help", "need", "soon", "can't", "unable", "not working",
                      "disconnecting", "keeps", "won't"],
            "low": ["question", "when you get a chance", "wondering", "general", "policy",
                   "policies", "information", "sometime", "eventually", "curious"]
        }
    
    def preprocess_text(self, text: str) -> str:
        """Normalize and clean the input text."""
        if self.use_spacy and self.nlp:
            doc = self.nlp(text.lower())
            # Remove stopwords and lemmatize
            tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct]
            return " ".join(tokens)
        else:
            # Simple preprocessing without spacy
            return text.lower()
    
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
        return "other", 0.3, True, []
    
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
