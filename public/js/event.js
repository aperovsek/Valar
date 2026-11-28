// Event page JavaScript
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

const name = new URLSearchParams(location.search).get("name") || "";
document.getElementById("h").textContent = name;
document.title = name;

const card = (t, inner) => '<div class="card"><h2>' + esc(t) + '</h2>' + inner + '</div>';

async function load() {
    let h = "";
    const r = await fetch("/api/event/" + encodeURIComponent(name)).catch(() => null);
    
    if (!r) {
        h += card("Error", "<p>Could not reach the server.</p>");
    } else if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        h += card("Event not found", '<p>This event has not been imported yet.</p><p class="mu">Run: <code>node scrape-events.js</code></p>');
    } else {
        const e = await r.json();
        
        // Display event logo and name in header
        if (e.logo) {
            document.getElementById("h").innerHTML = '<img class="event-header-logo" src="' + esc(e.logo) + '" alt="">' + esc(name);
        }
        
        const info = e.info || {};
        
        // Display specific fields in a summary section
        const details = [];
        if (info["Start Date"] || info["Date"]) {
            details.push('<span class="mm"><b>Start Date:</b> ' + esc(info["Start Date"] || info["Date"]) + '</span>');
        }
        if (info["End Date"]) {
            details.push('<span class="mm"><b>End Date:</b> ' + esc(info["End Date"]) + '</span>');
        }
        if (info["Prize Pool"] || info["Prize"]) {
            details.push('<span class="mm"><b>Prize Pool:</b> ' + esc(info["Prize Pool"] || info["Prize"]) + '</span>');
        }
        if (info["Region"] || info["Location"]) {
            details.push('<span class="mm"><b>Region:</b> ' + esc(info["Region"] || info["Location"]) + '</span>');
        }
        if (info["Teams"]) {
            details.push('<span class="mm"><b>Teams:</b> ' + esc(info["Teams"]) + '</span>');
        }
        
        if (details.length > 0) {
            h += card("Event Details", details.join(""));
        }
        
        // Display all info fields in a table
        if (Object.keys(info).length > 0) {
            h += card("Full Information", '<table>' + Object.entries(info).map(([k, v]) => 
                '<tr><td class="k">' + esc(k) + '</td><td>' + esc(v) + '</td></tr>'
            ).join("") + '</table>');
        }
        
        // Display event link
        h += '<p><a href="' + esc(e.url) + '" target="_blank" rel="noopener">vlr.gg page ↗</a></p>';
        
        // Load and display matches for this event
        h += await loadMatches(name);
        
        // Load and display participating teams
        h += await loadTeams(name);
    }
    
    document.getElementById("body").innerHTML = h;
}

async function loadMatches(eventName) {
    let h = "";
    try {
        const r = await fetch("/api/matches");
        if (!r.ok) throw 0;
        const d = await r.json();
        const L = d.matches.filter(m => m.e === eventName).sort((a, b) => b.t.localeCompare(a.t));
        
        if (L.length) {
            // Load team logos
            const lr = await fetch("/api/logos");
            const logos = lr.ok ? await lr.json() : {};
            
            // Team logo helper - dark variant follows the app's manual theme
            const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
            const tl = (n) => {
                const l = logos[n];
                if (!l) return '<span class="match-team-logo ph">' + esc((n || "?")[0]) + '</span>';
                const src = isDark() && l.d ? l.d : l.l;
                return '<img class="match-team-logo" src="' + esc(src) + '" alt="" loading="lazy">';
            };
            
            const matchesHtml = L.map(m => {
                const s = m.sc ? m.sc.split("-").map(Number) : null;
                const sc = s ? s[0] + " : " + s[1] : "vs";
                const st = m.status === "LIVE" ? "LIVE" : (m.status === "Completed" ? "Completed" : "Upcoming");
                
                return '<a href="' + esc(m.url) + '" target="_blank" rel="noopener" class="match-item">' +
                    '<span class="match-time">' + esc(m.t.slice(11)) + '</span>' +
                    '<div class="match-teams">' +
                        '<span class="match-team">' + tl(m.a) + '<span>' + esc(m.a) + '</span></span>' +
                        '<span class="match-vs">' + sc + '</span>' +
                        '<span class="match-team">' + tl(m.b) + '<span>' + esc(m.b) + '</span></span>' +
                    '</div>' +
                    (st ? '<span class="match-status">' + esc(st) + '</span>' : '') +
                    '</a>';
            }).join("");
            
            h += card("Matches (" + L.length + ")", '<div class="matches-list">' + matchesHtml + '</div>');
        }
    } catch (e) {
        console.error("Failed to load matches:", e);
    }
    return h;
}

async function loadTeams(eventName) {
    let h = "";
    try {
        const r = await fetch("/api/matches");
        if (!r.ok) throw 0;
        const d = await r.json();
        
        // Get all unique teams for this event
        const L = d.matches.filter(m => m.e === eventName);
        const teams = new Set();
        L.forEach(m => {
            if (m.a && m.a !== "TBD") teams.add(m.a);
            if (m.b && m.b !== "TBD") teams.add(m.b);
        });
        
        if (teams.size > 0) {
            // Load team logos
            const lr = await fetch("/api/logos");
            const logos = lr.ok ? await lr.json() : {};
            
            // Team logo helper - dark variant follows the app's manual theme
            const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
            const tl = (n) => {
                const l = logos[n];
                if (!l) return '<span class="lg ph">' + esc((n || "?")[0]) + '</span>';
                const src = isDark() && l.d ? l.d : l.l;
                return '<img class="lg" src="' + esc(src) + '" alt="" loading="lazy">';
            };
            
            const teamsHtml = Array.from(teams).sort().map(t => 
                '<a href="team.html?name=' + encodeURIComponent(t) + '" class="team-link">' +
                '<span class="team-logo-small">' + tl(t) + '</span>' +
                '<span class="team-name-small">' + esc(t) + '</span>' +
                '</a>'
            ).join("");
            
            h += card("Participating Teams (" + teams.size + ")", '<div class="teams-grid-small">' + teamsHtml + '</div>');
        }
    } catch (e) {
        console.error("Failed to load teams:", e);
    }
    return h;
}

load();
