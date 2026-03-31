#!/usr/bin/env python
"""
Training Data Audit Script
==========================

Documents current training set size, class distribution, and identifies
underrepresented categories and priority classes.

Generates a machine-readable audit report written to:
    data/reports/data_audit_<timestamp>.json

Usage:
    python scripts/audit_training_data.py
    python scripts/audit_training_data.py --min-category 200 --min-priority 150
"""

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

SPLITS_DIR  = BASE_DIR / "data" / "splits"
RAW_DIR     = BASE_DIR / "data" / "raw"
REPORTS_DIR = BASE_DIR / "data" / "reports"

# Default minimum sample thresholds per class in the *training* split
DEFAULT_MIN_CATEGORY = 200
DEFAULT_MIN_PRIORITY = 150


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def count_distribution(tickets: list, field: str) -> dict:
    return dict(Counter(t.get(field, "unknown") for t in tickets))


def sort_desc(d: dict) -> dict:
    return dict(sorted(d.items(), key=lambda x: -x[1]))


def pct(count: int, total: int) -> float:
    return round(count / total * 100, 2) if total else 0.0


def detect_duplicates(tickets: list) -> int:
    """Count near-duplicate tickets by description hash."""
    seen = set()
    dupes = 0
    for t in tickets:
        text = (t.get("subject", "") + " " + t.get("description", "")).strip().lower()
        h = hash(text)
        if h in seen:
            dupes += 1
        else:
            seen.add(h)
    return dupes


def detect_empty_or_short(tickets: list, min_len: int = 10) -> list:
    """Return list of ticket IDs with description shorter than min_len."""
    short = []
    for t in tickets:
        desc = t.get("description", "")
        if len(desc.strip()) < min_len:
            short.append(t.get("id", "?"))
    return short


def check_label_consistency(tickets: list) -> dict:
    """
    Verify that category and priority values are within the expected set.
    Returns a dict of {ticket_id: {field: bad_value}}.
    """
    VALID_CATEGORIES = {
        "general", "technical", "billing", "account", "feature_request",
        "hardware", "software", "network", "login", "other",
    }
    VALID_PRIORITIES = {"low", "medium", "high", "critical"}

    bad = {}
    for t in tickets:
        issues = {}
        cat = (t.get("category") or "").lower()
        pri = (t.get("priority") or "").lower()
        if cat not in VALID_CATEGORIES:
            issues["category"] = cat
        if pri not in VALID_PRIORITIES:
            issues["priority"] = pri
        if issues:
            bad[str(t.get("id", "?"))] = issues
    return bad


# ---------------------------------------------------------------------------
# Main analysis
# ---------------------------------------------------------------------------

