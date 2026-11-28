// Schedule page JavaScript
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

let M = [], LG = {}, EL = {}, view = "upcoming";
const FKEY = "schedule.filters";
const selE = new Set(), selT = new Set();
let pendingLoads = 3; // matches, logos, event-logos
let isInitialLoad = true;

// Load filters from localStorage
try {
    const f = JSON.parse(localStorage.getItem(FKEY) || "{}");
    if (f.view === "upcoming" || f.view === "results") view = f.view;
    (f.e || []).forEach(k => selE.add(k));
    (f.t || []).forEach(k => selT.add(k));
} catch (e) {}

// Logo function - picks dark variant based on the app's manual theme, not the system
const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
function logo(n) {
    if (!LG) return `<span class="lg ph">${esc((n || "?")[0])}</span>`;
    const l = LG[n];
    if (!l) return `<span class="lg ph">${esc((n || "?")[0])}</span>`;
    const src = isDark() && l.d ? l.d : l.l;
    return `<img class="lg" src="${esc(src)}" alt="" loading="lazy">`;
}

// Event logo function
function eventLogo(n) {
    if (!EL) return `<span class="lg ph">${esc((n || "?")[0])}</span>`;
    const l = EL[n];
    if (!l) return `<span class="lg ph">${esc((n || "?")[0])}</span>`;
    return `<img class="lg" src="${esc(l.l)}" alt="" loading="lazy">`;
}

// Save filters
function saveFilters() {
    try {
        localStorage.setItem(FKEY, JSON.stringify({ view, e: [...selE], t: [...selT] }));
    } catch (e) {}
}

// Count occurrences
function counts(f) {
    const o = {};
    M.forEach(m => f(m).forEach(k => { if (k && k !== "TBD") o[k] = (o[k] || 0) + 1; }));
    return o;
}

// Render facet filters
function facet(id, q, sel, o, isEvent) {
    const el = $(id);
    if (!el) return;

    // Ensure logo functions are available
    if (typeof logo !== 'function' || typeof eventLogo !== 'function') {
        console.error('Logo functions not available');
        return;
    }

    // Get the container for the list content
    let content = el.querySelector('.list-content');
    const searchId = id === "le" ? "se" : "st";
    const placeholder = id === "le" ? "Search events..." : "Search teams...";
    if (!content) {
        // Create the collapsible list structure if it doesn't exist.
        // The search input lives inside the collapsible area, above the list.
        el.innerHTML = `
            <div class="list-header" data-target="${id}-content">
                <span class="list-title">${isEvent ? 'Events' : 'Teams'}</span>
                <span class="list-toggle">▼</span>
            </div>
            <div class="list-content" id="${id}-content">
                <div class="list-search"><input type="search" id="${searchId}" placeholder="${placeholder}" /></div>
                <div class="list-items">
                ${Object.keys(o)
                    .sort()
                    .filter(k => k.toLowerCase().includes(q.toLowerCase()))
                    .map(k => {
                        const logoHtml = isEvent ? eventLogo(k) : logo(k);
                        return `
                            <div class="list-item ${sel.has(k) ? 'selected' : ''}" data-k="${esc(k)}">
                                ${logoHtml}
                                <span class="list-name">${esc(k)}</span>
                                <span class="list-count">${o[k]}</span>
                            </div>
                        `;
                    }).join("") || '<div class="empty">None</div>'}
                </div>
            </div>
        `;
        
        // Add click handlers for the header and items
        const header = el.querySelector('.list-header');
        const toggle = header.querySelector('.list-toggle');
        const contentEl = el.querySelector('.list-content');
        const searchInput = el.querySelector('#' + searchId);
        if (searchInput) searchInput.oninput = render;

        // Check if the list should be collapsed by default
        const shouldCollapse = localStorage.getItem(`filter-${id}-collapsed`) === 'true';
        if (shouldCollapse) {
            contentEl.classList.add('collapsed');
            toggle.textContent = '▶';
        }

        header.onclick = () => {
            contentEl.classList.toggle('collapsed');
            toggle.textContent = contentEl.classList.contains('collapsed') ? '▶' : '▼';
            // Save the collapsed state
            localStorage.setItem(`filter-${id}-collapsed`, contentEl.classList.contains('collapsed') ? 'true' : 'false');
        };

        // Add click handlers for list items
        el.querySelectorAll('.list-item').forEach(item => {
            item.onclick = () => {
                const key = item.dataset.k;
                if (sel.has(key)) {
                    sel.delete(key);
                    item.classList.remove('selected');
                } else {
                    sel.add(key);
                    item.classList.add('selected');
                }
                render();
            };
        });
    } else {
        // Update existing list content
        const items = content.querySelector('.list-items');
        if (items) items.innerHTML = Object.keys(o)
            .sort()
            .filter(k => k.toLowerCase().includes(q.toLowerCase()))
            .map(k => {
                const logoHtml = isEvent ? eventLogo(k) : logo(k);
                return `
                    <div class="list-item ${sel.has(k) ? 'selected' : ''}" data-k="${esc(k)}">
                        ${logoHtml}
                        <span class="list-name">${esc(k)}</span>
                        <span class="list-count">${o[k]}</span>
                    </div>
                `;
            }).join("") || '<div class="empty">None</div>';
        el.querySelectorAll('.list-item').forEach(item => {
            item.onclick = () => {
                const key = item.dataset.k;
                if (sel.has(key)) {
                    sel.delete(key);
                    item.classList.remove('selected');
                } else {
                    sel.add(key);
                    item.classList.add('selected');
                }
                render();
            };
        });
    }
}

