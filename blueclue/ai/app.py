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
from datetime import datetime
from typing import Any, Dict, List, Optional
from collections import OrderedDict
from contextlib import asynccontextmanager
from functools import partial

import numpy as np
import joblib
import uvicorn
from fastapi import FastAPI, HTTPException, Request
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
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
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


class PriorityResponse(BaseModel):
    priority: str
    confidence: float
    all_scores: Dict[str, float]
    model_version: str
    low_confidence: bool = False


class TimeResponse(BaseModel):
    estimated_hours: float
    confidence_range: Dict[str, float]
    model_version: str


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

        return {
            "estimated_hours": round(estimated_hours, 2),
            "confidence_range": {
                "lower_hours": round(lower, 2),
                "upper_hours": round(upper, 2),
            },
            "model_version": self.time_card.get("version", "unknown"),
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


# --------------------------------------------------------------------------- #
# FastAPI application
# --------------------------------------------------------------------------- #


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
    models.load_all()

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

        resp = CategoryResponse(**result)
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

        resp = PriorityResponse(**result)
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
            est = priority_hours.get(req.priority or "medium", 24)
            result = {
                "estimated_hours": float(est),
                "confidence_range": {"lower_hours": est * 0.5, "upper_hours": est * 2.0},
                "model_version": "rule-based-fallback",
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
            "classify_category": "POST /classify/category",
            "classify_priority": "POST /classify/priority",
            "predict_time": "POST /predict/resolution_time",
            "classify_combined": "POST /classify",
            "classify_legacy": "POST /classify/legacy",
        },
        "documentation": "/docs",
    }


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=ML_SERVICE_HOST,
        port=ML_SERVICE_PORT,
        reload=os.getenv("ML_ENV", "development") == "development",
        log_level="info",
        workers=int(os.getenv("ML_WORKERS", "1")),
    )
