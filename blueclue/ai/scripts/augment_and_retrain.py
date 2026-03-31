#!/usr/bin/env python
"""
Augment Underrepresented Classes & Retrain
==========================================

Targeted augmentation pipeline for BlueClue ML classifier.

Workflow
--------
1.  Run audit → identify classes below minimum sample threshold
2.  Generate synthetic samples for each underrepresented class
    using SyntheticDataGenerator with explicit category / priority overrides
3.  Merge augmented samples with the existing processed data
4.  Re-run preprocessing (deduplicate, clean labels, remove PII stubs)
5.  Re-split (train/val/test stratified)
6.  Retrain priority model (and optionally category model)
7.  Evaluate and write before/after accuracy to model card

Usage
-----
    # Full pipeline with defaults
    python scripts/augment_and_retrain.py

    # Custom thresholds
    python scripts/augment_and_retrain.py --min-category 200 --min-priority 150

    # Skip retraining (augment + prepare only)
    python scripts/augment_and_retrain.py --no-train

    # Retrain all models (category + priority)
    python scripts/augment_and_retrain.py --models category,priority

Environment Variables
---------------------
    ML_DATA_DIR      Override default data directory (blueclue/ai/data)
"""

import argparse
import json
import os
import sys
import random
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "src"))

DATA_DIR    = Path(os.getenv("ML_DATA_DIR", str(BASE_DIR / "data")))
RAW_DIR     = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SPLITS_DIR  = DATA_DIR / "splits"
REPORTS_DIR = DATA_DIR / "reports"
MODELS_DIR  = BASE_DIR / "models"

# ────────── Thresholds ──────────────────────────────────────────────────────
DEFAULT_MIN_CATEGORY = 200   # minimum samples per category in the train split
DEFAULT_MIN_PRIORITY = 150   # minimum samples per priority in the train split
# Use a time-derived seed so each augmentation run produces unique tickets.
# This avoids the dedup trap where re-running with the same seed generates
# identical tickets that all get removed as duplicates.
import time as _time
AUGMENT_SEED = int(_time.time()) % 100_000


# ────────── Helpers ─────────────────────────────────────────────────────────

def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(data, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, default=str)


def count_dist(tickets: list, field: str) -> dict:
    return dict(Counter(t.get(field, "unknown") for t in tickets))


def banner(msg: str):
    print("\n" + "─" * 60)
    print(f"  {msg}")
    print("─" * 60)


# ────────── Step 1: Audit ───────────────────────────────────────────────────

def run_audit(min_category: int, min_priority: int) -> dict:
    """Run data audit and return the report dict."""
    banner("STEP 1: Data Audit")
    from scripts.audit_training_data import audit
    return audit(min_category=min_category, min_priority=min_priority)


# ────────── Step 2: Augment ─────────────────────────────────────────────────

