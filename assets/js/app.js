(function () {
  "use strict";

  const STORAGE_KEYS = {
    SHORTLIST: "naamii_grants_shortlist_v1",
    THEME: "naamii_grants_theme_v1",
  };

  const state = {
    grants: [],
    externalPortals: [],
    metadata: {},
    search: "",
    category: "all",
    pathway: "all",
    group: "all",
    status: "all",
    amount: "all",
    sort: "fit",
    view: "grid",
    activePreset: "all",
    shortlistOnly: false,
    shortlist: new Set(),
    activeGrantId: null,
  };

  const els = {};

  function cacheElements() {
    els.searchInput = document.getElementById("searchInput");
    els.clearSearchBtn = document.getElementById("clearSearchBtn");
    els.categoryFilter = document.getElementById("categoryFilter");
    els.pathwayFilter = document.getElementById("pathwayFilter");
    els.groupFilter = document.getElementById("groupFilter");
    els.statusFilter = document.getElementById("statusFilter");
    els.amountFilter = document.getElementById("amountFilter");
    els.sortSelect = document.getElementById("sortSelect");
    els.grantsContainer = document.getElementById("grantsContainer");
    els.resultsCountText = document.getElementById("resultsCountText");
    els.resetFiltersBtn = document.getElementById("resetFiltersBtn");
    els.presetChips = document.getElementById("presetChips");
    els.shortlistToggleBtn = document.getElementById("shortlistToggleBtn");
    els.shortlistCount = document.getElementById("shortlistCount");
    els.shortlistBanner = document.getElementById("shortlistBanner");
    els.themeToggleBtn = document.getElementById("themeToggleBtn");
    els.themeIcon = document.getElementById("themeIcon");
    els.brandReset = document.getElementById("brandReset");
    els.exportCsvBtn = document.getElementById("exportCsvBtn");
    els.copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
    els.externalPortalsGrid = document.getElementById("externalPortalsGrid");
    els.lastUpdatedBadge = document.getElementById("lastUpdatedBadge");

    els.kpiTotal = document.getElementById("kpiTotal");
    els.kpiOpenRolling = document.getElementById("kpiOpenRolling");
    els.kpiDirect = document.getElementById("kpiDirect");
    els.kpiHealthInfra = document.getElementById("kpiHealthInfra");

    els.grantDrawerBackdrop = document.getElementById("grantDrawerBackdrop");
    els.drawerBadges = document.getElementById("drawerBadges");
    els.drawerContent = document.getElementById("drawerContent");
    els.closeDrawerBtn = document.getElementById("closeDrawerBtn");

    els.openSubmitModalBtn = document.getElementById("openSubmitModalBtn");
    els.submitModalBackdrop = document.getElementById("submitModalBackdrop");
    els.closeSubmitModalBtn = document.getElementById("closeSubmitModalBtn");
    els.suggestGrantForm = document.getElementById("suggestGrantForm");
    els.generatedJsonWrap = document.getElementById("generatedJsonWrap");
    els.generatedJson = document.getElementById("generatedJson");
    els.copyGeneratedJsonBtn = document.getElementById("copyGeneratedJsonBtn");

    els.toast = document.getElementById("toast");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.classList.add("hidden");
    }, 2800);
  }

  function loadPreferences() {
    try {
      const savedShortlist = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHORTLIST) || "[]");
      if (Array.isArray(savedShortlist)) {
        state.shortlist = new Set(savedShortlist);
      }
    } catch (_) {
      state.shortlist = new Set();
    }

    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (els.themeIcon) {
      els.themeIcon.textContent = theme === "dark" ? "☀" : "☾";
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (_) {}
  }

  function saveShortlist() {
    try {
      localStorage.setItem(STORAGE_KEYS.SHORTLIST, JSON.stringify([...state.shortlist]));
    } catch (_) {}
    updateShortlistUI();
  }

  function updateShortlistUI() {
    els.shortlistCount.textContent = String(state.shortlist.size);
    els.shortlistToggleBtn.setAttribute("aria-pressed", state.shortlistOnly ? "true" : "false");
    els.shortlistBanner.classList.toggle("hidden", !state.shortlistOnly);
  }

  async function loadPortalData() {
    if (window.location.protocol !== "file:") {
      try {
        const res = await fetch("./data/grants.json", { cache: "no-cache" });
        if (res.ok) {
          return await res.json();
        }
      } catch (_) {
        // Fallback to pre-bundled window.NAAMII_PORTAL_DATA
      }
    }
    if (window.NAAMII_PORTAL_DATA) {
      return window.NAAMII_PORTAL_DATA;
    }
    throw new Error("Unable to load grants dataset.");
  }

  function getStatusClass(status) {
    switch (status) {
      case "Open Now":
        return "status-open";
      case "Rolling":
        return "status-rolling";
      case "Upcoming":
        return "status-upcoming";
      default:
        return "status-paused";
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case "Open Now":
        return "● Open Now";
      case "Rolling":
        return "↻ Rolling";
      case "Upcoming":
        return "◷ Upcoming 2027";
      default:
        return "⏸ Watch / Paused";
    }
  }

  function getPathwayClass(pathway) {
    switch (pathway) {
      case "Direct Lead":
        return "pathway-direct";
      case "Consortium / Co-PI":
        return "pathway-consortium";
      case "Compute / Hardware":
        return "pathway-compute";
      default:
        return "pathway-fellowship";
    }
  }

  function getPathwayLabel(pathway) {
    switch (pathway) {
      case "Direct Lead":
        return "🇳🇵 Direct Lead";
      case "Consortium / Co-PI":
        return "🤝 Consortium / Co-PI";
      case "Compute / Hardware":
        return "⚡ Compute / Hardware";
      default:
        return "🎓 Fellowship / Individual";
    }
  }

  function getDaysUntil(isoDate) {
    if (!isoDate) return null;
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const parts = isoDate.split("-").map(Number);
    if (parts.length !== 3) return null;
    const targetUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    return Math.round((targetUtc - todayUtc) / 86400000);
  }

  function formatCountdownChip(grant) {
    if (!grant.deadline) return "";
    const days = getDaysUntil(grant.deadline);
    if (days === null) return "";
    if (days < 0) {
      return `<span class="urgent-chip" style="color: var(--text-muted);">Cycle passed · Watch next round</span>`;
    }
    if (days === 0) {
      return `<span class="urgent-chip">Due Today!</span>`;
    }
    if (days <= 45) {
      return `<span class="urgent-chip">⚡ Due in ${days}d (${escapeHtml(grant.deadline)})</span>`;
    }
    return `<span class="urgent-chip" style="color: var(--text-muted);">In ${days} days (${escapeHtml(grant.deadline)})</span>`;
  }

  function matchesAmountBucket(grant, bucket) {
    if (bucket === "all") return true;
    const max = Number(grant.amountMax || 0);
    switch (bucket) {
      case "seed":
        return max <= 50000;
      case "mid":
        return max > 50000 && max <= 250000;
      case "large":
        return max > 250000 && max <= 1000000;
      case "mega":
        return max > 1000000;
      default:
        return true;
    }
  }

  function getFilteredGrants() {
    const q = state.search.trim().toLowerCase();

    const filtered = state.grants.filter((g) => {
      if (state.shortlistOnly && !state.shortlist.has(g.id)) return false;

      // Preset special multi-conditions
      if (state.activePreset === "open-rolling") {
        if (g.status !== "Open Now" && g.status !== "Rolling") return false;
      } else if (state.activePreset === "infra-compute") {
        if (g.category !== "AI Infrastructure" && g.pathway !== "Compute / Hardware") return false;
      } else if (state.activePreset === "direct-nepal-kpi") {
        if (g.pathway !== "Direct Lead" && g.pathway !== "Compute / Hardware") return false;
      } else if (state.activePreset === "health-infra-kpi") {
        if (g.category !== "Healthcare AI" && g.category !== "AI Infrastructure") return false;
      }

      if (state.category !== "all" && g.category !== state.category) return false;
      if (state.pathway !== "all" && g.pathway !== state.pathway) return false;
      if (state.status !== "all" && g.status !== state.status) return false;
      if (state.group !== "all" && !(g.naamiiGroups || []).includes(state.group)) return false;
      if (!matchesAmountBucket(g, state.amount)) return false;

      if (q) {
        const haystack = [
          g.title,
          g.funder,
          g.funderType,
          g.category,
          g.pathway,
          g.status,
          g.summary,
          g.nepalEligibility,
          g.naamiiStrategy,
          g.amountDisplay,
          ...(g.subcategories || []),
          ...(g.naamiiGroups || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (state.sort === "fit") {
        return (b.fitScore || 0) - (a.fitScore || 0);
      }
      if (state.sort === "amount-desc") {
        return (b.amountMax || 0) - (a.amountMax || 0);
      }
      if (state.sort === "direct-first") {
        const rank = { "Direct Lead": 1, "Compute / Hardware": 2, "Individual / Fellowship": 3, "Consortium / Co-PI": 4 };
        const diff = (rank[a.pathway] || 9) - (rank[b.pathway] || 9);
        return diff !== 0 ? diff : (b.fitScore || 0) - (a.fitScore || 0);
      }
      if (state.sort === "title") {
        return a.title.localeCompare(b.title);
      }
      if (state.sort === "deadline") {
        const da = a.deadline ? getDaysUntil(a.deadline) : 99999;
        const db = b.deadline ? getDaysUntil(b.deadline) : 99999;
        const normA = da !== null && da >= 0 ? da : a.status === "Rolling" ? 5000 : 99999;
        const normB = db !== null && db >= 0 ? db : b.status === "Rolling" ? 5000 : 99999;
        return normA - normB;
      }
      return 0;
    });

    return filtered;
  }

  function hasActiveFilters() {
    return (
      state.search.trim() !== "" ||
      state.category !== "all" ||
      state.pathway !== "all" ||
      state.group !== "all" ||
      state.status !== "all" ||
      state.amount !== "all" ||
      state.activePreset !== "all" ||
      state.shortlistOnly
    );
  }

  function renderKPIs() {
    const total = state.grants.length;
    const openRolling = state.grants.filter((g) => g.status === "Open Now" || g.status === "Rolling").length;
    const directAndCompute = state.grants.filter(
      (g) => g.pathway === "Direct Lead" || g.pathway === "Compute / Hardware"
    ).length;
    const healthAndInfra = state.grants.filter(
      (g) => g.category === "Healthcare AI" || g.category === "AI Infrastructure"
    ).length;

    els.kpiTotal.textContent = String(total);
    els.kpiOpenRolling.textContent = String(openRolling);
    els.kpiDirect.textContent = String(directAndCompute);
    els.kpiHealthInfra.textContent = String(healthAndInfra);
  }

  function renderExternalPortals() {
    if (!els.externalPortalsGrid) return;
    els.externalPortalsGrid.innerHTML = state.externalPortals
      .map(
        (p) => `
        <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="db-card">
          <div class="db-card-top">
            <span class="db-cat">${escapeHtml(p.category)}</span>
            <span aria-hidden="true">↗</span>
          </div>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.tip)}</p>
        </a>
      `
      )
      .join("");
  }

  function renderGridView(grants) {
    return `
      <div class="grants-grid">
        ${grants
          .map((g) => {
            const isSaved = state.shortlist.has(g.id);
            return `
            <article class="grant-card" data-grant-id="${escapeHtml(g.id)}" tabindex="0" role="button" aria-label="${escapeHtml(g.title)}">
              <div class="card-top-row">
                <div class="badge-group">
                  <span class="badge ${getStatusClass(g.status)}">${getStatusLabel(g.status)}</span>
                  <span class="badge ${getPathwayClass(g.pathway)}">${getPathwayLabel(g.pathway)}</span>
                  ${g.autoDiscovered ? `<span class="badge badge-auto">✨ Weekly Sync</span>` : ""}
                </div>
                <button
                  type="button"
                  class="bookmark-btn ${isSaved ? "saved" : ""}"
                  data-bookmark-id="${escapeHtml(g.id)}"
                  title="${isSaved ? "Remove from pipeline shortlist" : "Save to pipeline shortlist"}"
                  aria-label="Bookmark grant"
                >
                  ★
                </button>
              </div>

              <div>
                <h3 class="card-title">${escapeHtml(g.title)}</h3>
                <div class="card-funder">${escapeHtml(g.funder)} · ${escapeHtml(g.funderType)}</div>
              </div>

              <div class="metrics-box">
                <div class="metric-col">
                  <span class="metric-label">Award / Support</span>
                  <span class="metric-val">${escapeHtml(g.amountDisplay)}</span>
                </div>
                <div class="metric-col">
                  <span class="metric-label">Window / Deadline</span>
                  <span class="metric-val">${escapeHtml(g.deadlineDisplay)}</span>
                  ${formatCountdownChip(g)}
                </div>
              </div>

              <p class="card-summary">${escapeHtml(g.summary)}</p>

              <div class="strategy-snippet">
                <strong>NAAMII Angle:</strong> ${escapeHtml(g.naamiiStrategy)}
              </div>

              <div class="tags-row">
                ${(g.naamiiGroups || [])
                  .map((grp) => `<span class="group-tag">${escapeHtml(grp)}</span>`)
                  .join("")}
              </div>

              <div class="card-footer">
                <span class="fit-pill">NAAMII Fit: ${escapeHtml(g.fitScore)}%</span>
                <div class="card-actions-inline">
                  <button type="button" class="card-link-btn" data-open-id="${escapeHtml(g.id)}">Details &amp; Playbook →</button>
                  <a href="${escapeHtml(g.url)}" target="_blank" rel="noopener noreferrer" class="card-link-btn" data-external-link="true">Portal ↗</a>
                </div>
              </div>
            </article>
          `;
          })
          .join("")}
      </div>
    `;
  }

  function renderTableView(grants) {
    return `
      <div class="table-wrap">
        <table class="grants-table">
          <thead>
            <tr>
              <th>★</th>
              <th>Program &amp; Funder</th>
              <th>Domain</th>
              <th>NAAMII Pathway</th>
              <th>Status &amp; Deadline</th>
              <th>Funding Range</th>
              <th>Fit</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            ${grants
              .map((g) => {
                const isSaved = state.shortlist.has(g.id);
                return `
                <tr data-grant-id="${escapeHtml(g.id)}">
                  <td>
                    <button
                      type="button"
                      class="bookmark-btn ${isSaved ? "saved" : ""}"
                      data-bookmark-id="${escapeHtml(g.id)}"
                      aria-label="Bookmark"
                    >★</button>
                  </td>
                  <td>
                    <div class="table-title">${escapeHtml(g.title)}</div>
                    <div class="table-funder">${escapeHtml(g.funder)}</div>
                  </td>
                  <td>${escapeHtml(g.category)}</td>
                  <td><span class="badge ${getPathwayClass(g.pathway)}">${getPathwayLabel(g.pathway)}</span></td>
                  <td>
                    <span class="badge ${getStatusClass(g.status)}">${getStatusLabel(g.status)}</span>
                    <div class="table-funder" style="margin-top:0.25rem;">${escapeHtml(g.deadlineDisplay)}</div>
                  </td>
                  <td>${escapeHtml(g.amountDisplay)}</td>
                  <td><span class="fit-pill">${escapeHtml(g.fitScore)}%</span></td>
                  <td>
                    <a href="${escapeHtml(g.url)}" target="_blank" rel="noopener noreferrer" data-external-link="true">Open ↗</a>
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTimelineView(grants) {
    const dated = grants
      .filter((g) => g.deadline && g.status !== "Rolling" && g.status !== "Paused / Watch")
      .slice()
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    const rolling = grants.filter((g) => g.status === "Rolling");
    const watch = grants.filter((g) => g.status === "Paused / Watch" || (!g.deadline && g.status !== "Rolling"));

    const monthGroups = new Map();
    dated.forEach((g) => {
      const [year, month] = g.deadline.split("-");
      const dateObj = new Date(Number(year), Number(month) - 1, 1);
      const label = dateObj.toLocaleString("en-US", { month: "long", year: "numeric" });
      if (!monthGroups.has(label)) monthGroups.set(label, []);
      monthGroups.get(label).push(g);
    });

    const renderBucket = (title, badgeText, list) => {
      if (!list.length) return "";
      return `
        <div class="timeline-bucket">
          <div class="timeline-bucket-header">
            <h3>${escapeHtml(title)}</h3>
            <span class="count-pill">${escapeHtml(badgeText)}</span>
          </div>
          <div class="timeline-items">
            ${list
              .map(
                (g) => `
              <div class="timeline-item" data-grant-id="${escapeHtml(g.id)}">
                <div class="badge-group" style="margin-bottom:0.4rem;">
                  <span class="badge ${getStatusClass(g.status)}">${getStatusLabel(g.status)}</span>
                  <span class="badge ${getPathwayClass(g.pathway)}">${getPathwayLabel(g.pathway)}</span>
                </div>
                <div class="table-title">${escapeHtml(g.title)}</div>
                <div class="table-funder">${escapeHtml(g.funder)} · <strong>${escapeHtml(g.amountDisplay)}</strong></div>
                <div class="table-funder" style="margin-top:0.3rem;">Window: ${escapeHtml(g.deadlineDisplay)}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    };

    let html = `<div class="timeline-list">`;
    if (rolling.length) {
      html += renderBucket("↻ Always Open & Rolling Submissions (Apply Anytime)", `${rolling.length} programs`, rolling);
    }
    for (const [monthLabel, items] of monthGroups.entries()) {
      html += renderBucket(`📅 ${monthLabel} Target Deadlines`, `${items.length} calls`, items);
    }
    if (watch.length) {
      html += renderBucket("⏸ Program Restructuring / Watchlist for 2027 Relaunch", `${watch.length} programs`, watch);
    }
    html += `</div>`;
    return html;
  }

  function renderGrants() {
    const filtered = getFilteredGrants();
    els.resultsCountText.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${state.grants.length}</strong> curated funding programs`;
    els.resetFiltersBtn.classList.toggle("hidden", !hasActiveFilters());
    els.clearSearchBtn.classList.toggle("hidden", state.search.trim() === "");

    if (!filtered.length) {
      els.grantsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No matching grants found</h3>
          <p>Try broadening your search terms or clearing active filters to view all 52+ global and regional programs.</p>
          <button type="button" class="btn btn-primary" id="emptyResetBtn">Reset All Filters</button>
        </div>
      `;
      const emptyBtn = document.getElementById("emptyResetBtn");
      if (emptyBtn) emptyBtn.addEventListener("click", resetAllFilters);
      return;
    }

    if (state.view === "table") {
      els.grantsContainer.innerHTML = renderTableView(filtered);
    } else if (state.view === "timeline") {
      els.grantsContainer.innerHTML = renderTimelineView(filtered);
    } else {
      els.grantsContainer.innerHTML = renderGridView(filtered);
    }
  }

  function openGrantDrawer(grantId) {
    const g = state.grants.find((item) => item.id === grantId);
    if (!g) return;
    state.activeGrantId = grantId;
    const isSaved = state.shortlist.has(g.id);

    els.drawerBadges.innerHTML = `
      <span class="badge ${getStatusClass(g.status)}">${getStatusLabel(g.status)}</span>
      <span class="badge ${getPathwayClass(g.pathway)}">${getPathwayLabel(g.pathway)}</span>
      <span class="badge pathway-fellowship">${escapeHtml(g.category)}</span>
    `;

    els.drawerContent.innerHTML = `
      <h2 id="drawerTitle" class="drawer-title">${escapeHtml(g.title)}</h2>
      <div class="drawer-funder">${escapeHtml(g.funder)} · <span>${escapeHtml(g.funderType)}</span></div>

      <div class="drawer-grid">
        <div class="drawer-stat">
          <div class="metric-label">Award / Compute Scale</div>
          <div class="metric-val">${escapeHtml(g.amountDisplay)}</div>
        </div>
        <div class="drawer-stat">
          <div class="metric-label">Submission Timeline</div>
          <div class="metric-val">${escapeHtml(g.deadlineDisplay)}</div>
          ${formatCountdownChip(g)}
        </div>
      </div>

      <div class="drawer-callout">
        <h4>🎯 NAAMII Strategic Playbook (Fit Score: ${escapeHtml(g.fitScore)}%)</h4>
        <p>${escapeHtml(g.naamiiStrategy)}</p>
      </div>

      <div class="drawer-section">
        <h4>🇳🇵 Nepal &amp; LMIC Institutional Eligibility</h4>
        <p>${escapeHtml(g.nepalEligibility)}</p>
      </div>

      <div class="drawer-section">
        <h4>Program Scope &amp; Thematic Priorities</h4>
        <p>${escapeHtml(g.summary)}</p>
      </div>

      <div class="drawer-section">
        <h4>Relevant NAAMII Labs &amp; Thematic Tags</h4>
        <div class="tags-row" style="margin-top:0.45rem;">
          ${(g.naamiiGroups || []).map((grp) => `<span class="group-tag">${escapeHtml(grp)}</span>`).join("")}
          ${(g.subcategories || []).map((sub) => `<span class="group-tag">${escapeHtml(sub)}</span>`).join("")}
        </div>
      </div>

      <div class="drawer-cta-bar">
        <a href="${escapeHtml(g.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          Open Official Funder Portal ↗
        </a>
        <button type="button" class="btn btn-outline" id="drawerBookmarkBtn">
          ${isSaved ? "★ Saved in Pipeline" : "☆ Save to Pipeline"}
        </button>
        ${
          g.deadline
            ? `<button type="button" class="btn btn-outline" id="drawerIcsBtn">📅 Add Deadline (.ics)</button>`
            : ""
        }
        <button type="button" class="btn btn-outline" id="drawerShareBtn">⎘ Copy Direct Link</button>
      </div>
    `;

    els.grantDrawerBackdrop.classList.remove("hidden");
    els.grantDrawerBackdrop.setAttribute("aria-hidden", "false");
    history.replaceState(null, "", `#grant=${encodeURIComponent(g.id)}`);

    const bmBtn = document.getElementById("drawerBookmarkBtn");
    if (bmBtn) {
      bmBtn.addEventListener("click", () => {
        toggleBookmark(g.id);
        openGrantDrawer(g.id);
      });
    }

    const icsBtn = document.getElementById("drawerIcsBtn");
    if (icsBtn) {
      icsBtn.addEventListener("click", () => downloadIcsReminder(g));
    }

    const shareBtn = document.getElementById("drawerShareBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}#grant=${encodeURIComponent(g.id)}`;
        navigator.clipboard.writeText(shareUrl).then(() => showToast("Direct grant link copied to clipboard!"));
      });
    }
  }

  function closeGrantDrawer() {
    state.activeGrantId = null;
    els.grantDrawerBackdrop.classList.add("hidden");
    els.grantDrawerBackdrop.setAttribute("aria-hidden", "true");
    if (window.location.hash.startsWith("#grant=")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  function toggleBookmark(grantId) {
    if (state.shortlist.has(grantId)) {
      state.shortlist.delete(grantId);
      showToast("Removed from Pipeline Shortlist");
    } else {
      state.shortlist.add(grantId);
      showToast("Saved to Pipeline Shortlist ★");
    }
    saveShortlist();
    renderGrants();
  }

  function downloadIcsReminder(grant) {
    if (!grant.deadline) return;
    const cleanDate = grant.deadline.replace(/-/g, "");
    const uid = `${grant.id}@naamii-grant-radar`;
    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//NAAMII Grant Radar//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${cleanDate}T090000Z`,
      `DTSTART;VALUE=DATE:${cleanDate}`,
      `SUMMARY:Grant Deadline: ${grant.title.replace(/[,;]/g, " ")}`,
      `DESCRIPTION:Funder: ${grant.funder}\\nAmount: ${grant.amountDisplay}\\nPortal: ${grant.url}`,
      `URL:${grant.url}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsLines], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${grant.id}-deadline.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Downloaded calendar reminder (.ics)");
  }

  function exportFilteredCsv() {
    const list = getFilteredGrants();
    if (!list.length) {
      showToast("No grants in current filter to export.");
      return;
    }

    const headers = [
      "Title",
      "Funder",
      "Category",
      "NAAMII Pathway",
      "Status",
      "Deadline",
      "Deadline Notes",
      "Funding",
      "NAAMII Fit %",
      "Nepal Eligibility",
      "NAAMII Strategy",
      "Official URL",
    ];

    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = list.map((g) =>
      [
        g.title,
        g.funder,
        g.category,
        g.pathway,
        g.status,
        g.deadline || "Rolling/TBD",
        g.deadlineDisplay,
        g.amountDisplay,
        g.fitScore,
        g.nepalEligibility,
        g.naamiiStrategy,
        g.url,
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `naamii-grants-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${list.length} grants to CSV`);
  }

  function copyMarkdownBrief() {
    const list = getFilteredGrants().slice(0, 15);
    if (!list.length) {
      showToast("No grants to copy.");
      return;
    }

    const lines = [
      `### NAAMII Grant & Funding Brief (${new Date().toISOString().slice(0, 10)})`,
      `_Showing top ${list.length} matching calls:_`,
      "",
      ...list.map(
        (g, idx) =>
          `${idx + 1}. **${g.title}** — *${g.funder}*\n   - **Pathway:** ${g.pathway} | **Status:** ${g.status} (${g.deadlineDisplay})\n   - **Funding:** ${g.amountDisplay}\n   - **NAAMII Angle:** ${g.naamiiStrategy}\n   - **Link:** ${g.url}`
      ),
    ];

    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => showToast(`Copied Markdown brief (${list.length} grants) to clipboard!`));
  }

  function applyPreset(preset) {
    // Reset individual dropdowns cleanly before applying preset
    state.category = "all";
    state.pathway = "all";
    state.group = "all";
    state.status = "all";
    state.amount = "all";
    state.activePreset = preset;

    if (preset === "direct-lead") {
      state.pathway = "Direct Lead";
    } else if (preset === "healthcare") {
      state.category = "Healthcare AI";
    } else if (preset === "consortium") {
      state.pathway = "Consortium / Co-PI";
    } else if (preset === "fellowships") {
      state.category = "Fellowships & Capacity";
    }

    syncFilterInputs();
    renderGrants();
  }

  function resetAllFilters() {
    state.search = "";
    state.category = "all";
    state.pathway = "all";
    state.group = "all";
    state.status = "all";
    state.amount = "all";
    state.activePreset = "all";
    state.shortlistOnly = false;
    syncFilterInputs();
    updateShortlistUI();
    renderGrants();
  }

  function syncFilterInputs() {
    els.searchInput.value = state.search;
    els.categoryFilter.value = state.category;
    els.pathwayFilter.value = state.pathway;
    els.groupFilter.value = state.group;
    els.statusFilter.value = state.status;
    els.amountFilter.value = state.amount;
    els.sortSelect.value = state.sort;

    document.querySelectorAll(".preset-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.preset === state.activePreset);
    });
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", (e) => {
      state.search = e.target.value;
      renderGrants();
    });

    els.clearSearchBtn.addEventListener("click", () => {
      state.search = "";
      els.searchInput.value = "";
      els.searchInput.focus();
      renderGrants();
    });

    const onDropdownChange = () => {
      state.activePreset = "custom";
      state.category = els.categoryFilter.value;
      state.pathway = els.pathwayFilter.value;
      state.group = els.groupFilter.value;
      state.status = els.statusFilter.value;
      state.amount = els.amountFilter.value;
      document.querySelectorAll(".preset-chip").forEach((chip) => chip.classList.remove("active"));
      renderGrants();
    };

    els.categoryFilter.addEventListener("change", onDropdownChange);
    els.pathwayFilter.addEventListener("change", onDropdownChange);
    els.groupFilter.addEventListener("change", onDropdownChange);
    els.statusFilter.addEventListener("change", onDropdownChange);
    els.amountFilter.addEventListener("change", onDropdownChange);

    els.sortSelect.addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderGrants();
    });

    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.view = btn.dataset.view;
        document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b === btn));
        renderGrants();
      });
    });

    els.presetChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".preset-chip");
      if (!chip) return;
      applyPreset(chip.dataset.preset);
    });

    document.querySelectorAll(".kpi-card").forEach((card) => {
      card.addEventListener("click", () => {
        const kpi = card.dataset.kpiPreset;
        resetAllFilters();
        if (kpi === "open-rolling") {
          applyPreset("open-rolling");
        } else if (kpi === "direct-nepal") {
          state.activePreset = "direct-nepal-kpi";
          document.querySelectorAll(".preset-chip").forEach((c) => c.classList.remove("active"));
          renderGrants();
        } else if (kpi === "health-infra") {
          state.activePreset = "health-infra-kpi";
          document.querySelectorAll(".preset-chip").forEach((c) => c.classList.remove("active"));
          renderGrants();
        }
        document.getElementById("explorer").scrollIntoView({ behavior: "smooth" });
      });
    });

    els.resetFiltersBtn.addEventListener("click", resetAllFilters);
    els.brandReset.addEventListener("click", (e) => {
      e.preventDefault();
      resetAllFilters();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    els.shortlistToggleBtn.addEventListener("click", () => {
      state.shortlistOnly = !state.shortlistOnly;
      updateShortlistUI();
      renderGrants();
    });

    els.themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });

    els.exportCsvBtn.addEventListener("click", exportFilteredCsv);
    els.copyMarkdownBtn.addEventListener("click", copyMarkdownBrief);

    // Delegated clicks inside grantsContainer
    els.grantsContainer.addEventListener("click", (e) => {
      if (e.target.closest("[data-external-link]")) {
        return; // Allow normal external portal navigation
      }
      const bm = e.target.closest("[data-bookmark-id]");
      if (bm) {
        e.stopPropagation();
        toggleBookmark(bm.dataset.bookmarkId);
        return;
      }
      const cardOrRow = e.target.closest("[data-grant-id]");
      if (cardOrRow) {
        openGrantDrawer(cardOrRow.dataset.grantId);
      }
    });

    els.grantsContainer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".grant-card");
        if (card && e.target === card) {
          e.preventDefault();
          openGrantDrawer(card.dataset.grantId);
        }
      }
    });

    // Drawer & Modal Closing
    els.closeDrawerBtn.addEventListener("click", closeGrantDrawer);
    els.grantDrawerBackdrop.addEventListener("click", (e) => {
      if (e.target === els.grantDrawerBackdrop) closeGrantDrawer();
    });

    els.openSubmitModalBtn.addEventListener("click", () => {
      els.submitModalBackdrop.classList.remove("hidden");
      els.submitModalBackdrop.setAttribute("aria-hidden", "false");
    });

    const closeSubmitModal = () => {
      els.submitModalBackdrop.classList.add("hidden");
      els.submitModalBackdrop.setAttribute("aria-hidden", "true");
    };

    els.closeSubmitModalBtn.addEventListener("click", closeSubmitModal);
    els.submitModalBackdrop.addEventListener("click", (e) => {
      if (e.target === els.submitModalBackdrop) closeSubmitModal();
    });

    // Suggest Grant JSON Generator
    els.suggestGrantForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("sgTitle").value.trim();
      const funder = document.getElementById("sgFunder").value.trim();
      const url = document.getElementById("sgUrl").value.trim();
      const category = document.getElementById("sgCategory").value;
      const pathway = document.getElementById("sgPathway").value;
      const status = document.getElementById("sgStatus").value;
      const deadline = document.getElementById("sgDeadline").value || null;
      const amountDisplay = document.getElementById("sgAmount").value.trim();
      const summary = document.getElementById("sgSummary").value.trim();

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 42);

      const entry = {
        id: slug || `grant-${Date.now()}`,
        title,
        funder,
        funderType: "International Funder",
        category,
        subcategories: ["AI Research", "LMIC / Nepal"],
        naamiiGroups: [
          category === "Healthcare AI"
            ? "TOGAI / TrAI (Health AI)"
            : category === "AI Infrastructure"
            ? "AI Infra & Compute"
            : "Fundamental ML, NLP & Vision",
        ],
        pathway,
        status,
        deadline,
        deadlineDisplay: deadline || (status === "Rolling" ? "Rolling / Always Open" : "Check Official Portal"),
        amountMin: 50000,
        amountMax: 250000,
        amountDisplay,
        nepalEligibility:
          pathway === "Direct Lead"
            ? "Nepal-based research institutes eligible to apply directly."
            : "Eligible via international partnership or individual researcher track.",
        summary,
        naamiiStrategy: "Submitted via NAAMII Grant Radar community form. Review scope and assign PI lead.",
        fitScore: 90,
        url,
      };

      els.generatedJson.value = JSON.stringify(entry, null, 2);
      els.generatedJsonWrap.classList.remove("hidden");
      els.copyGeneratedJsonBtn.classList.remove("hidden");
      showToast("JSON snippet generated!");
    });

    els.copyGeneratedJsonBtn.addEventListener("click", () => {
      navigator.clipboard
        .writeText(els.generatedJson.value)
        .then(() => showToast("Copied JSON entry to clipboard!"));
    });

    // Global Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== els.searchInput && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        els.searchInput.focus();
      } else if (e.key === "Escape") {
        if (!els.grantDrawerBackdrop.classList.contains("hidden")) closeGrantDrawer();
        if (!els.submitModalBackdrop.classList.contains("hidden")) closeSubmitModal();
      }
    });
  }

  async function init() {
    cacheElements();
    loadPreferences();
    bindEvents();

    try {
      const data = await loadPortalData();
      state.grants = (data.grants || []).map((g) => {
        // Real-time mid-week status safeguard between 7-day CI runs
        if (g.deadline && g.status === "Open Now") {
          const days = getDaysUntil(g.deadline);
          if (days !== null && days < 0) {
            return {
              ...g,
              status: "Upcoming",
              deadlineDisplay: `Cycle closed ${g.deadline} · Watch next round`,
            };
          }
        }
        return g;
      });
      state.externalPortals = data.externalPortals || [];
      state.metadata = data.metadata || {};

      if (state.metadata.lastUpdated && els.lastUpdatedBadge) {
        const nextText = state.metadata.nextScheduledUpdate
          ? ` · Next sync: ${state.metadata.nextScheduledUpdate}`
          : "";
        els.lastUpdatedBadge.innerHTML = `<span class="sync-dot" aria-hidden="true"></span><span>Auto-updates every 7d · Last: ${escapeHtml(
          state.metadata.lastUpdated
        )}${escapeHtml(nextText)}</span>`;
      }

      renderKPIs();
      updateShortlistUI();
      renderExternalPortals();
      renderGrants();

      // Open deep-linked grant if hash matches #grant=<id>
      if (window.location.hash.startsWith("#grant=")) {
        const targetId = decodeURIComponent(window.location.hash.slice("#grant=".length));
        openGrantDrawer(targetId);
      }
    } catch (err) {
      els.grantsContainer.innerHTML = `
        <div class="empty-state">
          <h3>Failed to load grant database</h3>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
