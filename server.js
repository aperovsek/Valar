// Tiny proxy: scrapes vlr.gg server-side (browsers can't, CORS) and serves JSON + the frontend.
import express from "express";
import fs from "node:fs";
import * as cheerio from "cheerio";

const PORT = process.env.PORT || 3000;
const RESULT_PAGES = +process.env.RESULT_PAGES || 3; // ~50 results per page
const TTL = 2 * 60 * 1000;                           // cache for 2 minutes, be polite
const BASE = "https://www.vlr.gg";
const pad = (n) => String(n).padStart(2, "0");
const clean = (s) => s.replace(/\s+/g, " ").trim();

async function get(path) {
  const r = await fetch(BASE + path, { headers: { "user-agent": "Mozilla/5.0 (compatible; match-schedule/1.0)" } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.text();
}

function parse(html) {
  const $ = cheerio.load(html), out = [];
  $(".wf-label.mod-large").each((_, h) => {
    const label = clean($(h).clone().children().remove().end().text()).replace(/^\w+,\s*/, "");
    const d = new Date(label + " 12:00 UTC");
    if (isNaN(d)) return;
    const date = d.toISOString().slice(0, 10);
    $(h).next(".wf-card").find("a.match-item").each((_, el) => {
      const a = $(el), href = a.attr("href") || "";
      const tm = a.find(".match-item-time").text().match(/(\d+):(\d+)\s*(AM|PM)/i);
      const hh = tm ? (+tm[1] % 12) + (tm[3].toUpperCase() === "PM" ? 12 : 0) : 0;
      const teams = a.find(".match-item-vs-team").toArray().map((t) => ({
        name: clean($(t).find(".match-item-vs-team-name").text()),
        score: clean($(t).find(".match-item-vs-team-score").text()),
      }));
      if (teams.length < 2) return;
      const ev = a.find(".match-item-event");
      const sc = /^\d+$/.test(teams[0].score) && /^\d+$/.test(teams[1].score) ? `${teams[0].score}-${teams[1].score}` : "";
      out.push({
        id: href.split("/")[1], url: BASE + href,
        t: `${date}T${pad(hh)}:${tm ? tm[2] : "00"}`,
        a: teams[0].name, b: teams[1].name,
        e: clean(ev.clone().children().remove().end().text()),
        s: clean(ev.find(".match-item-event-series").text()),
        sc, status: clean(a.find(".ml-status").text()),
      });
    });
  });
  return out;
}

let cache = { at: 0, data: null };
async function load() {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data;
  const paths = ["/matches", ...Array.from({ length: RESULT_PAGES }, (_, i) => `/matches/results/?page=${i + 1}`)];
  const pages = await Promise.all(paths.map((p) => get(p).then(parse)));
  const seen = new Map();
  pages.flat().forEach((m) => seen.set(m.id, m));
  cache = { at: Date.now(), data: { updated: new Date().toISOString(), matches: [...seen.values()] } };
  return cache.data;
}

const app = express();

// Enable CORS for API endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/api/matches", async (_req, res) => {
  try { res.json(await load()); }
  catch (e) { console.error(e); cache.data ? res.json(cache.data) : res.status(502).json({ error: String(e) }); }
});
// Liquipedia data (created once by scrape-liquipedia.js); re-read automatically when the file changes
let DB = { teams: {}, players: {}, missing: [] }, mtime = 0;
const db = () => {
  try { 
    const m = fs.statSync("data/liquipedia.json").mtimeMs; 
    if (m !== mtime) { 
      DB = JSON.parse(fs.readFileSync("data/liquipedia.json", "utf8")); 
      mtime = m; 
    } 
  } catch (e) {
    console.log("No liquipedia.json found, using empty database");
  }
  return DB;
};
// Events data (created once by scrape-events.js); re-read automatically when the file changes
let EV = {}, evtime = 0;
const events = () => {
  try { 
    const m = fs.statSync("data/events.json").mtimeMs; 
    if (m !== evtime) { 
      EV = JSON.parse(fs.readFileSync("data/events.json", "utf8")); 
      evtime = m; 
    } 
  } catch (e) {
    console.log("No events.json found, using empty events database");
  }
  return EV;
};
app.get("/api/team/:name", (req, res) => {
  const d = db(), t = d.teams[req.params.name];
  if (t) return res.json(t);
  res.status(404).json({ error: (d.missing || []).includes(req.params.name) ? "no_page" : "not_imported", imported: Object.keys(d.teams).length });
});
app.get("/api/logos", (_req, res) => {
  const o = {};
  for (const [n, t] of Object.entries(db().teams)) if (t.logoFile) o[n] = { l: t.logoFile, d: t.logoDarkFile || "" };
  res.json(o);
});
app.get("/api/event-logos", (_req, res) => {
  const o = {};
  for (const [n, e] of Object.entries(events())) if (e.logo) o[n] = { l: e.logo };
  res.json(o);
});
app.get("/api/event/:name", (req, res) => {
  const e = events()[req.params.name];
  e ? res.json(e) : res.status(404).json({ error: "no data" });
});
app.get("/api/player/:name", (req, res) => {
  const p = db().players[req.params.name];
  p ? res.json(p) : res.status(404).json({ error: "no data" });
});
// Serve all team data for teams page
app.get("/api/team-data", (_req, res) => {
  res.json(db());
});
// Serve all event data for events page
app.get("/api/event-data", (_req, res) => {
  res.json(events());
});
app.use(express.static("public"));
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