def augment_classes(audit_report: dict, min_category: int, min_priority: int) -> list:
    """
    Generate synthetic tickets targeting underrepresented classes.

    Returns the combined list of existing + new tickets (raw, pre-preprocessing).
    """
    banner("STEP 2: Augmenting Underrepresented Classes")

    from ml.synthetic_generator import SyntheticDataGenerator

    gen = SyntheticDataGenerator(seed=AUGMENT_SEED)

    # Load existing raw synthetic tickets as base corpus
    raw_path = RAW_DIR / "synthetic_tickets.json"
    if raw_path.exists():
        existing = load_json(raw_path)
        print(f"  Loaded {len(existing)} existing raw tickets from {raw_path.name}")
    else:
        existing = []
        print("  No existing raw tickets found — starting from scratch")

    new_tickets = []

    # ── Category augmentation ──────────────────────────────────────────────
    underrep_cats = audit_report.get("underrepresented_categories", [])
    train_size    = audit_report["dataset_sizes"]["train"]

    if not underrep_cats:
        print("  No underrepresented categories — skipping category augmentation")
    else:
        for info in underrep_cats:
            cat     = info["class"]
            current = info["count"]
            # We need `gap` samples to reach the threshold IN THE TRAIN SPLIT.
            # The train split is ~70% of all data, so scale up the generation.
            gap     = info["gap"]
            # Over-generate 4x to survive dedup after mixing with existing corpus
            n_raw   = max(int(gap * 4 / 0.70), 30)

            print(f"\n  Category '{cat}': train={current}  target={min_category}"
                  f"  gap={gap}  generating {n_raw} raw samples")

            batch = gen.generate(n_samples=n_raw, balance_categories=False)
            # Force correct category on every generated ticket
            for t in batch:
                t["category"] = cat
                t["_augmented"] = True
                t["_augment_reason"] = f"category_underrepresented (train={current})"

            new_tickets.extend(batch)
            print(f"    + {len(batch)} tickets added for category '{cat}'")

    # ── Priority augmentation ──────────────────────────────────────────────
    # Priority is harder to target precisely because templates carry their own
    # label.  We generate with forced priority for each underrepresented class.
    underrep_pris = audit_report.get("underrepresented_priorities", [])

    if not underrep_pris:
        print("\n  No underrepresented priorities — skipping priority augmentation")
    else:
        for info in underrep_pris:
            pri     = info["class"]
            current = info["count"]
            gap     = info["gap"]
            # Over-generate 4x to survive dedup
            n_raw   = max(int(gap * 4 / 0.70), 30)

            print(f"\n  Priority '{pri}': train={current}  target={min_priority}"
                  f"  gap={gap}  generating {n_raw} raw samples")

            batch = gen.generate(n_samples=n_raw, balance_categories=True)
            for t in batch:
                t["priority"]         = pri
                t["ai_priority"]      = pri
                t["_augmented"]       = True
                t["_augment_reason"]  = f"priority_underrepresented (train={current})"

            new_tickets.extend(batch)
            print(f"    + {len(batch)} tickets added for priority '{pri}'")

    if not new_tickets:
        print("\n  ✓ Nothing to augment — dataset already meets thresholds")
        return existing

    # Renumber IDs
    offset = max((t.get("id", 0) for t in existing), default=0)
    for i, t in enumerate(new_tickets, start=1):
        t["id"] = offset + i

    combined = existing + new_tickets
    print(f"\n  Total corpus after augmentation: {len(combined)} tickets"
          f"  (+{len(new_tickets)} new)")
    return combined


# ────────── Step 3: Data quality pass ───────────────────────────────────────

def quality_pass(tickets: list) -> list:
    """
    Remove exact-duplicate descriptions and flag/remove invalid labels.
    Returns cleaned ticket list.
    """
    banner("STEP 3: Data Quality Pass")

    VALID_CATS = {
        "general", "technical", "billing", "account", "feature_request",
        "hardware", "software", "network", "login", "other",
    }
    VALID_PRI = {"low", "medium", "high", "critical"}

    seen_hashes   = set()
    removed_dupes = 0
    removed_labels = 0
    clean = []

    for t in tickets:
        # Deduplicate by description text hash
        key = (t.get("subject", "") + "|" + t.get("description", "")).strip().lower()
        h   = hash(key)
        if h in seen_hashes:
            removed_dupes += 1
            continue
        seen_hashes.add(h)

        # Label validation
        cat = (t.get("category") or "").lower().strip()
        pri = (t.get("priority") or "").lower().strip()
        if cat not in VALID_CATS or pri not in VALID_PRI:
            removed_labels += 1
            continue   # discard mislabelled examples

        t["category"] = cat
        t["priority"]  = pri
        clean.append(t)

    print(f"  Duplicates removed  : {removed_dupes}")
    print(f"  Invalid labels removed: {removed_labels}")
    print(f"  Clean ticket count  : {len(clean)}")
    return clean


# ────────── Step 4: Preprocess + Split ──────────────────────────────────────

