"""
Model Registry
==============

File-system + JSON-index based model versioning and rollback.

Design
------
* Each model version is stored as a ``.pkl`` file in ``models/``.
* A companion JSON index ``models/registry.json`` tracks all versions,
  which is active, and deployment history.
* Keeps at most ``max_versions`` per model type (oldest pruned automatically).
* Supports rollback by setting a previous version as active.

The registry is intentionally lightweight (no external MLflow service required)
so it works in every deployment environment.  If you want to add MLflow later,
wrap ``ModelRegistry.register()`` to also call ``mlflow.log_artifact()``.

Usage
-----
    registry = ModelRegistry(base_dir="/path/to/ai")

    # Register a newly-trained model
    registry.register(
        model_type="category",
        version="v3_20260302",
        model_path="/path/to/category_classifier_v3.pkl",
        extractor_path="/path/to/feature_extractor.pkl",
        metrics={"accuracy": 0.89, "f1_macro": 0.87},
        metadata=full_model_card_dict,
    )

    # Deploy the new version
    registry.deploy("category", "v3_20260302")

    # Roll back to a previous version
    registry.rollback("category")
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("blueclue.registry")

REGISTRY_FILE = "registry.json"
MAX_VERSIONS_DEFAULT = 3


class ModelRegistry:
    """
    Lightweight file-system model registry.

    Parameters
    ----------
    base_dir : str
        Root AI service directory (contains ``models/`` sub-folder).
    max_versions : int
        Maximum number of versions to retain per model type.
        Oldest versions are pruned when this limit is exceeded.
    """

    def __init__(self, base_dir: str, max_versions: int = MAX_VERSIONS_DEFAULT):
        self.models_dir = os.path.join(base_dir, "models")
        self.registry_path = os.path.join(self.models_dir, REGISTRY_FILE)
        self.max_versions = max_versions
        os.makedirs(self.models_dir, exist_ok=True)
        self._data = self._load()

    # ── persistence ─────────────────────────────────────────────────────── #

    def _load(self) -> Dict[str, Any]:
        if os.path.exists(self.registry_path):
            try:
                with open(self.registry_path) as f:
                    return json.load(f)
            except Exception as exc:
                logger.warning("Could not load registry: %s – starting fresh", exc)
        return {"versions": {}, "active": {}, "history": []}

    def _save(self):
        with open(self.registry_path, "w") as f:
            json.dump(self._data, f, indent=2, default=str)

    # ── public API ───────────────────────────────────────────────────────── #

    def register(
        self,
        model_type: str,
        version: str,
        model_path: str,
        extractor_path: Optional[str] = None,
        metrics: Optional[Dict[str, float]] = None,
        metadata: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Register a new model version in the registry.

        Copies the model file into ``models/<model_type>/<version>/`` and
        records all metadata.  Does NOT deploy the model (call ``deploy()``
        separately to make it active).

        Returns
        -------
        dict
            The new version record.
        """
        version_dir = os.path.join(self.models_dir, model_type, version)
        os.makedirs(version_dir, exist_ok=True)

        # Copy artefacts
        dest_model = os.path.join(version_dir, f"{model_type}_classifier.pkl")
        if os.path.abspath(model_path) != os.path.abspath(dest_model):
            shutil.copy2(model_path, dest_model)

        dest_extractor = None
        if extractor_path and os.path.exists(extractor_path):
            dest_extractor = os.path.join(version_dir, "feature_extractor.pkl")
            if os.path.abspath(extractor_path) != os.path.abspath(dest_extractor):
                shutil.copy2(extractor_path, dest_extractor)

        # Save metadata card
        card_path = os.path.join(version_dir, "model_card.json")
        card = metadata or {}
        card.update({
            "version": version,
            "model_type": model_type,
            "registered_at": datetime.now(tz=timezone.utc).isoformat(),
            "metrics": metrics or {},
        })
        with open(card_path, "w") as f:
            json.dump(card, f, indent=2, default=str)

        # Build version record
        record = {
            "version": version,
            "model_type": model_type,
            "model_path": dest_model,
            "extractor_path": dest_extractor,
            "card_path": card_path,
            "metrics": metrics or {},
            "is_active": False,
            "is_deployed": False,
            "registered_at": datetime.now(tz=timezone.utc).isoformat(),
            "deployed_at": None,
            "rolled_back_at": None,
        }

        versions = self._data.setdefault("versions", {})
        model_versions = versions.setdefault(model_type, [])
        model_versions.append(record)

        # Prune old versions
        self._prune(model_type)
        self._save()

        logger.info("Registered %s version %s", model_type, version)
        return record

    def deploy(self, model_type: str, version: str) -> bool:
        """
        Deploy a registered version: copy its artefacts to the canonical
        ``*_latest.pkl`` paths and update the registry as active.

        Returns True on success, False if version not found.
        """
        record = self._find(model_type, version)
        if record is None:
            logger.error("Cannot deploy: version %s/%s not found", model_type, version)
            return False

        canonical = {
            "category": (
                os.path.join(self.models_dir, "category_classifier_latest.pkl"),
                os.path.join(os.path.dirname(self.models_dir), "data", "features",
                             "feature_extractor.pkl"),
            ),
            "priority": (
                os.path.join(self.models_dir, "priority_classifier_latest.pkl"),
                os.path.join(self.models_dir, "priority_feature_extractor_latest.pkl"),
            ),
            "time": (
                os.path.join(self.models_dir, "time_predictor_latest.pkl"),
                os.path.join(self.models_dir, "time_feature_extractor_latest.pkl"),
            ),
        }

        model_dest, extractor_dest = canonical.get(model_type, (None, None))

        if model_dest and os.path.exists(record["model_path"]):
            shutil.copy2(record["model_path"], model_dest)
        if extractor_dest and record.get("extractor_path") and \
                os.path.exists(record["extractor_path"]):
            shutil.copy2(record["extractor_path"], extractor_dest)

        # Deactivate previous active version
        for v in self._data["versions"].get(model_type, []):
            if v.get("is_active"):
                v["is_active"] = False

        record["is_active"] = True
        record["is_deployed"] = True
        record["deployed_at"] = datetime.now(tz=timezone.utc).isoformat()

        self._data.setdefault("active", {})[model_type] = version
        self._data.setdefault("history", []).append({
            "action": "deploy",
            "model_type": model_type,
            "version": version,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        })
        self._save()

        logger.info("Deployed %s version %s", model_type, version)
        return True

    def rollback(self, model_type: str, target_version: Optional[str] = None) -> bool:
        """
        Roll back to the previous deployed version (or a specific version).

        Parameters
        ----------
        model_type : str
        target_version : str, optional
            If None, rolls back to the most recently deployed non-active version.
        """
        model_versions = self._data.get("versions", {}).get(model_type, [])
        deployed = [v for v in model_versions if v.get("is_deployed")]
        deployed_sorted = sorted(deployed, key=lambda v: v.get("deployed_at", ""), reverse=True)

        if target_version:
            target = self._find(model_type, target_version)
        else:
            # Skip the currently active version; pick the one before
            non_active_deployed = [v for v in deployed_sorted if not v.get("is_active")]
            target = non_active_deployed[0] if non_active_deployed else None

        if target is None:
            logger.error("No previous version available to roll back to for %s", model_type)
            return False

        # Mark current active as rolled-back
        for v in model_versions:
            if v.get("is_active"):
                v["is_active"] = False
                v["rolled_back_at"] = datetime.now(tz=timezone.utc).isoformat()

        self._save()
        success = self.deploy(model_type, target["version"])

        self._data.setdefault("history", []).append({
            "action": "rollback",
            "model_type": model_type,
            "version": target["version"],
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        })
        self._save()
        return success

    def get_active_version(self, model_type: str) -> Optional[Dict]:
        """Return the currently active version record or None."""
        for v in self._data.get("versions", {}).get(model_type, []):
            if v.get("is_active"):
                return v
        return None

    def list_versions(self, model_type: Optional[str] = None) -> List[Dict]:
        """Return all registered versions, optionally filtered by model_type."""
        if model_type:
            return list(self._data.get("versions", {}).get(model_type, []))
        result = []
        for versions in self._data.get("versions", {}).values():
            result.extend(versions)
        return result

    def get_history(self, limit: int = 20) -> List[Dict]:
        """Return the most recent deployment/rollback history entries."""
        history = self._data.get("history", [])
        return sorted(history, key=lambda h: h.get("timestamp", ""), reverse=True)[:limit]

    def should_auto_deploy(
        self, model_type: str, new_version: str, improvement_threshold: float = 0.02
    ) -> bool:
        """
        Return True if the new version's accuracy is at least
        ``improvement_threshold`` better than the current active version.
        """
        new_record = self._find(model_type, new_version)
        active = self.get_active_version(model_type)

        if new_record is None:
            return False
        if active is None:
            return True  # No existing model – always deploy

        new_acc = new_record.get("metrics", {}).get("accuracy", 0.0)
        current_acc = active.get("metrics", {}).get("accuracy", 0.0)

        return (new_acc - current_acc) >= improvement_threshold

    def get_summary(self) -> Dict[str, Any]:
        """High-level summary of the registry for the admin dashboard."""
        summary: Dict[str, Any] = {}
        for model_type, versions in self._data.get("versions", {}).items():
            active = next((v for v in versions if v.get("is_active")), None)
            summary[model_type] = {
                "total_versions": len(versions),
                "active_version": active.get("version") if active else None,
                "active_accuracy": active.get("metrics", {}).get("accuracy") if active else None,
                "active_deployed_at": active.get("deployed_at") if active else None,
                "versions": [
                    {
                        "version": v["version"],
                        "is_active": v.get("is_active", False),
                        "accuracy": v.get("metrics", {}).get("accuracy"),
                        "registered_at": v.get("registered_at"),
                    }
                    for v in sorted(versions, key=lambda x: x.get("registered_at", ""), reverse=True)
                ],
            }
        return summary

    # ── private helpers ──────────────────────────────────────────────────── #

    def _find(self, model_type: str, version: str) -> Optional[Dict]:
        for v in self._data.get("versions", {}).get(model_type, []):
            if v["version"] == version:
                return v
        return None

    def _prune(self, model_type: str):
        versions = self._data.get("versions", {}).get(model_type, [])
        if len(versions) <= self.max_versions:
            return

        # Sort oldest-first; keep active and most recent N
        non_active = [v for v in versions if not v.get("is_active")]
        non_active_sorted = sorted(
            non_active, key=lambda v: v.get("registered_at", "")
        )
        to_prune = non_active_sorted[: len(versions) - self.max_versions]

        for record in to_prune:
            version_dir = os.path.dirname(record.get("model_path", ""))
            if version_dir and os.path.isdir(version_dir):
                try:
                    shutil.rmtree(version_dir)
                    logger.info("Pruned old version dir: %s", version_dir)
                except Exception as exc:
                    logger.warning("Could not prune %s: %s", version_dir, exc)
            versions.remove(record)

        logger.info("Pruned %d old versions of %s", len(to_prune), model_type)
