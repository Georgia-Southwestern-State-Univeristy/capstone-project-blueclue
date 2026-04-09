"""
Explainability Module
=====================

Provides SHAP-based (and lightweight keyword-fallback) explanations for every
ML prediction.  Answers the question:
    "Why did the AI choose this category / priority?"

Strategy
--------
* Tree-based models (Random Forest, Gradient Boosting): use ``shap.TreeExplainer``
  which is fast enough for request-time inference.
* Other model types: fall back to ``shap.LinearExplainer`` or ``KernelExplainer``
  (heavier – results are pre-cached via ``ExplanationCache``).
* If SHAP is unavailable (e.g. in a lightweight container), fall back to feature
  importance from the model itself and overlap with IT keyword lists.

Public API
----------
    explainer = ExplainabilityEngine(model, feature_extractor)
    result = explainer.explain(ticket_text, subject=None)
    # result: ExplanationResult

    result.top_features   -> [("windows", 0.32), ("error", 0.18), ...]
    result.summary        -> "Category: Software (85% confident) because: windows, error, application"
    result.to_dict()      -> JSON-serialisable dict
"""

from __future__ import annotations

import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("blueclue.explainability")

# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ExplanationResult:
    """Structured output of a single prediction explanation."""
    prediction: str
    confidence: float
    top_features: List[Tuple[str, float]]       # (feature_name, shap_value)
    all_feature_scores: Dict[str, float] = field(default_factory=dict)
    method: str = "shap"                        # 'shap' | 'feature_importance' | 'keyword'
    low_confidence: bool = False
    confidence_threshold: float = 0.60

    # ---- human-readable summary ----------------------------------------- #

    @property
    def top_keywords(self) -> List[str]:
        """Return just the names of the top contributing features."""
        return [name for name, _ in self.top_features[:5]]

    @property
    def summary(self) -> str:
        """
        Returns a user-facing summary like:
        "Category: Software (85% confident) because: windows, error, application"
        """
        pct = round(self.confidence * 100)
        kw = ", ".join(self.top_keywords[:3]) if self.top_keywords else "unknown"
        flag = " ⚠ low confidence" if self.low_confidence else ""
        return f"{self.prediction} ({pct}% confident) because: {kw}{flag}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "prediction": self.prediction,
            "confidence": round(self.confidence, 4),
            "confidence_pct": round(self.confidence * 100, 1),
            "low_confidence": self.low_confidence,
            "top_features": [
                {"feature": name, "score": round(float(score), 4)}
                for name, score in self.top_features[:5]
            ],
            "summary": self.summary,
            "method": self.method,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Caching helpers
# ─────────────────────────────────────────────────────────────────────────────

class ExplanationCache:
    """Simple LRU-style in-memory cache for explanation results."""

    def __init__(self, max_size: int = 512):
        self._store: Dict[str, ExplanationResult] = {}
        self._order: List[str] = []
        self.max_size = max_size

    def _key(self, text: str, model_type: str) -> str:
        import hashlib
        return hashlib.md5(f"{model_type}:{text[:200]}".encode()).hexdigest()

    def get(self, text: str, model_type: str) -> Optional[ExplanationResult]:
        key = self._key(text, model_type)
        return self._store.get(key)

    def set(self, text: str, model_type: str, result: ExplanationResult):
        key = self._key(text, model_type)
        if key in self._store:
            self._order.remove(key)
        self._store[key] = result
        self._order.append(key)
        if len(self._order) > self.max_size:
            oldest = self._order.pop(0)
            self._store.pop(oldest, None)


# ─────────────────────────────────────────────────────────────────────────────
# Main explainability engine
# ─────────────────────────────────────────────────────────────────────────────

