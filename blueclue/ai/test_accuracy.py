"""
BlueClue AI Classification Accuracy Testing Script
Tests the classifier with multiple tickets and calculates accuracy metrics.
"""

import sys
import os
from typing import List, Dict

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from classifier import TicketClassifier


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
            }
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
        """Calculate accuracy metrics from test results."""
        total_tests = len(results)
        category_correct = sum(1 for r in results if r["category_correct"])
        priority_correct = sum(1 for r in results if r["priority_correct"])
        fallback_count = sum(1 for r in results if r["fallback_used"])
        
        avg_confidence = sum(r["confidence"] for r in results) / total_tests
        
        # Calculate per-category accuracy
        category_stats = {}
        for category in ["hardware", "software", "network", "login", "other"]:
            cat_tests = [r for r in results if r["expected_category"] == category]
            if cat_tests:
                cat_correct = sum(1 for r in cat_tests if r["category_correct"])
                category_stats[category] = {
                    "total": len(cat_tests),
                    "correct": cat_correct,
                    "accuracy": (cat_correct / len(cat_tests)) * 100
                }
        
        return {
            "total_tests": total_tests,
            "category_accuracy": (category_correct / total_tests) * 100,
            "priority_accuracy": (priority_correct / total_tests) * 100,
            "overall_accuracy": ((category_correct + priority_correct) / (total_tests * 2)) * 100,
            "average_confidence": avg_confidence,
            "fallback_rate": (fallback_count / total_tests) * 100,
            "category_stats": category_stats
        }
    
    def print_results(self, results: List[Dict], metrics: Dict):
        """Print formatted test results and metrics."""
        print("\n" + "="*80)
        print("BLUECLUE AI CLASSIFICATION ACCURACY TEST RESULTS")
        print("="*80 + "\n")
        
        print(f"Test Date: February 10, 2026")
        print(f"Total Tests: {metrics['total_tests']}\n")
        
        # Overall Metrics
        print("OVERALL METRICS:")
        print("-" * 80)
        print(f"Category Accuracy:    {metrics['category_accuracy']:.1f}%")
        print(f"Priority Accuracy:    {metrics['priority_accuracy']:.1f}%")
        print(f"Overall Accuracy:     {metrics['overall_accuracy']:.1f}%")
        print(f"Average Confidence:   {metrics['average_confidence']:.2f}")
        print(f"Fallback Rate:        {metrics['fallback_rate']:.1f}%")
        print()
        
        # Per-Category Performance
        print("PERFORMANCE BY CATEGORY:")
        print("-" * 80)
        print(f"{'Category':<15} {'Tests':<8} {'Correct':<10} {'Accuracy':<10}")
        print("-" * 80)
        for category, stats in metrics['category_stats'].items():
            print(f"{category.capitalize():<15} {stats['total']:<8} {stats['correct']:<10} {stats['accuracy']:.1f}%")
        print()
        
        # Detailed Test Results
        print("DETAILED TEST RESULTS:")
        print("-" * 80)
        for i, result in enumerate(results, 1):
            status = "✓" if (result["category_correct"] and result["priority_correct"]) else "✗"
            print(f"\nTest {i}: {result['test_type']} {status}")
            print(f"  Description: \"{result['description']}\"")
            print(f"  Category:    Expected: {result['expected_category']:<10} Got: {result['predicted_category']:<10} {'✓' if result['category_correct'] else '✗'}")
            print(f"  Priority:    Expected: {result['expected_priority']:<10} Got: {result['predicted_priority']:<10} {'✓' if result['priority_correct'] else '✗'}")
            print(f"  Confidence:  {result['confidence']:.2f}")
            print(f"  Fallback:    {'Yes' if result['fallback_used'] else 'No'}")
            if result['keywords_matched']['category']:
                print(f"  Keywords:    {', '.join(result['keywords_matched']['category'][:3])}")
        
        print("\n" + "="*80)
        print("TEST COMPLETE")
        print("="*80 + "\n")
    
    def export_to_markdown(self, results: List[Dict], metrics: Dict, filename: str = "test_results.md"):
        """Export results to a markdown file."""
        output_path = os.path.join(os.path.dirname(__file__), filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# BlueClue AI Classification Test Results\n\n")
            f.write(f"**Test Date:** February 10, 2026\n")
            f.write(f"**Total Tests:** {metrics['total_tests']}\n\n")
            
            f.write("## Overall Metrics\n\n")
            f.write(f"- **Category Accuracy:** {metrics['category_accuracy']:.1f}%\n")
            f.write(f"- **Priority Accuracy:** {metrics['priority_accuracy']:.1f}%\n")
            f.write(f"- **Overall Accuracy:** {metrics['overall_accuracy']:.1f}%\n")
            f.write(f"- **Average Confidence:** {metrics['average_confidence']:.2f}\n")
            f.write(f"- **Fallback Rate:** {metrics['fallback_rate']:.1f}%\n\n")
            
            f.write("## Performance by Category\n\n")
            f.write("| Category | Tests | Correct | Accuracy |\n")
            f.write("|----------|-------|---------|----------|\n")
            for category, stats in metrics['category_stats'].items():
                f.write(f"| {category.capitalize()} | {stats['total']} | {stats['correct']} | {stats['accuracy']:.1f}% |\n")
            
            f.write("\n## Detailed Results\n\n")
            for i, result in enumerate(results, 1):
                status = "✅" if (result["category_correct"] and result["priority_correct"]) else "❌"
                f.write(f"### Test {i}: {result['test_type']} {status}\n\n")
                f.write(f"**Description:** \"{result['description']}\"\n\n")
                f.write(f"- **Category:** Expected `{result['expected_category']}`, Got `{result['predicted_category']}` {'✅' if result['category_correct'] else '❌'}\n")
                f.write(f"- **Priority:** Expected `{result['expected_priority']}`, Got `{result['predicted_priority']}` {'✅' if result['priority_correct'] else '❌'}\n")
                f.write(f"- **Confidence:** {result['confidence']:.2f}\n")
                f.write(f"- **Fallback:** {'Yes' if result['fallback_used'] else 'No'}\n")
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
