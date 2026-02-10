"""
BlueClue AI Classification Accuracy Testing Script
Tests the classifier with multiple tickets and calculates accuracy metrics.
"""

import sys
import os
from typing import List, Dict

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.classifier import TicketClassifier


class AccuracyTester:
    """Test and evaluate the ticket classifier accuracy."""
    
    def __init__(self):
        # Initialize classifier without spacy to avoid compatibility issues
        self.classifier = TicketClassifier(use_spacy=False)
        self.test_cases = self._define_test_cases()
        
    def _define_test_cases(self) -> List[Dict]:
        """Define comprehensive test cases with expected outputs."""
        return [
            # Hardware tickets
            {
                "description": "My laptop screen is broken and I need help urgently",
                "expected_category": "hardware",
                "expected_priority": "high",
                "test_type": "Hardware - Broken Screen (Urgent)"
            },
            {
                "description": "The printer is not working properly",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Hardware - Printer Issue"
            },
            {
                "description": "My keyboard keys are stuck",
                "expected_category": "hardware",
                "expected_priority": "low",
                "test_type": "Hardware - Keyboard"
            },
            {
                "description": "Monitor display is flickering badly",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Hardware - Monitor"
            },
            
            # Software tickets
            {
                "description": "Need Microsoft Office installed when you get a chance",
                "expected_category": "software",
                "expected_priority": "low",
                "test_type": "Software - Office Install"
            },
            {
                "description": "Can't open Excel files, need help",
                "expected_category": "software",
                "expected_priority": "medium",
                "test_type": "Software - Excel Issue"
            },
            {
                "description": "Application keeps crashing immediately",
                "expected_category": "software",
                "expected_priority": "high",
                "test_type": "Software - App Crash"
            },
            
            # Network tickets
            {
                "description": "The wifi keeps disconnecting",
                "expected_category": "network",
                "expected_priority": "medium",
                "test_type": "Network - WiFi Disconnect"
            },
            {
                "description": "Internet connection is very slow",
                "expected_category": "network",
                "expected_priority": "low",
                "test_type": "Network - Slow Internet"
            },
            {
                "description": "Can't connect to VPN urgently",
                "expected_category": "network",
                "expected_priority": "high",
                "test_type": "Network - VPN Emergency"
            },
            
            # Login tickets
            {
                "description": "I can't login to my email account",
                "expected_category": "login",
                "expected_priority": "medium",
                "test_type": "Login - Email Access"
            },
            {
                "description": "Forgot my password, need to reset",
                "expected_category": "login",
                "expected_priority": "medium",
                "test_type": "Login - Password Reset"
            },
            {
                "description": "Account is locked out, can't access anything",
                "expected_category": "login",
                "expected_priority": "high",
                "test_type": "Login - Locked Account"
            },
            
            # Other tickets
            {
                "description": "General question about company policies",
                "expected_category": "other",
                "expected_priority": "low",
                "test_type": "Other - Policy Question"
            },
            {
                "description": "Just wondering about something",
                "expected_category": "other",
                "expected_priority": "low",
                "test_type": "Other - General Inquiry"
            },
            
            # ===== EXPANDED TEST CASES FOR IMPROVED ACCURACY =====
            
            # Hardware - Additional edge cases
            {
                "description": "My docking station won't connect to dual monitors",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Hardware - Docking Station Complex"
            },
            {
                "description": "Water damage to laptop URGENT need replacement",
                "expected_category": "hardware",
                "expected_priority": "high",
                "test_type": "Hardware - Water Damage Critical"
            },
            {
                "description": "USB ports not working on workstation",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Hardware - USB Port Issue"
            },
            {
                "description": "Printer has paper jam and won't print",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Hardware - Paper Jam"
            },
            {
                "description": "Battery not charging, power adapter might be defective",
                "expected_category": "hardware",
                "expected_priority": "high",
                "test_type": "Hardware - Power Issue"
            },
            {
                "description": "Mouse keeps disconnecting from wireless receiver",
                "expected_category": "hardware",
                "expected_priority": "low",
                "test_type": "Hardware - Wireless Mouse"
            },
            
            # Software - Additional test cases
            {
                "description": "Excel keeps crashing when opening large files",
                "expected_category": "software",
                "expected_priority": "high",
                "test_type": "Software - Excel Crashing"
            },
            {
                "description": "Need Adobe Acrobat installed when you get a chance",
                "expected_category": "software",
                "expected_priority": "low",
                "test_type": "Software - Adobe Installation"
            },
            {
                "description": "Blue screen error code 0x0000007B immediately",
                "expected_category": "software",
                "expected_priority": "high",
                "test_type": "Software - BSOD Critical"
            },
            {
                "description": "Outlook won't open, says not responding",
                "expected_category": "software",
                "expected_priority": "high",
                "test_type": "Software - Outlook Frozen"
            },
            {
                "description": "Browser running slow, need help optimizing Chrome",
                "expected_category": "software",
                "expected_priority": "low",
                "test_type": "Software - Browser Performance"
            },
            {
                "description": "Windows update failed, system won't restart properly",
                "expected_category": "software",
                "expected_priority": "high",
                "test_type": "Software - Update Failure"
            },
            {
                "description": "Teams app freezes during video calls",
                "expected_category": "software",
                "expected_priority": "medium",
                "test_type": "Software - Teams Issue"
            },
            {
                "description": "Antivirus keeps blocking legitimate applications",
                "expected_category": "software",
                "expected_priority": "medium",
                "test_type": "Software - Security Software"
            },
            
            # Network - Additional scenarios
            {
                "description": "VPN connection keeps dropping ASAP need fix",
                "expected_category": "network",
                "expected_priority": "high",
                "test_type": "Network - VPN Unstable Critical"
            },
            {
                "description": "Can't find wifi network at all",
                "expected_category": "network",
                "expected_priority": "medium",
                "test_type": "Network - WiFi Not Visible"
            },
            {
                "description": "Ethernet cable connection no internet access",
                "expected_category": "network",
                "expected_priority": "medium",
                "test_type": "Network - Ethernet Issue"
            },
            {
                "description": "Internet is buffering constantly, very slow bandwidth",
                "expected_category": "network",
                "expected_priority": "low",
                "test_type": "Network - Bandwidth/Buffering"
            },
            {
                "description": "Remote access not working, can't connect to office network",
                "expected_category": "network",
                "expected_priority": "high",
                "test_type": "Network - Remote Access Down"
            },
            {
                "description": "DNS issues, websites won't load properly",
                "expected_category": "network",
                "expected_priority": "medium",
                "test_type": "Network - DNS Problem"
            },
            
            # Login - Additional authentication scenarios
            {
                "description": "Can't login to email account, password expired",
                "expected_category": "login",
                "expected_priority": "high",
                "test_type": "Login - Expired Password Email"
            },
            {
                "description": "Multi-factor authentication not sending verification code",
                "expected_category": "login",
                "expected_priority": "high",
                "test_type": "Login - MFA Issue"
            },
            {
                "description": "Username and credentials not working for login",
                "expected_category": "login",
                "expected_priority": "medium",
                "test_type": "Login - Credentials Invalid"
            },
            {
                "description": "Account access denied, need permissions updated",
                "expected_category": "login",
                "expected_priority": "medium",
                "test_type": "Login - Access Permissions"
            },
            {
                "description": "Change password request when possible",
                "expected_category": "login",
                "expected_priority": "low",
                "test_type": "Login - Password Change Request"
            },
            
            # Edge Cases - Complex/Multi-category scenarios
            {
                "description": "Laptop won't connect to wifi and battery is dead",
                "expected_category": "hardware",  # Hardware issue takes priority
                "expected_priority": "high",
                "test_type": "Edge - Multi-issue Hardware/Network"
            },
            {
                "description": "Can't install software update because internet keeps disconnecting",
                "expected_category": "network",  # Network blocking software
                "expected_priority": "medium",
                "test_type": "Edge - Network Blocking Software"
            },
            {
                "description": "Login page won't load due to slow internet connection",
                "expected_category": "network",  # Network is root cause
                "expected_priority": "medium",
                "test_type": "Edge - Network Affecting Login"
            },
            {
                "description": "Printer software won't install on new computer",
                "expected_category": "software",  # Software installation issue
                "expected_priority": "medium",
                "test_type": "Edge - Software/Hardware Mix"
            },
            
            # Ambiguous cases - Testing fallback and confidence
            {
                "description": "Something is wrong but I'm not sure what",
                "expected_category": "other",
                "expected_priority": "low",
                "test_type": "Edge - Vague Description"
            },
            {
                "description": "Need help with IT stuff",
                "expected_category": "other",
                "expected_priority": "low",
                "test_type": "Edge - Generic Request"
            },
            
            # Urgency variation tests
            {
                "description": "Screen flickering, need fix when you get a chance",
                "expected_category": "hardware",
                "expected_priority": "low",  # "when you get a chance" lowers priority
                "test_type": "Urgency - Low Priority Modifier"
            },
            {
                "description": "Production server down EMERGENCY critical help needed NOW",
                "expected_category": "hardware",
                "expected_priority": "high",
                "test_type": "Urgency - Multiple High Priority Keywords"
            },
            {
                "description": "Question about printer, no rush",
                "expected_category": "hardware",
                "expected_priority": "low",
                "test_type": "Urgency - Explicit Low Priority"
            },
            
            # ===== SIMPLE/TERSE MESSAGE TESTS =====
            {
                "description": "pc wont turn on",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Simple - PC Won't Turn On"
            },
            {
                "description": "i cant log in",
                "expected_category": "login",
                "expected_priority": "medium",
                "test_type": "Simple - Can't Login"
            },
            {
                "description": "wifi not working",
                "expected_category": "network",
                "expected_priority": "medium",
                "test_type": "Simple - WiFi Not Working"
            },
            {
                "description": "printer broke",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Simple - Printer Broke"
            },
            {
                "description": "forgot my pw",
                "expected_category": "login",
                "expected_priority": "medium",
                "test_type": "Simple - Forgot Password (abbreviation)"
            },
            {
                "description": "comp is slow",
                "expected_category": "hardware",
                "expected_priority": "low",
                "test_type": "Simple - Computer Slow (abbreviation)"
            },
            {
                "description": "cant access email",
                "expected_category": "login",
                "expected_priority": "medium",
                "test_type": "Simple - Can't Access Email"
            },
            {
                "description": "screen broken",
                "expected_category": "hardware",
                "expected_priority": "medium",
                "test_type": "Simple - Screen Broken"
            },
        ]
    
    def run_test(self, test_case: Dict) -> Dict:
        """Run a single test case and return results."""
        description = test_case["description"]
        expected_category = test_case["expected_category"]
        expected_priority = test_case["expected_priority"]
        
        # Get AI classification
        result = self.classifier.classify(description)
        
        # Compare with expected
        category_correct = result["category"] == expected_category
        priority_correct = result["priority"] == expected_priority
        
        return {
            "test_type": test_case["test_type"],
            "description": description,
            "expected_category": expected_category,
            "predicted_category": result["category"],
            "category_correct": category_correct,
            "expected_priority": expected_priority,
            "predicted_priority": result["priority"],
            "priority_correct": priority_correct,
            "confidence": result["confidence"],
            "category_confidence": result.get("category_confidence", 0),
            "priority_confidence": result.get("priority_confidence", 0),
            "subcategory": result.get("subcategory", "general"),
            "is_multi_category": result.get("is_multi_category", False),
            "all_categories": result.get("all_categories", []),
            "fallback_used": result["fallback_used"],
            "keywords_matched": result["keywords_matched"]
        }
    
    def run_all_tests(self) -> List[Dict]:
        """Run all test cases and return results."""
        results = []
        for test_case in self.test_cases:
            result = self.run_test(test_case)
            results.append(result)
        return results
    
    def calculate_metrics(self, results: List[Dict]) -> Dict:
        """Calculate enhanced accuracy metrics from test results."""
        total_tests = len(results)
        category_correct = sum(1 for r in results if r["category_correct"])
        priority_correct = sum(1 for r in results if r["priority_correct"])
        fallback_count = sum(1 for r in results if r["fallback_used"])
        multi_category_count = sum(1 for r in results if r.get("is_multi_category", False))
        
        avg_confidence = sum(r["confidence"] for r in results) / total_tests if total_tests > 0 else 0
        avg_cat_confidence = sum(r.get("category_confidence", 0) for r in results) / total_tests if total_tests > 0 else 0
        avg_pri_confidence = sum(r.get("priority_confidence", 0) for r in results) / total_tests if total_tests > 0 else 0
        
        # Calculate per-category accuracy
        category_stats = {}
        for category in ["hardware", "software", "network", "login", "other"]:
            cat_tests = [r for r in results if r["expected_category"] == category]
            if cat_tests:
                cat_correct = sum(1 for r in cat_tests if r["category_correct"])
                pri_correct = sum(1 for r in cat_tests if r["priority_correct"])
                category_stats[category] = {
                    "total": len(cat_tests),
                    "correct": cat_correct,
                    "accuracy": (cat_correct / len(cat_tests)) * 100,
                    "priority_accuracy": (pri_correct / len(cat_tests)) * 100
                }
        
        # Calculate subcategory distribution
        subcategory_stats = {}
        for result in results:
            subcat = result.get("subcategory", "general")
            if subcat not in subcategory_stats:
                subcategory_stats[subcat] = {"total": 0, "correct": 0}
            subcategory_stats[subcat]["total"] += 1
            if result["category_correct"]:
                subcategory_stats[subcat]["correct"] += 1
        
        return {
            "total_tests": total_tests,
            "category_accuracy": (category_correct / total_tests) * 100 if total_tests > 0 else 0,
            "priority_accuracy": (priority_correct / total_tests) * 100 if total_tests > 0 else 0,
            "overall_accuracy": ((category_correct + priority_correct) / (total_tests * 2)) * 100 if total_tests > 0 else 0,
            "average_confidence": avg_confidence,
            "average_category_confidence": avg_cat_confidence,
            "average_priority_confidence": avg_pri_confidence,
            "fallback_rate": (fallback_count / total_tests) * 100 if total_tests > 0 else 0,
            "multi_category_rate": (multi_category_count / total_tests) * 100 if total_tests > 0 else 0,
            "category_stats": category_stats,
            "subcategory_stats": subcategory_stats
        }
    
    def print_results(self, results: List[Dict], metrics: Dict):
        """Print formatted test results and enhanced metrics."""
        print("\n" + "="*80)
        print("BLUECLUE AI CLASSIFICATION ACCURACY TEST RESULTS (ENHANCED)")
        print("="*80 + "\n")
        
        print(f"Test Date: February 10, 2026")
        print(f"Total Tests: {metrics['total_tests']}\n")
        
        # Overall Metrics
        print("OVERALL METRICS:")
        print("-" * 80)
        print(f"Category Accuracy:           {metrics['category_accuracy']:.1f}%")
        print(f"Priority Accuracy:           {metrics['priority_accuracy']:.1f}%")
        print(f"Overall Accuracy:            {metrics['overall_accuracy']:.1f}%")
        print(f"Average Confidence:          {metrics['average_confidence']:.2f}")
        print(f"Average Category Confidence: {metrics['average_category_confidence']:.2f}")
        print(f"Average Priority Confidence: {metrics['average_priority_confidence']:.2f}")
        print(f"Fallback Rate:               {metrics['fallback_rate']:.1f}%")
        print(f"Multi-Category Detection:    {metrics['multi_category_rate']:.1f}%")
        print()
        
        # Per-Category Performance
        print("PERFORMANCE BY CATEGORY:")
        print("-" * 80)
        for category, stats in metrics['category_stats'].items():
            print(f"{category.upper():<12} | Tests: {stats['total']:3d} | "
                  f"Category Acc: {stats['accuracy']:5.1f}% | "
                  f"Priority Acc: {stats['priority_accuracy']:5.1f}%")
        print()
        
        # Subcategory Performance (if available)
        if metrics.get('subcategory_stats'):
            print("PERFORMANCE BY SUBCATEGORY:")
            print("-" * 80)
            for subcat, stats in sorted(metrics['subcategory_stats'].items(), key=lambda x: x[1]['total'], reverse=True):
                if stats['total'] > 0:
                    accuracy = (stats['correct'] / stats['total']) * 100
                    print(f"{subcat:<20} | Tests: {stats['total']:3d} | Accuracy: {accuracy:5.1f}%")
            print()
        
        # Detailed Test Results
        print("DETAILED TEST RESULTS:")
        print("-" * 80)
        
        # Group by correctness for easier reading
        correct_tests = [r for r in results if r["category_correct"] and r["priority_correct"]]
        incorrect_tests = [r for r in results if not (r["category_correct"] and r["priority_correct"])]
        
        print(f"\n✓ CORRECT PREDICTIONS ({len(correct_tests)}/{len(results)}):")
        print("-" * 80)
        for result in correct_tests[:5]:  # Show first 5
            print(f"  {result['test_type']}")
            print(f"    \"{result['description'][:60]}...\"" if len(result['description']) > 60 else f"    \"{result['description']}\"")
            print(f"    Category: {result['predicted_category']} | Priority: {result['predicted_priority']} | "
                  f"Confidence: {result['confidence']:.2f} | Subcategory: {result.get('subcategory', 'N/A')}")
        
        if len(correct_tests) > 5:
            print(f"  ... and {len(correct_tests) - 5} more correct predictions")
        
        if incorrect_tests:
            print(f"\n✗ INCORRECT PREDICTIONS ({len(incorrect_tests)}/{len(results)}):")
            print("-" * 80)
            for result in incorrect_tests:
                cat_status = "✓" if result["category_correct"] else "✗"
                pri_status = "✓" if result["priority_correct"] else "✗"
                print(f"  {result['test_type']}")
                print(f"    \"{result['description'][:70]}...\"" if len(result['description']) > 70 else f"    \"{result['description']}\"")
                print(f"    Category {cat_status}: Expected: {result['expected_category']:<10} Got: {result['predicted_category']:<10}")
                print(f"    Priority {pri_status}: Expected: {result['expected_priority']:<10} Got: {result['predicted_priority']:<10}")
                print(f"    Confidence: {result['confidence']:.2f} | Subcategory: {result.get('subcategory', 'N/A')}")
                if result.get('is_multi_category'):
                    print(f"    Multi-category detected: {[c['category'] for c in result.get('all_categories', [])[:3]]}")
                print()
        
        print("\n" + "="*80)
        print("TEST COMPLETE")
        print("="*80 + "\n")
    
    def export_to_markdown(self, results: List[Dict], metrics: Dict, filename: str = "test_results.md"):
        """Export enhanced results to a markdown file."""
        output_path = os.path.join(os.path.dirname(__file__), filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# BlueClue AI Classification Test Results (Enhanced)\n\n")
            f.write(f"**Test Date:** February 10, 2026\n")
            f.write(f"**Total Tests:** {metrics['total_tests']}\n\n")
            
            f.write("## Overall Metrics\n\n")
            f.write(f"- **Category Accuracy:** {metrics['category_accuracy']:.1f}%\n")
            f.write(f"- **Priority Accuracy:** {metrics['priority_accuracy']:.1f}%\n")
            f.write(f"- **Overall Accuracy:** {metrics['overall_accuracy']:.1f}%\n")
            f.write(f"- **Average Confidence:** {metrics['average_confidence']:.2f}\n")
            f.write(f"- **Average Category Confidence:** {metrics['average_category_confidence']:.2f}\n")
            f.write(f"- **Average Priority Confidence:** {metrics['average_priority_confidence']:.2f}\n")
            f.write(f"- **Fallback Rate:** {metrics['fallback_rate']:.1f}%\n")
            f.write(f"- **Multi-Category Detection Rate:** {metrics['multi_category_rate']:.1f}%\n\n")
            
            f.write("## Performance by Category\n\n")
            f.write("| Category | Tests | Correct | Category Accuracy | Priority Accuracy |\n")
            f.write("|----------|-------|---------|-------------------|-------------------|\n")
            for category, stats in metrics['category_stats'].items():
                f.write(f"| {category.capitalize()} | {stats['total']} | {stats['correct']} | "
                       f"{stats['accuracy']:.1f}% | {stats['priority_accuracy']:.1f}% |\n")
            
            # Subcategory stats
            if metrics.get('subcategory_stats'):
                f.write("\n## Performance by Subcategory\n\n")
                f.write("| Subcategory | Tests | Correct | Accuracy |\n")
                f.write("|-------------|-------|---------|----------|\n")
                for subcat, stats in sorted(metrics['subcategory_stats'].items(), key=lambda x: x[1]['total'], reverse=True):
                    if stats['total'] > 0:
                        accuracy = (stats['correct'] / stats['total']) * 100
                        f.write(f"| {subcat} | {stats['total']} | {stats['correct']} | {accuracy:.1f}% |\n")
            
            # Incorrect predictions
            incorrect_tests = [r for r in results if not (r["category_correct"] and r["priority_correct"])]
            
            f.write(f"\n## Failed Tests ({len(incorrect_tests)} failures)\n\n")
            for result in incorrect_tests:
                cat_status = "✅" if result["category_correct"] else "❌"
                pri_status = "✅" if result["priority_correct"] else "❌"
                f.write(f"### {result['test_type']}\n\n")
                f.write(f"**Description:** \"{result['description']}\"\n\n")
                f.write(f"- **Category {cat_status}:** Expected `{result['expected_category']}`, Got `{result['predicted_category']}`\n")
                f.write(f"- **Priority {pri_status}:** Expected `{result['expected_priority']}`, Got `{result['predicted_priority']}`\n")
                f.write(f"- **Confidence:** {result['confidence']:.2f}\n")
                f.write(f"- **Subcategory:** {result.get('subcategory', 'N/A')}\n")
                if result.get('is_multi_category'):
                    categories = [c['category'] for c in result.get('all_categories', [])[:3]]
                    f.write(f"- **Multi-category detected:** {', '.join(categories)}\n")
                if result['keywords_matched']['category']:
                    f.write(f"- **Keywords Matched:** {', '.join(result['keywords_matched']['category'])}\n")
                f.write("\n")
        
        print(f"\nResults exported to: {output_path}")


def main():
    """Main test execution function."""
    print("\nInitializing BlueClue AI Classifier Tests...")
    
    tester = AccuracyTester()
    
    print(f"Running {len(tester.test_cases)} test cases...\n")
    
    # Run all tests
    results = tester.run_all_tests()
    
    # Calculate metrics
    metrics = tester.calculate_metrics(results)
    
    # Print results
    tester.print_results(results, metrics)
    
    # Export to markdown
    tester.export_to_markdown(results, metrics)
    
    # Return exit code based on overall accuracy
    if metrics['overall_accuracy'] >= 70:
        print("✓ SUCCESS: Overall accuracy meets the 70% threshold!")
        return 0
    else:
        print(f"✗ WARNING: Overall accuracy ({metrics['overall_accuracy']:.1f}%) is below 70% threshold")
        return 1


if __name__ == "__main__":
    sys.exit(main())
