"""Quick smoke test for the retrained MLCategoryClassifier."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.ml_classifier import MLCategoryClassifier

clf = MLCategoryClassifier()

tests = [
    ("network",         "Cannot connect to WiFi, getting no network error"),
    ("hardware",        "My laptop screen is cracked after I dropped it"),
    ("feature_request", "I need a new feature for batch delete in dashboard"),
    ("billing",         "I was charged twice on my invoice this month"),
    ("login",           "Account locked after too many login attempts"),
    ("software",        "Visual Studio crashes every time I open a project"),
    ("account",         "Need to update my email address, I got married"),
    ("other",           "Where can I find the IT onboarding training materials?"),
]

print(f"{'Predicted':20s}  {'Expected':20s}  Conf   Text")
print("-" * 90)
correct = 0
for expected, text in tests:
    r = clf.predict(text)
    match = "OK" if r["category"] == expected else "FAIL"
    if match == "OK":
        correct += 1
    print(f"{r['category']:20s}  {expected:20s}  {r['confidence']:.2f}  [{match}]  {text[:45]}")

print(f"\n{correct}/{len(tests)} correct ({correct/len(tests)*100:.0f}%)")
