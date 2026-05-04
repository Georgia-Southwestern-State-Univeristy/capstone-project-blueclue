"""
augment_external_data.py
------------------------
Converts two external CSV datasets into BluClue training format:
  - synthetic_it_support_tickets (2).csv  (100k rows, has initial_message text)
  - Support_tickets.csv                   (50k rows, metadata only — text generated)

Output: blueclue/ai/data/raw/augmented_external_tickets.csv
Columns: subject, description, category, priority

50% of rows get casual/natural user language.
50% keep / get structured professional language.

Usage:
    python scripts/augment_external_data.py
    python scripts/augment_external_data.py --file1 path/to/file1.csv --file2 path/to/file2.csv
    python scripts/augment_external_data.py --limit 20000   # cap rows per source
"""

import csv
import random
import re
import argparse
import os
import sys

random.seed(42)

# ── Output path ────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR    = os.path.dirname(SCRIPT_DIR)   # blueclue/ai/
OUT_PATH    = os.path.join(BASE_DIR, "data", "raw", "augmented_external_tickets.csv")

# ── Default input paths ────────────────────────────────────────────────────────
DEFAULT_FILE1 = r"C:\Users\thomas.newcomb\Downloads\synthetic_it_support_tickets (2).csv"
DEFAULT_FILE2 = r"C:\Users\thomas.newcomb\Downloads\Support_tickets.csv"

# ── Category maps ──────────────────────────────────────────────────────────────
# File 1: product_area + issue_type -> category
FILE1_CAT_MAP = {
    ("login_auth",          "account_access"):    "login",
    ("login_auth",          "security_concern"):  "login",
    ("login_auth",          "how_to"):            "login",
    ("login_auth",          "bug"):               "login",
    ("login_auth",          "performance"):       "login",
    ("login_auth",          "feature_request"):   "feature_request",
    ("login_auth",          "other"):             "login",
    ("billing",             "billing_problem"):   "billing",
    ("billing",             "account_access"):    "account",
    ("billing",             "security_concern"):  "account",
    ("billing",             "feature_request"):   "feature_request",
    ("billing",             "how_to"):            "feature_request",
    ("billing",             "bug"):               "billing",
    ("billing",             "performance"):       "billing",
    ("billing",             "other"):             "billing",
    ("mobile_app",          "bug"):               "software",
    ("mobile_app",          "performance"):       "software",
    ("mobile_app",          "account_access"):    "login",
    ("mobile_app",          "feature_request"):   "feature_request",
    ("mobile_app",          "how_to"):            "feature_request",
    ("mobile_app",          "security_concern"):  "account",
    ("mobile_app",          "other"):             "software",
    ("api_integration",     "bug"):               "network",
    ("api_integration",     "performance"):       "network",
    ("api_integration",     "account_access"):    "login",
    ("api_integration",     "feature_request"):   "feature_request",
    ("api_integration",     "how_to"):            "feature_request",
    ("api_integration",     "security_concern"):  "account",
    ("api_integration",     "other"):             "network",
    ("analytics_dashboard", "bug"):               "software",
    ("analytics_dashboard", "performance"):       "software",
    ("analytics_dashboard", "account_access"):    "login",
    ("analytics_dashboard", "feature_request"):   "feature_request",
    ("analytics_dashboard", "how_to"):            "feature_request",
    ("analytics_dashboard", "security_concern"):  "account",
    ("analytics_dashboard", "other"):             "software",
    ("data_export",         "bug"):               "software",
    ("data_export",         "performance"):       "software",
    ("data_export",         "account_access"):    "login",
    ("data_export",         "feature_request"):   "feature_request",
    ("data_export",         "how_to"):            "feature_request",
    ("data_export",         "security_concern"):  "account",
    ("data_export",         "other"):             "software",
    ("notifications",       "bug"):               "software",
    ("notifications",       "performance"):       "software",
    ("notifications",       "account_access"):    "login",
    ("notifications",       "feature_request"):   "feature_request",
    ("notifications",       "how_to"):            "feature_request",
    ("notifications",       "security_concern"):  "account",
    ("notifications",       "other"):             "software",
}

# File 2: product_area -> category
FILE2_CAT_MAP = {
    "auth":          "login",
    "billing":       "billing",
    "mobile":        "hardware",
    "analytics":     "software",
    "notifications": "software",
    "data_pipeline": "network",
}

