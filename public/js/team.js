// Team page JavaScript
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

const name = new URLSearchParams(location.search).get("name") || "";
document.getElementById("h").textContent = name;
document.title = name;

const card = (t, inner) => '<div class="card"><h2>' + esc(t) + '</h2>' + inner + '</div>';

function table(rows, team) {
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== "page" && k !== "group" && k !== "imageUrl" && k !== "imageFile");
    return '<table><tr>' + cols.map(c => '<th>' + esc(c) + '</th>').join("") + '</tr>' + rows.map(r => '<tr>' + cols.map(c => {
        const v = esc(r[c] || "");
        const imgUrl = r.imageUrl || r.imageFile;
        const img = imgUrl ? '<img class="player-img player-img-table" src="' + esc(imgUrl) + '" alt="">' : '';
        return '<td>' + (c === "id" && r.page ? '<a href="player.html?id=' + encodeURIComponent(r.page) + '&team=' + encodeURIComponent(team) + '">' + img + v + '</a>' : (c === "id" ? img + v : v)) + '</td>';
    }).join("") + '</tr>').join("") + '</table>';
}

async function load() {
    let h = "";
    const r = await fetch("/api/team/" + encodeURIComponent(name)).catch(() => null);
    
    if (!r) {
        h += card("Error", "<p>Could not reach the server.</p>");
    } else if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        h += card("No Liquipedia data", e.error === "no_page" ?
            "<p>Liquipedia has no page matching this team name.</p>" :
            '<p>This team has not been imported yet (' + (e.imported || 0) + ' teams in the data file). Run:</p><p><code>node scrape-liquipedia.js --teams="' + esc(name) + '"</code></p><p class="mu">then reload this page.</p>');
    } else {
        const t = await r.json();
        if (t.v < 3) h += card("Outdated data", '<p>Re-run <code>node scrape-liquipedia.js --teams="' + esc(name) + '"</code> to refresh (adds the logo).</p>');
        
        if (t.logoFile) {
            const renderLogo = () => {
                const dark = document.documentElement.getAttribute("data-theme") === "dark";
                const src = dark && t.logoDarkFile ? t.logoDarkFile : t.logoFile;
                document.getElementById("h").innerHTML = '<img class="lg" src="' + esc(src) + '" alt=""><span>' + esc(name) + '</span>';
            };
            renderLogo();
            window.addEventListener("themechange", renderLogo);
        }
        
        const info = Object.entries(t.info || {});
        h += card("Overview", (t.intro ? '<p>' + esc(t.intro).replace(/\n\n/g, "</p><p>") + '</p>' : "") + (info.length ? '<table>' + info.map(([k, v]) => '<tr><td class="k">' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join("") + '</table>' : '<p class="mu">No overview fields found.</p>') + '<p><a href="' + esc(t.url) + '" target="_blank" rel="noopener">Liquipedia page ↗</a></p>');
        
        const groups = {};
        (t.players || []).forEach(p => (groups[p.group || "Roster"] = groups[p.group || "Roster"] || []).push(p));
        h += Object.keys(groups).length ? Object.entries(groups).map(([g, rows]) => card("Player roster · " + g, table(rows, name))).join("") : card("Player roster", '<p class="mu">None found.</p>');
        
        const og = {};
        (t.org || []).forEach(p => (og[p.group || "Staff"] = og[p.group || "Staff"] || []).push(p));
        h += Object.keys(og).length ? Object.entries(og).map(([g, rows]) => card("Organization roster · " + g, table(rows, name))).join("") : card("Organization roster", '<p class="mu">None found.</p>');
        
        h += card("Achievements (" + (t.achievements || []).length + ")", (t.achievements || []).length ? table(t.achievements, name) : '<p class="mu">None found.</p>');
    }
    
    try {
        const d = await (await fetch("/api/matches")).json();
        const L = d.matches.filter(m => m.a === name || m.b === name).sort((x, y) => y.t.localeCompare(x.t)).slice(0, 20);
        if (L.length) h += card("Recent matches", L.map(m => '<div class="mm"><span class="mu">' + esc(m.t.replace("T", " ")) + '</span><span>' + esc(m.a) + ' vs ' + esc(m.b) + '</span><b>' + esc(m.sc || "") + '</b></div>').join(""));
    } catch (e) {}
    
    document.getElementById("body").innerHTML = h;
}

load();
