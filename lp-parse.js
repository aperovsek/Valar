// Turns a rendered Liquipedia team page (HTML) into { intro, info, players, org, achievements }.
// Works by walking headings/tables in document order, so it doesn't depend on exact wrapper divs.
import * as cheerio from "cheerio";

const clean = (s) => s.replace(/\s+/g, " ").trim();
const STAFF = /coach|manager|analyst|director|owner|ceo|staff|founder|president|performance/i;

export function parseTeam(html) {
  const $ = cheerio.load(html);
  const root = $(".mw-parser-output").first();
  const scope = root.length ? root : $.root();

  const info = {};
  scope.find(".fo-nttax-infobox").first().find(".infobox-description").each((_, el) => {
    const k = clean($(el).text()).replace(/:$/, "");
    const v = clean($(el).next().text());
    if (k && v && k !== "Links") info[k] = v;
  });

  const imgSrc = (sel) => {
    const s = scope.find(".fo-nttax-infobox").first().find(sel).first().attr("src") || "";
    return s ? new URL(s, "https://liquipedia.net").href : "";
  };
  const logo = imgSrc(".infobox-image.lightmode img") || imgSrc(".infobox-image img") || imgSrc("img");
  let logoDark = imgSrc(".infobox-image.darkmode img");
  if (logoDark === logo) logoDark = "";

  const intro = [], players = [], org = [], achievements = [];
  let h2 = "", heading = "", seenHeading = false;
  const hdr = (tr) => $(tr).find("th").map((_, th) => clean($(th).text()).toLowerCase()).get();

  scope.find("h2,h3,h4,p,table").each((_, el) => {
    const $el = $(el), tag = (el.tagName || el.name || "").toLowerCase();
    if ($el.closest(".fo-nttax-infobox").length) return;

    if (/^h[2-4]$/.test(tag)) {
      const c = $el.clone(); c.find(".mw-editsection").remove();
      heading = clean(c.find(".mw-headline").text() || c.text());
      if (tag === "h2") h2 = heading;
      seenHeading = true; return;
    }
    if (tag === "p") {
      if (!seenHeading && intro.length < 2 && !$el.closest("table").length) {
        const c = $el.clone(); c.find("sup,style").remove();
        const t = clean(c.text()); if (t.length > 40) intro.push(t);
      }
      return;
    }
    if ($el.parents("table").length) return; // nested table

    const trs = $el.find("tr").toArray();
    const hi = trs.findIndex((tr) => hdr(tr).includes("id")); // header row can come after a title row
    const isRoster = hi >= 0;
    let heads = hdr(trs[isRoster ? hi : 0] || []);
    const isAch = !isRoster && heads.length >= 4 && heads.includes("date") && heads.some((h) => /^place/.test(h));
    if (!isRoster && !isAch) return;
    if (isRoster && !heads.includes("position")) { const bi = heads.indexOf(""); if (bi >= 0) heads[bi] = "position"; }

    const rows = [];
    trs.slice(isRoster ? hi + 1 : 1).forEach((tr) => {
      const tds = $(tr).children("td");
      if (!tds.length) return;
      const row = {};
      tds.each((i, td) => { if (heads[i]) row[heads[i]] = clean($(td).text()); });
      if (isRoster) {
        if (!row.id) return;
        const a = $(tr).find("td a").filter((_, x) => /^\/valorant\/[^:#?]+$/.test($(x).attr("href") || "") && !$(x).hasClass("new")).first();
        if (a.length) row.page = decodeURIComponent(a.attr("href").slice("/valorant/".length)).replace(/_/g, " ");
      }
      rows.push(row);
    });

    if (isAch) { achievements.push(...rows); return; }
    const inOrg = /organi[sz]ation|staff|management/i.test(h2);
    const group = !heading || /^(player roster|organi[sz]ation)$/i.test(heading) ? (inOrg ? "Staff" : "Roster") : heading;
    rows.forEach((r) => {
      if (inOrg || STAFF.test(r.position || r.role || "")) org.push({ group, ...r });
      else players.push({ group, ...r });
    });
  });

  return { logo, logoDark, intro: intro.join("\n\n"), info, players, org, achievements: achievements.slice(0, 300) };
}

// ---- player pages: read the {{Infobox player}} template out of wikitext ----
const strip = (s) => {
  let o = s.replace(/<!--.*?-->/g, "").replace(/<ref[^>]*>.*?<\/ref>/g, "").replace(/<br\s*\/?>/gi, ", ");
  for (let i = 0; i < 4; i++) o = o.replace(/\{\{[^{}]*\}\}/g, "");
  return o.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?/g, "").trim();
};
export function wikiInfobox(text, name) {
  const i = text.toLowerCase().indexOf("{{infobox " + name);
  if (i < 0) return {};
  let d = 0, end = text.length;
  for (let j = i; j < text.length; j++) {
    if (text.startsWith("{{", j)) { d++; j++; }
    else if (text.startsWith("}}", j)) { d--; j++; if (!d) { end = j + 1; break; } }
  }
  const o = {};
  text.slice(i, end).split("\n").forEach((l) => {
    const m = l.match(/^\s*\|\s*([\w .-]+?)\s*=\s*(.*)$/);
    if (m) { const v = strip(m[2]); if (v) o[m[1]] = v; }
  });
  return o;
}

// Debug helper: lists headings and table headers in page order.
export function outline(html) {
  const $ = cheerio.load(html);
  const root = $(".mw-parser-output").first();
  const lines = [];
  (root.length ? root : $.root()).find("h2,h3,h4,table").each((_, el) => {
    const $el = $(el), tag = (el.tagName || el.name || "").toLowerCase();
    if ($el.closest(".fo-nttax-infobox").length || $el.parents("table").length) return;
    if (/^h[2-4]$/.test(tag)) { const c = $el.clone(); c.find(".mw-editsection").remove(); lines.push(`${tag.toUpperCase()}  ${clean(c.text())}`); return; }
    const th = $el.find("tr").first().find("th,td").map((_, x) => clean($(x).text()).slice(0, 25)).get();
    lines.push(`    table (${$el.find("tr").length} rows): ${th.join(" | ")}`);
  });
  return lines.join("\n");
}
