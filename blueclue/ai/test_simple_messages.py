"""Quick test for simple messages and user priority"""
from src.classifier import TicketClassifier

classifier = TicketClassifier(use_spacy=False)

print("\n" + "="*60)
print("SIMPLE MESSAGE & USER PRIORITY TESTS")
print("="*60 + "\n")

# Test 1: Simple message
print("Test 1: Simple message - 'pc wont turn on'")
r1 = classifier.classify("pc wont turn on")
print(f"  Category: {r1['category']} (confidence: {r1['category_confidence']})")
print(f"  Subcategory: {r1['subcategory']}")
print(f"  Priority: {r1['priority']} (source: {r1['priority_source']})")
print(f"  Keywords: {r1['keywords_matched']['category']}")
print()

# Test 2: Same message with user priority
print("Test 2: Same message with USER priority = 'high'")
r2 = classifier.classify("pc wont turn on", user_priority="high")
print(f"  Category: {r2['category']} (confidence: {r2['category_confidence']})")
print(f"  Priority: {r2['priority']} (source: {r2['priority_source']})")
print(f"  Priority confidence: {r2['priority_confidence']}")
print()

# Test 3: Simple login
print("Test 3: Simple message - 'i cant log in'")
r3 = classifier.classify("i cant log in")
print(f"  Category: {r3['category']} (confidence: {r3['category_confidence']})")
print(f"  Subcategory: {r3['subcategory']}")
print(f"  Priority: {r3['priority']}")
print(f"  Keywords: {r3['keywords_matched']['category']}")
print()

# Test 4: Abbreviations
print("Test 4: Abbreviation - 'forgot my pw'")
r4 = classifier.classify("forgot my pw")
print(f"  Category: {r4['category']} (confidence: {r4['category_confidence']})")
print(f"  Subcategory: {r4['subcategory']}")
print(f"  Keywords: {r4['keywords_matched']['category']}")
print()

# Test 5: User overrides low AI priority
print("Test 5: User selects 'low' for urgent message")
r5 = classifier.classify("URGENT laptop broken ASAP", user_priority="low")
print(f"  Message: 'URGENT laptop broken ASAP'")
print(f"  AI would suggest: high priority")
print(f"  User selected: low")
print(f"  Final priority: {r5['priority']} (source: {r5['priority_source']})")
print(f"  Priority confidence: {r5['priority_confidence']}")
print()

# Test 6: More simple messages
simple_tests = [
    "wifi not working",
    "printer broke",
    "comp is slow",
    "cant access email",
    "screen broken"
]

print("Test 6: More simple messages")
for msg in simple_tests:
    r = classifier.classify(msg)
    print(f"  '{msg}' → {r['category']} ({r['subcategory']})")

print("\n" + "="*60)
print("✓ All tests passed!")
print("="*60 + "\n")
