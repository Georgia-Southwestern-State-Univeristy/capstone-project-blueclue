"""
BlueClue ML Inference Service
=============================

FastAPI microservice for ticket classification and resolution-time prediction.
Replaces the Flask-based dummy classifier with trained ML models.

Endpoints:
    POST /classify/category         -> Category classification
    POST /classify/priority         -> Priority classification
    POST /predict/resolution_time   -> Resolution-time estimation
    POST /classify                  -> Combined classification (backward compat.)
    POST /classify/legacy           -> Legacy Flask-shaped response
    GET  /health                    -> Health check
    GET  /models/info               -> Model metadata
    GET  /metrics                   -> Service metrics
"""

import asyncio
import os
import sys
import time
import json
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
from functools import partial

import numpy as np
import joblib
import uvicorn
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- #
# Path setup
# --------------------------------------------------------------------------- #
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "src"))
sys.path.insert(0, BASE_DIR)

# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #
LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("blueclue.ml")

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
ML_SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", "5000"))
ML_SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
MODELS_DIR = os.path.join(BASE_DIR, "models")
FEATURES_DIR = os.path.join(BASE_DIR, "data", "features")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.6"))
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", "1024"))
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "3600"))  # 1 hour

# --------------------------------------------------------------------------- #
# Pydantic request / response schemas
# --------------------------------------------------------------------------- #


class ClassifyRequest(BaseModel):
    """Request body for classification endpoints."""
    text: str = Field(..., min_length=1, max_length=10000,
                      description="Ticket description text")
    subject: Optional[str] = Field(None, max_length=500,
                                   description="Ticket subject line")
    category: Optional[str] = Field(None,
                                    description="Pre-determined category (for priority/time)")
    priority: Optional[str] = Field(None,
                                    description="Pre-determined priority (for time)")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict,
                                               description="Additional ticket metadata")


class CategoryResponse(BaseModel):
    category: str
    confidence: float
    all_scores: Dict[str, float]
    model_version: str
    low_confidence: bool = False
    top_features: Optional[List[Dict[str, Any]]] = None


class PriorityResponse(BaseModel):
    priority: str
    confidence: float
    all_scores: Dict[str, float]
    model_version: str
    low_confidence: bool = False
    top_features: Optional[List[Dict[str, Any]]] = None


class TimeResponse(BaseModel):
    estimated_hours: float
    confidence_range: Dict[str, float]
    model_version: str
    uncertainty_label: Optional[str] = None  # e.g. "2–4 hours"


# ---- New schemas for monitoring / explainability / feedback -------------- #


class ExplainRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    subject: Optional[str] = None
    model_type: str = Field("category", description="'category' | 'priority'")
    prediction: Optional[str] = None
    confidence: Optional[float] = 0.0


class ExplainResponse(BaseModel):
    prediction: str
    confidence: float
    confidence_pct: float
    low_confidence: bool
    top_features: List[Dict[str, Any]]
    summary: str
    method: str


class FeedbackRequest(BaseModel):
    ticket_id: int
    classification_id: Optional[int] = None
    ai_category: Optional[str] = None
    ai_priority: Optional[str] = None
    ai_confidence: Optional[float] = None
    user_category: Optional[str] = None
    user_priority: Optional[str] = None
    category_overridden: bool = False
    priority_overridden: bool = False
    override_reason: Optional[str] = None
    user_id: Optional[int] = None


class FeedbackResponse(BaseModel):
    success: bool
    message: str
    feedback_id: Optional[int] = None


class DriftRunRequest(BaseModel):
    model_type: str = Field("category", description="'category' | 'priority'")
    window_days: int = Field(30, ge=1, le=365)


class ModelDeployRequest(BaseModel):
    model_type: str
    version: str


class ModelRollbackRequest(BaseModel):
    model_type: str
    target_version: Optional[str] = None


class RetrainingRequest(BaseModel):
    model_types: List[str] = Field(default_factory=lambda: ["category", "priority", "time"])
    triggered_by: str = "manual"
    auto_deploy: bool = False
    improvement_threshold: float = 0.02
    db_run_id: Optional[int] = None  # DB row id to update on completion


class CombinedResponse(BaseModel):
    """Backward-compatible combined classification response."""
    category: str
    priority: str
    confidence: float
    category_confidence: float
    priority_confidence: float
    estimated_resolution_hours: Optional[float] = None
    fallback_used: bool = False
    model_versions: Dict[str, str]
    low_confidence: bool = False
    category_top_features: Optional[List[Dict[str, Any]]] = None
    priority_top_features: Optional[List[Dict[str, Any]]] = None


class HealthResponse(BaseModel):
    status: str
    message: str
    timestamp: str
    version: str
    models_loaded: Dict[str, bool]
    uptime_seconds: float


class ModelInfoResponse(BaseModel):
    models: Dict[str, Any]
    service_version: str
    cache_stats: Dict[str, Any]


# --------------------------------------------------------------------------- #
# TTL-aware LRU cache
# --------------------------------------------------------------------------- #


class TTLCache:
    """Simple in-memory TTL cache for prediction results."""

    def __init__(self, max_size: int = 1024, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._store: OrderedDict[str, tuple] = OrderedDict()
        self.hits = 0
        self.misses = 0

    @staticmethod
    def _hash(text: str, endpoint: str) -> str:
        return hashlib.sha256(f"{endpoint}:{text}".encode()).hexdigest()

    def get(self, text: str, endpoint: str):
        key = self._hash(text, endpoint)
        if key in self._store:
            value, ts = self._store[key]
            if time.time() - ts < self.ttl:
                self.hits += 1
                self._store.move_to_end(key)
                return value
            else:
                del self._store[key]
        self.misses += 1
        return None

    def set(self, text: str, endpoint: str, value: Any):
        key = self._hash(text, endpoint)
        self._store[key] = (value, time.time())
        self._store.move_to_end(key)
        if len(self._store) > self.max_size:
            self._store.popitem(last=False)

    @property
    def stats(self) -> Dict[str, Any]:
        total = self.hits + self.misses
        return {
            "size": len(self._store),
            "max_size": self.max_size,
            "ttl_seconds": self.ttl,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 4) if total > 0 else 0.0,
        }


# --------------------------------------------------------------------------- #
# Model manager -- loads all three models at startup
# --------------------------------------------------------------------------- #