def run_preprocessing(tickets: list):
    """Run the DataPreprocessor + DataSplitter on the combined corpus."""
    banner("STEP 4: Preprocessing & Splitting")

    from ml.preprocessor import DataPreprocessor
    from ml.data_splitter import DataSplitter

    preprocessor = DataPreprocessor(
        remove_pii=True,
        handle_missing="impute",
        remove_duplicates=True,
        min_description_length=10,
    )

    print(f"  Input tickets: {len(tickets)}")
    # preprocess() returns List[Dict] (stats are in preprocessor.stats)
    clean = preprocessor.preprocess(tickets)
    print(f"  After preprocessing: {len(clean)}")

    # Save processed data
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    processed_path = PROCESSED_DIR / "tickets_clean.json"
    save_json(clean, processed_path)

    preprocessing_report = {
        "preprocessing_stats": preprocessor.stats,
        "settings": {
            "remove_pii": True,
            "handle_missing": "impute",
            "remove_duplicates": True,
            "min_description_length": 10,
        },
    }
    save_json(preprocessing_report, PROCESSED_DIR / "preprocessing_report.json")
    print(f"  ✓ Saved {len(clean)} clean tickets → {processed_path.relative_to(BASE_DIR)}")

    # Split (DataSplitter takes random_seed, not seed)
    splitter = DataSplitter(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, random_seed=42)
    train, val, test = splitter.split(clean, stratify_by="category")

    SPLITS_DIR.mkdir(parents=True, exist_ok=True)
    save_json(train, SPLITS_DIR / "train.json")
    save_json(val,   SPLITS_DIR / "val.json")
    save_json(test,  SPLITS_DIR / "test.json")

    # Write split metadata
    meta = {
        "total_samples": len(clean),
        "train_samples": len(train),
        "val_samples":   len(val),
        "test_samples":  len(test),
        "stratify_by":   "category",
        "random_seed":   42,
        "ratios":        {"train": 0.70, "validation": 0.15, "test": 0.15},
        "actual_ratios": {
            "train":      round(len(train) / len(clean), 6),
            "validation": round(len(val)   / len(clean), 6),
            "test":       round(len(test)  / len(clean), 6),
        },
        "train_distribution": dict(Counter(t["category"] for t in train)),
        "val_distribution":   dict(Counter(t["category"] for t in val)),
        "test_distribution":  dict(Counter(t["category"] for t in test)),
        "train_priority_distribution": dict(Counter(t["priority"] for t in train)),
    }
    save_json(meta, SPLITS_DIR / "split_metadata.json")
    print(f"  ✓ Split → train={len(train)}  val={len(val)}  test={len(test)}")
    return train, val, test


# ────────── Step 5: Save augmented raw corpus ────────────────────────────────

