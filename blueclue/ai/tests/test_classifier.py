import sys
from pathlib import Path

# Add parent directory to path to import from src
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.classifier import TicketClassifier

def test_classifier():
    """Test the ticket classifier with sample tickets."""
    classifier = TicketClassifier()
    
    test_tickets = [
        {
            "text": "My application keeps crashing when I try to login. This is urgent!",
            "expected_category": "technical",
            "expected_priority": "high"
        },
        {
            "text": "I was charged twice for my subscription. Can I get a refund?",
            "expected_category": "billing",
            "expected_priority": "medium"
        },
        {
            "text": "I forgot my password and can't access my account.",
            "expected_category": "account",
            "expected_priority": "medium"
        },
        {
            "text": "It would be great if you could add a dark mode feature.",
            "expected_category": "feature_request",
            "expected_priority": "low"
        }
    ]
    
    print("=== Ticket Classification Test ===\n")
    
    correct = 0
    total = len(test_tickets)
    
    for i, ticket in enumerate(test_tickets, 1):
        result = classifier.classify(ticket["text"])
        
        category_correct = result["category"] == ticket["expected_category"]
        priority_correct = result["priority"] == ticket["expected_priority"]
        
        if category_correct and priority_correct:
            correct += 1
        
        print(f"Ticket {i}:")
        print(f"Text: {ticket['text']}")
        print(f"Category: {result['category']} {'✓' if category_correct else '✗ (expected: ' + ticket['expected_category'] + ')'}")
        print(f"Priority: {result['priority']} {'✓' if priority_correct else '✗ (expected: ' + ticket['expected_priority'] + ')'}")
        print(f"Confidence: {result['confidence']}")
        print(f"Fallback Used: {result['fallback_used']}")
        print(f"Keywords Matched: {result['keywords_matched']}")
        print()
    
    accuracy = (correct / total) * 100
    print(f"=== Results ===")
    print(f"Accuracy: {accuracy}%")
    print(f"Passed: {correct}/{total}")
    
    if accuracy >= 70:
        print("✓ Test PASSED (≥70% accuracy)")
    else:
        print("✗ Test FAILED (<70% accuracy)")

if __name__ == "__main__":
    test_classifier()