# Priority normalisation
PRIORITY_MAP = {
    "urgent":   "critical",
    "high":     "high",
    "medium":   "medium",
    "low":      "low",
    "3":        "high",
    "2":        "medium",
    "1":        "low",
}

# ── Casual rewrite helpers ─────────────────────────────────────────────────────
CASUAL_SUBS = [
    (r"\bI cannot\b",           random.choice(["i cant", "i can't", "cant"])),
    (r"\bI am unable to\b",     random.choice(["i cant", "im unable to", "i cant seem to"])),
    (r"\bI am\b",               "im"),
    (r"\bI have\b",             "i have"),
    (r"\bplease\b",             random.choice(["pls", "please", "plz"])),
    (r"\bthe application\b",    random.choice(["the app", "it"])),
    (r"\bthe system\b",         random.choice(["it", "the system", "this thing"])),
    (r"\bnot functioning\b",    random.choice(["not working", "broken", "messed up"])),
    (r"\berror message\b",      random.choice(["error", "weird message", "red error"])),
    (r"\bpassword\b",           random.choice(["password", "pw", "pass"])),
    (r"\bnetwork connection\b", random.choice(["wifi", "internet", "connection"])),
    (r"\bInternet\b",           "internet"),
    (r"\bWi-Fi\b",              random.choice(["wifi", "wi-fi", "wireless"])),
]

CASUAL_CLOSINGS = [
    "",
    " pls help",
    " help!!!",
    " please help",
    " thanks",
    " thx",
    " any ideas?",
    " this is urgent",
    " really need this fixed asap",
]

CASUAL_BRANDS = {
    "login":    ["cant log into outlook", "teams wont open", "cant sign in to office365",
                 "my outlook keeps saying wrong password", "cant get into my account"],
    "network":  ["cant get on google", "teams wont load", "zoom keeps dropping",
                 "no internet at my desk", "wifi wont connect", "cant reach any websites"],
    "software": ["teams keeps crashing", "excel wont open", "my computer is running so slow",
                 "outlook wont load emails", "app keeps freezing",
                 "word crashed and i lost my file"],
    "hardware": ["my laptop wont turn on", "screen just went black",
                 "keyboard stopped working", "my computer is super slow",
                 "mouse not responding", "pc wont boot up"],
    "billing":  ["got charged twice", "wrong amount on my invoice",
                 "my subscription got cancelled", "billing is messed up"],
    "account":  ["my account got suspended", "someone else might be in my account",
                 "cant access my files", "account says its locked"],
    "feature_request": ["can you add dark mode", "would be great if we could export to excel",
                        "is there a way to get notifications", "can we get a mobile version"],
    "other":    ["not sure what happened", "something is broken", "please help with my issue"],
}


def casualize(text: str, category: str) -> str:
    """Rewrite a structured message into casual user language."""
    # 30% chance: replace entirely with a brand-name casual phrase
    if random.random() < 0.30 and category in CASUAL_BRANDS:
        base = random.choice(CASUAL_BRANDS[category])
        closing = random.choice(CASUAL_CLOSINGS)
        return (base + closing).strip()

    t = text.strip()
    # Apply surface substitutions
    for pattern, replacement in CASUAL_SUBS:
        t = re.sub(pattern, replacement, t, flags=re.IGNORECASE)

    # Lowercase the whole thing
    t = t.lower()

    # Drop terminal period
    t = t.rstrip(".")

    # Randomly strip some punctuation
    if random.random() < 0.5:
        t = t.replace(",", "")

    # Occasionally add urgency or brand reference
    if random.random() < 0.4:
        t += random.choice(CASUAL_CLOSINGS)

    return t.strip()


def make_subject_casual(category: str) -> str:
    subjects = {
        "login":    ["cant login", "login not working", "password issue",
                     "account locked out", "cant sign in"],
        "network":  ["no internet", "wifi down", "cant connect",
                     "internet not working", "connection issues"],
        "software": ["app crashing", "software broken", "program wont open",
                     "computer running slow", "error with app"],
        "hardware": ["computer wont turn on", "keyboard broken", "screen issues",
                     "laptop wont boot", "hardware problem"],
        "billing":  ["wrong charge", "billing problem", "invoice issue",
                     "payment not working", "charged incorrectly"],
        "account":  ["account issue", "account locked", "cant access account",
                     "account suspended"],
        "feature_request": ["feature request", "can you add this",
                            "suggestion", "requesting feature"],
        "other":    ["need help", "issue with system", "something broken"],
    }
    return random.choice(subjects.get(category, ["help needed"]))


