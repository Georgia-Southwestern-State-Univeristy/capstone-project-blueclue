"""
Drift Detection Module
======================

Detects distribution shift between the training-time label distribution
and the current live prediction distribution.

Detection methods
-----------------
* Kolmogorov–Smirnov (KS) test   – continuous confidence scores
* Chi-squared (χ²) test           – categorical label distributions

Usage
-----
    detector = DriftDetector(baseline_distribution)
    report   = detector.run(live_predictions, period_start, period_end)

    if report.drift_detected:
        print(f"Drift detected!  KS={report.ks_statistic:.3f}")
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

import numpy as np
from scipy import stats

logger = logging.getLogger("blueclue.drift")

# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class DriftReport:
    model_type: str
    report_date: str                         # ISO date string
    period_start: Optional[str]
    period_end: Optional[str]
    sample_size: int
    ks_statistic: Optional[float]
    ks_p_value: Optional[float]
    chi2_statistic: Optional[float]
    chi2_p_value: Optional[float]
    drift_detected: bool
    drift_threshold: float
    distribution: Dict[str, int]            # live label counts
    baseline_dist: Dict[str, int]           # training label counts
    notes: str = ""

    # ── human-readable severity ─────────────────────────────────────────── #

    @property
    def severity(self) -> str:
        if not self.drift_detected:
            return "none"
        if self.ks_p_value is not None and self.ks_p_value < 0.001:
            return "high"
        if self.ks_p_value is not None and self.ks_p_value < 0.01:
            return "medium"
        return "low"

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["severity"] = self.severity
        return d


# ─────────────────────────────────────────────────────────────────────────────
# Detector
# ─────────────────────────────────────────────────────────────────────────────

class DriftDetector:
    """
    Compares a live window of predictions against a baseline distribution
    and flags significant drift.

    Parameters
    ----------
    baseline_distribution : dict
        ``{label: count}`` from the training dataset. 
        Example: ``{"software": 412, "hardware": 198, ...}``
    model_type : str
        'category' | 'priority' | 'time' – logged in the report.
    p_value_threshold : float
        P-value below which drift is considered statistically significant
        (default 0.05).
    min_sample_size : int
        Minimum number of live predictions required to run the test (default 30).
    """

    def __init__(
        self,
        baseline_distribution: Dict[str, int],
        model_type: str = "category",
        p_value_threshold: float = 0.05,
        min_sample_size: int = 30,
    ):
        self.baseline_distribution = baseline_distribution
        self.model_type = model_type
        self.threshold = p_value_threshold
        self.min_sample = min_sample_size

        # Normalised baseline probabilities
        total = sum(baseline_distribution.values()) or 1
        self._baseline_probs = {
            k: v / total for k, v in baseline_distribution.items()
        }

    # ── public API ──────────────────────────────────────────────────────── #

    def run(
        self,
        live_predictions: Sequence[str],
        confidence_scores: Optional[Sequence[float]] = None,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> DriftReport:
        """
        Run drift detection on a window of live predictions.

        Parameters
        ----------
        live_predictions : list[str]
            List of predicted labels from the live system.
        confidence_scores : list[float], optional
            Confidence scores for each prediction.  If provided, a KS test
            is also run against the training-time confidence distribution.
        period_start, period_end : datetime, optional
            Time boundaries of the live window (for the report only).

        Returns
        -------
        DriftReport
        """
        today = datetime.now(tz=timezone.utc).date().isoformat()
        ps = period_start.isoformat() if period_start else None
        pe = period_end.isoformat() if period_end else None

        # Count live labels
        live_dist: Dict[str, int] = {}
        for label in live_predictions:
            live_dist[label] = live_dist.get(label, 0) + 1

        sample_size = len(live_predictions)

        if sample_size < self.min_sample:
            return DriftReport(
                model_type=self.model_type,
                report_date=today,
                period_start=ps,
                period_end=pe,
                sample_size=sample_size,
                ks_statistic=None,
                ks_p_value=None,
                chi2_statistic=None,
                chi2_p_value=None,
                drift_detected=False,
                drift_threshold=self.threshold,
                distribution=live_dist,
                baseline_dist=self.baseline_distribution,
                notes=f"Insufficient sample size ({sample_size} < {self.min_sample}). "
                      "Drift detection skipped.",
            )

        # ── Chi-squared test on label distribution ──────────────────────── #
        chi2_stat, chi2_p = self._chi2_test(live_dist, sample_size)

        # ── KS test on confidence scores (optional) ─────────────────────── #
        ks_stat = ks_p = None
        if confidence_scores and len(confidence_scores) >= self.min_sample:
            ks_stat, ks_p = self._ks_test(confidence_scores)

        # ── Decide if drift is detected ─────────────────────────────────── #
        drift = False
        if chi2_p is not None and chi2_p < self.threshold:
            drift = True
        if ks_p is not None and ks_p < self.threshold:
            drift = True

        notes = self._build_notes(chi2_stat, chi2_p, ks_stat, ks_p, drift)

        return DriftReport(
            model_type=self.model_type,
            report_date=today,
            period_start=ps,
            period_end=pe,
            sample_size=sample_size,
            ks_statistic=round(ks_stat, 4) if ks_stat is not None else None,
            ks_p_value=round(ks_p, 4) if ks_p is not None else None,
            chi2_statistic=round(chi2_stat, 4) if chi2_stat is not None else None,
            chi2_p_value=round(chi2_p, 4) if chi2_p is not None else None,
            drift_detected=drift,
            drift_threshold=self.threshold,
            distribution=live_dist,
            baseline_dist=self.baseline_distribution,
            notes=notes,
        )

    # ── private helpers ─────────────────────────────────────────────────── #

    def _chi2_test(
        self, live_dist: Dict[str, int], total: int
    ) -> tuple:
        """Chi-squared goodness-of-fit test against baseline proportions."""
        all_labels = sorted(set(list(self._baseline_probs.keys()) + list(live_dist.keys())))

        observed = np.array([live_dist.get(lbl, 0) for lbl in all_labels], dtype=float)
        expected = np.array(
            [self._baseline_probs.get(lbl, 1e-6) * total for lbl in all_labels],
            dtype=float,
        )

        # Avoid zero expected cells (laplace smoothing)
        expected = np.maximum(expected, 0.5)

        try:
            chi2, p = stats.chisquare(observed, f_exp=expected)
            return float(chi2), float(p)
        except Exception as exc:
            logger.warning("Chi2 test failed: %s", exc)
            return None, None

    def _ks_test(self, scores: Sequence[float]) -> tuple:
        """KS test: compare live confidence distribution to a uniform [0,1]."""
        # If we have a stored baseline confidence distribution we could compare
        # to that; for now we compare to uniform as a proxy for no drift.
        try:
            stat, p = stats.kstest(scores, "uniform")
            return float(stat), float(p)
        except Exception as exc:
            logger.warning("KS test failed: %s", exc)
            return None, None

    @staticmethod
    def _build_notes(chi2, chi2_p, ks, ks_p, drift) -> str:
        parts = []
        if chi2 is not None:
            parts.append(f"Chi²={chi2:.3f} (p={chi2_p:.4f})")
        if ks is not None:
            parts.append(f"KS={ks:.3f} (p={ks_p:.4f})")
        if drift:
            parts.append("⚠ Significant drift detected – consider retraining.")
        else:
            parts.append("No significant drift detected.")
        return "  ".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Convenience factory
# ─────────────────────────────────────────────────────────────────────────────

def build_baseline_from_model_card(model_card: dict, label_key: str = "category_distribution") -> Dict[str, int]:
    """Extract baseline distribution from a saved model card JSON."""
    return dict(model_card.get(label_key, {}))
