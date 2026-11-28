// Teams page JavaScript
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

let DB = {};
let LG = {};
let filteredTeams = [];
let searchQuery = "";

const $ = (id) => document.getElementById(id);

// Load team data
async function loadData() {
    try {
        const r = await fetch("/api/team-data");
        if (r.ok) {
            DB = await r.json();
        } else {
            console.error("Failed to load team data:", r.status);
        }
    } catch (e) {
        console.error("Failed to load team data:", e);
    }
    
    try {
        const r = await fetch("/api/logos");
        if (r.ok) {
            LG = await r.json();
        }
    } catch (e) {
        console.error("Failed to load logos:", e);
    }
    
    // Initialize with all teams
    filteredTeams = Object.keys(DB.teams || {}).sort();
    render();
}

// Logo function - dark variant follows the app's manual theme
const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
function logo(n) {
    const l = LG[n];
    if (!l) return `<span class="lg ph">${esc((n || "?")[0])}</span>`;
    const src = isDark() && l.d ? l.d : l.l;
    return `<img class="lg" src="${esc(src)}" alt="" loading="lazy">`;
}

// Render teams
function render() {
    // Filter teams by search query
    if (searchQuery) {
        filteredTeams = Object.keys(DB.teams || {})
            .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort();
    } else {
        filteredTeams = Object.keys(DB.teams || {}).sort();
    }
    
    let h = "";
    
    if (filteredTeams.length === 0) {
        h = '<div class="empty">No teams found.</div>';
    } else {
        h = '<div class="team-grid">' +
            filteredTeams.map(name => {
                const team = DB.teams[name];
                const displayName = esc(name);
                const region = team?.info?.Region ? esc(team.info.Region) : "";
                const location = team?.info?.Location ? esc(team.info.Location) : "";
                
                return '<a href="team.html?name=' + encodeURIComponent(name) + '" class="team-card">' +
                    '<div class="team-logo">' + logo(name) + '</div>' +
                    '<div class="team-info">' +
                        '<div class="team-name">' + displayName + '</div>' +
                        (region || location ? '<div class="team-region">' + esc(region || location) + '</div>' : '') +
                    '</div>' +
                    '</a>';
            }).join("") +
            '</div>';
    }
    
    $("out").innerHTML = h;
}

// Initialize
$("search").oninput = () => {
    searchQuery = $("search").value;
    render();
};

// Set active tab
$("tu").className = "on";

// Load data - call immediately
loadData();
setInterval(loadData, 5 * 60 * 1000);
