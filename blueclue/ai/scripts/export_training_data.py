#!/usr/bin/env python
"""
Training Data Export Script
============================

Exports ticket data from PostgreSQL into the ML training dataset format.
Designed to be run weekly to keep the training data fresh.

Usage:
    # Export last 90 days of tickets
    python scripts/export_training_data.py

    # Export since a specific date
    python scripts/export_training_data.py --since 2026-01-01

    # Preview without writing files
    python scripts/export_training_data.py --dry-run

Environment Variables:
    DATABASE_URL   PostgreSQL connection string (e.g. postgresql://user:pw@host/db)
    DB_HOST        Database host (alternative to DATABASE_URL)
    DB_PORT        Database port (default: 5432)
    DB_NAME        Database name
    DB_USER        Database user
    DB_PASSWORD    Database password

Output:
    Appends new records to:
        ../data/raw/tickets_exported.jsonl   (one JSON object per line)
    Writes a manifest file:
        ../data/raw/export_manifest.json
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add parent dir to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger("export_training_data")

RAW_DATA_DIR = BASE_DIR / "data" / "raw"
EXPORT_FILE = RAW_DATA_DIR / "tickets_exported.jsonl"
MANIFEST_FILE = RAW_DATA_DIR / "export_manifest.json"

# ─────────────────────────────────────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_db_connection():
    """Return a psycopg2 connection using environment variables."""
    import psycopg2

    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "blueclue"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        connect_timeout=10,
    )


EXPORT_QUERY = """
SELECT
    t.id,
    t.ticket_number,
    t.subject,
    t.description,
    t.status,
    t.category::TEXT                          AS category,
    t.priority::TEXT                          AS priority,
    t.created_at,
    t.updated_at,
    t.resolved_at,
    -- Resolution time in hours
    EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600.0
                                              AS resolution_hours,
    -- User override info via feedback table
    fb.category_overridden,
    fb.user_category                          AS final_category,
    fb.priority_overridden,
    fb.user_priority                          AS final_priority,
    fb.override_reason,
    -- AI prediction info
    ac.predicted_category,
    ac.predicted_priority,
    ac.confidence                             AS ai_confidence,
    ac.fallback_used
FROM tickets t
LEFT JOIN ml_prediction_feedback fb ON fb.ticket_id = t.id
LEFT JOIN ai_classifications      ac ON ac.ticket_id = t.id
WHERE t.created_at >= %(since)s
  AND t.deleted_at IS NULL
  AND t.category IS NOT NULL
  AND t.priority IS NOT NULL
ORDER BY t.created_at ASC
"""


def export_tickets(since: datetime, conn) -> List[Dict[str, Any]]:
    """Query ticket data since the given date."""
    with conn.cursor() as cur:
        cur.execute(EXPORT_QUERY, {"since": since})
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    records = []
    for row in rows:
        rec = dict(zip(columns, row))
        # Use user-overridden labels if available, otherwise AI/actual labels
        rec["effective_category"] = (
            rec.get("user_category") or rec.get("category") or rec.get("predicted_category")
        )
        rec["effective_priority"] = (
            rec.get("user_priority") or rec.get("priority") or rec.get("predicted_priority")
        )
        # Serialise datetimes
        for k in list(rec.keys()):
            if hasattr(rec[k], "isoformat"):
                rec[k] = rec[k].isoformat()
        records.append(rec)

    return records


# ─────────────────────────────────────────────────────────────────────────────
# Manifest helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_manifest() -> Dict[str, Any]:
    if MANIFEST_FILE.exists():
        try:
            with open(MANIFEST_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_export": None, "total_records": 0, "exports": []}


def save_manifest(manifest: Dict[str, Any]):
    with open(MANIFEST_FILE, "w") as f:
        json.dump(manifest, f, indent=2, default=str)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def run_export(since: Optional[datetime] = None, dry_run: bool = False) -> int:
    manifest = load_manifest()

    if since is None:
        if manifest["last_export"]:
            # Pick up where we left off
            since = datetime.fromisoformat(manifest["last_export"])
            logger.info("Resuming from last export date: %s", since.date())
        else:
            since = datetime.now(tz=timezone.utc) - timedelta(days=90)
            logger.info("No previous export found – exporting last 90 days")

    logger.info("Connecting to database …")
    try:
        conn = get_db_connection()
    except Exception as exc:
        logger.error("Cannot connect to database: %s", exc)
        raise

    try:
        logger.info("Exporting tickets since %s …", since.date())
        records = export_tickets(since, conn)
        logger.info("Found %d records", len(records))

        if not records:
            logger.info("Nothing new to export")
            return 0

        if dry_run:
            logger.info("DRY RUN – not writing any files")
            for rec in records[:3]:
                logger.info("  Sample: ticket=%s cat=%s pri=%s",
                            rec.get("ticket_number"),
                            rec.get("effective_category"),
                            rec.get("effective_priority"))
            return len(records)

        # Append to JSONL file
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(EXPORT_FILE, "a", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, default=str) + "\n")

        logger.info("Written %d records to %s", len(records), EXPORT_FILE)

        # Update manifest
        manifest["last_export"] = datetime.now(tz=timezone.utc).isoformat()
        manifest["total_records"] = manifest.get("total_records", 0) + len(records)
        manifest.setdefault("exports", []).append({
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "since": since.isoformat(),
            "records": len(records),
        })
        save_manifest(manifest)
        logger.info("Manifest updated")

        return len(records)

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Export ML training data from PostgreSQL")
    parser.add_argument("--since", type=str, default=None,
                        help="Export tickets since this ISO date (default: auto from manifest)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview without writing files")
    parser.add_argument("--days", type=int, default=None,
                        help="Export the last N days (overrides --since)")
    args = parser.parse_args()

    since = None
    if args.days:
        since = datetime.now(tz=timezone.utc) - timedelta(days=args.days)
    elif args.since:
        since = datetime.fromisoformat(args.since)
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

    count = run_export(since=since, dry_run=args.dry_run)
    logger.info("Export complete – %d records", count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
