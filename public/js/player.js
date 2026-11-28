// Player page JavaScript
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

const q = new URLSearchParams(location.search);
const id = q.get("id") || "";
const team = q.get("team");

document.getElementById("h").textContent = id;
document.title = id;

if (team) document.getElementById("back").innerHTML = '· <a href="team.html?name=' + encodeURIComponent(team) + '">' + esc(team) + '</a>';

async function load() {
    let h = "";
    try {
        const r = await fetch("/api/player/" + encodeURIComponent(id));
        if (!r.ok) throw 0;
        const p = await r.json();
        
        // Display player image if available
        const imgUrl = p.imageUrl || p.imageFile;
        if (imgUrl) document.getElementById("h").innerHTML = '<img class="player-img" src="' + esc(imgUrl) + '" alt="">' + id;
        
        const info = Object.entries(p.info || {});
        h += info.length ? '<div class="card"><table>' + info.map(([k, v]) => '<tr><td class="k">' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join("") + '</table></div>' : '<div class="card mu">No details found.</div>';
        h += '<p><a href="' + esc(p.url) + '" target="_blank" rel="noopener">Liquipedia page ↗</a></p>';
    } catch (e) {
        h = '<div class="card mu">No Liquipedia data for this player.</div>';
    }
    document.getElementById("body").innerHTML = h;
}

load();
