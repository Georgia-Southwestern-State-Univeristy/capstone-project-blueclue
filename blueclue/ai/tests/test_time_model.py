"""
Tests for the Resolution Time Prediction Model (v2)
====================================================

Covers:
  - TimeFeatureExtractor metadata feature extraction (including new v2 features)
  - Uncertainty label generation in predict_time / /predict/resolution_time
  - API endpoint contract for /predict/resolution_time
  - Edge-case handling (missing fields, zero workload, off-hours, weekends)

Run with:
    pytest tests/test_time_model.py -v
"""

import os
import sys
import math
from datetime import datetime, timezone, timedelta

import pytest
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.train_time_model import TimeFeatureExtractor, PRIORITY_TIME_FACTORS
from httpx import AsyncClient, ASGITransport
from app import app


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_ticket(**overrides):
    """Return a minimal valid ticket dict with sensible defaults."""
    base = {
        "subject": "Keyboard not working",
        "description": "The keyboard stopped responding after the latest update.",
        "category": "hardware",
        "priority": "medium",
        "created_at": "2026-04-02T10:00:00Z",
        "ai_confidence": 0.85,
        "user_previous_tickets": 3,
        "comment_count": 2,
        "reopen_count": 0,
        "technician_workload": 5,
    }
    base.update(overrides)
    return base


def _make_fitted_extractor(n=15):
    """Return an extractor fitted on synthetic tickets."""
    tickets = [_make_ticket(
        priority=["low", "medium", "high", "critical"][i % 4],
        category=["hardware", "software", "network", "account"][i % 4],
        time_to_resolution_hours=float((i + 1) * 4),
        technician_workload=i % 10,
    ) for i in range(n)]
    extractor = TimeFeatureExtractor(max_tfidf_features=50, use_log_transform=True)
    extractor.fit(tickets)
    return extractor, tickets


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests – TimeFeatureExtractor metadata features
# ─────────────────────────────────────────────────────────────────────────────

class TestMetadataFeatures:
    """Verify _extract_metadata_features produces correct values."""

    def test_priority_factor_critical(self):
        ticket = _make_ticket(priority="critical")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        # Priority factor is the first element
        assert feats[0] == PRIORITY_TIME_FACTORS["critical"]

    def test_priority_factor_low(self):
        ticket = _make_ticket(priority="low")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        assert feats[0] == PRIORITY_TIME_FACTORS["low"]

    def test_priority_factor_unknown_defaults_to_medium(self):
        ticket = _make_ticket(priority="blastoff")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        assert feats[0] == PRIORITY_TIME_FACTORS.get("blastoff", 1.0)

    def test_ai_confidence_normalized(self):
        ticket = _make_ticket(ai_confidence=0.95)
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        assert feats[1] == pytest.approx(0.95)

    def test_ai_confidence_defaults_to_half(self):
        ticket = _make_ticket()
        del ticket["ai_confidence"]
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        assert feats[1] == pytest.approx(0.5)

    def test_business_hours_flag(self):
        """10:00 on a weekday should be classified as business hours (1.0)."""
        ticket = _make_ticket(created_at="2026-04-01T10:30:00Z")  # Wednesday
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        # business_hours is at index 7 (after priority_factor, ai_confidence,
        # user_tickets, text_len, word_count, questions, sentences)
        business_hours_idx = 7
        assert feats[business_hours_idx] == 1.0

    def test_off_hours_flag(self):
        """02:00 AM should be off-hours (0.5)."""
        ticket = _make_ticket(created_at="2026-04-01T02:00:00Z")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        business_hours_idx = 7
        assert feats[business_hours_idx] == 0.5

    # ── New v2 features ────────────────────────────────────────────────────

    def test_day_of_week_monday(self):
        """Monday = 0, normalized to 0.0."""
        # 2026-03-30 is a Monday
        ticket = _make_ticket(created_at="2026-03-30T09:00:00Z")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        # day_of_week is index 10 (business_hours=7, is_weekend=8, hour_of_day=9, day_of_week=10)
        day_idx = 10
        assert feats[day_idx] == pytest.approx(0 / 6.0)

    def test_day_of_week_sunday(self):
        """Sunday = 6, normalized to 1.0."""
        # 2026-04-05 is a Sunday
        ticket = _make_ticket(created_at="2026-04-05T12:00:00Z")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        day_idx = 10
        assert feats[day_idx] == pytest.approx(6 / 6.0)

    def test_technician_workload_present(self):
        """technician_workload=10 should produce 10/20 = 0.5."""
        ticket = _make_ticket(technician_workload=10)
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        # technician_workload is the last feature
        assert feats[-1] == pytest.approx(10 / 20.0)

    def test_technician_workload_zero(self):
        ticket = _make_ticket(technician_workload=0)
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        assert feats[-1] == pytest.approx(0.0)

    def test_technician_workload_missing_defaults_zero(self):
        ticket = _make_ticket()
        del ticket["technician_workload"]
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        assert feats[-1] == pytest.approx(0.0)

    def test_technician_workload_high(self):
        """Workload > 20 should still produce a finite positive number."""
        ticket = _make_ticket(technician_workload=40)
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        assert feats[-1] == pytest.approx(40 / 20.0)

    def test_feature_vector_length_consistent(self):
        """All tickets should produce the same metadata vector length."""
        e = TimeFeatureExtractor()
        lengths = {
            len(e._extract_metadata_features(_make_ticket(technician_workload=0))),
            len(e._extract_metadata_features(_make_ticket(technician_workload=5))),
            len(e._extract_metadata_features(_make_ticket(created_at=""))),
        }
        assert len(lengths) == 1, "Metadata feature length must be consistent"

    def test_missing_created_at_uses_defaults(self):
        """A missing created_at should not raise and should fill in 0.5 defaults."""
        ticket = _make_ticket(created_at="")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        # business_hours, is_weekend, hour_of_day, day_of_week all default to 0.5
        business_hours_idx = 7
        assert feats[business_hours_idx] == 0.5

    def test_corrupted_created_at_uses_defaults(self):
        ticket = _make_ticket(created_at="not-a-date")
        extractor = TimeFeatureExtractor()
        feats = extractor._extract_metadata_features(ticket)
        business_hours_idx = 7
        assert feats[business_hours_idx] == 0.5


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests – TimeFeatureExtractor.fit() / feature names
# ─────────────────────────────────────────────────────────────────────────────

