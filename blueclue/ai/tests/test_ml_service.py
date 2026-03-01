"""
Tests for the BlueClue ML Inference Service
============================================

Run with:  pytest tests/test_ml_service.py -v
"""

import os
import sys
import json
import time
import pytest

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from app import (
    app,
    TTLCache,
    ModelManager,
    MetricsCollector,
    _rule_based_classify,
    ClassifyRequest,
)

# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.fixture
async def client(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# --------------------------------------------------------------------------- #
# Unit tests – TTLCache
# --------------------------------------------------------------------------- #


class TestTTLCache:
    def test_set_and_get(self):
        c = TTLCache(max_size=10, ttl_seconds=60)
        c.set("hello", "endpoint", {"result": 1})
        assert c.get("hello", "endpoint") == {"result": 1}

    def test_miss(self):
        c = TTLCache()
        assert c.get("nonexistent", "x") is None
        assert c.misses == 1

    def test_ttl_expiry(self):
        c = TTLCache(max_size=10, ttl_seconds=0)  # immediate expiry
        c.set("hello", "ep", "value")
        time.sleep(0.01)
        assert c.get("hello", "ep") is None

    def test_eviction(self):
        c = TTLCache(max_size=2, ttl_seconds=60)
        c.set("a", "e", 1)
        c.set("b", "e", 2)
        c.set("c", "e", 3)  # should evict "a"
        assert c.get("a", "e") is None
        assert c.get("b", "e") == 2
        assert c.get("c", "e") == 3

    def test_stats(self):
        c = TTLCache(max_size=10, ttl_seconds=60)
        c.set("x", "e", 1)
        c.get("x", "e")  # hit
        c.get("y", "e")  # miss
        stats = c.stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 1


# --------------------------------------------------------------------------- #
# Unit tests – MetricsCollector
# --------------------------------------------------------------------------- #


class TestMetricsCollector:
    def test_record_and_summary(self):
        m = MetricsCollector()
        m.record_request(latency_ms=10.0, confidence=0.9, category="hardware")
        m.record_request(latency_ms=20.0, confidence=0.5, priority="high")
        m.record_error()

        s = m.summary
        assert s["total_requests"] == 2
        assert s["total_errors"] == 1
        assert s["latency_ms"]["mean"] == 15.0
        assert "hardware" in s["category_distribution"]
        assert "high" in s["priority_distribution"]


# --------------------------------------------------------------------------- #
# Unit tests – Rule-based fallback
# --------------------------------------------------------------------------- #


class TestRuleBasedFallback:
    def test_hardware_classification(self):
        result = _rule_based_classify("My laptop screen is broken")
        assert result["category"] == "hardware"

    def test_network_classification(self):
        result = _rule_based_classify("I can't connect to the wifi")
        assert result["category"] == "network"

    def test_account_classification(self):
        result = _rule_based_classify("I forgot my password and my account is locked")
        assert result["category"] == "account"

    def test_critical_priority(self):
        result = _rule_based_classify("URGENT: production server is down, this is an emergency")
        assert result["priority"] == "critical"

    def test_low_priority(self):
        result = _rule_based_classify("Just a minor cosmetic question about the UI")
        assert result["priority"] == "low"

    def test_default_fallback(self):
        result = _rule_based_classify("something random")
        assert result["fallback"] is True
        assert result["confidence"] == 0.3


# --------------------------------------------------------------------------- #
# Integration tests – API endpoints
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_root(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "BlueClue ML Inference Service"
    assert data["version"] == "2.0.0"
    assert "endpoints" in data


@pytest.mark.anyio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("OK", "DEGRADED")
    assert "models_loaded" in data
    assert "uptime_seconds" in data


@pytest.mark.anyio
async def test_models_info(client):
    resp = await client.get("/models/info")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert "cache_stats" in data


@pytest.mark.anyio
async def test_metrics(client):
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_requests" in data
    assert "latency_ms" in data


@pytest.mark.anyio
async def test_classify_category(client):
    resp = await client.post("/classify/category", json={"text": "My laptop screen is cracked"})
    assert resp.status_code == 200
    data = resp.json()
    assert "category" in data
    assert "confidence" in data
    assert "model_version" in data


@pytest.mark.anyio
async def test_classify_priority(client):
    resp = await client.post("/classify/priority", json={
        "text": "URGENT: the server is completely down",
        "category": "network",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "priority" in data
    assert "confidence" in data


@pytest.mark.anyio
async def test_predict_resolution_time(client):
    resp = await client.post("/predict/resolution_time", json={
        "text": "Need to install new software on 5 machines",
        "category": "software",
        "priority": "medium",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "estimated_hours" in data
    assert "confidence_range" in data


@pytest.mark.anyio
async def test_classify_combined(client):
    resp = await client.post("/classify", json={"text": "WiFi keeps dropping in the conference room"})
    assert resp.status_code == 200
    data = resp.json()
    assert "category" in data
    assert "priority" in data
    assert "confidence" in data
    assert "model_versions" in data


@pytest.mark.anyio
async def test_classify_legacy(client):
    resp = await client.post("/classify/legacy", json={"text": "I can't print anything"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "classification" in data
    assert "timestamp" in data


# ---- Validation tests --------------------------------------------------- #


@pytest.mark.anyio
async def test_empty_text_rejected(client):
    resp = await client.post("/classify/category", json={"text": ""})
    assert resp.status_code == 422  # Pydantic validation error


@pytest.mark.anyio
async def test_missing_text_rejected(client):
    resp = await client.post("/classify/category", json={})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_legacy_missing_text(client):
    resp = await client.post("/classify/legacy", json={"text": ""})
    assert resp.status_code == 400


# ---- Cache hit test ------------------------------------------------------ #


@pytest.mark.anyio
async def test_cache_hit(client):
    """Second identical request should return cached result."""
    payload = {"text": "My keyboard is not working properly"}
    resp1 = await client.post("/classify/category", json=payload)
    resp2 = await client.post("/classify/category", json=payload)
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["category"] == resp2.json()["category"]