class ModelManager:
    """Loads and manages all ML models + feature extractors."""

    def __init__(self):
        self.category_model = None
        self.category_extractor = None
        self.category_card: Dict = {}

        self.priority_model = None
        self.priority_extractor = None
        self.priority_card: Dict = {}

        self.time_model = None
        self.time_extractor = None
        self.time_card: Dict = {}

        self._loaded = {"category": False, "priority": False, "time": False}

    # ---- loaders ---------------------------------------------------------- #

    def load_category_model(self):
        try:
            model_path = os.path.join(MODELS_DIR, "category_classifier_latest.pkl")
            extractor_path = os.path.join(FEATURES_DIR, "feature_extractor.pkl")

            if not os.path.exists(model_path):
                logger.warning("Category model not found at %s", model_path)
                return
            if not os.path.exists(extractor_path):
                logger.warning("Category feature extractor not found at %s", extractor_path)
                return

            from ml.feature_extractor import FeatureExtractor

            self.category_model = joblib.load(model_path)
            self.category_extractor = FeatureExtractor.load(extractor_path)

            card_path = self._find_model_card("model_card_")
            if card_path:
                with open(card_path) as f:
                    self.category_card = json.load(f)

            self._loaded["category"] = True
            logger.info("Category model loaded (version %s)",
                        self.category_card.get("version", "unknown"))
        except Exception as exc:
            logger.error("Failed to load category model: %s", exc, exc_info=True)

    def load_priority_model(self):
        try:
            model_path = os.path.join(MODELS_DIR, "priority_classifier_latest.pkl")
            extractor_path = os.path.join(MODELS_DIR, "priority_feature_extractor_latest.pkl")

            if not os.path.exists(model_path):
                logger.warning("Priority model not found at %s", model_path)
                return
            if not os.path.exists(extractor_path):
                logger.warning("Priority feature extractor not found at %s", extractor_path)
                return

            from train_priority_model import PriorityFeatureExtractor

            self.priority_model = joblib.load(model_path)
            self.priority_extractor = PriorityFeatureExtractor.load(extractor_path)

            card_path = self._find_model_card("priority_model_card_")
            if card_path:
                with open(card_path) as f:
                    self.priority_card = json.load(f)

            self._loaded["priority"] = True
            logger.info("Priority model loaded (version %s)",
                        self.priority_card.get("version", "unknown"))
        except Exception as exc:
            logger.error("Failed to load priority model: %s", exc, exc_info=True)

    def load_time_model(self):
        try:
            model_path = os.path.join(MODELS_DIR, "time_predictor_latest.pkl")
            extractor_path = os.path.join(MODELS_DIR, "time_feature_extractor_latest.pkl")

            if not os.path.exists(model_path):
                logger.warning("Time model not found at %s", model_path)
                return
            if not os.path.exists(extractor_path):
                logger.warning("Time feature extractor not found at %s", extractor_path)
                return

            from train_time_model import TimeFeatureExtractor

            self.time_model = joblib.load(model_path)
            self.time_extractor = TimeFeatureExtractor.load(extractor_path)

            card_path = self._find_model_card("time_model_card_")
            if card_path:
                with open(card_path) as f:
                    self.time_card = json.load(f)

            self._loaded["time"] = True
            logger.info("Time model loaded (version %s)",
                        self.time_card.get("version", "unknown"))
        except Exception as exc:
            logger.error("Failed to load time model: %s", exc, exc_info=True)

    def load_all(self):
        logger.info("Loading ML models from %s ...", MODELS_DIR)
        self.load_category_model()
        self.load_priority_model()
        self.load_time_model()
        loaded = sum(1 for v in self._loaded.values() if v)
        logger.info("Model loading complete: %d/3 models loaded", loaded)

    # ---- inference -------------------------------------------------------- #

    def predict_category(self, text: str, subject: str = None,
                         metadata: Dict = None) -> Dict[str, Any]:
        if not self._loaded["category"]:
            raise RuntimeError("Category model not loaded")

        ticket = {
            "description": text or "",
            "subject": subject or "",
            "created_at": datetime.now().isoformat(),
        }
        if metadata:
            ticket.update(metadata)

        features = self.category_extractor.transform([ticket])
        prediction = self.category_model.predict(features)[0]

        if hasattr(self.category_model, "predict_proba"):
            probs = self.category_model.predict_proba(features)[0]
            categories = list(self.category_model.classes_)
            confidence = float(max(probs))
            all_scores = {c: round(float(p), 4) for c, p in zip(categories, probs)}
        else:
            confidence = 1.0
            all_scores = {prediction: 1.0}

        return {
            "category": prediction,
            "confidence": round(confidence, 4),
            "all_scores": all_scores,
            "model_version": self.category_card.get("version", "unknown"),
            "low_confidence": confidence < CONFIDENCE_THRESHOLD,
        }

    def predict_priority(self, text: str, subject: str = None,
                         category: str = None,
                         metadata: Dict = None) -> Dict[str, Any]:
        if not self._loaded["priority"]:
            raise RuntimeError("Priority model not loaded")

        ticket = {
            "description": text or "",
            "subject": subject or "",
            "category": category or "other",
            "created_at": datetime.now().isoformat(),
        }
        if metadata:
            ticket.update(metadata)

        features = self.priority_extractor.transform([ticket])
        prediction = self.priority_model.predict(features)[0]

        if hasattr(self.priority_model, "predict_proba"):
            probs = self.priority_model.predict_proba(features)[0]
            priorities = list(self.priority_model.classes_)
            confidence = float(max(probs))
            all_scores = {p: round(float(v), 4) for p, v in zip(priorities, probs)}
        else:
            confidence = 1.0
            all_scores = {prediction: 1.0}

        return {
            "priority": prediction,
            "confidence": round(confidence, 4),
            "all_scores": all_scores,
            "model_version": self.priority_card.get("version", "unknown"),
            "low_confidence": confidence < CONFIDENCE_THRESHOLD,
        }

    def predict_time(self, text: str, subject: str = None,
                     category: str = None, priority: str = None,
                     metadata: Dict = None) -> Dict[str, Any]:
        if not self._loaded["time"]:
            raise RuntimeError("Time model not loaded")

        ticket = {
            "description": text or "",
            "subject": subject or "",
            "category": category or "other",
            "priority": priority or "medium",
            "created_at": datetime.now().isoformat(),
        }
        if metadata:
            ticket.update(metadata)

        features = self.time_extractor.transform([ticket])
        raw_pred = self.time_model.predict(features)[0]

        if hasattr(self.time_extractor, "use_log_transform") and self.time_extractor.use_log_transform:
            estimated_hours = float(np.expm1(raw_pred))
        else:
            estimated_hours = float(raw_pred)

        # Clamp to reasonable range (0.5h - 30 days)
        estimated_hours = max(0.5, min(estimated_hours, 720))
        lower = max(0.5, estimated_hours * 0.7)
        upper = estimated_hours * 1.3

        # Build human-readable uncertainty label (e.g. "2–4 hours" or "1–3 days")
        def _fmt_hours(h: float) -> str:
            if h < 1:
                return "< 1 hour"
            if h < 24:
                return f"{int(round(h))} hour{'s' if round(h) != 1 else ''}"
            days = h / 24
            return f"{int(round(days))} day{'s' if round(days) != 1 else ''}"

        uncertainty_label = f"{_fmt_hours(lower)} – {_fmt_hours(upper)}"

        return {
            "estimated_hours": round(estimated_hours, 2),
            "confidence_range": {
                "lower_hours": round(lower, 2),
                "upper_hours": round(upper, 2),
            },
            "model_version": self.time_card.get("version", "unknown"),
            "uncertainty_label": uncertainty_label,
        }

    # ---- helpers ---------------------------------------------------------- #

    def _find_model_card(self, prefix: str) -> Optional[str]:
        if not os.path.isdir(MODELS_DIR):
            return None
        cards = sorted(
            [f for f in os.listdir(MODELS_DIR)
             if f.startswith(prefix) and f.endswith(".json")]
        )
        return os.path.join(MODELS_DIR, cards[-1]) if cards else None

    @property
    def loaded_status(self) -> Dict[str, bool]:
        return dict(self._loaded)

    def get_all_info(self) -> Dict[str, Any]:
        info: Dict[str, Any] = {}
        if self._loaded["category"]:
            info["category"] = {
                "version": self.category_card.get("version"),
                "model_type": self.category_card.get("model_name"),
                "categories": self.category_card.get("categories", []),
                "accuracy": self.category_card.get("metrics", {}).get("accuracy"),
                "f1_macro": self.category_card.get("metrics", {}).get("f1_macro"),
                "training_date": self.category_card.get("training_date"),
                "inference_time_ms": self.category_card.get("inference_time_ms"),
            }
        if self._loaded["priority"]:
            info["priority"] = {
                "version": self.priority_card.get("version"),
                "model_type": self.priority_card.get("model_name"),
                "priorities": self.priority_card.get("priorities", []),
                "accuracy": self.priority_card.get("metrics", {}).get("accuracy"),
                "f1_macro": self.priority_card.get("metrics", {}).get("f1_macro"),
                "training_date": self.priority_card.get("training_date"),
                "inference_time_ms": self.priority_card.get("inference_time_ms"),
            }
        if self._loaded["time"]:
            info["time"] = {
                "version": self.time_card.get("version"),
                "model_type": self.time_card.get("model_name"),
                "mae_hours": self.time_card.get("metrics", {}).get("mae_hours"),
                "r2_score": self.time_card.get("metrics", {}).get("r2_score"),
                "training_date": self.time_card.get("training_date"),
                "inference_time_ms": self.time_card.get("inference_time_ms"),
            }
        return info