class TestFeatureExtractorFit:
    def test_fit_registers_v2_feature_names(self):
        extractor, _ = _make_fitted_extractor()
        assert "day_of_week" in extractor.feature_names
        assert "technician_workload" in extractor.feature_names

    def test_fit_feature_name_count_matches_transform(self):
        extractor, tickets = _make_fitted_extractor()
        X = extractor.transform(tickets[:1])
        assert X.shape[1] == len(extractor.feature_names)

    def test_fit_then_transform_no_error(self):
        extractor, tickets = _make_fitted_extractor()
        X = extractor.transform(tickets)
        assert X.shape[0] == len(tickets)
        assert not np.isnan(X).any(), "Feature matrix must not contain NaN"
        assert not np.isinf(X).any(), "Feature matrix must not contain Inf"

    def test_categories_and_priorities_captured(self):
        extractor, _ = _make_fitted_extractor()
        assert "hardware" in extractor.categories
        assert "medium" in extractor.priorities

    def test_unknown_category_at_transform_time(self):
        """Unknown category at transform time should not raise."""
        extractor, _ = _make_fitted_extractor()
        unknown_ticket = _make_ticket(category="unknown_new_category")
        X = extractor.transform([unknown_ticket])
        assert X.shape[0] == 1

    def test_extract_target_log_transforms(self):
        ticket = _make_ticket(time_to_resolution_hours=10.0)
        extractor = TimeFeatureExtractor(use_log_transform=True)
        targets = extractor.extract_target([ticket], transform=True)
        assert targets[0] == pytest.approx(np.log1p(10.0))

    def test_inverse_transform_roundtrip(self):
        extractor = TimeFeatureExtractor(use_log_transform=True)
        original = np.array([4.0, 24.0, 72.0])
        transformed = np.log1p(original)
        recovered = extractor.inverse_transform_target(transformed)
        np.testing.assert_allclose(recovered, original, rtol=1e-6)


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests – Uncertainty label helper (tested via API layer)
# ─────────────────────────────────────────────────────────────────────────────

