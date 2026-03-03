#!/usr/bin/env python
"""
Continuous Learning / Retraining Pipeline
==========================================

Monthly automated (or manually triggered) retraining pipeline.
Workflow:
    1.  Export new labelled tickets from the database (calls export_training_data.py)
    2.  Merge with existing training data
    3.  Retrain category, priority, and time models
    4.  Evaluate new models on a held-out test split
    5.  Compare accuracy against currently deployed models
    6.  Auto-deploy if accuracy improvement ≥ threshold
    7.  Register new version in the model registry
    8.  Write run report to data/reports/

Environment Variables (all optional):
    DATABASE_URL            PostgreSQL connection string
    RETRAIN_MODELS          Comma-separated list: category,priority,time
    RETRAIN_AUTO_DEPLOY     1 = auto-deploy if better, 0 = manual
    RETRAIN_THRESHOLD       Minimum accuracy improvement fraction (default 0.02)
    RETRAIN_RUN_ID          Run identifier (auto-generated if not set)
    ML_DATA_DIR             Override data directory

Usage:
    python scripts/retrain_pipeline.py
    python scripts/retrain_pipeline.py --models category,priority
    python scripts/retrain_pipeline.py --auto-deploy --threshold 0.02
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "src"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("retrain_pipeline")

REPORTS_DIR = BASE_DIR / "data" / "reports"
RAW_DATA_DIR = BASE_DIR / "data" / "raw"
MODELS_DIR = BASE_DIR / "models"


# ─────────────────────────────────────────────────────────────────────────────
# Step helpers
# ─────────────────────────────────────────────────────────────────────────────

def step_export_data() -> int:
    """Export new tickets from the database.  Returns number of new records."""
    logger.info("─" * 60)
    logger.info("STEP 1: Exporting new training data from database")
    try:
        from scripts.export_training_data import run_export
        count = run_export()
        logger.info("  Exported %d new records", count)
        return count
    except Exception as exc:
        logger.warning("Data export failed (continuing with existing data): %s", exc)
        return 0


def step_prepare_data() -> bool:
    """Run data preprocessing and feature extraction."""
    logger.info("─" * 60)
    logger.info("STEP 2: Preprocessing data")

    prepare_script = BASE_DIR / "scripts" / "prepare_ml_data.py"
    if not prepare_script.exists():
        logger.warning("prepare_ml_data.py not found – skipping data prep")
        return False

    import subprocess
    try:
        result = subprocess.run(
            [sys.executable, str(prepare_script), "--input",
             str(RAW_DATA_DIR / "tickets_exported.jsonl")],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode == 0:
            logger.info("  Data preprocessing complete")
            return True
        else:
            logger.warning("  Data preprocessing returned non-zero: %s", result.stderr[-500:])
            return False
    except Exception as exc:
        logger.warning("Data preprocessing failed: %s – using existing prepared data", exc)
        return False


def step_retrain_model(model_type: str, version: str) -> Optional[Dict[str, Any]]:
    """
    Retrain a single model type.  Returns metrics dict or None on failure.
    """
    logger.info("─" * 60)
    logger.info("STEP 3.%s: Retraining %s model (version: %s)", model_type, model_type, version)

    train_scripts = {
        "category": BASE_DIR / "src" / "train_category_model.py",
        "priority": BASE_DIR / "src" / "train_priority_model.py",
        "time":     BASE_DIR / "src" / "train_time_model.py",
    }

    script = train_scripts.get(model_type)
    if script is None or not script.exists():
        logger.error("Training script not found for %s", model_type)
        return None

    import subprocess

    env = os.environ.copy()
    env["MODEL_VERSION"] = version

    try:
        result = subprocess.run(
            [sys.executable, str(script)],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=1800,  # 30 min max
            env=env,
        )
        if result.returncode != 0:
            logger.error("Training failed for %s:\n%s", model_type, result.stderr[-1000:])
            return None

        logger.info("  Training complete for %s", model_type)

        # Find the latest model card for this type
        card_prefix = {
            "category": "model_card_",
            "priority": "priority_model_card_",
            "time": "time_model_card_",
        }[model_type]

        cards = sorted(MODELS_DIR.glob(f"{card_prefix}*.json"))
        if cards:
            with open(cards[-1]) as f:
                card = json.load(f)
            metrics = card.get("metrics", {})
            logger.info("  Metrics: %s", metrics)
            return {"metrics": metrics, "card": card, "card_path": str(cards[-1])}
        return {"metrics": {}, "card": {}, "card_path": None}

    except subprocess.TimeoutExpired:
        logger.error("Training timed out for %s", model_type)
        return None
    except Exception as exc:
        logger.error("Training error for %s: %s", model_type, exc)
        return None


def step_register_and_deploy(
    model_type: str,
    version: str,
    train_result: Dict,
    auto_deploy: bool,
    threshold: float,
) -> Dict[str, Any]:
    """Register the new model version and optionally deploy it."""
    logger.info("─" * 60)
    logger.info("STEP 4.%s: Registering %s v%s", model_type, model_type, version)

    try:
        from src.model_registry import ModelRegistry
        registry = ModelRegistry(base_dir=str(BASE_DIR))

        model_files = {
            "category": MODELS_DIR / "category_classifier_latest.pkl",
            "priority": MODELS_DIR / "priority_classifier_latest.pkl",
            "time":     MODELS_DIR / "time_predictor_latest.pkl",
        }
        extractor_files = {
            "category": BASE_DIR / "data" / "features" / "feature_extractor.pkl",
            "priority": MODELS_DIR / "priority_feature_extractor_latest.pkl",
            "time":     MODELS_DIR / "time_feature_extractor_latest.pkl",
        }

        model_path = model_files.get(model_type)
        extractor_path = extractor_files.get(model_type)

        if model_path and model_path.exists():
            registry.register(
                model_type=model_type,
                version=version,
                model_path=str(model_path),
                extractor_path=str(extractor_path) if extractor_path and extractor_path.exists() else None,
                metrics=train_result.get("metrics", {}),
                metadata=train_result.get("card", {}),
            )
            logger.info("  Registered %s v%s", model_type, version)
        else:
            logger.warning("  Model file not found for %s – skipping registration", model_type)
            return {"registered": False, "deployed": False}

        # Auto-deploy decision
        deployed = False
        if auto_deploy:
            if registry.should_auto_deploy(model_type, version, threshold):
                logger.info("  Auto-deploying %s v%s (improvement ≥ %.1f%%)",
                            model_type, version, threshold * 100)
                deployed = registry.deploy(model_type, version)
                if deployed:
                    logger.info("  ✓ Deployed %s v%s", model_type, version)
                else:
                    logger.warning("  Deployment failed for %s v%s", model_type, version)
            else:
                logger.info("  Improvement below threshold (%.1f%%) – skipping auto-deploy",
                            threshold * 100)
        else:
            logger.info("  Manual deploy mode – version registered but not deployed")

        return {"registered": True, "deployed": deployed, "version": version}

    except Exception as exc:
        logger.error("Registry/deploy error for %s: %s", model_type, exc, exc_info=True)
        return {"registered": False, "deployed": False, "error": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# Report writer
# ─────────────────────────────────────────────────────────────────────────────

def write_run_report(run_id: str, results: Dict[str, Any], duration_s: float):
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"retrain_{run_id}.json"

    report = {
        "run_id": run_id,
        "started_at": results.get("started_at"),
        "completed_at": datetime.now(tz=timezone.utc).isoformat(),
        "duration_seconds": round(duration_s, 1),
        "models_retrained": results.get("model_types", []),
        "results": results.get("model_results", {}),
        "new_records_exported": results.get("new_records", 0),
        "auto_deploy": results.get("auto_deploy", False),
        "improvement_threshold": results.get("threshold", 0.02),
        "overall_status": results.get("overall_status", "unknown"),
    }

    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    logger.info("Run report written to %s", report_path)
    return str(report_path)


# ─────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_pipeline(
    model_types: List[str],
    auto_deploy: bool,
    threshold: float,
    run_id: str,
    skip_export: bool = False,
) -> Dict[str, Any]:
    start_time = time.time()
    started_at = datetime.now(tz=timezone.utc).isoformat()

    version = datetime.now(tz=timezone.utc).strftime("v%Y%m%d_%H%M")

    logger.info("=" * 60)
    logger.info("BlueClue Retraining Pipeline")
    logger.info("  Run ID:      %s", run_id)
    logger.info("  Version:     %s", version)
    logger.info("  Models:      %s", model_types)
    logger.info("  Auto-deploy: %s (threshold=%.1f%%)", auto_deploy, threshold * 100)
    logger.info("=" * 60)

    new_records = 0
    if not skip_export:
        new_records = step_export_data()

    # Run data preparation (best-effort)
    step_prepare_data()

    model_results: Dict[str, Any] = {}
    overall_success = True

    for mt in model_types:
        train_result = step_retrain_model(mt, version)
        if train_result is None:
            model_results[mt] = {"status": "failed"}
            overall_success = False
            continue

        reg_result = step_register_and_deploy(mt, version, train_result, auto_deploy, threshold)
        model_results[mt] = {
            "status": "success",
            "version": version,
            "metrics": train_result.get("metrics", {}),
            "registered": reg_result.get("registered", False),
            "deployed": reg_result.get("deployed", False),
        }

    duration = time.time() - start_time
    overall_status = "success" if overall_success else "partial_failure"

    results = {
        "run_id": run_id,
        "started_at": started_at,
        "model_types": model_types,
        "model_results": model_results,
        "new_records": new_records,
        "auto_deploy": auto_deploy,
        "threshold": threshold,
        "overall_status": overall_status,
    }

    report_path = write_run_report(run_id, results, duration)
    results["report_path"] = report_path

    logger.info("=" * 60)
    logger.info("Pipeline complete in %.1fs – status: %s", duration, overall_status)
    logger.info("=" * 60)

    return results


def main():
    parser = argparse.ArgumentParser(description="BlueClue ML Retraining Pipeline")
    parser.add_argument(
        "--models", type=str,
        default=os.getenv("RETRAIN_MODELS", "category,priority,time"),
        help="Comma-separated model types to retrain"
    )
    parser.add_argument(
        "--auto-deploy", action="store_true",
        default=os.getenv("RETRAIN_AUTO_DEPLOY", "0") == "1",
        help="Auto-deploy if accuracy improves by threshold"
    )
    parser.add_argument(
        "--threshold", type=float,
        default=float(os.getenv("RETRAIN_THRESHOLD", "0.02")),
        help="Minimum accuracy improvement for auto-deploy (default: 0.02)"
    )
    parser.add_argument(
        "--skip-export", action="store_true",
        help="Skip data export step (use existing data)"
    )
    parser.add_argument(
        "--run-id", type=str,
        default=os.getenv("RETRAIN_RUN_ID", f"run_{int(time.time())}"),
    )
    args = parser.parse_args()

    model_types = [m.strip() for m in args.models.split(",") if m.strip()]
    valid_types = {"category", "priority", "time"}
    model_types = [m for m in model_types if m in valid_types]

    if not model_types:
        logger.error("No valid model types specified. Choose from: %s", valid_types)
        return 1

    results = run_pipeline(
        model_types=model_types,
        auto_deploy=args.auto_deploy,
        threshold=args.threshold,
        run_id=args.run_id,
        skip_export=args.skip_export,
    )

    return 0 if results["overall_status"] in ("success", "partial_failure") else 1


if __name__ == "__main__":
    sys.exit(main())
