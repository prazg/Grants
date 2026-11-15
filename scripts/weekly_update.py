#!/usr/bin/env python3
"""
Automated 7-Day Grant Radar Updater for NAAMII (Nepal).
Runs via GitHub Actions every 7 days (and on manual workflow_dispatch) using only
Python's standard library for long-term reliability:

1. Rolls over expired deadlines (`Open Now` -> `Upcoming` next cycle) and promotes
   imminent windows (`Upcoming` within 60 days -> `Open Now`).
2. Harvests newly posted relevant calls from free, unauthenticated official feeds:
   - NIH Guide for Grants & Contracts RSS (Fogarty, NIBIB, NLM, Global Health AI)
   - UKRI Funding Finder RSS (ISPF, ODA, Global Health, AI & Compute)
   - Grants.gov Search2 JSON API (Global Health AI, LMIC Digital Health & Fogarty)
3. Updates metadata (`lastUpdated`, `nextScheduledUpdate`) and writes `data/update-log.json`.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRANTS_JSON = ROOT / "data" / "grants.json"
UPDATE_LOG_JSON = ROOT / "data" / "update-log.json"

USER_AGENT = "NAAMII-Grant-Radar-Bot/1.0 (+https://www.naamii.org.np; research-grants-portal)"
TIMEOUT_SEC = 20
MAX_NEW_PER_RUN = 8

AI_HEALTH_KEYWORDS = re.compile(
    r"\b(artificial intelligence|machine learning|deep learning|data science|"
    r"digital health|mhealth|mobile health|medical imaging|bioinformatics|"
    r"computational|large language model|llm|genomics|diagnostics|infrastructure|compute)\b",
    re.IGNORECASE,
)

GLOBAL_LMIC_KEYWORDS = re.compile(
    r"\b(global health|low- and middle-income|low and middle income|lmic|lmics|"
    r"developing countr|south asia|nepal|fogarty|oda|international|global south|"
    r"low-resource|tropical|infectious)\b",
    re.IGNORECASE,
)


def strip_html(raw: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", raw or "")
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def slugify(text: str, prefix: str = "auto") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return f"{prefix}-{slug[:44]}".rstrip("-")


def fetch_bytes(url: str, data: bytes | None = None, headers: dict[str, str] | None = None) -> bytes:
    req_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=req_headers)
    with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
        return resp.read()


def classify_opportunity(title: str, description: str) -> tuple[str, list[str], str]:
    blob = f"{title} {description}".lower()
    if any(k in blob for k in ("fellowship", "career", "postdoctoral", "scholar", "training", "k43", "d43")):
        category = "Fellowships & Capacity"
    elif any(k in blob for k in ("compute", "infrastructure", "dataset", "cloud", "cyberinfrastructure", "software")):
        category = "AI Infrastructure"
    elif any(k in blob for k in ("health", "clinical", "medical", "biomedical", "disease", "nih", "diagnostics")):
        category = "Healthcare AI"
    else:
        category = "Fundamental & Consortium"

    groups: list[str] = []
    if any(k in blob for k in ("health", "clinical", "medical", "imaging", "diagnostics", "mhealth")):
        groups.append("TOGAI / TrAI (Health AI)")
    if any(k in blob for k in ("genom", "microbiome", "bioinformatics", "antimicrobial", "infectious", "pathogen")):
        groups.append("Bioinformatics & Microbiome")
    if any(k in blob for k in ("compute", "infrastructure", "cloud", "hardware", "dataset")):
        groups.append("AI Infra & Compute")
    if any(k in blob for k in ("climate", "environment", "earth", "disaster", "vector")):
        groups.append("Climate & Remote Sensing")
    if any(k in blob for k in ("language", "nlp", "vision", "foundation model", "machine learning")):
        groups.append("Fundamental ML, NLP & Vision")
    if not groups:
        groups.append("TOGAI / TrAI (Health AI)")

    pathway = "Consortium / Co-PI"
    if any(k in blob for k in ("k43", "fellowship", "early career", "scholar")):
        pathway = "Individual / Fellowship"
    elif any(k in blob for k in ("lmic lead", "developing country institution", "low- and middle-income country institutions")):
        pathway = "Direct Lead"

    return category, groups[:3], pathway


def harvest_nih_rss(today_str: str) -> list[dict]:
    url = "https://grants.nih.gov/grants/guide/newsfeed/fundingopps.xml"
    raw = fetch_bytes(url)
    root = ET.fromstring(raw)
    candidates: list[dict] = []

    for item in root.findall(".//item"):
        title = strip_html(item.findtext("title") or "")
        link = (item.findtext("link") or "").strip()
        desc = strip_html(item.findtext("description") or "")
        combined = f"{title} {desc}"

        if not link.startswith("https://"):
            continue
        if not (AI_HEALTH_KEYWORDS.search(combined) and GLOBAL_LMIC_KEYWORDS.search(combined)):
            continue

        category, groups, pathway = classify_opportunity(title, desc)
        candidates.append(
            {
                "id": slugify(title, "nih"),
                "title": title[:140],
                "funder": "National Institutes of Health (NIH / Fogarty)",
                "funderType": "Public Research Council",
                "category": category,
                "subcategories": ["Global Health", "Biomedical AI", "Auto-Discovered"],
                "naamiiGroups": groups,
                "pathway": pathway,
                "status": "Open Now",
                "deadline": None,
                "deadlineDisplay": "Active NIH FOA (See official notice for cycle dates)",
                "amountMin": 100000,
                "amountMax": 500000,
                "amountDisplay": "Varies by NIH Activity Code (See FOA)",
                "nepalEligibility": "Matched LMIC / international global health keywords in NIH Guide. Verify 'Non-domestic (non-U.S.) Entities' section in the FOA.",
                "summary": desc[:340] + ("..." if len(desc) > 340 else ""),
                "naamiiStrategy": "Auto-discovered via weekly NIH Guide scan. Check foreign lead vs. US-LMIC Multiple-PI subaward eligibility.",
                "fitScore": 88,
                "url": link,
                "autoDiscovered": True,
                "discoveredAt": today_str,
            }
        )
    return candidates


def harvest_ukri_rss(today_str: str) -> list[dict]:
    url = "https://www.ukri.org/opportunity/feed/"
    raw = fetch_bytes(url)
    root = ET.fromstring(raw)
    candidates: list[dict] = []

    for item in root.findall(".//item"):
        title = strip_html(item.findtext("title") or "")
        link = (item.findtext("link") or "").strip()
        desc = strip_html(item.findtext("description") or "")
        combined = f"{title} {desc}"

        if not link.startswith("https://"):
            continue
        if not (AI_HEALTH_KEYWORDS.search(combined) and GLOBAL_LMIC_KEYWORDS.search(combined)):
            continue

        category, groups, pathway = classify_opportunity(title, desc)
        candidates.append(
            {
                "id": slugify(title, "ukri"),
                "title": title[:140],
                "funder": "UK Research and Innovation (UKRI)",
                "funderType": "Public Research Council",
                "category": category,
                "subcategories": ["UK-International", "ODA / Global", "Auto-Discovered"],
                "naamiiGroups": groups,
                "pathway": "Consortium / Co-PI",
                "status": "Open Now",
                "deadline": None,
                "deadlineDisplay": "Open UKRI Opportunity (Check portal closing date)",
                "amountMin": 100000,
                "amountMax": 1000000,
                "amountDisplay": "See UKRI Funding Finder specification",
                "nepalEligibility": "Matched international / ODA / global health-AI criteria on UKRI feed. Typically requires UK Lead PI + Nepal/ODA Co-Lead.",
                "summary": desc[:340] + ("..." if len(desc) > 340 else ""),
                "naamiiStrategy": "Auto-discovered via weekly UKRI scan. Reach out to UK university collaborators early to join as the South Asia LMIC partner.",
                "fitScore": 87,
                "url": link,
                "autoDiscovered": True,
                "discoveredAt": today_str,
            }
        )
    return candidates


def harvest_grants_gov(today_str: str) -> list[dict]:
    url = "https://api.grants.gov/v1/api/search2"
    payload = json.dumps(
        {
            "rows": 20,
            "keyword": "artificial intelligence global health low middle income",
            "oppStatuses": "forecasted|posted",
        }
    ).encode("utf-8")
    raw = fetch_bytes(url, data=payload, headers={"Content-Type": "application/json"})
    resp = json.loads(raw.decode("utf-8"))
    hits = resp.get("data", {}).get("oppHits", []) or []
    candidates: list[dict] = []

    for hit in hits:
        opp_id = hit.get("id")
        title = strip_html(hit.get("title") or "")
        agency = strip_html(hit.get("agencyName") or "U.S. Federal Agency")
        close_str = (hit.get("closeDate") or "").strip()  # MM/DD/YYYY if present

        if not opp_id or not title:
            continue
        if not (AI_HEALTH_KEYWORDS.search(title) or GLOBAL_LMIC_KEYWORDS.search(title)):
            continue

        iso_deadline = None
        if re.match(r"^\d{2}/\d{2}/\d{4}$", close_str):
            mm, dd, yyyy = close_str.split("/")
            iso_deadline = f"{yyyy}-{mm}-{dd}"

        detail_url = f"https://www.grants.gov/search-results-detail/{opp_id}"
        category, groups, pathway = classify_opportunity(title, agency)
        candidates.append(
            {
                "id": slugify(f"{hit.get('number', opp_id)}-{title}", "ggov"),
                "title": title[:140],
                "funder": agency,
                "funderType": "Public Agency (Grants.gov)",
                "category": category,
                "subcategories": ["Global Health & Tech", "Auto-Discovered"],
                "naamiiGroups": groups,
                "pathway": pathway,
                "status": "Open Now" if hit.get("oppStatus") == "posted" else "Upcoming",
                "deadline": iso_deadline,
                "deadlineDisplay": iso_deadline or "Posted / Forecasted on Grants.gov",
                "amountMin": 100000,
                "amountMax": 750000,
                "amountDisplay": "See Grants.gov Synopsis",
                "nepalEligibility": "Verify foreign organization eligibility in Section III of the Grants.gov synopsis (direct LMIC award vs. subaward).",
                "summary": f"Live federal funding opportunity ({hit.get('number', 'FOA')}) posted by {agency} matching global health / AI search criteria.",
                "naamiiStrategy": "Auto-discovered via weekly Grants.gov API scan. Ensure SAM.gov UEI registration is active before applying.",
                "fitScore": 86,
                "url": detail_url,
                "autoDiscovered": True,
                "discoveredAt": today_str,
            }
        )
    return candidates


def harvest_apnic_rss(today_str: str) -> list[dict]:
    url = "https://apnic.foundation/feed/"
    raw = fetch_bytes(url)
    root = ET.fromstring(raw)
    candidates: list[dict] = []

    for item in root.findall(".//item"):
        title = strip_html(item.findtext("title") or "")
        link = (item.findtext("link") or "").strip()
        desc = strip_html(item.findtext("description") or "")
        combined = f"{title} {desc}".lower()

        if not link.startswith("https://"):
            continue
        if not any(k in combined for k in ("grant", "applications open", "call for proposals", "fellowship", "isif")):
            continue

        is_fellowship = "fellowship" in combined
        candidates.append(
            {
                "id": slugify(title, "apnic"),
                "title": title[:140],
                "funder": "APNIC Foundation / ISIF Asia",
                "funderType": "Regional Tech Foundation",
                "category": "Fellowships & Capacity" if is_fellowship else "AI Infrastructure",
                "subcategories": ["Asia-Pacific", "Digital Infrastructure", "Auto-Discovered"],
                "naamiiGroups": ["AI Infra & Compute", "Education & ANAIS"],
                "pathway": "Individual / Fellowship" if is_fellowship else "Direct Lead",
                "status": "Open Now",
                "deadline": None,
                "deadlineDisplay": "Open Call Announced (See APNIC Foundation post)",
                "amountMin": 10000 if is_fellowship else 30000,
                "amountMax": 15000 if is_fellowship else 150000,
                "amountDisplay": "$10,000 – $150,000 USD (See Call Tier)",
                "nepalEligibility": "Nepal is an eligible APNIC Asia-Pacific economy; registered non-profits and researchers in Nepal can apply directly.",
                "summary": desc[:340] + ("..." if len(desc) > 340 else ""),
                "naamiiStrategy": "Auto-discovered via weekly APNIC Foundation scan. High fit for NAAMII digital infrastructure and regional research.",
                "fitScore": 92,
                "url": link,
                "autoDiscovered": True,
                "discoveredAt": today_str,
            }
        )
    return candidates


def update_deadlines_and_statuses(grants: list[dict], today: dt.date) -> dict[str, int]:
    rolled_over = 0
    promoted_open = 0

    for g in grants:
        deadline_str = g.get("deadline")
        if not deadline_str:
            continue
        try:
            d_date = dt.date.fromisoformat(deadline_str)
        except ValueError:
            continue

        days_left = (d_date - today).days

        # 1. Expired "Open Now" calls -> transition cleanly to Upcoming next cycle
        if days_left < 0 and g.get("status") == "Open Now":
            next_year_date = d_date.replace(year=d_date.year + 1)
            g["status"] = "Upcoming"
            g["deadline"] = next_year_date.isoformat()
            g["deadlineDisplay"] = f"Est. {next_year_date.strftime('%b %Y')} (Last cycle closed {deadline_str})"
            rolled_over += 1

        # 2. Expired "Upcoming" calls -> roll target window +1 year
        elif days_left < 0 and g.get("status") == "Upcoming":
            next_year_date = d_date.replace(year=d_date.year + 1)
            g["deadline"] = next_year_date.isoformat()
            g["deadlineDisplay"] = f"Est. {next_year_date.strftime('%b %Y')} Cycle"
            rolled_over += 1

        # 3. Upcoming calls now within 45 days -> highlight as Open Now
        elif 0 <= days_left <= 45 and g.get("status") == "Upcoming":
            g["status"] = "Open Now"
            promoted_open += 1

    return {"rolledOver": rolled_over, "promotedOpen": promoted_open}


def main() -> int:
    today = dt.datetime.now(dt.timezone.utc).date()
    today_str = today.isoformat()
    next_week_str = (today + dt.timedelta(days=7)).isoformat()

    data = json.loads(GRANTS_JSON.read_text(encoding="utf-8"))
    grants: list[dict] = data.get("grants", [])

    # Step 1: Roll forward expired deadlines & promote opening calls
    lifecycle_stats = update_deadlines_and_statuses(grants, today)

    # Step 2: Poll live funding feeds safely
    existing_urls = {g.get("url", "").rstrip("/").lower() for g in grants}
    existing_titles = {re.sub(r"\W+", "", g.get("title", "").lower()) for g in grants}
    existing_ids = {g.get("id") for g in grants}

    source_results: dict[str, str] = {}
    discovered: list[dict] = []

    harvesters = [
        ("nih_guide_rss", harvest_nih_rss),
        ("ukri_rss", harvest_ukri_rss),
        ("grants_gov_api", harvest_grants_gov),
        ("apnic_foundation_rss", harvest_apnic_rss),
    ]

    for source_name, fn in harvesters:
        try:
            items = fn(today_str)
            source_results[source_name] = f"ok ({len(items)} matches)"
            for item in items:
                norm_url = item["url"].rstrip("/").lower()
                norm_title = re.sub(r"\W+", "", item["title"].lower())
                if norm_url in existing_urls or norm_title in existing_titles or item["id"] in existing_ids:
                    continue
                if len(discovered) < MAX_NEW_PER_RUN:
                    discovered.append(item)
                    existing_urls.add(norm_url)
                    existing_titles.add(norm_title)
                    existing_ids.add(item["id"])
        except (urllib.error.URLError, ET.ParseError, TimeoutError, ValueError, OSError) as exc:
            source_results[source_name] = f"skipped ({type(exc).__name__})"

    if discovered:
        grants.extend(discovered)

    # Step 3: Update portal metadata
    metadata = data.setdefault("metadata", {})
    metadata["lastUpdated"] = today_str
    metadata["nextScheduledUpdate"] = next_week_str
    metadata["updateIntervalDays"] = 7
    metadata["lastSyncStats"] = {
        "syncedAtUtc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "newGrantsAdded": len(discovered),
        "deadlinesRolledOver": lifecycle_stats["rolledOver"],
        "callsPromotedOpen": lifecycle_stats["promotedOpen"],
        "sources": source_results,
    }

    GRANTS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Append to rolling update log (keep latest 52 weekly runs = 1 year of history)
    history: list[dict] = []
    if UPDATE_LOG_JSON.exists():
        try:
            history = json.loads(UPDATE_LOG_JSON.read_text(encoding="utf-8"))
        except ValueError:
            history = []

    history.insert(
        0,
        {
            "date": today_str,
            "totalGrants": len(grants),
            "newGrantsAdded": len(discovered),
            "deadlinesRolledOver": lifecycle_stats["rolledOver"],
            "callsPromotedOpen": lifecycle_stats["promotedOpen"],
            "sources": source_results,
        },
    )
    UPDATE_LOG_JSON.write_text(json.dumps(history[:52], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Weekly update complete ({today_str}): total={len(grants)}, "
        f"added={len(discovered)}, rolled_over={lifecycle_stats['rolledOver']}, "
        f"promoted={lifecycle_stats['promotedOpen']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
