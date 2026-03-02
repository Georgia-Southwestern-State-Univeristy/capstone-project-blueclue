"""
Load test script for the BlueClue ML Inference Service.
Target: 100 req/min sustained, <200ms p95 latency.

Usage:
    python tests/test_load.py                     # default: 100 requests
    python tests/test_load.py --requests 500      # custom count
    python tests/test_load.py --concurrency 10    # 10 concurrent workers
"""

import argparse
import asyncio
import statistics
import time
import sys

import httpx

BASE_URL = "http://localhost:5000"

SAMPLE_TICKETS = [
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


async def send_request(client: httpx.AsyncClient, text: str) -> dict:
    """Send one classification request and return timing info."""
    t0 = time.perf_counter()
    try:
        resp = await client.post(f"{BASE_URL}/classify", json={"text": text}, timeout=10.0)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {"status": resp.status_code, "latency_ms": latency_ms, "error": None}
    except Exception as e:
        latency_ms = (time.perf_counter() - t0) * 1000
        return {"status": 0, "latency_ms": latency_ms, "error": str(e)}


async def run_load_test(total_requests: int, concurrency: int):
    """Run the load test."""
    print(f"\n{'='*60}")
    print(f"BlueClue ML Service Load Test")
    print(f"{'='*60}")
    print(f"Target URL:    {BASE_URL}/classify")
    print(f"Total requests: {total_requests}")
    print(f"Concurrency:    {concurrency}")
    print(f"{'='*60}\n")

    # Check health first
    async with httpx.AsyncClient() as client:
        try:
            health = await client.get(f"{BASE_URL}/health", timeout=5.0)
            print(f"Health check: {health.status_code} - {health.json().get('status', 'unknown')}\n")
        except Exception as e:
            print(f"ERROR: ML service unreachable at {BASE_URL}: {e}")
            sys.exit(1)

    results = []
    semaphore = asyncio.Semaphore(concurrency)

    async def bounded_request(client, text):
        async with semaphore:
            return await send_request(client, text)

    start_time = time.perf_counter()

    async with httpx.AsyncClient() as client:
        tasks = []
        for i in range(total_requests):
            text = SAMPLE_TICKETS[i % len(SAMPLE_TICKETS)]
            tasks.append(bounded_request(client, text))
        results = await asyncio.gather(*tasks)

    total_time = time.perf_counter() - start_time

    # Analyze results
    latencies = [r["latency_ms"] for r in results if r["error"] is None]
    errors = [r for r in results if r["error"] is not None]
    status_codes = {}
    for r in results:
        sc = r["status"]
        status_codes[sc] = status_codes.get(sc, 0) + 1

    print(f"\nResults:")
    print(f"{'-'*60}")
    print(f"Total time:        {total_time:.2f}s")
    print(f"Successful:        {len(latencies)}/{total_requests}")
    print(f"Errors:            {len(errors)}")
    print(f"Throughput:        {total_requests / total_time:.1f} req/s "
          f"({total_requests / total_time * 60:.0f} req/min)")

    if latencies:
        latencies.sort()
        print(f"\nLatency (ms):")
        print(f"  Mean:   {statistics.mean(latencies):.1f}")
        print(f"  Median: {statistics.median(latencies):.1f}")
        print(f"  p95:    {latencies[int(len(latencies) * 0.95)]:.1f}")
        print(f"  p99:    {latencies[int(len(latencies) * 0.99)]:.1f}")
        print(f"  Min:    {min(latencies):.1f}")
        print(f"  Max:    {max(latencies):.1f}")

    print(f"\nStatus codes: {status_codes}")

    # Pass/Fail against targets
    print(f"\n{'='*60}")
    print("PASS/FAIL Criteria:")

    throughput = total_requests / total_time * 60
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else float("inf")

    if throughput >= 100:
        print(f"  [PASS] Throughput: {throughput:.0f} req/min >= 100 req/min")
    else:
        print(f"  [FAIL] Throughput: {throughput:.0f} req/min < 100 req/min")

    if p95 < 300:
        print(f"  [PASS] p95 latency: {p95:.1f}ms < 300ms")
    else:
        print(f"  [FAIL] p95 latency: {p95:.1f}ms >= 300ms")

    error_rate = len(errors) / total_requests * 100
    if error_rate < 1:
        print(f"  [PASS] Error rate: {error_rate:.2f}% < 1%")
    else:
        print(f"  [FAIL] Error rate: {error_rate:.2f}% >= 1%")

    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load test for BlueClue ML Service")
    parser.add_argument("--requests", type=int, default=100, help="Total requests")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent workers")
    args = parser.parse_args()

    asyncio.run(run_load_test(args.requests, args.concurrency))
