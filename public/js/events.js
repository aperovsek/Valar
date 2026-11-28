// Events page JavaScript
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

let EV = {};
let filteredEvents = [];
let searchQuery = "";

const $ = (id) => document.getElementById(id);

// Load event data
async function loadData() {
    try {
        const r = await fetch("/api/event-data");
        if (r.ok) {
            EV = await r.json();
        } else {
            console.error("Failed to load event data:", r.status);
        }
    } catch (e) {
        console.error("Failed to load event data:", e);
    }

    // Initialize with all events
    filteredEvents = Object.keys(EV || {}).sort();
    render();
}

// Logo function for events
function eventLogo(n) {
    const e = EV[n];
    if (e?.logo) return `<img class="lg" src="${esc(e.logo)}" alt="" loading="lazy">`;
    return `<span class="lg ph">${esc((n || "?")[0])}</span>`;
}

// Render events
function render() {
    // Filter events by search query
    if (searchQuery) {
        filteredEvents = Object.keys(EV || {})
            .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort();
    } else {
        filteredEvents = Object.keys(EV || {}).sort();
    }
    
    let h = "";
    
    if (filteredEvents.length === 0) {
        h = '<div class="empty">No events found.</div>';
    } else {
        h = '<div class="event-list">' +
            filteredEvents.map(name => {
                const event = EV[name];
                const displayName = esc(name);
                const date = event?.info?.Date || event?.info?.StartDate || "";
                const prize = event?.info?.Prize || event?.info?.PrizePool || "";
                const region = event?.info?.Region || event?.info?.Location || "";
                
                return '<a href="event.html?name=' + encodeURIComponent(name) + '" class="event-card">' +
                    '<div class="event-logo">' + eventLogo(name) + '</div>' +
                    '<div class="event-info">' +
                        '<div class="event-name">' + displayName + '</div>' +
                        '<div class="event-meta">' +
                            (date ? '<span class="event-date">' + esc(date) + '</span>' : '') +
                            (region ? '<span class="event-region">' + esc(region) + '</span>' : '') +
                            (prize ? '<span class="event-prize">' + esc(prize) + '</span>' : '') +
                        '</div>' +
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