def make_subject_professional(category: str, issue_type: str = "") -> str:
    subjects = {
        "login":    ["Unable to authenticate - login failure",
                     "Account access denied - password issue",
                     "Multi-factor authentication not working",
                     "User account locked after failed login attempts"],
        "network":  ["Network connectivity issue - unable to reach resources",
                     "Internet connection down - building affected",
                     "VPN connection failure",
                     "Wi-Fi authentication failing on corporate network"],
        "software": ["Application error - software not responding",
                     "System performance degradation",
                     "Software installation failure",
                     "Application crash - data loss risk"],
        "hardware": ["Hardware failure - device not operational",
                     "Laptop screen malfunction",
                     "Keyboard/peripheral not responding",
                     "Computer fails to boot - possible hardware fault"],
        "billing":  ["Billing discrepancy - incorrect charge applied",
                     "Invoice error requiring urgent correction",
                     "Subscription payment failure"],
        "account":  ["Account access revoked - urgent restoration needed",
                     "Unauthorized account activity detected",
                     "User account permissions incorrect"],
        "feature_request": ["Feature Enhancement Request",
                            "New functionality request for consideration",
                            "User experience improvement suggestion"],
        "other":    ["General IT Support Request",
                     "Technical issue - classification unclear",
                     "Miscellaneous system issue"],
    }
    return random.choice(subjects.get(category, ["Support Request"]))


# ── Description generators for File 2 (no source text) ────────────────────────

def _timeframe(downtime_min: float) -> str:
    if downtime_min == 0:
        return "since this morning"
    if downtime_min < 60:
        return f"for about {int(downtime_min)} minutes"
    hours = round(downtime_min / 60, 1)
    return f"for approximately {hours} hours"


def generate_description_casual(category: str, row: dict) -> str:
    """Generate a casual description from Support_tickets metadata."""
    downtime  = float(row.get("downtime_min", 0) or 0)
    affected  = int(float(row.get("customers_affected", 0) or 0))
    sentiment = row.get("customer_sentiment", "neutral")
    timeframe = _timeframe(downtime)

    templates = {
        "login": [
            f"hey so i cant log in at all {timeframe}. keeps saying wrong password but im sure its right. pls help",
            f"cant sign in to my account. been locked out {timeframe}. password reset email never came",
            f"login not working for me or a few of my coworkers. been down {timeframe}",
            f"account is locked cant get in. pretty sure i typed my password right. need this fixed asap",
        ],
        "network": [
            f"internet is completely down {timeframe} cant get to anything. tried restarting router",
            f"wifi keeps dropping every few minutes {timeframe}. cant stay connected long enough to work",
            f"no internet at our office {timeframe}. around {max(1,affected)} people cant work",
            f"connection keeps cutting out {timeframe}. even tried plugging in but still no luck",
        ],
        "software": [
            f"app keeps crashing whenever i try to open it. been happening {timeframe}",
            f"the program wont load at all {timeframe}. just shows an error and closes",
            f"software is super slow {timeframe}, takes forever to do anything simple",
            f"getting a weird error every time i try to use it. started {timeframe}",
        ],
        "hardware": [
            f"my computer just shut off randomly {timeframe} and wont turn back on properly",
            f"screen keeps going black {timeframe}. not sure what happened maybe overheated",
            f"keyboard stopped responding {timeframe}. tried unplugging and replugging",
            f"laptop wont boot up at all {timeframe}. just shows a blank screen",
        ],
        "billing": [
            f"i got charged twice this month. noticed {timeframe}. please fix this",
            f"my invoice looks wrong {timeframe}. amount doesnt match what was agreed",
            f"payment went through but account still showing as unpaid {timeframe}",
        ],
        "account": [
            f"my account got disabled {timeframe} and i cant access anything i need for work",
            f"permissions changed {timeframe} now i cant open files i could before",
            f"account says its suspended but i havent done anything wrong. been down {timeframe}",
        ],
        "feature_request": [
            "would be really helpful if we could export data to excel, is that possible",
            "can you add a way to get email notifications when something changes",
            "it would be nice to have a dark mode option, easier on the eyes",
            "requesting the ability to bulk assign tickets, would save a lot of time",
        ],
        "other": [
            f"not sure whats wrong but something is broken {timeframe}. please help",
            f"having an issue with the system {timeframe} not sure who to contact",
        ],
    }

    urgency_suffix = ""
    if sentiment == "negative":
        urgency_suffix = random.choice([" this is really urgent", " we really need this fixed ASAP", " please help!!"])

    choices = templates.get(category, templates["other"])
    return random.choice(choices) + urgency_suffix