// Render the schedule
function render() {
    // Show loading message initially
    if (isInitialLoad && pendingLoads > 0) {
        $("out").innerHTML = '<div class="empty">Loading matches...</div>';
        return;
    }

    // Only render if we have data
    if (M.length === 0 && pendingLoads === 0) {
        $("out").innerHTML = '<div class="empty">No matches found.</div>';
        return;
    }

    // Ensure logo functions are available
    if (typeof logo !== 'function' || typeof eventLogo !== 'function') {
        console.error('Logo functions not available');
        return;
    }

    saveFilters();
    facet("le", $("se") ? $("se").value : "", selE, counts(m => [m.e]), true); // true for events
    facet("lt", $("st") ? $("st").value : "", selT, counts(m => [m.a, m.b]), false); // false for teams

    const up = view === "upcoming";
    const L = M.filter(m => up ? m.status !== "Completed" : m.status === "Completed")
        .filter(m => (!selE.size || selE.has(m.e)) && (!selT.size || selT.has(m.a) || selT.has(m.b)))
        .sort((x, y) => up ? x.t.localeCompare(y.t) : y.t.localeCompare(x.t));

    // Render chips
    $("chips").innerHTML = [...selE].map(k => {
        const logoHtml = eventLogo(k);
        return `<span class="chip" data-g="e" data-k="${esc(k)}">${logoHtml}<span class="chip-name">${esc(k)}</span> ×</span>`;
    }).join("") +
    [...selT].map(k => {
        const logoHtml = logo(k);
        return `<span class="chip" data-g="t" data-k="${esc(k)}">${logoHtml}<span class="chip-name">${esc(k)}</span> ×</span>`;
    }).join("");

    $("chips").querySelectorAll(".chip").forEach(x => (x.onclick = () => {
        (x.dataset.g === "e" ? selE : selT).delete(x.dataset.k);
        render();
    }));

    // Render matches
    let h = "", last = "";
    for (const m of L) {
        const day = m.t.slice(0, 10);
        if (day !== last) {
            last = day;
            h += `<div class="day">${esc(new Date(day + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}</div>`;
        }
        const s = m.sc ? m.sc.split("-").map(Number) : null;
        h += `<div class="m"><div class="t">${esc(m.t.slice(11))}</div>
            <div class="tm r ${s && s[0] > s[1] ? "w" : ""}"><a href="team.html?name=${encodeURIComponent(m.a)}">${logo(m.a)}<span>${esc(m.a)}</span>${s ? `<span class="tsc">${s[0]}</span>` : ""}</a></div>
            <div class="sc ${m.status === "LIVE" ? "live" : ""}">${m.status === "LIVE" ? "LIVE" : s ? s[0] + " : " + s[1] : "vs"}</div>
            <div class="tm ${s && s[1] > s[0] ? "w" : ""}"><a href="team.html?name=${encodeURIComponent(m.b)}">${logo(m.b)}<span>${esc(m.b)}</span>${s ? `<span class="tsc">${s[1]}</span>` : ""}</a></div>
            <div class="evl">${eventLogo(m.e)}</div>
            <div class="ev"><a href="event.html?name=${encodeURIComponent(m.e)}">${esc(m.e)}</a>${m.s ? " · " + esc(m.s) : ""} · <a href="${esc(m.url)}" target="_blank" rel="noopener">vlr.gg ↗</a></div></div>`;
    }
    $("out").innerHTML = h || '<div class="empty">No matches for these filters.</div>';

    isInitialLoad = false;
}

// Load data
async function load() {
    pendingLoads = 3;
    isInitialLoad = true;

    // Show loading state immediately
    $("out").innerHTML = '<div class="empty">Loading matches...</div>';

    try {
        const r = await fetch("/api/matches");
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        M = d.matches;
        pendingLoads--;
        if (pendingLoads === 0) render();
    } catch (e) {
        console.error("Failed to load matches:", e);
        pendingLoads--;
        if (pendingLoads === 0) render();
    }

    try {
        const r = await fetch("/api/logos");
        if (r.ok) {
            LG = await r.json();
        }
        pendingLoads--;
        if (pendingLoads === 0) render();
    } catch (e) {
        console.error("Failed to load logos:", e);
        pendingLoads--;
        if (pendingLoads === 0) render();
    }

    try {
        const r = await fetch("/api/event-logos");
        if (r.ok) {
            EL = await r.json();
        }
        pendingLoads--;
        if (pendingLoads === 0) render();
    } catch (e) {
        console.error("Failed to load event logos:", e);
        pendingLoads--;
        if (pendingLoads === 0) render();
    }
}

// Initialize
$("tu").onclick = () => { view = "upcoming"; $("tu").className = "on"; $("tr").className = ""; render(); };
$("tr").onclick = () => { view = "results"; $("tr").className = "on"; $("tu").className = ""; render(); };
// Note: the #se/#st search inputs are created inside facet() during render(),
// so their oninput handlers are attached there — not here.
$("ce").onclick = (e) => { e.preventDefault(); selE.clear(); render(); };
$("ct").onclick = (e) => { e.preventDefault(); selT.clear(); render(); };
$("rf").onclick = load;

// Set initial tab state
$("tu").className = view === "upcoming" ? "on" : "";
$("tr").className = view === "results" ? "on" : "";

// Login button
const loginBtn = $("login-btn");
if (loginBtn) {
    loginBtn.onclick = () => {
        alert("Login functionality will be implemented in a future update.");
    };
}

// Initial load - call it immediately
load();
setInterval(load, 2 * 60 * 1000);
