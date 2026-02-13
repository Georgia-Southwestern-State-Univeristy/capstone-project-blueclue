"""Test priority classification in detail"""
from src.classifier import TicketClassifier
import json

classifier = TicketClassifier(use_spacy=False)

print("\n" + "="*80)
print("PRIORITY CLASSIFICATION TEST")
print("="*80 + "\n")

# Test cases covering different priority levels
test_cases = [
    # HIGH PRIORITY - should trigger high
    {
        "description": "URGENT: Production server is down, can't work at all!",
        "expected": "high",
        "reason": "urgent, production, down, can't work"
    },
    {
        "description": "EMERGENCY - laptop completely broken, need ASAP",
        "expected": "high",
        "reason": "emergency, completely broken, asap"
    },
    {
        "description": "Critical issue: system down, blocking all work",
        "expected": "high",
        "reason": "critical, system down, blocking"
    },
    {
        "description": "My computer won't turn on at all and I have a deadline today",
        "expected": "high",
        "reason": "won't turn on at all, today"
    },
    {
        "description": "Locked out of my account and cannot work",
        "expected": "high",
        "reason": "locked out, cannot work"
    },
    
    # MEDIUM PRIORITY - should trigger medium
    {
        "description": "I'm having trouble with my printer, it won't print",
        "expected": "medium",
        "reason": "trouble, won't print"
    },
    {
        "description": "My mouse keeps disconnecting, can you help?",
        "expected": "medium",
        "reason": "keeps disconnecting"
    },
    {
        "description": "Issue with email - attachments not working properly",
        "expected": "medium",
        "reason": "issue, not working"
    },
    {
        "description": "Need help with password reset today",
        "expected": "medium",
        "reason": "need help, today"
    },
    {
        "description": "Screen is flickering and it's hard to see",
        "expected": "medium",
        "reason": "problem affecting work"
    },
    
    # LOW PRIORITY - should trigger low
    {
        "description": "Just wondering if we can get a new keyboard when possible",
        "expected": "low",
        "reason": "wondering, when possible"
    },
    {
        "description": "Question about software installation policy, no rush",
        "expected": "low",
        "reason": "question, no rush"
    },
    {
        "description": "I'm curious about upgrading my monitor sometime",
        "expected": "low",
        "reason": "curious, sometime"
    },
    {
        "description": "General question about backup procedures when you get a chance",
        "expected": "low",
        "reason": "general question, when you get a chance"
    },
    {
        "description": "Information request about printer policies, not urgent",
        "expected": "low",
        "reason": "information, not urgent"
    },
]

print(f"Testing {len(test_cases)} priority classification scenarios...\n")

correct = 0
incorrect = 0
results = []

for i, test in enumerate(test_cases, 1):
    result = classifier.classify(test["description"])
    
    is_correct = result['priority'] == test['expected']
    if is_correct:
        correct += 1
        status = "✓ PASS"
    else:
        incorrect += 1
        status = "✗ FAIL"
    
    results.append({
        "test_num": i,
        "description": test["description"],
        "expected": test['expected'],
        "actual": result['priority'],
        "confidence": result['priority_confidence'],
        "matched_keywords": result['keywords_matched']['priority'],
        "status": status,
        "reason": test['reason']
    })
    
    print(f"Test #{i}: {status}")
    print(f"  Description: {test['description'][:60]}...")
    print(f"  Expected: {test['expected'].upper()}")
    print(f"  Actual: {result['priority'].upper()} (confidence: {result['priority_confidence']:.2f})")
    print(f"  Matched Keywords: {result['keywords_matched']['priority']}")
    print(f"  Reason: {test['reason']}")
    print()

print("="*80)
print(f"RESULTS: {correct}/{len(test_cases)} tests passed ({(correct/len(test_cases)*100):.1f}%)")
print("="*80)

if incorrect > 0:
    print(f"\n⚠ {incorrect} test(s) failed. Reviewing failures:\n")
    for r in results:
        if "✗" in r['status']:
            print(f"Test #{r['test_num']}: Expected {r['expected']}, got {r['actual']}")
            print(f"  '{r['description'][:70]}...'")
            print(f"  Matched keywords: {r['matched_keywords']}")
            print()

print("\n" + "="*80)
print("DIAGNOSTIC INFORMATION")
print("="*80)

# Test a simple case to see internal scoring
print("\nDiagnosing: 'URGENT laptop broken need help ASAP'")
test_text = "URGENT laptop broken need help ASAP"
result = classifier.classify(test_text)

print(f"\nFull classification result:")
print(json.dumps({
    "category": result['category'],
    "priority": result['priority'],
    "priority_confidence": result['priority_confidence'],
    "keywords_matched": result['keywords_matched'],
    "priority_source": result.get('priority_source', 'ai')
}, indent=2))

print("\n" + "="*80)
print("To test with real ticket creation, submit tickets with these descriptions:")
print("="*80)
print("\nHIGH PRIORITY TEST:")
print("  'URGENT: My computer crashed and I cannot work at all!'")
print("\nMEDIUM PRIORITY TEST:")
print("  'Having trouble with my email, attachments won\\'t send'")
print("\nLOW PRIORITY TEST:")
print("  'Question about getting a new keyboard when possible, no rush'")
print("\n" + "="*80 + "\n")