def audit(min_category: int = DEFAULT_MIN_CATEGORY,
          min_priority: int = DEFAULT_MIN_PRIORITY) -> dict:
    """Run the full audit and return the report dict."""

    print("=" * 60)
    print("BlueClue Training Data Audit")
    print("=" * 60)
    audit_ts = datetime.utcnow().isoformat() + "Z"

    # ------------------------------------------------------------------
    # 1. Load splits
    # ------------------------------------------------------------------
    train_path = SPLITS_DIR / "train.json"
    val_path   = SPLITS_DIR / "val.json"
    test_path  = SPLITS_DIR / "test.json"
    meta_path  = SPLITS_DIR / "split_metadata.json"

    if not train_path.exists():
        print("  ERROR: splits/train.json not found. Run prepare_ml_data.py first.")
        sys.exit(1)

    train = load_json(train_path)
    val   = load_json(val_path)   if val_path.exists()  else []
    test  = load_json(test_path)  if test_path.exists() else []
    meta  = load_json(meta_path)  if meta_path.exists() else {}

    total = len(train) + len(val) + len(test)
    print(f"\n  Dataset totals:  train={len(train)}  val={len(val)}  test={len(test)}  total={total}")

    # ------------------------------------------------------------------
    # 2. Category distribution
    # ------------------------------------------------------------------
    cat_train = sort_desc(count_distribution(train, "category"))
    cat_val   = sort_desc(count_distribution(val,   "category"))
    cat_test  = sort_desc(count_distribution(test,  "category"))

    print("\n  Category distribution (train split):")
    underrep_categories = []
    for cat, count in sorted(cat_train.items(), key=lambda x: x[1]):
        marker = "  ⚠ UNDERREPRESENTED" if count < min_category else ""
        print(f"    {cat:<22} {count:>5}  ({pct(count, len(train)):.1f}%){marker}")
        if count < min_category:
            underrep_categories.append({
                "class": cat,
                "count": count,
                "gap": min_category - count,
                "pct_of_train": pct(count, len(train)),
            })

    # ------------------------------------------------------------------
    # 3. Priority distribution
    # ------------------------------------------------------------------
    pri_train = sort_desc(count_distribution(train, "priority"))
    pri_val   = sort_desc(count_distribution(val,   "priority"))
    pri_test  = sort_desc(count_distribution(test,  "priority"))

    print("\n  Priority distribution (train split):")
    underrep_priorities = []
    for pri, count in sorted(pri_train.items(), key=lambda x: x[1]):
        marker = "  ⚠ UNDERREPRESENTED" if count < min_priority else ""
        print(f"    {pri:<12} {count:>5}  ({pct(count, len(train)):.1f}%){marker}")
        if count < min_priority:
            underrep_priorities.append({
                "class": pri,
                "count": count,
                "gap": min_priority - count,
                "pct_of_train": pct(count, len(train)),
            })

    # ------------------------------------------------------------------
    # 4. Data quality checks
    # ------------------------------------------------------------------
    all_tickets = train + val + test

    dupe_count   = detect_duplicates(all_tickets)
    short_ids    = detect_empty_or_short(all_tickets)
    label_issues = check_label_consistency(all_tickets)

    print(f"\n  Data quality:")
    print(f"    Near-duplicate descriptions detected : {dupe_count}")
    print(f"    Tickets with too-short descriptions  : {len(short_ids)}")
    print(f"    Tickets with invalid labels          : {len(label_issues)}")

    # ------------------------------------------------------------------
    # 5. Imbalance ratio
    # ------------------------------------------------------------------
    cat_counts = list(cat_train.values())
    pri_counts = list(pri_train.values())
    cat_imbalance = round(max(cat_counts) / min(cat_counts), 2) if cat_counts else 0
    pri_imbalance = round(max(pri_counts) / min(pri_counts), 2) if pri_counts else 0

    print(f"\n  Imbalance ratios:")
    print(f"    Category  max/min = {cat_imbalance}x (ideal < 3x)")
    print(f"    Priority  max/min = {pri_imbalance}x (ideal < 4x)")

    # ------------------------------------------------------------------
    # 6. Build report
    # ------------------------------------------------------------------
    report = {
        "audit_timestamp": audit_ts,
        "thresholds": {
            "min_category_samples":  min_category,
            "min_priority_samples":  min_priority,
        },
        "dataset_sizes": {
            "train": len(train),
            "val":   len(val),
            "test":  len(test),
            "total": total,
        },
        "category_distribution": {
            "train": cat_train,
            "val":   cat_val,
            "test":  cat_test,
        },
        "priority_distribution": {
            "train": pri_train,
            "val":   pri_val,
            "test":  pri_test,
        },
        "underrepresented_categories": underrep_categories,
        "underrepresented_priorities":  underrep_priorities,
        "imbalance_ratios": {
            "category_max_min": cat_imbalance,
            "priority_max_min": pri_imbalance,
        },
        "data_quality": {
            "near_duplicates_detected":   dupe_count,
            "short_description_count":    len(short_ids),
            "short_description_ids":      short_ids[:50],   # cap for readability
            "invalid_label_count":        len(label_issues),
            "invalid_label_samples":      dict(list(label_issues.items())[:20]),
        },
        "recommendations": [],
    }

    # Auto-generate recommendations
    if underrep_categories:
        cats = [r["class"] for r in underrep_categories]
        report["recommendations"].append(
            f"Augment categories {cats} to reach {min_category} training samples each "
            f"using SyntheticDataGenerator with targeted category overrides."
        )
    if underrep_priorities:
        pris = [r["class"] for r in underrep_priorities]
        report["recommendations"].append(
            f"Augment priority classes {pris} to reach {min_priority} training samples each."
        )
    if cat_imbalance > 3:
        report["recommendations"].append(
            f"Category imbalance ratio {cat_imbalance}x exceeds 3x — consider additional augmentation "
            "or class_weight='balanced' in the ML trainer."
        )
    if pri_imbalance > 4:
        report["recommendations"].append(
            f"Priority imbalance ratio {pri_imbalance}x exceeds 4x — enable class_weight='balanced' in the "
            "priority model to improve recall on minority classes."
        )
    if label_issues:
        report["recommendations"].append(
            f"{len(label_issues)} tickets have invalid category or priority labels — fix or remove them "
            "before the next training run."
        )

    # ------------------------------------------------------------------
    # 7. Save report
    # ------------------------------------------------------------------
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ts_tag = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_path = REPORTS_DIR / f"data_audit_{ts_tag}.json"
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    # Also write a stable "latest" copy
    latest_path = REPORTS_DIR / "data_audit_latest.json"
    with open(latest_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    print(f"\n  ✓ Audit report saved → {out_path.relative_to(BASE_DIR)}")
    print(f"  ✓ Latest copy       → {latest_path.relative_to(BASE_DIR)}")

    if report["recommendations"]:
        print("\n  Recommendations:")
        for rec in report["recommendations"]:
            print(f"    • {rec}")

    print()
    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit BlueClue training data distribution and quality.")
    parser.add_argument("--min-category", type=int, default=DEFAULT_MIN_CATEGORY,
                        help=f"Minimum training samples per category class (default: {DEFAULT_MIN_CATEGORY})")
    parser.add_argument("--min-priority", type=int, default=DEFAULT_MIN_PRIORITY,
                        help=f"Minimum training samples per priority class (default: {DEFAULT_MIN_PRIORITY})")
    args = parser.parse_args()
    audit(min_category=args.min_category, min_priority=args.min_priority)