# --------------------------------------------------------------------------- #
# Rule-based fallback (used when ML models are unavailable)
# --------------------------------------------------------------------------- #

CATEGORY_RULES: Dict[str, List[str]] = {
    "hardware": ["laptop", "computer", "monitor", "printer", "keyboard", "mouse",
                 "screen", "battery", "charger", "hardware", "device"],
    "software": ["install", "update", "crash", "application", "software", "windows",
                 "office", "excel", "word", "outlook", "teams", "app"],
    "network":  ["wifi", "internet", "network", "vpn", "connection", "wireless",
                 "ethernet", "bandwidth", "dns", "firewall"],
    "account":  ["password", "login", "account", "access", "permission", "locked",
                 "reset", "authentication", "credentials", "sign in"],
    "login":    ["can't log in", "login failed", "password expired", "forgot password",
                 "locked out", "sign-in", "two factor", "mfa", "sso"],
    "billing":  ["invoice", "billing", "charge", "payment", "subscription",
                 "refund", "receipt", "cost", "pricing"],
    "feature_request": ["feature", "suggestion", "enhancement", "request",
                        "improvement", "add", "wish", "idea", "roadmap"],
}

PRIORITY_RULES: Dict[str, List[str]] = {
    "critical": ["urgent", "emergency", "down", "outage", "critical",
                 "production", "all users", "security breach"],
    "high":     ["important", "asap", "deadline", "broken", "cannot access",
                 "failing", "blocking"],
    "medium":   ["issue", "problem", "error", "slow", "intermittent"],
    "low":      ["question", "minor", "cosmetic", "nice to have", "feedback"],
}


def _rule_based_classify(text: str) -> Dict[str, Any]:
    """Simple keyword-based fallback for when ML models are unavailable."""
    text_lower = text.lower()

    best_cat, best_cat_score = "other", 0
    for cat, keywords in CATEGORY_RULES.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_cat_score:
            best_cat, best_cat_score = cat, score

    best_pri, best_pri_score = "low", 0
    for pri, keywords in PRIORITY_RULES.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_pri_score:
            best_pri, best_pri_score = pri, score

    return {"category": best_cat, "priority": best_pri,
            "confidence": 0.3, "fallback": True}


# --------------------------------------------------------------------------- #
# Global singletons
# --------------------------------------------------------------------------- #
models = ModelManager()
cache = TTLCache(max_size=CACHE_MAX_SIZE, ttl_seconds=CACHE_TTL_SECONDS)
START_TIME = time.time()


# --------------------------------------------------------------------------- #
# Metrics collector
# --------------------------------------------------------------------------- #


class MetricsCollector:
    """Lightweight in-process metrics."""

    def __init__(self):
        self.request_count = 0
        self.error_count = 0
        self.latencies: List[float] = []
        self.confidence_scores: List[float] = []
        self.category_distribution: Dict[str, int] = {}
        self.priority_distribution: Dict[str, int] = {}
        self.fallback_count = 0

    def record_request(self, latency_ms: float, confidence: float = None,
                       category: str = None, priority: str = None,
                       fallback: bool = False):
        self.request_count += 1
        self.latencies.append(latency_ms)
        if confidence is not None:
            self.confidence_scores.append(confidence)
        if category:
            self.category_distribution[category] = \
                self.category_distribution.get(category, 0) + 1
        if priority:
            self.priority_distribution[priority] = \
                self.priority_distribution.get(priority, 0) + 1
        if fallback:
            self.fallback_count += 1
        # Keep only last 10k entries to bound memory
        if len(self.latencies) > 10_000:
            self.latencies = self.latencies[-5_000:]
        if len(self.confidence_scores) > 10_000:
            self.confidence_scores = self.confidence_scores[-5_000:]

    def record_error(self):
        self.error_count += 1

    @property
    def summary(self) -> Dict[str, Any]:
        lats = self.latencies or [0]
        confs = self.confidence_scores or [0]
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "fallback_count": self.fallback_count,
            "latency_ms": {
                "mean": round(float(np.mean(lats)), 2),
                "p50": round(float(np.percentile(lats, 50)), 2),
                "p95": round(float(np.percentile(lats, 95)), 2),
                "p99": round(float(np.percentile(lats, 99)), 2),
            },
            "confidence": {
                "mean": round(float(np.mean(confs)), 4),
                "min": round(float(np.min(confs)), 4),
                "below_threshold_pct": round(
                    100 * sum(1 for c in confs if c < CONFIDENCE_THRESHOLD)
                    / max(len(confs), 1), 2
                ),
            },
            "category_distribution": dict(self.category_distribution),
            "priority_distribution": dict(self.priority_distribution),
        }


metrics = MetricsCollector()

# In-memory tracking of retraining runs started in this process instance
_active_runs: Dict[str, Dict[str, Any]] = {}


# --------------------------------------------------------------------------- #
# Explainability engines (lazy-loaded after models are ready)
# --------------------------------------------------------------------------- #

class ExplainabilityManager:
    """Wraps one ExplainabilityEngine per model type."""

    def __init__(self):
        self._engines: Dict[str, Any] = {}

    def init(self, model_manager: "ModelManager"):
        try:
            from src.explainability import ExplainabilityEngine
            if model_manager._loaded.get("category"):
                self._engines["category"] = ExplainabilityEngine(
                    model_manager.category_model,
                    model_manager.category_extractor,
                    model_type="category",
                    confidence_threshold=CONFIDENCE_THRESHOLD,
                )
                logger.info("Category explainability engine ready")
            if model_manager._loaded.get("priority"):
                self._engines["priority"] = ExplainabilityEngine(
                    model_manager.priority_model,
                    model_manager.priority_extractor,
                    model_type="priority",
                    confidence_threshold=CONFIDENCE_THRESHOLD,
                )
                logger.info("Priority explainability engine ready")
        except ImportError as exc:
            logger.warning("Explainability engine unavailable: %s", exc)
        except Exception as exc:
            logger.error("Failed to init explainability engines: %s", exc, exc_info=True)

    def explain(self, model_type: str, text: str, subject: str = "",
                prediction: str = "", confidence: float = 0.0) -> Optional[Dict]:
        engine = self._engines.get(model_type)
        if engine is None:
            return None
        result = engine.explain(
            text=text, subject=subject,
            prediction=prediction, confidence=confidence,
        )
        return result.to_dict()

    def get_global_features(self, model_type: str, top_n: int = 10) -> Optional[List[Dict]]:
        """Return model-level top features from the fitted model (not per-prediction)."""
        engine = self._engines.get(model_type)
        if engine is None:
            return None
        return engine.get_global_top_features(top_n)

    def is_ready(self, model_type: str) -> bool:
        return model_type in self._engines


explainer_mgr = ExplainabilityManager()


async def _inline_explain(
    model_type: str, text: str, subject: str,
    prediction: str, confidence: float,
) -> Optional[List[Dict[str, Any]]]:
    """
    Best-effort inline explainability with an 80 ms hard cap.
    Returns the top_features list or None on timeout / error.
    """
    if not explainer_mgr.is_ready(model_type):
        return None
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                explainer_mgr.explain,
                model_type, text, subject, prediction, confidence,
            ),
            timeout=0.08,
        )
        return result.get("top_features") if result else None
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Drift detectors
# --------------------------------------------------------------------------- #

