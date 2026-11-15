# NAAMII Grant & Funding Radar (Nepal · LMIC)

A zero-build, collaborative **GitHub Pages** portal compiling international, regional, and national grants, compute/GPU infrastructure programs, and global health AI funding calls tailored for researchers at **NAAMII (Nepal Applied Mathematics and Informatics Institute for Research)** and the broader research ecosystem in **Nepal**.

Inspired by [ScientifyResearch](https://www.scientifyresearch.org/), with specialized institutional intelligence for **Nepal's LMIC / ODA-South Asia / UNESCO-TWAS STLC** classifications.

---

## Key Capabilities

- **52 Curated & Verified Funding Programs** across 4 core pillars:
  1. **Healthcare & Global Health AI** (EVAH $60M Initiative, IDRC AI4GH, UK NIHR South Asia, NIH Fogarty K43 & mHealth, Wellcome Discovery & Climate/Health, Grand Challenges, WHO/TDR, CZI, Wellcome Leap, Pfizer GHIG, Botnar, ADB Digital Health)
  2. **AI Infrastructure, Compute & Open Datasets** (Mozilla Human-Scale AI Incubator, Lacuna Fund, ISIF Asia / APNIC, NVIDIA Academic GPU Grants, AWS/GCP/Microsoft Azure Research Credits, OpenAI & Anthropic Researcher Access, Meta Llama Impact Grants, BMZ/GIZ FAIR Forward, GSMA Innovation Fund)
  3. **Fundamental ML & International Consortia** (Horizon Europe Cluster 1 Health & Cluster 4 Digital/AI, Swiss SNSF SPIRIT, Human Frontier Science Program, Royal Society International Exchanges, UKRI/British Council ISPF, Amazon Research Awards, Google GARA, Schmidt Sciences)
  4. **Fellowships, Women in STEM & Nepal National Ecosystem** (OWSD $50K Early Career STLC Fellowship, TWAS STLC Equipment Grants, Mozilla Fellowships, CIFAR Azrieli Global Scholars, Schlumberger Faculty for the Future, J-PAL PAIE AI Evidence, NHRC, NAST & UGC Nepal)
- **Nepal Application Pathway Filters**: Immediately distinguish **Direct Lead (Nepal Eligible)** calls from **Consortium / Co-PI** calls, **Compute / Hardware Credits**, and **Individual Fellowships**.
- **NAAMII Research Lab Alignment**: Filter by `TOGAI & TrAI Labs (Health AI)`, `AI Infrastructure & Compute`, `Fundamental ML, NLP & Vision`, `Bioinformatics & Microbiome`, `Climate & Remote Sensing`, and `AI Education (ANAIS & UDAAN)`.
- **3 Interactive Views**: Card Grid, Compact Spreadsheet Table, and **2026–2027 Deadline Roadmap Timeline**.
- **Grant Pipeline Workspace**: Bookmark calls locally, download `.ics` calendar reminders, export filtered views to **CSV**, or copy a formatted **Markdown Brief** for Slack/email.

---

## Automated 7-Day Refresh Engine

The portal updates itself automatically **every 7 days** (`cron: "0 3 * * 1"` — every Monday at 03:00 UTC / 08:45 AM Nepal Time) via [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) and [`scripts/weekly_update.py`](./scripts/weekly_update.py):

1. **Live Feed & API Harvesting (Zero API Keys Needed)**:
   - **NIH Guide for Grants & Contracts RSS** — catches newly posted Fogarty (`FIC`), NIBIB, NLM, and global health AI notices.
   - **UKRI Funding Finder RSS** — catches new ISPF, ODA, South Asia, and international AI/health calls.
   - **Grants.gov Search2 REST API** — scans active `posted` and `forecasted` global health + AI opportunities.
   - **APNIC Foundation RSS** — catches newly opened ISIF Asia infrastructure grants and regional fellowships for Nepal.
   - Newly discovered grants are deduplicated, classified by NAAMII research group, tagged with a `✨ Weekly Sync` badge, and appended to `data/grants.json`.
2. **Automatic Deadline Lifecycle Management**:
   - Expired `Open Now` deadlines are automatically rolled forward to `Upcoming` (next expected annual cycle), and `Upcoming` calls entering a 45-day submission window are promoted to `Open Now`.
   - Between weekly CI runs, [`assets/js/app.js`](./assets/js/app.js) also evaluates deadlines in real time in the visitor's browser so passed deadlines never appear as open.
3. **Commit History & Continuous Deployment**:
   - Each weekly run updates `metadata.lastUpdated`, `metadata.nextScheduledUpdate`, `data/grants-data.js`, and [`data/update-log.json`](./data/update-log.json), commits back to `main` (which also keeps GitHub's 60-day scheduled-workflow activity timer alive indefinitely), and redeploys **GitHub Pages** automatically.
   - You can also trigger an immediate refresh anytime from **Actions → Weekly Grant Refresh & Deploy to GitHub Pages → Run workflow**.

---

## Previewing Locally

- **Instant local open**: Double-click `index.html` in any browser (uses `data/grants-data.js` automatically so there are no `file://` CORS issues).
- **Or via any static server** (fetches `data/grants.json` live):
  ```bash
  python -m http.server 8000
  ```

---

## Adding or Updating Grants

1. Edit [`data/grants.json`](./data/grants.json) directly (or click **+ Suggest Grant** in the portal top bar to generate a formatted JSON object).
2. Run the sync/validation script before committing:
   - **Windows PowerShell**: `.\scripts\sync-data.ps1`
   - **Python 3 (macOS/Linux/CI)**: `python3 scripts/sync_and_validate.py`
3. Alternatively, researchers can submit calls without editing JSON via the repository's **Issues → Suggest a Grant / Funding Call** form (`.github/ISSUE_TEMPLATE/add-grant.yml`).

## Created and curated by Prajwal Ghimire (prajwal.ghimire@naamii.org.np)