class TestUncertaintyLabel:
    """
    The uncertainty label is generated inside ModelManager.predict_time().
    We test its shape and content via the rule-based fallback path which is
    always active (no model file required).
    """

    @pytest.fixture
    def anyio_backend(self):
        return "asyncio"

    @pytest.fixture
    async def client(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    @pytest.mark.anyio
    async def test_uncertainty_label_present(self, client):
        resp = await client.post("/predict/resolution_time", json={
            "text": "Cannot connect to the database server",
            "category": "technical",
            "priority": "high",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "uncertainty_label" in data, "Response must include uncertainty_label"

    @pytest.mark.anyio
    async def test_uncertainty_label_not_empty(self, client):
        resp = await client.post("/predict/resolution_time", json={
            "text": "Printer offline after firmware update",
            "priority": "medium",
        })
        assert resp.status_code == 200
        label = resp.json().get("uncertainty_label", "")
        assert label, "uncertainty_label must be a non-empty string"

    @pytest.mark.anyio
    async def test_uncertainty_label_contains_dash(self, client):
        """Label must express a range (e.g. '2–4 hours' or '1–2 days')."""
        resp = await client.post("/predict/resolution_time", json={
            "text": "Server room temperature alarm is going off",
            "priority": "critical",
        })
        assert resp.status_code == 200
        label = resp.json().get("uncertainty_label", "")
        assert "–" in label or "-" in label, f"Expected a range in label, got: {label!r}"

    @pytest.mark.anyio
    async def test_uncertainty_label_low_priority_shows_longer_range(self, client):
        """Low priority fallback is 48 h; label range upper bound should reflect that."""
        resp = await client.post("/predict/resolution_time", json={
            "text": "Minor cosmetic tweak for the admin UI",
            "priority": "low",
        })
        assert resp.status_code == 200
        data = resp.json()
        # Fallback: est=48, lower=24, upper=96 → "1 day – 4 days"
        assert data["estimated_hours"] == pytest.approx(48.0)
        label = data["uncertainty_label"]
        assert "day" in label.lower() or "hour" in label.lower()

    @pytest.mark.anyio
    async def test_confidence_range_bounds_consistent(self, client):
        """confidence_range lower must be <= estimated_hours <= upper."""
        resp = await client.post("/predict/resolution_time", json={
            "text": "My account was locked out",
            "priority": "medium",
        })
        assert resp.status_code == 200
        data = resp.json()
        lower = data["confidence_range"]["lower_hours"]
        upper = data["confidence_range"]["upper_hours"]
        estimated = data["estimated_hours"]
        assert lower <= estimated <= upper, (
            f"Expected lower ({lower}) <= estimated ({estimated}) <= upper ({upper})"
        )

    @pytest.mark.anyio
    async def test_model_version_in_response(self, client):
        resp = await client.post("/predict/resolution_time", json={
            "text": "Need projector in meeting room 3",
            "priority": "low",
        })
        assert resp.status_code == 200
        assert resp.json().get("model_version"), "model_version must be present and non-empty"


# ─────────────────────────────────────────────────────────────────────────────
# Integration tests – /predict/resolution_time endpoint contract
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.anyio
async def test_resolution_time_with_metadata(client):
    """metadata dict (including technician_workload) should be accepted."""
    resp = await client.post("/predict/resolution_time", json={
        "text": "Need software installed on 10 laptops",
        "category": "software",
        "priority": "medium",
        "metadata": {
            "technician_workload": 8,
            "reopen_count": 1,
            "comment_count": 3,
        },
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["estimated_hours"] > 0
    assert data["confidence_range"]["lower_hours"] > 0
    assert data["confidence_range"]["upper_hours"] > data["confidence_range"]["lower_hours"]


@pytest.mark.anyio
async def test_resolution_time_all_priorities(client):
    """All four priority levels should produce a valid response."""
    for priority in ("critical", "high", "medium", "low"):
        resp = await client.post("/predict/resolution_time", json={
            "text": "Generic support request",
            "priority": priority,
        })
        assert resp.status_code == 200, f"Failed for priority={priority}"
        data = resp.json()
        assert data["estimated_hours"] > 0
        assert data["uncertainty_label"]


@pytest.mark.anyio
async def test_resolution_time_minimum_clamped(client):
    """Estimated hours must never be below 0.5 (clamp floor)."""
    # Empty short description forces minimal features
    resp = await client.post("/predict/resolution_time", json={
        "text": "ok",
        "priority": "critical",
    })
    assert resp.status_code == 200
    assert resp.json()["estimated_hours"] >= 0.5


@pytest.mark.anyio
async def test_resolution_time_validation_empty_text(client):
    resp = await client.post("/predict/resolution_time", json={"text": ""})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_resolution_time_validation_missing_text(client):
    resp = await client.post("/predict/resolution_time", json={"priority": "medium"})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_resolution_time_cache_hit(client):
    """Two identical requests should return identical results (cache)."""
    payload = {
        "text": "Repeated identical ticket for cache test",
        "category": "hardware",
        "priority": "medium",
    }
    r1 = await client.post("/predict/resolution_time", json=payload)
    r2 = await client.post("/predict/resolution_time", json=payload)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["estimated_hours"] == r2.json()["estimated_hours"]


@pytest.mark.anyio
async def test_resolution_time_different_workloads_handled(client):
    """High vs zero technician workload should both succeed."""
    for workload in (0, 20, 50):
        resp = await client.post("/predict/resolution_time", json={
            "text": "Deploy new version to production",
            "category": "software",
            "priority": "high",
            "metadata": {"technician_workload": workload},
        })
        assert resp.status_code == 200, f"Failed for technician_workload={workload}"