def generate_description_professional(category: str, row: dict) -> str:
    """Generate a structured professional description from Support_tickets metadata."""
    downtime  = float(row.get("downtime_min", 0) or 0)
    affected  = int(float(row.get("customers_affected", 0) or 0))
    company   = row.get("company_size", "Small")
    timeframe = _timeframe(downtime)
    scope     = f"Approximately {affected} users are affected. " if affected > 1 else ""
    greeting  = "Dear IT Support Team," if company in ("Medium", "Large") else "Hi Support,"

    templates = {
        "login": [
            f"{greeting}\n\nI am unable to log into my account. The system returns an authentication error after entering my credentials. This has been occurring {timeframe}. {scope}I have already attempted a password reset without success. Please advise.",
            f"{greeting}\n\nMy account has been locked following several failed login attempts. I am confident my credentials are correct and suspect a system-side issue. The issue started {timeframe}. {scope}Please assist in restoring access.",
            f"{greeting}\n\nMulti-factor authentication is not functioning correctly. I receive no verification code via the authenticator app despite multiple attempts {timeframe}. {scope}This is blocking all system access.",
        ],
        "network": [
            f"{greeting}\n\nWe are experiencing a complete network connectivity outage that began {timeframe}. {scope}All wired and wireless connections appear to be affected. Switches have power but no link lights are visible. Immediate assistance is required.",
            f"{greeting}\n\nInternet connectivity has been intermittent {timeframe}. {scope}The connection drops every few minutes, impacting productivity significantly. A full outage investigation is requested.",
            f"{greeting}\n\nVPN connectivity has failed {timeframe}. {scope}Remote users are unable to access internal resources. Please investigate the VPN gateway configuration.",
        ],
        "software": [
            f"{greeting}\n\nThe application is generating a critical error upon launch and fails to complete startup. This issue began {timeframe} and is affecting {max(1,affected)} user(s). {scope}Error logs are available upon request.",
            f"{greeting}\n\nSystem performance has degraded significantly {timeframe}. {scope}Response times have increased to an unacceptable level, impacting daily operations. Please investigate resource utilization.",
            f"{greeting}\n\nThe software update applied {timeframe} has introduced instability. {scope}The application crashes intermittently under normal usage. A rollback or hotfix is requested.",
        ],
        "hardware": [
            f"{greeting}\n\nMy workstation is experiencing a hardware failure that started {timeframe}. The device fails to complete POST and displays no output on the monitor. {scope}A hardware inspection or replacement is required.",
            f"{greeting}\n\nThe laptop screen has developed a fault {timeframe}. {scope}Display artifacts and intermittent blackouts are occurring. The device is still under warranty.",
            f"{greeting}\n\nPeripheral devices (keyboard and mouse) have stopped responding {timeframe}. {scope}All USB connections have been verified. A hardware fault is suspected.",
        ],
        "billing": [
            f"{greeting}\n\nI have identified a billing discrepancy on our account. An incorrect charge was applied {timeframe}. {scope}Please review invoice and process the necessary correction at your earliest convenience.",
            f"{greeting}\n\nOur subscription payment was processed successfully however the account still shows as unpaid. This began {timeframe}. {scope}Please reconcile the payment records and restore full access.",
        ],
        "account": [
            f"{greeting}\n\nMy account access was revoked {timeframe} without prior notification. {scope}I require full access restoration to continue my duties. Please confirm the reason for suspension and reinstate permissions.",
            f"{greeting}\n\nUnexpected changes to account permissions were detected {timeframe}. {scope}Several team members are unable to access previously available resources. A permissions audit is requested.",
        ],
        "feature_request": [
            f"{greeting}\n\nI would like to formally request a feature enhancement: the ability to export reports in Excel format. This capability would significantly improve our workflow efficiency.",
            f"{greeting}\n\nOur team would benefit from email notification alerts when ticket statuses change. Please consider this for a future release.",
            f"{greeting}\n\nWe are requesting a bulk action feature to assign multiple tickets simultaneously. This would reduce manual processing time considerably.",
        ],
        "other": [
            f"{greeting}\n\nI am experiencing a technical issue that began {timeframe} and does not fit neatly into a standard category. {scope}Please assign to the appropriate team for investigation.",
        ],
    }

    choices = templates.get(category, templates["other"])
    return random.choice(choices)


