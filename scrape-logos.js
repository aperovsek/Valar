// ONE-TIME: downloads team logos from vlr.gg into public/logos/ and writes data/logos.json
// Needs the server running (it reads the match list from it).   Usage:  node scrape-logos.js [--force]
// It opens the fewest match pages that cover every team (each match page shows both teams' logos), ~1.5s apart.
import fs from "node:fs";
import * as cheerio from "cheerio";

const UA = process.env.LP_UA || "match-schedule/1.0 (one-time logo import; contact: CHANGE-ME@example.com)";
const OUT = "data/logos.json";
const force = process.argv.includes("--force");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clean = (s) => s.replace(/\s+/g, " ").trim();

let last = 0;
async function get(url, binary) {
  const wait = last + 1500 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}

fs.mkdirSync("data", { recursive: true });
fs.mkdirSync("public/logos", { recursive: true });
const logos = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(logos, null, 1));

let matches;
try { matches = (await (await fetch("http://localhost:3000/api/matches")).json()).matches; }
catch { console.error("Start the server first (npm start): could not read http://localhost:3000/api/matches"); process.exit(1); }

const todo = new Set();
matches.forEach((m) => [m.a, m.b].forEach((n) => { if (n && n !== "TBD" && (force || !logos[n])) todo.add(n); }));
console.log(todo.size, "teams need a logo");

// greedy cover: repeatedly open the match page that covers the most teams still missing
while (todo.size) {
  let best = null, bestScore = 0;
  for (const m of matches) {
    const s = (todo.has(m.a) ? 1 : 0) + (todo.has(m.b) ? 1 : 0);
    if (s > bestScore) { best = m; bestScore = s; }
  }
  if (!best) break;
  const m = best;
  console.log("match page:", m.a, "vs", m.b);
  try {
    const $ = cheerio.load(await get(m.url));
    let links = $("a.match-header-link").toArray();
    if (!links.length) links = $('a[href^="/team/"]').toArray().filter((a) => $(a).find("img").length);
    const found = links.slice(0, 2).map((a) => ({
      id: (($(a).attr("href") || "").match(/^\/team\/(\d+)/) || [])[1] || "",
      name: clean($(a).find(".wf-title-med").text() || $(a).text()),
      src: $(a).find("img").first().attr("src") || "",
    }));
    found.forEach((f, i) => {
      const target = [m.a, m.b].find((n) => norm(n) === norm(f.name)) || (found.length === 2 ? [m.a, m.b][i] : null);
      if (target) { f.target = target; }
    });
    for (const f of found) {
      if (!f.target || !todo.has(f.target)) continue;
      todo.delete(f.target); // never retry the same team this run, even if it has no logo
      if (!f.src || f.src.includes("/img/vlr/tmp/")) { console.log("  no logo:", f.target); continue; }
      const url = new URL(f.src, "https://www.vlr.gg").href;
      const ext = ((new URL(url).pathname.match(/\.(png|jpe?g|svg|webp|gif)$/i) || [])[1] || "png").toLowerCase();
      fs.writeFileSync(`public/logos/${slug(f.target)}.${ext}`, await get(url, true));
      logos[f.target] = { l: `/logos/${slug(f.target)}.${ext}`, id: f.id };
      console.log("  logo:", f.target);
    }
    // if the page gave us nothing for these teams, stop asking for them
    [m.a, m.b].forEach((n) => todo.delete(n));
    save();
  } catch (e) { console.error("  failed:", e.message); [m.a, m.b].forEach((n) => todo.delete(n)); }
}
save();
console.log(`done: ${Object.keys(logos).length} logos -> ${OUT}`);