class ExplainabilityEngine:
    """
    Generates SHAP-based explanations for a trained sklearn model.

    Parameters
    ----------
    model : sklearn estimator
        The trained classifier (Random Forest, GradientBoosting, SVM, etc.)
    feature_extractor : FeatureExtractor
        Fitted FeatureExtractor instance used during training.
    model_type : str
        One of 'category', 'priority', 'time' – used for cache keys.
    confidence_threshold : float
        Predictions below this level are flagged as low-confidence.
    """

    def __init__(
        self,
        model,
        feature_extractor,
        model_type: str = "category",
        confidence_threshold: float = 0.60,
        cache_size: int = 512,
    ):
        self.model = model
        self.feature_extractor = feature_extractor
        self.model_type = model_type
        self.confidence_threshold = confidence_threshold
        self._cache = ExplanationCache(max_size=cache_size)

        self._shap_explainer = None
        self._use_shap = False
        self._feature_names: List[str] = []

        self._init_shap()

    # ---- initialisation -------------------------------------------------- #

    def _init_shap(self):
        """Try to initialise a SHAP explainer; fall back gracefully."""
        try:
            import shap  # noqa: F401  # type: ignore[import]
            self._shap_available = True
        except ImportError:
            logger.warning("SHAP not installed – using feature-importance fallback")
            self._shap_available = False
            return

        try:
            # Build a tiny background sample (SHAP needs it for some explainers)
            self._background_data = None
            model_cls = type(self.model).__name__

            if model_cls in (
                "RandomForestClassifier", "GradientBoostingClassifier",
                "ExtraTreesClassifier", "DecisionTreeClassifier",
                "RandomForestRegressor", "GradientBoostingRegressor",
            ):
                import shap  # type: ignore[import]
                self._shap_explainer = shap.TreeExplainer(self.model)
                self._use_shap = True
                logger.info("SHAP TreeExplainer initialised for %s", model_cls)
            else:
                # LinearExplainer or KernelExplainer initialised lazily
                logger.info(
                    "Model type %s: SHAP explainer will be initialised on first call",
                    model_cls,
                )
                self._use_shap = True

        except Exception as exc:
            logger.warning("Could not initialise SHAP explainer: %s", exc)
            self._use_shap = False

    def _get_feature_names(self, features) -> List[str]:
        """Return feature names aligned with the feature matrix columns."""
        if self._feature_names:
            return self._feature_names

        # Try to get names from the feature extractor
        if hasattr(self.feature_extractor, "feature_names"):
            names = self.feature_extractor.feature_names
            if names and len(names) == features.shape[1]:
                self._feature_names = list(names)
                return self._feature_names

        # Try to get TF-IDF vocabulary
        if hasattr(self.feature_extractor, "tfidf_vectorizer") and \
                self.feature_extractor.tfidf_vectorizer is not None:
            vocab = self.feature_extractor.tfidf_vectorizer.get_feature_names_out()
            self._feature_names = list(vocab) + [
                f"meta_{i}" for i in range(features.shape[1] - len(vocab))
            ]
            return self._feature_names

        # Generic names as fallback
        self._feature_names = [f"f{i}" for i in range(features.shape[1])]
        return self._feature_names

    # ---- public API ------------------------------------------------------- #

    def explain(
        self,
        text: str,
        subject: str = "",
        metadata: Optional[Dict] = None,
        prediction: str = "",
        confidence: float = 0.0,
        top_n: int = 5,
    ) -> ExplanationResult:
        """
        Generate an explanation for a single prediction.

        Parameters
        ----------
        text : str
            Ticket description.
        subject : str
            Ticket subject line.
        metadata : dict, optional
            Extra ticket fields passed to the feature extractor.
        prediction : str
            The label predicted by the model (avoids re-running predict).
        confidence : float
            The confidence returned by the model.
        top_n : int
            How many top features to include.

        Returns
        -------
        ExplanationResult
        """
        # Check cache
        cached = self._cache.get(text, self.model_type)
        if cached is not None:
            return cached

        try:
            result = self._explain_internal(
                text, subject, metadata, prediction, confidence, top_n
            )
        except Exception as exc:
            logger.error("Explanation generation failed: %s", exc, exc_info=True)
            result = self._keyword_fallback(text, prediction, confidence)

        self._cache.set(text, self.model_type, result)
        return result

    def get_global_top_features(self, top_n: int = 10) -> Optional[List[Dict[str, Any]]]:
        """
        Return model-level top features by global importance (not per-prediction).
        Uses ``feature_importances_`` (tree models) or mean absolute ``coef_``
        (linear models).  Returns ``None`` if the model exposes neither.
        """
        from datetime import datetime

        try:
            # Build a dummy ticket just to get the feature shape / names
            dummy_ticket = {
                "description": "dummy ticket text",
                "subject": "",
                "created_at": datetime.now().isoformat(),
            }
            features = self.feature_extractor.transform([dummy_ticket])
            names = self._get_feature_names(features)

            if hasattr(self.model, "feature_importances_"):
                importances = self.model.feature_importances_
                scored = sorted(
                    zip(names, importances.tolist()),
                    key=lambda x: x[1],
                    reverse=True,
                )
                return [
                    {"feature": name, "score": round(float(score), 4)}
                    for name, score in scored
                    if score > 1e-5 and re.match(r"^[a-z][a-z_ ]{1,}$", name)
                ][:top_n]

            if hasattr(self.model, "coef_"):
                import numpy as _np
                coef = self.model.coef_
                avg = _np.abs(coef).mean(axis=0) if coef.ndim > 1 else _np.abs(coef[0])
                if len(names) == len(avg):
                    scored = sorted(
                        zip(names, avg.tolist()),
                        key=lambda x: x[1],
                        reverse=True,
                    )
                    return [
                        {"feature": name, "score": round(float(score), 4)}
                        for name, score in scored
                        if score > 1e-5 and re.match(r"^[a-z][a-z_ ]{1,}$", name)
                    ][:top_n]

        except Exception as exc:
            logger.warning("get_global_top_features failed: %s", exc)

        return None

    # ---- internal -------------------------------------------------------- #

    def _explain_internal(
        self,
        text: str,
        subject: str,
        metadata: Optional[Dict],
        prediction: str,
        confidence: float,
        top_n: int,
    ) -> ExplanationResult:
        from datetime import datetime

        ticket = {
            "description": text or "",
            "subject": subject or "",
            "created_at": datetime.now().isoformat(),
        }
        if metadata:
            ticket.update(metadata)

        features = self.feature_extractor.transform([ticket])
        feature_names = self._get_feature_names(features)

        if hasattr(self.model, "coef_"):
            # Linear model: use coefficient × feature_value directly (no stale-background risk)
            return self._linear_coef_explanation(
                features, feature_names, prediction, confidence, top_n
            )
        elif self._use_shap and self._shap_available:
            return self._shap_explanation(
                features, feature_names, prediction, confidence, top_n
            )
        elif hasattr(self.model, "feature_importances_"):
            return self._feature_importance_explanation(
                features, feature_names, text, prediction, confidence, top_n
            )
        else:
            return self._keyword_fallback(text, prediction, confidence)

    def _linear_coef_explanation(
        self,
        features,
        feature_names: List[str],
        prediction: str,
        confidence: float,
        top_n: int,
    ) -> ExplanationResult:
        """
        Explain a linear model (LogisticRegression, Ridge, etc.) by computing
        contribution = coef[class_idx, i] × feature_value[i].

        This is identical to SHAP with a zero-vector background but avoids the
        stale-background pitfall of a lazily-initialised LinearExplainer.
        """
        coef = np.asarray(self.model.coef_)  # (n_classes, n_features) or (1, n_features)

        # Flatten sparse feature matrices to dense
        if hasattr(features, "toarray"):
            feat_arr = features.toarray().flatten()
        else:
            feat_arr = np.asarray(features).flatten()

        # Pick the row of coefficients for the predicted class
        if coef.ndim == 2 and coef.shape[0] > 1:
            classes = list(self.model.classes_) if hasattr(self.model, "classes_") else []
            try:
                class_idx = classes.index(prediction)
            except (ValueError, IndexError):
                class_idx = 0
            w = coef[class_idx]
        else:
            w = coef.flatten()

        # Contribution = coefficient × feature value
        contributions = w * feat_arr

        scored = sorted(
            zip(feature_names, contributions),
            key=lambda x: float(abs(x[1])),
            reverse=True,
        )

        meaningful = [
            (name, score)
            for name, score in scored
            if abs(score) > 1e-4 and re.match(r"^[a-z][a-z_ ]{1,}$", name)
        ]

        top_features = meaningful[:top_n] if meaningful else scored[:top_n]
        all_scores = {name: float(score) for name, score in scored[:50]}

        return ExplanationResult(
            prediction=prediction,
            confidence=confidence,
            top_features=[(n, float(s)) for n, s in top_features],
            all_feature_scores=all_scores,
            method="coef",
            low_confidence=confidence < self.confidence_threshold,
            confidence_threshold=self.confidence_threshold,
        )

    def _shap_explanation(
        self,
        features,
        feature_names: List[str],
        prediction: str,
        confidence: float,
        top_n: int,
    ) -> ExplanationResult:
        import shap  # type: ignore[import]

        try:
            # Initialise explainer lazily for linear/kernel models
            if self._shap_explainer is None:
                model_cls = type(self.model).__name__
                if hasattr(self.model, "coef_"):
                    self._shap_explainer = shap.LinearExplainer(
                        self.model, features, feature_perturbation="interventional"
                    )
                else:
                    self._shap_explainer = shap.KernelExplainer(
                        self.model.predict_proba, features
                    )

            shap_values = self._shap_explainer.shap_values(features)

            # For multi-class models shap_values is a list of arrays (one per class)
            if isinstance(shap_values, list):
                # Use the class that was predicted
                classes = (
                    list(self.model.classes_)
                    if hasattr(self.model, "classes_") else []
                )
                try:
                    class_idx = classes.index(prediction)
                    vals = shap_values[class_idx][0]
                except (ValueError, IndexError):
                    vals = shap_values[0][0]
            else:
                vals = shap_values[0]

            # Ensure vals is a flat 1-D array of Python scalars so that
            # abs() and sorted() work correctly regardless of SHAP version.
            vals = np.asarray(vals).flatten()

            # Pair feature names with absolute SHAP values, sort descending
            scored = sorted(
                zip(feature_names, vals),
                key=lambda x: float(abs(x[1])),
                reverse=True,
            )

            # Filter out very small contributors and non-word tokens
            meaningful = [
                (name, score)
                for name, score in scored
                if abs(score) > 1e-4 and re.match(r"^[a-z][a-z_ ]{1,}$", name)
            ]

            top_features = meaningful[:top_n] if meaningful else scored[:top_n]
            all_scores = {name: float(score) for name, score in scored[:50]}

            return ExplanationResult(
                prediction=prediction,
                confidence=confidence,
                top_features=[(n, float(s)) for n, s in top_features],
                all_feature_scores=all_scores,
                method="shap",
                low_confidence=confidence < self.confidence_threshold,
                confidence_threshold=self.confidence_threshold,
            )

        except Exception as exc:
            logger.warning("SHAP explanation failed, falling back: %s", exc)
            if hasattr(self.model, "feature_importances_"):
                return self._feature_importance_explanation(
                    features, feature_names, "", prediction, confidence, top_n
                )
            return self._keyword_fallback("", prediction, confidence)

    def _feature_importance_explanation(
        self,
        features,
        feature_names: List[str],
        text: str,
        prediction: str,
        confidence: float,
        top_n: int,
    ) -> ExplanationResult:
        """Use model.feature_importances_ (e.g. Random Forest)."""
        importances = self.model.feature_importances_

        # Weight importances by actual feature value for this sample
        feature_vals = np.asarray(features).flatten()
        if len(feature_vals) == len(importances):
            weighted = importances * np.abs(feature_vals)
        else:
            weighted = importances

        scored = sorted(
            zip(feature_names, weighted),
            key=lambda x: x[1],
            reverse=True,
        )

        meaningful = [
            (name, score)
            for name, score in scored
            if score > 1e-5 and re.match(r"^[a-z][a-z_ ]{1,}$", name)
        ]

        top_features = meaningful[:top_n] if meaningful else scored[:top_n]

        return ExplanationResult(
            prediction=prediction,
            confidence=confidence,
            top_features=[(n, float(s)) for n, s in top_features],
            method="feature_importance",
            low_confidence=confidence < self.confidence_threshold,
            confidence_threshold=self.confidence_threshold,
        )

    def _keyword_fallback(
        self, text: str, prediction: str, confidence: float
    ) -> ExplanationResult:
        """
        Last-resort fallback: extract the IT-domain terms present in the text
        and return them as 'keywords'.  No model introspection required.
        """
        IT_TERMS = [
            "network", "wifi", "internet", "vpn", "connection",
            "password", "login", "account", "access", "permission",
            "software", "application", "install", "update", "upgrade",
            "hardware", "computer", "laptop", "monitor", "printer",
            "email", "outlook", "teams", "office", "excel", "word",
            "server", "database", "backup", "restore", "security",
            "windows", "error", "crash", "blue screen", "memory",
            "cpu", "disk", "vpn", "firewall", "dns", "certificate",
        ]
        text_lower = text.lower()
        found = [
            (term, 1.0 / (i + 1))
            for i, term in enumerate(IT_TERMS)
            if term in text_lower
        ]

        return ExplanationResult(
            prediction=prediction,
            confidence=confidence,
            top_features=found[:5],
            method="keyword",
            low_confidence=confidence < self.confidence_threshold,
            confidence_threshold=self.confidence_threshold,
        )