# ── Process File 1 ─────────────────────────────────────────────────────────────

def process_file1(path: str, limit: int) -> list:
    results = []
    with open(path, encoding="utf-8", errors="replace") as f:
        rows = list(csv.DictReader(f))

    if limit:
        rows = rows[:limit]

    for row in rows:
        pa = row.get("product_area", "").strip()
        it = row.get("issue_type", "").strip()
        priority_raw = row.get("priority", "medium").strip().lower()
        priority = PRIORITY_MAP.get(priority_raw, "medium")

        category = FILE1_CAT_MAP.get((pa, it))
        if not category:
            # Fallback: product_area alone
            fallbacks = {
                "login_auth":          "login",
                "billing":             "billing",
                "mobile_app":          "software",
                "api_integration":     "network",
                "analytics_dashboard": "software",
                "data_export":         "software",
                "notifications":       "software",
            }
            category = fallbacks.get(pa, "other")

        source_text = row.get("initial_message", "").strip()
        if not source_text:
            continue

        casual = random.random() < 0.50
        if casual:
            description = casualize(source_text, category)
            subject = make_subject_casual(category)
        else:
            description = source_text
            subject = make_subject_professional(category, it)

        results.append({
            "subject":     subject,
            "description": description,
            "category":    category,
            "priority":    priority,
            "source":      "file1",
        })

    return results


# ── Process File 2 ─────────────────────────────────────────────────────────────

def process_file2(path: str, limit: int) -> list:
    results = []
    with open(path, encoding="utf-8", errors="replace") as f:
        rows = list(csv.DictReader(f))

    if limit:
        rows = rows[:limit]

    for row in rows:
        pa = row.get("product_area", "").strip()
        priority_raw = row.get("priority", "medium").strip().lower()
        priority = PRIORITY_MAP.get(priority_raw, "medium")

        category = FILE2_CAT_MAP.get(pa, "other")

        casual = random.random() < 0.50
        if casual:
            description = generate_description_casual(category, row)
            subject = make_subject_casual(category)
        else:
            description = generate_description_professional(category, row)
            subject = make_subject_professional(category)

        results.append({
            "subject":     subject,
            "description": description,
            "category":    category,
            "priority":    priority,
            "source":      "file2",
        })

    return results


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Augment external CSVs into BluClue training format")
    parser.add_argument("--file1",  default=DEFAULT_FILE1, help="Path to synthetic_it_support_tickets CSV")
    parser.add_argument("--file2",  default=DEFAULT_FILE2, help="Path to Support_tickets CSV")
    parser.add_argument("--limit",  type=int, default=0,   help="Max rows per source file (0=all)")
    parser.add_argument("--out",    default=OUT_PATH,      help="Output CSV path")
    args = parser.parse_args()

    print(f"Processing File 1: {args.file1}")
    rows1 = process_file1(args.file1, args.limit)
    print(f"  -> {len(rows1):,} rows")

    print(f"Processing File 2: {args.file2}")
    rows2 = process_file2(args.file2, args.limit)
    print(f"  -> {len(rows2):,} rows")

    all_rows = rows1 + rows2
    random.shuffle(all_rows)

    # Category and priority distribution
    from collections import Counter
    cats  = Counter(r["category"] for r in all_rows)
    pris  = Counter(r["priority"] for r in all_rows)
    print(f"\nTotal rows: {len(all_rows):,}")
    print("Category distribution:", dict(cats.most_common()))
    print("Priority distribution:", dict(pris.most_common()))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["subject", "description", "category", "priority", "source"])
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nSaved -> {args.out}")
    print("Next step: run  python scripts/augment_and_retrain.py  or merge with existing training data.")


if __name__ == "__main__":
    main()
