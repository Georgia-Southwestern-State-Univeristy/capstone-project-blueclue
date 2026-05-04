"""
Temporarily regenerate data/splits/ from the original 3292-ticket dataset
so the priority model trains on a balanced priority distribution.
Call restore_splits.py afterward to bring back the category-model splits.
"""
import json, shutil, sys
from pathlib import Path
from collections import Counter

BASE   = Path(__file__).resolve().parent.parent
SPLITS = BASE / "data" / "splits"
BACKUP = BASE / "data" / "splits_category_backup"

sys.path.insert(0, str(BASE))

from ml.preprocessor import DataPreprocessor
from ml.data_splitter  import DataSplitter

# ── Backup current (category-optimised) splits ──────────────────────────────
shutil.copytree(SPLITS, BACKUP, dirs_exist_ok=True)
print(f"✓ Category splits backed up → {BACKUP.relative_to(BASE)}")

# ── Load and split original 3292-ticket dataset ──────────────────────────────
raw_path = BASE / "data" / "raw" / "synthetic_tickets.json"
with open(raw_path, encoding="utf-8") as f:
    tickets = json.load(f)
print(f"  Loaded {len(tickets)} original tickets")

pre = DataPreprocessor(remove_pii=True, handle_missing="impute", remove_duplicates=True)
clean = pre.preprocess(tickets)
print(f"  After preprocessing: {len(clean)}")

splitter = DataSplitter(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, random_seed=42)
train, val, test = splitter.split(clean, stratify_by="category")

# Overwrite splits directory
SPLITS.mkdir(exist_ok=True)
with open(SPLITS / "train.json", "w", encoding="utf-8") as f:
    json.dump(train, f)
with open(SPLITS / "val.json",   "w", encoding="utf-8") as f:
    json.dump(val,   f)
with open(SPLITS / "test.json",  "w", encoding="utf-8") as f:
    json.dump(test,  f)

print(f"✓ Priority splits written → train={len(train)}  val={len(val)}  test={len(test)}")
print("  Priority distribution (train):",
      dict(Counter(t["priority"] for t in train)))
print("  Category distribution (train):",
      dict(Counter(t["category"] for t in train)))