class DriftManager:
    """Manages DriftDetector instances per model type."""

    def __init__(self):
        self._detectors: Dict[str, Any] = {}
        self._last_reports: Dict[str, Any] = {}

    def init(self, model_manager: "ModelManager"):
        try:
            from src.drift_detector import DriftDetector, build_baseline_from_model_card
            # (model_type, model_card, fallback list-key for uniform distribution)
            configs = [
                ("category", model_manager.category_card, "categories"),
                ("priority", model_manager.priority_card, "priorities"),
            ]
            for mt, card, label_list_key in configs:
                if not card:
                    continue
                # Try explicit pre-computed distribution keys first
                dist: Dict[str, int] = {}
                for key in ("category_distribution", "priority_distribution", "class_distribution"):
                    dist = build_baseline_from_model_card(card, key)
                    if dist:
                        break
                # Fallback: derive uniform distribution from the class-label list
                # (model cards store categories/priorities as a plain list, not a dict)
                if not dist:
                    class_list: list = card.get(label_list_key, [])
                    n_samples: int = card.get("training_samples", 0)
                    if class_list:
                        n_per = max(1, n_samples // len(class_list)) if n_samples else 1
                        dist = {cls: n_per for cls in class_list}
                if dist:
                    self._detectors[mt] = DriftDetector(
                        baseline_distribution=dist,
                        model_type=mt,
                    )
                    logger.info("Drift detector ready for %s (%d labels, baseline built from %s)",
                                mt, len(dist), label_list_key if not build_baseline_from_model_card(card, "category_distribution") else "explicit distribution")
                else:
                    logger.warning("Could not build baseline distribution for drift detector: %s", mt)
        except Exception as exc:
            logger.warning("Drift detector init failed: %s", exc)

    def run_report(self, model_type: str, window_days: int = 30) -> Optional[Dict]:
        detector = self._detectors.get(model_type)
        if detector is None:
            return None

        # Sample from in-memory metrics distributions
        if model_type == "category":
            dist = metrics.category_distribution
        else:
            dist = metrics.priority_distribution

        live_labels = []
        for label, count in dist.items():
            live_labels.extend([label] * count)

        if not live_labels:
            return {"error": "No live predictions available yet"}

        from datetime import datetime, timezone, timedelta
        period_end = datetime.now(tz=timezone.utc)
        period_start = period_end - timedelta(days=window_days)

        report = detector.run(
            live_predictions=live_labels,
            confidence_scores=metrics.confidence_scores[-1000:] if metrics.confidence_scores else None,
            period_start=period_start,
            period_end=period_end,
        )
        self._last_reports[model_type] = report.to_dict()
        return report.to_dict()

    def get_last_report(self, model_type: str) -> Optional[Dict]:
        return self._last_reports.get(model_type)


drift_mgr = DriftManager()


# --------------------------------------------------------------------------- #
# LLM / RAG service (initialised in lifespan)
# --------------------------------------------------------------------------- #

_llm_service = None   # LLMService singleton — set in lifespan


# --------------------------------------------------------------------------- #
# Model registry
# --------------------------------------------------------------------------- #

registry = None  # initialised in lifespan


# --------------------------------------------------------------------------- #
# Local feedback store (JSONL file – read by the Node.js backend)
# --------------------------------------------------------------------------- #

FEEDBACK_LOG_PATH = os.path.join(BASE_DIR, "data", "feedback_log.jsonl")
_feedback_lock = asyncio.Lock()

async def _append_feedback(record: Dict):
    os.makedirs(os.path.dirname(FEEDBACK_LOG_PATH), exist_ok=True)
    async with _feedback_lock:
        with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")


# --------------------------------------------------------------------------- #
# Rolling accuracy store (persisted to disk for dashboard)
# --------------------------------------------------------------------------- #

ROLLING_ACCURACY_PATH = os.path.join(BASE_DIR, "data", "rolling_accuracy.json")

def _load_rolling_accuracy() -> Dict:
    if os.path.exists(ROLLING_ACCURACY_PATH):
        try:
            with open(ROLLING_ACCURACY_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {"daily": [], "weekly": []}

_rolling_accuracy: Dict = {}  # loaded in lifespan


# Sample texts used to warm the prediction cache at startup so the first
# real requests don't pay the cold-start penalty.
_WARMUP_TEXTS = [
    "My laptop screen is cracked and won't turn on",
    "I can't connect to the company WiFi network",
    "Need to reset my password, I've been locked out of my account",
    "The billing amount on my invoice seems incorrect",
    "Could you add a dark mode option to the application?",
    "Excel crashes every time I try to open a large spreadsheet",
    "The printer on floor 3 has a paper jam",
    "VPN disconnects every 10 minutes from home",
    "URGENT: Production database server is down affecting all users",
    "Minor typo on the settings page, no rush to fix",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models at startup, warm cache, clean up on shutdown."""
    global registry, _rolling_accuracy, _llm_service
    models.load_all()

    # Initialise explainability + drift detection
    explainer_mgr.init(models)
    drift_mgr.init(models)

    # Initialise model registry
    try:
        from src.model_registry import ModelRegistry
        registry = ModelRegistry(base_dir=BASE_DIR)
        logger.info("Model registry loaded (%d total versions)",
                    len(registry.list_versions()))
    except Exception as exc:
        logger.warning("Model registry unavailable: %s", exc)

    # Load rolling accuracy data
    _rolling_accuracy = _load_rolling_accuracy()

    # ── LLM / RAG initialisation ────────────────────────────────────────── #
    try:
        from src.llm_service import get_llm_service
        _llm_service = get_llm_service()
        logger.info(
            "LLM service initialised — model=%s  llm_ready=%s  embed_dim=%d",
            _llm_service.get_model_name(),
            _llm_service.is_llm_available(),
            _llm_service.get_embedding_dim(),
        )
        # Auto-generate embeddings for any articles that don't have one yet.
        # Runs in a background thread so it doesn't delay startup.
        if os.getenv("DATABASE_URL"):
            import threading
            def _bg_embed():
                try:
                    import importlib.util, sys as _sys
                    gen_path = os.path.join(BASE_DIR, "generate_embeddings.py")
                    spec = importlib.util.spec_from_file_location("gen_emb", gen_path)
                    mod  = importlib.util.module_from_spec(spec)
                    _sys.modules["gen_emb"] = mod
                    spec.loader.exec_module(mod)
                    mod.run(force=False, dry_run=False)
                except Exception as exc:
                    logger.warning("Background embedding generation failed: %s", exc)
            threading.Thread(target=_bg_embed, daemon=True).start()
            logger.info("Background embedding generation started")
    except Exception as exc:
        logger.warning("LLM service init failed (RAG endpoints disabled): %s", exc)
    # ──────────────────────────────────────────────────────────────────────── #

    # Warm the cache with sample texts so cold-start latency doesn't affect p95
    if any(models._loaded.values()):
        logger.info("Warming prediction cache with %d sample texts …", len(_WARMUP_TEXTS))
        for text in _WARMUP_TEXTS:
            try:
                req = ClassifyRequest(text=text)
                await _classify_combined_impl(req)
            except Exception:
                pass  # best-effort
        logger.info("Cache warm-up complete (cache size: %d)", len(cache._store))
        # Reset metrics so warmup requests don't skew the monitoring dashboard.
        # Real traffic starts counting from zero after this point.
        metrics.request_count = 0
        metrics.error_count = 0
        metrics.latencies = []
        metrics.confidence_scores = []
        metrics.category_distribution = {}
        metrics.priority_distribution = {}
        metrics.fallback_count = 0
        logger.info("Metrics collector reset after warmup — live monitoring begins")

    yield
    logger.info("ML service shutting down")


app = FastAPI(
    title="BlueClue ML Inference Service",
    description="Ticket classification and resolution-time prediction with trained ML models.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Request logging middleware
# --------------------------------------------------------------------------- #


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    logger.info("%s %s -> %s (%.1fms)",
                request.method, request.url.path, response.status_code, duration_ms)
    return response


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check -- includes model load status."""
    return HealthResponse(
        status="OK" if any(models.loaded_status.values()) else "DEGRADED",
        message="BlueClue ML Inference Service is running",
        timestamp=datetime.now().isoformat(),
        version="2.0.0",
        models_loaded=models.loaded_status,
        uptime_seconds=round(time.time() - START_TIME, 1),
    )


@app.get("/models/info", response_model=ModelInfoResponse)
async def model_info():
    """Return metadata for all loaded models and cache stats."""
    return ModelInfoResponse(
        models=models.get_all_info(),
        service_version="2.0.0",
        cache_stats=cache.stats,
    )


@app.get("/metrics")
async def get_metrics():
    """Return service metrics."""
    return metrics.summary


# ---- Category classification --------------------------------------------- #


@app.post("/classify/category", response_model=CategoryResponse)
async def classify_category(req: ClassifyRequest):
    """Classify ticket category using the trained ML model."""
    t0 = time.time()

    cached = cache.get(req.text, "category")
    if cached:
        return cached

    try:
        if models._loaded["category"]:
            result = await asyncio.to_thread(
                models.predict_category,
                text=req.text, subject=req.subject, metadata=req.metadata)
        else:
            fb = _rule_based_classify(req.text)
            result = {
                "category": fb["category"], "confidence": fb["confidence"],
                "all_scores": {fb["category"]: fb["confidence"]},
                "model_version": "rule-based-fallback", "low_confidence": True,
            }
            metrics.record_request(
                latency_ms=(time.time() - t0) * 1000,
                confidence=fb["confidence"], category=fb["category"], fallback=True)
            return CategoryResponse(**result)

        top_features = await _inline_explain(
            "category", req.text, req.subject or "", result["category"], result["confidence"])
        resp = CategoryResponse(**result, top_features=top_features)
        cache.set(req.text, "category", resp)
        metrics.record_request(
            latency_ms=(time.time() - t0) * 1000,
            confidence=result["confidence"], category=result["category"])
        return resp

    except Exception as exc:
        metrics.record_error()
        logger.error("Category classification error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ---- Priority classification -------------------------------------------- #


@app.post("/classify/priority", response_model=PriorityResponse)
async def classify_priority(req: ClassifyRequest):
    """Classify ticket priority using the trained ML model."""
    t0 = time.time()

    cache_key_text = f"{req.text}|{req.category or ''}"
    cached = cache.get(cache_key_text, "priority")
    if cached:
        return cached

    try:
        if models._loaded["priority"]:
            result = await asyncio.to_thread(
                models.predict_priority,
                text=req.text, subject=req.subject,
                category=req.category, metadata=req.metadata)
        else:
            fb = _rule_based_classify(req.text)
            result = {
                "priority": fb["priority"], "confidence": fb["confidence"],
                "all_scores": {fb["priority"]: fb["confidence"]},
                "model_version": "rule-based-fallback", "low_confidence": True,
            }
            metrics.record_request(
                latency_ms=(time.time() - t0) * 1000,
                confidence=fb["confidence"], priority=fb["priority"], fallback=True)
            return PriorityResponse(**result)

        top_features = await _inline_explain(
            "priority", req.text, req.subject or "", result["priority"], result["confidence"])
        resp = PriorityResponse(**result, top_features=top_features)
        cache.set(cache_key_text, "priority", resp)
        metrics.record_request(
            latency_ms=(time.time() - t0) * 1000,
            confidence=result["confidence"], priority=result["priority"])
        return resp

    except Exception as exc:
        metrics.record_error()
        logger.error("Priority classification error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ---- Resolution time prediction ----------------------------------------- #


@app.post("/predict/resolution_time", response_model=TimeResponse)
async def predict_resolution_time(req: ClassifyRequest):
    """Predict resolution time using the trained ML model."""
    t0 = time.time()

    cache_key_text = f"{req.text}|{req.category or ''}|{req.priority or ''}"
    cached = cache.get(cache_key_text, "time")
    if cached:
        return cached

    try:
        if models._loaded["time"]:
            result = await asyncio.to_thread(
                models.predict_time,
                text=req.text, subject=req.subject,
                category=req.category, priority=req.priority,
                metadata=req.metadata)
        else:
            priority_hours = {"critical": 4, "high": 8, "medium": 24, "low": 48}
            est = float(priority_hours.get(req.priority or "medium", 24))
            lower, upper = est * 0.5, est * 2.0

            def _fmt_h(h: float) -> str:
                if h < 1:
                    return "< 1 hour"
                if h < 24:
                    return f"{int(round(h))} hour{'s' if round(h) != 1 else ''}"
                days = h / 24
                return f"{int(round(days))} day{'s' if round(days) != 1 else ''}"

            result = {
                "estimated_hours": est,
                "confidence_range": {"lower_hours": lower, "upper_hours": upper},
                "model_version": "rule-based-fallback",
                "uncertainty_label": f"{_fmt_h(lower)} \u2013 {_fmt_h(upper)}",
            }

        resp = TimeResponse(**result)
        cache.set(cache_key_text, "time", resp)
        metrics.record_request(latency_ms=(time.time() - t0) * 1000)
        return resp

    except Exception as exc:
        metrics.record_error()
        logger.error("Time prediction error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ---- Combined classification (backward compatible) ---------------------- #


async def _classify_combined_impl(req: ClassifyRequest) -> CombinedResponse:
    """
    Core combined-classification logic.  Extracted so both the /classify
    endpoint and the warm-up code can call it.
    """
    t0 = time.time()

    cached = cache.get(req.text, "combined")
    if cached:
        return cached

    fallback_used = False
    model_versions: Dict[str, str] = {}

    # --- Category ---
    try:
        if models._loaded["category"]:
            cat_result = await asyncio.to_thread(
                models.predict_category,
                text=req.text, subject=req.subject, metadata=req.metadata)
        else:
            fb = _rule_based_classify(req.text)
            cat_result = {"category": fb["category"], "confidence": fb["confidence"],
                          "all_scores": {}, "model_version": "rule-based-fallback",
                          "low_confidence": True}
            fallback_used = True
    except Exception:
        fb = _rule_based_classify(req.text)
        cat_result = {"category": fb["category"], "confidence": fb["confidence"],
                      "all_scores": {}, "model_version": "error-fallback",
                      "low_confidence": True}
        fallback_used = True
    model_versions["category"] = cat_result["model_version"]

    # --- Priority ---
    try:
        if models._loaded["priority"]:
            pri_result = await asyncio.to_thread(
                models.predict_priority,
                text=req.text, subject=req.subject,
                category=cat_result["category"], metadata=req.metadata)
        else:
            fb = _rule_based_classify(req.text)
            pri_result = {"priority": fb["priority"], "confidence": fb["confidence"],
                          "all_scores": {}, "model_version": "rule-based-fallback",
                          "low_confidence": True}
            fallback_used = True
    except Exception:
        fb = _rule_based_classify(req.text)
        pri_result = {"priority": fb["priority"], "confidence": fb["confidence"],
                      "all_scores": {}, "model_version": "error-fallback",
                      "low_confidence": True}
        fallback_used = True
    model_versions["priority"] = pri_result["model_version"]

    # --- Time (best-effort) ---
    estimated_hours = None
    try:
        if models._loaded["time"]:
            time_result = await asyncio.to_thread(
                models.predict_time,
                text=req.text, subject=req.subject,
                category=cat_result["category"], priority=pri_result["priority"],
                metadata=req.metadata)
            estimated_hours = time_result["estimated_hours"]
            model_versions["time"] = time_result["model_version"]
    except Exception:
        pass

    overall_confidence = min(cat_result["confidence"], pri_result["confidence"])
    low_conf = cat_result.get("low_confidence", False) or pri_result.get("low_confidence", False)

    # Inline explain – parallel, best-effort, 80 ms hard cap each
    cat_feats, pri_feats = await asyncio.gather(
        _inline_explain("category", req.text, req.subject or "",
                        cat_result["category"], cat_result["confidence"]),
        _inline_explain("priority", req.text, req.subject or "",
                        pri_result["priority"], pri_result["confidence"]),
        return_exceptions=True,
    )
    cat_feats = cat_feats if not isinstance(cat_feats, Exception) else None
    pri_feats = pri_feats if not isinstance(pri_feats, Exception) else None

    resp = CombinedResponse(
        category=cat_result["category"],
        priority=pri_result["priority"],
        confidence=round(overall_confidence, 4),
        category_confidence=round(cat_result["confidence"], 4),
        priority_confidence=round(pri_result["confidence"], 4),
        estimated_resolution_hours=estimated_hours,
        fallback_used=fallback_used,
        model_versions=model_versions,
        low_confidence=low_conf,
        category_top_features=cat_feats,
        priority_top_features=pri_feats,
    )

    cache.set(req.text, "combined", resp)
    metrics.record_request(
        latency_ms=(time.time() - t0) * 1000,
        confidence=overall_confidence,
        category=cat_result["category"], priority=pri_result["priority"],
        fallback=fallback_used)
    return resp


@app.post("/classify", response_model=CombinedResponse)
async def classify_combined(req: ClassifyRequest):
    """
    Combined classification -- predicts category, priority and optionally
    resolution time in one call.  Backward-compatible with the legacy
    Flask /classify endpoint.
    """
    return await _classify_combined_impl(req)


# ---- Legacy wrapper (Flask-compatible response shape) -------------------- #


@app.post("/classify/legacy")
async def classify_legacy(request: Request):
    """
    Legacy endpoint returning the same JSON shape as the old Flask app.
    Eases migration for existing backend callers.
    """
    body = await request.json()
    text = body.get("text", "")
    if not text:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing required field",
                     "message": "\"text\" field is required"},
        )

    req = ClassifyRequest(text=text)
    combined = await classify_combined(req)

    return JSONResponse(content={
        "success": True,
        "input": text,
        "classification": {
            "category": combined.category,
            "priority": combined.priority,
            "confidence": combined.confidence,
            "category_confidence": combined.category_confidence,
            "priority_confidence": combined.priority_confidence,
            "estimated_resolution_hours": combined.estimated_resolution_hours,
            "fallback_used": combined.fallback_used,
        },
        "timestamp": datetime.now().isoformat(),
    })


# ---- Root --------------------------------------------------------------- #


@app.get("/")
async def root():
    return {
        "name": "BlueClue ML Inference Service",
        "version": "2.0.0",
        "endpoints": {
            "health": "GET /health",
            "models_info": "GET /models/info",
            "metrics": "GET /metrics",
            "metrics_rolling": "GET /metrics/rolling",
            "classify_category": "POST /classify/category",
            "classify_priority": "POST /classify/priority",
            "predict_time": "POST /predict/resolution_time",
            "classify_combined": "POST /classify",
            "classify_legacy": "POST /classify/legacy",
            "explain": "POST /explain",
            "feedback": "POST /feedback",
            "feedback_log": "GET /feedback/log",
            "drift_run": "POST /drift/run",
            "drift_latest": "GET /drift/latest",
            "model_versions": "GET /models/versions",
            "model_deploy": "POST /models/deploy",
            "model_rollback": "POST /models/rollback",
            "retrain": "POST /retrain",
        },
        "documentation": "/docs",
    }


# ---- Explainability ------------------------------------------------------ #


@app.post("/explain", response_model=ExplainResponse)
async def explain_prediction(req: ExplainRequest):
    """
    Return a SHAP-based explanation for a single prediction.
    Answers: 'Why did the AI choose this category / priority?'
    """
    if not explainer_mgr.is_ready(req.model_type):
        # Fall back: auto-classify first then explain
        if req.model_type == "category" and models._loaded.get("category"):
            cr = await asyncio.to_thread(
                models.predict_category, text=req.text, subject=req.subject
            )
            result = explainer_mgr.explain(
                "category", req.text, req.subject or "",
                prediction=cr["category"], confidence=cr["confidence"]
            )
            if result:
                return ExplainResponse(**result)
        raise HTTPException(
            status_code=503,
            detail=f"Explainability engine for '{req.model_type}' is not available"
        )

    prediction = req.prediction or ""
    confidence = req.confidence or 0.0

    # If no prediction provided, classify first
    if not prediction:
        try:
            if req.model_type == "category" and models._loaded.get("category"):
                cr = await asyncio.to_thread(
                    models.predict_category, text=req.text, subject=req.subject
                )
                prediction = cr["category"]
                confidence = cr["confidence"]
            elif req.model_type == "priority" and models._loaded.get("priority"):
                pr = await asyncio.to_thread(
                    models.predict_priority, text=req.text, subject=req.subject
                )
                prediction = pr["priority"]
                confidence = pr["confidence"]
        except Exception as exc:
            logger.warning("Pre-classification for explain failed: %s", exc)

    try:
        result = await asyncio.to_thread(
            explainer_mgr.explain,
            req.model_type, req.text, req.subject or "",
            prediction, confidence
        )
        if result is None:
            raise HTTPException(status_code=503, detail="Explainability engine unavailable")
        return ExplainResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Explain endpoint error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ---- Global model insights ---------------------------------------------- #


@app.get("/explain/global-features")
async def get_global_top_features():
    """
    Return the top contributing features globally for each model type.
    Uses model.feature_importances_ (tree) or mean |coef_| (linear).
    Useful for the 'Model Insights' admin view.
    """
    return {
        "category": explainer_mgr.get_global_features("category", top_n=15),
        "priority": explainer_mgr.get_global_features("priority", top_n=15),
    }


# ---- Feedback collection ------------------------------------------------- #


@app.post("/feedback", response_model=FeedbackResponse)
async def record_feedback(req: FeedbackRequest, background_tasks: BackgroundTasks):
    """
    Record a user's accept/override decision on an AI prediction.
    The record is appended to a local JSONL log so the Node.js backend
    can periodically ingest it into PostgreSQL.
    """
    record = {
        "id": int(time.time() * 1000),
        "ticket_id": req.ticket_id,
        "classification_id": req.classification_id,
        "ai_category": req.ai_category,
        "ai_priority": req.ai_priority,
        "ai_confidence": req.ai_confidence,
        "user_category": req.user_category,
        "user_priority": req.user_priority,
        "category_overridden": req.category_overridden,
        "priority_overridden": req.priority_overridden,
        "override_reason": req.override_reason,
        "user_id": req.user_id,
        "created_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    background_tasks.add_task(_append_feedback, record)
    return FeedbackResponse(
        success=True,
        message="Feedback recorded",
        feedback_id=record["id"]
    )


@app.get("/feedback/log")
async def get_feedback_log(limit: int = 100):
    """Return recent feedback entries from the local JSONL log."""
    if not os.path.exists(FEEDBACK_LOG_PATH):
        return {"entries": [], "total": 0}

    entries = []
    try:
        with open(FEEDBACK_LOG_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    entries = entries[-limit:]
    override_count = sum(1 for e in entries if e.get("category_overridden") or e.get("priority_overridden"))
    override_rate = round(override_count / max(len(entries), 1) * 100, 2)

    return {
        "entries": list(reversed(entries)),
        "total": len(entries),
        "override_count": override_count,
        "override_rate_pct": override_rate,
    }


# ---- Drift detection ----------------------------------------------------- #


@app.post("/drift/run")
async def run_drift_detection(req: DriftRunRequest):
    """
    Run drift detection on the last N days of live predictions.
    Returns a full DriftReport.
    """
    report = await asyncio.to_thread(
        drift_mgr.run_report, req.model_type, req.window_days
    )
    if report is None:
        raise HTTPException(
            status_code=503,
            detail=f"Drift detector for '{req.model_type}' is not available"
        )
    return report


@app.get("/drift/latest")
async def get_latest_drift_report(model_type: str = "category"):
    """Return the most recently computed drift report for a model type."""
    report = drift_mgr.get_last_report(model_type)
    if report is None:
        return {
            "message": f"No drift report yet for '{model_type}'. "
                       f"Call POST /drift/run to generate one."
        }
    return report


# ---- Model version management ------------------------------------------- #


@app.get("/models/versions")
async def list_model_versions(model_type: Optional[str] = None):
    """List all registered model versions."""
    if registry is None:
        raise HTTPException(status_code=503, detail="Model registry not available")
    summary = registry.get_summary()
    if model_type:
        return summary.get(model_type, {"error": f"No versions found for '{model_type}'"})
    return summary


@app.get("/models/registry/history")
async def get_registry_history(limit: int = 20):
    """Return deployment / rollback history."""
    if registry is None:
        raise HTTPException(status_code=503, detail="Model registry not available")
    return {"history": registry.get_history(limit=limit)}


@app.post("/models/deploy")
async def deploy_model(req: ModelDeployRequest):
    """Deploy a registered model version as the active model."""
    if registry is None:
        raise HTTPException(status_code=503, detail="Model registry not available")
    success = await asyncio.to_thread(registry.deploy, req.model_type, req.version)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Version '{req.version}' of '{req.model_type}' not found in registry"
        )
    # Reload the deployed model
    if req.model_type == "category":
        await asyncio.to_thread(models.load_category_model)
        explainer_mgr.init(models)
    elif req.model_type == "priority":
        await asyncio.to_thread(models.load_priority_model)
        explainer_mgr.init(models)
    elif req.model_type == "time":
        await asyncio.to_thread(models.load_time_model)
    cache._store.clear()  # Invalidate cache after model change

    return {"success": True, "message": f"Deployed {req.model_type} v{req.version}"}


@app.post("/models/rollback")
async def rollback_model(req: ModelRollbackRequest):
    """Roll back a model type to the previous (or specified) version."""
    if registry is None:
        raise HTTPException(status_code=503, detail="Model registry not available")
    success = await asyncio.to_thread(
        registry.rollback, req.model_type, req.target_version
    )
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"No previous version available to roll back to for '{req.model_type}'"
        )
    # Reload
    if req.model_type == "category":
        await asyncio.to_thread(models.load_category_model)
        explainer_mgr.init(models)
    elif req.model_type == "priority":
        await asyncio.to_thread(models.load_priority_model)
        explainer_mgr.init(models)
    elif req.model_type == "time":
        await asyncio.to_thread(models.load_time_model)
    cache._store.clear()

    active = registry.get_active_version(req.model_type)
    return {
        "success": True,
        "message": f"Rolled back {req.model_type}",
        "active_version": active.get("version") if active else None,
    }


# ---- Manual retraining trigger ------------------------------------------ #


@app.post("/retrain")
async def trigger_retraining(req: RetrainingRequest, background_tasks: BackgroundTasks):
    """
    Trigger the retraining pipeline as a background task.
    Returns immediately with a run ID; poll GET /retrain/status/{run_id} for progress.
    """
    run_id = f"run_{int(time.time())}"
    pipeline_script = os.path.join(BASE_DIR, "scripts", "retrain_pipeline.py")

    if not os.path.exists(pipeline_script):
        raise HTTPException(
            status_code=503,
            detail="Retraining pipeline script not found. "
                   "Ensure scripts/retrain_pipeline.py is present."
        )

    started_at = datetime.now(tz=timezone.utc).isoformat()
    _active_runs[run_id] = {
        "run_id": run_id,
        "status": "running",
        "model_types": req.model_types,
        "triggered_by": req.triggered_by,
        "auto_deploy": req.auto_deploy,
        "started_at": started_at,
        "completed_at": None,
        "db_run_id": req.db_run_id,
    }

    # Sync function — BackgroundTasks runs it in a thread pool, so subprocess.run
    # is safe here and won't block the event loop.
    def _run_pipeline():
        import subprocess
        logger.info("Starting retraining pipeline (%s), run_id=%s",
                    req.model_types, run_id)
        env = os.environ.copy()
        env["RETRAIN_MODELS"] = ",".join(req.model_types)
        env["RETRAIN_AUTO_DEPLOY"] = "1" if req.auto_deploy else "0"
        env["RETRAIN_THRESHOLD"] = str(req.improvement_threshold)
        env["RETRAIN_RUN_ID"] = run_id
        env["RETRAIN_DB_ID"] = str(req.db_run_id) if req.db_run_id else ""
        status = "failed"
        try:
            result = subprocess.run(
                [sys.executable, pipeline_script],
                timeout=3600, env=env
                # No capture_output — pipeline logs flow directly to server stdout/stderr
            )
            if result.returncode == 0:
                status = "success"
                logger.info("Retraining pipeline completed successfully (run_id=%s)", run_id)
            else:
                logger.error("Retraining pipeline failed (run_id=%s, returncode=%d)",
                             run_id, result.returncode)
        except subprocess.TimeoutExpired:
            status = "timeout"
            logger.error("Retraining pipeline timed out (run_id=%s)", run_id)
        except Exception as exc:
            logger.error("Retraining pipeline error (run_id=%s): %s", run_id, exc)
        finally:
            _active_runs[run_id]["status"] = status
            _active_runs[run_id]["completed_at"] = datetime.now(tz=timezone.utc).isoformat()

    background_tasks.add_task(_run_pipeline)

    return {
        "success": True,
        "run_id": run_id,
        "message": f"Retraining pipeline started for: {req.model_types}. "
                   f"Poll GET /retrain/status/{run_id} for progress.",
        "triggered_by": req.triggered_by,
        "auto_deploy": req.auto_deploy,
        "started_at": started_at,
    }


@app.get("/retrain/status/{run_id}")
async def get_retrain_status(run_id: str):
    """Poll the status of a retraining run started in this process instance."""
    if run_id not in _active_runs:
        return {
            "run_id": run_id,
            "status": "unknown",
            "message": "Run not found — may have been started by a different worker or process restart.",
        }
    return _active_runs[run_id]


# ---- Enhanced metrics ---------------------------------------------------- #


@app.get("/metrics/rolling")
async def get_rolling_metrics():
    """
    Rolling accuracy and performance metrics for the monitoring dashboard.
    Includes daily stats from the in-memory MetricsCollector plus any
    persisted rolling_accuracy.json data.
    """
    base_metrics = metrics.summary
    lats = metrics.latencies or [0]
    confs = metrics.confidence_scores or [0]

    low_conf_threshold = CONFIDENCE_THRESHOLD
    low_conf_count = sum(1 for c in confs if c < low_conf_threshold)

    # Confidence histogram (10 buckets)
    hist_counts, hist_bins = np.histogram(confs, bins=10, range=(0, 1))
    confidence_histogram = [
        {
            "bucket": f"{hist_bins[i]:.1f}-{hist_bins[i+1]:.1f}",
            "count": int(hist_counts[i]),
        }
        for i in range(len(hist_counts))
    ]

    # Requests-per-minute (estimate from latency window)
    uptime = time.time() - START_TIME
    rpm = round(metrics.request_count / max(uptime / 60, 1), 2)

    return {
        "uptime_seconds": round(uptime, 1),
        "requests_per_minute": rpm,
        "total_requests": metrics.request_count,
        "total_errors": metrics.error_count,
        "error_rate_pct": round(
            100 * metrics.error_count / max(metrics.request_count, 1), 2
        ),
        "fallback_count": metrics.fallback_count,
        "fallback_rate_pct": round(
            100 * metrics.fallback_count / max(metrics.request_count, 1), 2
        ),
        "latency_ms": base_metrics["latency_ms"],
        "confidence": {
            **base_metrics["confidence"],
            "histogram": confidence_histogram,
            "low_confidence_count": low_conf_count,
            "low_confidence_pct": round(100 * low_conf_count / max(len(confs), 1), 2),
            "threshold": low_conf_threshold,
        },
        "category_distribution": base_metrics["category_distribution"],
        "priority_distribution": base_metrics["priority_distribution"],
        "models_loaded": models.loaded_status,
        "explainability_ready": {
            "category": explainer_mgr.is_ready("category"),
            "priority": explainer_mgr.is_ready("priority"),
        },
        "rolling_accuracy": _rolling_accuracy,
    }


# =========================================================================== #
# RAG / LLM Endpoints                                                          #
# =========================================================================== #

# ── Pydantic schemas for RAG ─────────────────────────────────────────────── #

class RAGChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    user_id: Optional[int] = None
    conversation_id: Optional[int] = None
    conversation_history: Optional[List[Dict[str, str]]] = Field(default_factory=list)
    user_role: str = Field("customer", description="'customer' | 'tech' | 'admin'")
    use_cache: bool = True
    top_k: int = Field(5, ge=1, le=10)


class RAGChatResponse(BaseModel):
    answer: str
    citations: List[Dict[str, Any]] = []
    escalate: bool = False
    model_used: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
    cache_hit: bool = False
    fallback_used: bool = False


class TicketSummarizeRequest(BaseModel):
    transcript: str = Field(..., min_length=10, max_length=20000)


class TicketSummarizeResponse(BaseModel):
    title: str
    description: str
    suggested_category: str


class EmbeddingGenerateRequest(BaseModel):
    force: bool = False
    article_id: Optional[int] = None


# ── /rag/health ─────────────────────────────────────────────────────────── #

@app.get("/rag/health")
async def rag_health():
    """Return LLM / embedding readiness and KB coverage."""
    if _llm_service is None:
        return JSONResponse(
            status_code=503,
            content={"llm_ready": False, "embedding_ready": False,
                     "error": "LLM service not initialised"},
        )

    # Check embedding coverage
    embedding_stats = {"total": 0, "embedded": 0, "missing": 0}
    db_url = os.getenv("DATABASE_URL", "")
    if db_url:
        try:
            import psycopg2, psycopg2.extras
            conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
            from src.rag_pipeline import get_article_embedding_status
            embedding_stats = get_article_embedding_status(conn)
            conn.close()
        except Exception as exc:
            logger.warning("rag/health DB check failed: %s", exc)

    return {
        "llm_ready":         _llm_service.is_llm_available(),
        "embedding_ready":   embedding_stats.get("embedded", 0) > 0,
        "model":             _llm_service.get_model_name(),
        "embedding_model":   os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002"),
        "embedding_dim":     _llm_service.get_embedding_dim(),
        "articles_total":    embedding_stats.get("total", 0),
        "articles_embedded": embedding_stats.get("embedded", 0),
        "articles_missing":  embedding_stats.get("missing", 0),
    }


# ── /rag/chat ────────────────────────────────────────────────────────────── #

@app.post("/rag/chat", response_model=RAGChatResponse)
async def rag_chat(req: RAGChatRequest, background_tasks: BackgroundTasks):
    """
    Main RAG chat endpoint.
    Embeds the user message, retrieves relevant KB articles,
    constructs a grounded prompt, and calls the LLM.
    """
    if _llm_service is None:
        raise HTTPException(status_code=503, detail="LLM service not initialised")

    try:
        from src.rag_pipeline import run_rag_pipeline
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: run_rag_pipeline(
                query=req.message,
                llm_service=_llm_service,
                user_id=req.user_id,
                conversation_id=req.conversation_id,
                conversation_history=req.conversation_history or [],
                user_role=req.user_role,
                top_k=req.top_k,
                use_cache=req.use_cache,
            ),
        )
        return RAGChatResponse(
            answer=result.answer,
            citations=result.citations,
            escalate=result.escalate,
            model_used=result.model_used,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            total_tokens=result.total_tokens,
            cost_usd=result.cost_usd,
            latency_ms=result.latency_ms,
            cache_hit=result.cache_hit,
            fallback_used=result.fallback_used,
        )
    except Exception as exc:
        logger.error("/rag/chat error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── /rag/summarize-ticket ────────────────────────────────────────────────── #

@app.post("/rag/summarize-ticket", response_model=TicketSummarizeResponse)
async def rag_summarize_ticket(req: TicketSummarizeRequest):
    """
    Use the LLM to generate a ticket title, description, and category
    suggestion from a chat transcript.
    """
    if _llm_service is None or not _llm_service.is_llm_available():
        # Fallback: first user line as title
        lines = [l for l in req.transcript.split("\n") if l.startswith("User:")]
        title = lines[0].replace("User:", "").strip()[:100] if lines else "Support Request"
        return TicketSummarizeResponse(
            title=title,
            description=req.transcript[:2000],
            suggested_category="general",
        )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a help-desk ticket intake assistant. "
                "Given a chat transcript between a user and a support bot, "
                "extract a concise ticket title (max 10 words), "
                "a 1-2 sentence description of the issue, "
                "and suggest one category from: "
                "hardware, software, network, account, email, other. "
                "Respond ONLY with JSON: "
                '{"title": "...", "description": "...", "suggested_category": "..."}'
            ),
        },
        {
            "role": "user",
            "content": f"Chat transcript:\n{req.transcript[:4000]}",
        },
    ]

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: _llm_service.chat_completion(messages, temperature=0.3, max_tokens=150),
        )
        import re
        raw = result["content"].strip()
        # Extract JSON from possible markdown code block
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return TicketSummarizeResponse(
                title=data.get("title", "Support Request")[:100],
                description=data.get("description", "")[:2000],
                suggested_category=data.get("suggested_category", "general"),
            )
    except Exception as exc:
        logger.warning("/rag/summarize-ticket LLM error: %s", exc)

    # Fallback
    lines = [l for l in req.transcript.split("\n") if l.startswith("User:")]
    title = lines[0].replace("User:", "").strip()[:100] if lines else "Support Request"
    return TicketSummarizeResponse(
        title=title,
        description=req.transcript[:2000],
        suggested_category="general",
    )