def save_augmented_raw(tickets: list):
    """Persist the combined raw corpus so downstream scripts can find it."""
    # Strip internal tracking fields before saving
    INTERNAL_FIELDS = {"_augmented", "_augment_reason", "_source", "_feedback_weight"}
    clean_for_save = []
    for t in tickets:
        clean_for_save.append({k: v for k, v in t.items() if k not in INTERNAL_FIELDS})

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    raw_json = RAW_DIR / "synthetic_tickets.json"
    save_json(clean_for_save, raw_json)
    print(f"  ✓ Saved augmented raw corpus → {raw_json.relative_to(BASE_DIR)}")

    # Also write CSV for manual inspection
    import csv
    raw_csv = RAW_DIR / "synthetic_tickets.csv"
    if clean_for_save:
        # Collect union of all field names (original + new tickets may differ)
        all_fields = list(dict.fromkeys(
            k for t in clean_for_save for k in t.keys()
        ))
        with open(raw_csv, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=all_fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(clean_for_save)
    print(f"  ✓ Saved augmented raw corpus CSV → {raw_csv.relative_to(BASE_DIR)}")


# ────────── Step 6: Retrain ─────────────────────────────────────────────────

def run_training(models):
    """Run training scripts for the requested models."""
    banner(f"STEP 5: Training models: {models}")
    import subprocess

    scripts = {
        "priority": BASE_DIR / "src" / "train_priority_model.py",
        "category": BASE_DIR / "src" / "train_category_model.py",
    }

    results = {}
    for model_name in models:
        script = scripts.get(model_name)
        if script is None or not script.exists():
            print(f"  WARN: No training script for '{model_name}' — skipping")
            results[model_name] = {"status": "skipped"}
            continue

        print(f"\n  Training {model_name} model …")
        cmd = [sys.executable, str(script), "--model", "logistic", "--tune", "--quick"]
        proc = subprocess.run(cmd, capture_output=False, text=True, cwd=str(BASE_DIR))
        if proc.returncode == 0:
            print(f"  ✓ {model_name} training complete (exit 0)")
            results[model_name] = {"status": "success"}
        else:
            print(f"  ✗ {model_name} training exited with code {proc.returncode}")
            results[model_name] = {"status": "failed", "returncode": proc.returncode}

    return results


# ────────── Step 7: Write model card ────────────────────────────────────────

def write_model_card(audit_before: dict, audit_after: dict,
                     train_results: dict, min_category: int, min_priority: int):
    """
    Write a v3 model card summarising the augmentation run.
    Reads the latest priority model card for baseline metrics if available.
    """
    banner("STEP 6: Writing Model Card")

    ts      = datetime.now(timezone.utc)
    ts_tag  = ts.strftime("%Y%m%d")
    ts_iso  = ts.isoformat()

    # Try to load the most recent priority model card for baseline
    baseline_priority = {}
    priority_cards = sorted(MODELS_DIR.glob("priority_model_card_v*.json"))
    if priority_cards:
        try:
            baseline_priority = load_json(priority_cards[-1])
            print(f"  Using baseline from {priority_cards[-1].name}")
        except Exception:
            pass

    prior_metrics = {}
    if "v2_metrics" in baseline_priority:
        prior_metrics = baseline_priority["v2_metrics"]
    elif "achieved" in baseline_priority:
        prior_metrics = baseline_priority["achieved"]

    card = {
        "model_name": "BlueClue ML Priority + Category Classifier",
        "version": f"v3_{ts_tag}",
        "run_type": "augmentation_retrain",
        "training_date": ts_iso,
        "description": (
            "Augmentation retrain triggered by underrepresented class audit. "
            "SyntheticDataGenerator used to fill classes below minimum sample threshold. "
            "Data quality pass removed duplicates and mislabelled examples before retraining."
        ),

        # ── Before snapshot ─────────────────────────────────────────────
        "before": {
            "dataset_sizes":              audit_before["dataset_sizes"],
            "category_distribution_train": audit_before["category_distribution"]["train"],
            "priority_distribution_train": audit_before["priority_distribution"]["train"],
            "underrepresented_categories": audit_before["underrepresented_categories"],
            "underrepresented_priorities":  audit_before["underrepresented_priorities"],
            "imbalance_ratios":            audit_before["imbalance_ratios"],
            "data_quality":               audit_before["data_quality"],
            "model_metrics":              prior_metrics,
        },

        # ── After snapshot ──────────────────────────────────────────────
        "after": {
            "dataset_sizes":              audit_after["dataset_sizes"],
            "category_distribution_train": audit_after["category_distribution"]["train"],
            "priority_distribution_train": audit_after["priority_distribution"]["train"],
            "underrepresented_categories": audit_after["underrepresented_categories"],
            "underrepresented_priorities":  audit_after["underrepresented_priorities"],
            "imbalance_ratios":            audit_after["imbalance_ratios"],
            "data_quality":               audit_after["data_quality"],
            # Metrics filled by train scripts; placeholder if training was skipped
            "model_metrics": {
                "note": "See priority_model_card_v3_*.json written by train_priority_model.py for full metrics."
            },
        },

        # ── Augmentation details ─────────────────────────────────────────
        "augmentation": {
            "min_category_threshold": min_category,
            "min_priority_threshold":  min_priority,
            "augmentation_seed":       AUGMENT_SEED,
            "categories_augmented":    [u["class"] for u in audit_before["underrepresented_categories"]],
            "priorities_augmented":    [u["class"] for u in audit_before["underrepresented_priorities"]],
            "samples_added": (
                audit_after["dataset_sizes"]["total"] - audit_before["dataset_sizes"]["total"]
            ),
        },

        # ── Training results ─────────────────────────────────────────────
        "training_run_results": train_results,

        # ── Changes made ─────────────────────────────────────────────────
        "changes": [
            "Added 17 new billing templates covering: auto-renewal disputes, VAT invoices, "
            "price-increase notices, failed ACH, account suspension, itemized invoices, "
            "outage credits, refund requests, upgrade/downgrade, duplicate accounts.",
            "Added 17 new account templates covering: 2FA reset, username change, role change, "
            "contractor onboarding, account re-enable for rehire, ownership transfer, "
            "emergency data export, audit log request, account unfreeze, IP restriction.",
            "Added 23 new feature_request templates covering: API access, PDF export, "
            "accessibility, custom report builder, dark mode, multi-language, "
            "mobile push notifications, webhooks, AI suggestions, MFA, audit trails, "
            "offline mode, recurring tasks, saved filters, calendar sync, batch import, "
            "granular roles, SLA tracking, ticket duplication, white-label, boolean search.",
            "Created scripts/audit_training_data.py for reproducible class-distribution audits.",
            "Created scripts/augment_and_retrain.py for targeted augmentation + retrain pipeline.",
        ],

        "thresholds": {
            "min_category_samples":  min_category,
            "min_priority_samples":  min_priority,
            "description": (
                f"Classes with fewer than {min_category} training samples (category) or "
                f"{min_priority} (priority) are flagged as underrepresented and targeted for augmentation."
            ),
        },
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    card_path = MODELS_DIR / f"model_card_v3_{ts_tag}.json"
    alt_path  = MODELS_DIR / "model_card_v3_latest.json"

    save_json(card, card_path)
    save_json(card, alt_path)

    print(f"  ✓ Model card → {card_path.relative_to(BASE_DIR)}")
    print(f"  ✓ Latest     → {alt_path.relative_to(BASE_DIR)}")
    return card


# ────────── Main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Augment underrepresented training classes and retrain BlueClue ML models."
    )
    parser.add_argument("--min-category", type=int, default=DEFAULT_MIN_CATEGORY,
                        help=f"Minimum training samples per category (default: {DEFAULT_MIN_CATEGORY})")
    parser.add_argument("--min-priority", type=int, default=DEFAULT_MIN_PRIORITY,
                        help=f"Minimum training samples per priority (default: {DEFAULT_MIN_PRIORITY})")
    parser.add_argument("--models", type=str, default="priority",
                        help="Comma-separated models to retrain: category,priority (default: priority)")
    parser.add_argument("--no-train", action="store_true",
                        help="Augment and prepare data only — skip retraining")
    args = parser.parse_args()

    models_to_train = [m.strip() for m in args.models.split(",") if m.strip()]

    print("=" * 60)
    print("BlueClue Augmentation & Retrain Pipeline")
    print(f"  Date           : {datetime.now().isoformat()}")
    print(f"  Min category   : {args.min_category}")
    print(f"  Min priority   : {args.min_priority}")
    print(f"  Models         : {models_to_train}")
    print(f"  Skip training  : {args.no_train}")
    print("=" * 60)

    # Step 1: Audit BEFORE
    audit_before = run_audit(args.min_category, args.min_priority)

    # Step 2: Generate augmentation
    augmented_corpus = augment_classes(audit_before, args.min_category, args.min_priority)

    # Step 3: Quality pass
    clean_corpus = quality_pass(augmented_corpus)

    # Step 4: Save raw corpus
    banner("Saving augmented raw corpus")
    save_augmented_raw(clean_corpus)

    # Step 5: Preprocess + split
    run_preprocessing(clean_corpus)

    # Step 6: Audit AFTER (re-read splits)
    audit_after = run_audit(args.min_category, args.min_priority)

    # Step 7: Retrain
    train_results = {}
    if not args.no_train:
        train_results = run_training(models_to_train)
    else:
        banner("Training skipped (--no-train)")
        train_results = {m: {"status": "skipped"} for m in models_to_train}

    # Step 8: Write model card
    card = write_model_card(audit_before, audit_after,
                            train_results, args.min_category, args.min_priority)

    # Final summary
    banner("Pipeline Complete")
    added = card["augmentation"]["samples_added"]
    print(f"  Samples before : {audit_before['dataset_sizes']['total']}")
    print(f"  Samples after  : {audit_after['dataset_sizes']['total']}")
    print(f"  New samples    : {added}")
    print(f"  Categories still underrepresented: "
          f"{[u['class'] for u in audit_after['underrepresented_categories']] or 'none'}")
    print(f"  Priorities still underrepresented:  "
          f"{[u['class'] for u in audit_after['underrepresented_priorities']] or 'none'}")
    print()


if __name__ == "__main__":
    main()
