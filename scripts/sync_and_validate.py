#!/usr/bin/env python3
"""
Validates data/grants.json and syncs data/grants-data.js so the portal works
both over HTTP/HTTPS (GitHub Pages) and local file:// protocol without CORS issues.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "data" / "grants.json"
JS_PATH = ROOT / "data" / "grants-data.js"

REQUIRED_FIELDS = {
    "id",
    "title",
    "funder",
    "funderType",
    "category",
    "subcategories",
    "naamiiGroups",
    "pathway",
    "status",
    "deadline",
    "deadlineDisplay",
    "amountMin",
    "amountMax",
    "amountDisplay",
    "nepalEligibility",
    "summary",
    "naamiiStrategy",
    "fitScore",
    "url",
}

VALID_CATEGORIES = {
    "Healthcare AI",
    "AI Infrastructure",
    "Fundamental & Consortium",
    "Fellowships & Capacity",
}

VALID_PATHWAYS = {
    "Direct Lead",
    "Consortium / Co-PI",
    "Individual / Fellowship",
    "Compute / Hardware",
}

VALID_STATUSES = {
    "Open Now",
    "Rolling",
    "Upcoming",
    "Paused / Watch",
}


def main() -> int:
    if not JSON_PATH.exists():
        print(f"ERROR: Missing {JSON_PATH}", file=sys.stderr)
        return 1

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    grants = data.get("grants", [])
    if not grants:
        print("ERROR: No grants found in data/grants.json", file=sys.stderr)
        return 1

    seen_ids = set()
    errors = []

    for idx, g in enumerate(grants):
        gid = g.get("id", f"<index-{idx}>")
        missing = REQUIRED_FIELDS - set(g.keys())
        if missing:
            errors.append(f"[{gid}] Missing fields: {sorted(missing)}")
        if gid in seen_ids:
            errors.append(f"[{gid}] Duplicate grant id")
        seen_ids.add(gid)

        if g.get("category") not in VALID_CATEGORIES:
            errors.append(f"[{gid}] Invalid category: {g.get('category')}")
        if g.get("pathway") not in VALID_PATHWAYS:
            errors.append(f"[{gid}] Invalid pathway: {g.get('pathway')}")
        if g.get("status") not in VALID_STATUSES:
            errors.append(f"[{gid}] Invalid status: {g.get('status')}")

        deadline = g.get("deadline")
        if deadline is not None and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(deadline)):
            errors.append(f"[{gid}] Invalid ISO deadline format: {deadline}")

        url = g.get("url", "")
        if not str(url).startswith("https://"):
            errors.append(f"[{gid}] URL must start with https:// -> {url}")

    if errors:
        print("Validation failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    js_payload = (
        "// Auto-generated from data/grants.json by scripts/sync_and_validate.py\n"
        "// Edit data/grants.json directly and run `python scripts/sync_and_validate.py`.\n"
        f"window.NAAMII_PORTAL_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
    )
    JS_PATH.write_text(js_payload, encoding="utf-8")
    print(f"Validated {len(grants)} grants and synced {JS_PATH.relative_to(ROOT)} successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