# ── /rag/embeddings/generate ─────────────────────────────────────────────── #

@app.post("/rag/embeddings/generate")
async def rag_generate_embeddings(
    req: EmbeddingGenerateRequest,
    background_tasks: BackgroundTasks,
):
    """
    Trigger (re)generation of KB article embeddings.
    Runs in the background so we return immediately.
    """
    if _llm_service is None:
        raise HTTPException(status_code=503, detail="LLM service not initialised")

    if not os.getenv("DATABASE_URL"):
        raise HTTPException(status_code=503, detail="DATABASE_URL not configured")

    def _run():
        import sys as _sys
        gen_path = os.path.join(BASE_DIR, "generate_embeddings.py")
        import importlib.util
        spec = importlib.util.spec_from_file_location("gen_emb_bg", gen_path)
        mod  = importlib.util.module_from_spec(spec)
        _sys.modules["gen_emb_bg"] = mod
        spec.loader.exec_module(mod)
        mod.run(force=req.force, dry_run=False, article_id=req.article_id)

    background_tasks.add_task(_run)
    return {"status": "started", "force": req.force, "article_id": req.article_id}


# ── /rag/embeddings/status ───────────────────────────────────────────────── #

@app.get("/rag/embeddings/status")
async def rag_embeddings_status():
    """Return embedding coverage stats for all KB articles."""
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        raise HTTPException(status_code=503, detail="DATABASE_URL not configured")

    try:
        import psycopg2, psycopg2.extras
        conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
        from src.rag_pipeline import get_article_embedding_status

        stats    = get_article_embedding_status(conn)

        # Also return per-article detail via the view
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, category, status, last_embedded, embedding_model
                FROM   kb_embedding_coverage
                ORDER  BY status DESC, id
                """
            )
            articles = [dict(r) for r in cur.fetchall()]
        conn.close()

        return {
            "summary":  stats,
            "articles": articles,
        }
    except Exception as exc:
        logger.error("/rag/embeddings/status error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---- Root --------------------------------------------------------------- #

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=ML_SERVICE_HOST,
        port=ML_SERVICE_PORT,
        reload=os.getenv("ML_ENV", "development") == "development",
        log_level="info",
        workers=int(os.getenv("ML_WORKERS", "1")),
    )
