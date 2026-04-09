"""
Restore data/splits/ from the category-model backup created by prep_priority_splits.py
"""
import shutil
from pathlib import Path

BASE   = Path(__file__).resolve().parent.parent
SPLITS = BASE / "data" / "splits"
BACKUP = BASE / "data" / "splits_category_backup"

if not BACKUP.exists():
    print("No backup found – nothing to restore")
else:
    shutil.copytree(BACKUP, SPLITS, dirs_exist_ok=True)
    shutil.rmtree(BACKUP)
    print(f"✓ Category splits restored from backup → {SPLITS.relative_to(BASE)}")
