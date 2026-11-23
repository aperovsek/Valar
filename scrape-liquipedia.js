// ONE-TIME import from Liquipedia's MediaWiki API -> data/liquipedia.json
//
// Quick test (no server needed):  LP_UA="my-site (you@email.com)" node scrape-liquipedia.js --teams="Team Liquid,Cloud9"
// Full import (server running):   LP_UA="my-site (you@email.com)" node scrape-liquipedia.js --limit=30
// Flags: --debug prints the page outline and saves the raw HTML to data/. --force re-imports teams already saved. Re-running resumes where it stopped.
// Liquipedia API limits: action=parse 1 req / 30s, other actions 1 req / 2s.
import fs from "node:fs";
import { parseTeam, wikiInfobox, outline } from "./lp-parse.js";

const API = "https://liquipedia.net/valorant/api.php";
const UA = process.env.LP_UA || "match-schedule/1.0 (one-time import; contact: CHANGE-ME@example.com)";
const OUT = "data/liquipedia.json";
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3);
const limit = +arg("limit") || Infinity;
const debug = process.argv.includes("--debug");
const force = process.argv.includes("--force") || debug;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

let last = 0;
async function api(params, gap) {
  const wait = last + gap - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const url = API + "?" + new URLSearchParams({ format: "json", formatversion: "2", redirects: "1", ...params });
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-encoding": "gzip" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const parsePage = (title) => api({ action: "parse", page: title.replace(/ /g, "_"), prop: "text" }, 31000);
async function resolve(name) { // vlr name -> Liquipedia title, only on a (near) exact match
  const r = await api({ action: "opensearch", search: name, limit: "8", namespace: "0" }, 2100);
  return (r[1] || []).find((t) => norm(t) === norm(name)) || null;
}

fs.mkdirSync("data", { recursive: true });
const db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { teams: {}, players: {}, missing: [] };
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
async function download(url, base) { // logos are saved locally once, never hotlinked
  if (!url) return null;
  try {
    const wait = last + 2100 - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const r = await fetch(url, { headers: { "user-agent": UA } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const ext = ((new URL(url).pathname.match(/\.(png|jpe?g|svg|webp|gif)$/i) || [])[1] || "png").toLowerCase();
    fs.mkdirSync("public/logos", { recursive: true });
    fs.writeFileSync(`public/logos/${base}.${ext}`, Buffer.from(await r.arrayBuffer()));
    return `/logos/${base}.${ext}`;
  } catch (e) { console.error("  logo failed:", e.message); return null; }
}
const save = () => fs.writeFileSync(OUT, JSON.stringify(db, null, 1));

let names;
if (arg("teams")) names = arg("teams").split(",").map((s) => s.trim()).filter(Boolean);
else {
  let matches;
  try { matches = (await (await fetch("http://localhost:3000/api/matches")).json()).matches; }
  catch { console.error("Could not read http://localhost:3000/api/matches. Start the server first, or pass --teams=\"Team Liquid,Cloud9\"."); process.exit(1); }
  const freq = {};
  matches.forEach((m) => [m.a, m.b].forEach((n) => { if (n && n !== "TBD") freq[n] = (freq[n] || 0) + 1; }));
  names = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, limit);
}
console.log(`${names.length} teams to check`);

let okCount = 0;
for (const name of names) {
  if (!force && (db.teams[name]?.v === 3 || db.missing.includes(name))) continue;
  console.log("team:", name);
  try {
    let r = await parsePage(name);
    if (r.error) {
      const alt = await resolve(name);
      if (alt) r = await parsePage(alt);
    }
    if (r.error) { console.log("  no matching Liquipedia page"); if (!db.missing.includes(name)) db.missing.push(name); save(); continue; }
    if (debug) {
      fs.writeFileSync(`data/debug-${name.replace(/\W+/g, "_")}.html`, r.parse.text);
      console.log("--- page outline ---\n" + outline(r.parse.text) + "\n--------------------");
    }
    const t = parseTeam(r.parse.text);
    t.logoFile = await download(t.logo, slug(name));
    t.logoDarkFile = await download(t.logoDark, slug(name) + "-dark");
    db.teams[name] = { v: 3, title: r.parse.title, url: "https://liquipedia.net/valorant/" + encodeURIComponent(r.parse.title.replace(/ /g, "_")), ...t };
    db.missing = db.missing.filter((n) => n !== name);
    save(); okCount++;
    console.log(`  ok: ${Object.keys(t.info).length} info fields, ${t.players.length} players, ${t.org.length} staff, ${t.achievements.length} achievements, logo: ${t.logoFile || "none"}`);
  } catch (e) { console.error("  failed:", e.message); }
}

const need = [...new Set(Object.values(db.teams).flatMap((t) => (t.players || []).map((p) => p.page).filter(Boolean)))].filter((p) => !db.players[p]);
console.log(need.length, "players to fetch");
for (let i = 0; i < need.length; i += 50) {
  const chunk = need.slice(i, i + 50);
  try {
    const r = await api({ action: "query", prop: "revisions", rvslots: "main", rvprop: "content", titles: chunk.join("|") }, 2100);
    const alias = {};
    [...(r.query.normalized || []), ...(r.query.redirects || [])].forEach((x) => (alias[x.from] = x.to));
    const byTitle = Object.fromEntries(r.query.pages.filter((p) => !p.missing).map((p) => [p.title, p]));
    for (const req of chunk) {
      let t = req; for (let k = 0; k < 3 && alias[t]; k++) t = alias[t];
      const p = byTitle[t];
      db.players[req] = {
        title: t, url: "https://liquipedia.net/valorant/" + encodeURIComponent(t.replace(/ /g, "_")),
        info: p ? wikiInfobox(p.revisions?.[0]?.slots?.main?.content || "", "player") : {},
      };
    }
    save();
    console.log("players:", Math.min(i + 50, need.length) + "/" + need.length);
  } catch (e) { console.error("  batch failed:", e.message); }
}
console.log(`done: ${Object.keys(db.teams).length} teams, ${Object.keys(db.players).length} players, ${db.missing.length} without a page -> ${OUT}`);
