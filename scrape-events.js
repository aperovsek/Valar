// ONE-TIME import of ALL events from vlr.gg -> data/events.json
//
// Usage: node scrape-events.js
//
// DEBUG mode: DEBUG=1 node scrape-events.js
//
// Event URL pattern: /event/{id}/{slug}
// Example: https://www.vlr.gg/event/3233/vct-2027-emea-kickoff-europe-qualifier-playoffs

import fs from "node:fs";
import * as cheerio from "cheerio";

const BASE = "https://www.vlr.gg";
const UA = "match-schedule/1.0 (one-time import)";
const OUT = "data/events.json";
const DEBUG = process.env.DEBUG === "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let last = 0;
async function get(path) {
  const wait = last + 1000 - Date.now(); // Be polite, 1 second between requests
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const r = await fetch(BASE + path, { headers: { "user-agent": UA } });
  if (!r.ok) {
    const errorText = await r.text().catch(() => "");
    throw new Error(`${path} -> ${r.status}: ${errorText.slice(0, 100)}`);
  }
  return r.text();
}

// Extract event logo URL from event page HTML
function extractEventLogo(html) {
  const $ = cheerio.load(html);
  // Try multiple selectors for event logo
  const logo = $(".event-header-logo img").attr("src") ||
               $(".event-detail-header-logo img").attr("src") ||
               $(".mod-event-header img").attr("src") ||
               $(".event-header img").attr("src") ||
               $(".header-logo img").attr("src") ||
               $(".logo img").attr("src") ||
               $("picture img").attr("src") ||
               $("img").first().attr("src");
  
  if (logo) {
    try {
      if (logo.startsWith("http")) {
        return logo;
      }
      return new URL(logo, BASE).href;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Extract comprehensive event info from event page HTML
function extractEventInfo(html, eventName) {
  const $ = cheerio.load(html);
  const info = {};
  
  // Event header info items - try multiple selectors
  $(".event-detail-header-info-item, .event-header-info-item, .infobox-description").each((_, el) => {
    const keyEl = $(el).find(".event-detail-header-info-item-key, .event-header-info-item-key, .infobox-description-key").first();
    const valueEl = $(el).find(".event-detail-header-info-item-value, .event-header-info-item-value, .infobox-description-value").first();
    
    const key = clean(keyEl.text()) || clean($(el).text()).replace(/:$/, "");
    const value = clean(valueEl.text()) || clean($(el).next().text());
    
    if (key && value && key !== "Links" && key !== "link") {
      info[key] = value;
    }
  });
  
  // Try to find dates in the page
  const text = $("body").text();
  
  // Dates - look for specific patterns
  const dateMatch = text.match(/(?:Date|Start|End)[:\s]+([^\n]+)/i);
  if (dateMatch) {
    const dateValue = dateMatch[1].trim();
    if (dateValue.includes("-") || dateValue.includes("to")) {
      const dates = dateValue.split(/[-to]/i).map(d => d.trim());
      if (dates[0]) info["Start Date"] = dates[0];
      if (dates[1]) info["End Date"] = dates[1];
    } else {
      info["Date"] = dateValue;
    }
  }
  
  // Also try to find dates in specific elements
  $(".event-detail-header-date, .event-header-date, .event-dates").each((_, el) => {
    const dateText = clean($(el).text());
    if (dateText) {
      if (dateText.includes("-") || dateText.includes("to")) {
        const dates = dateText.split(/[-to]/i).map(d => d.trim());
        if (dates[0]) info["Start Date"] = dates[0];
        if (dates[1]) info["End Date"] = dates[1];
      } else {
        info["Date"] = dateText;
      }
    }
  });
  
  // Prize pool
  const prizeMatch = text.match(/(?:Prize[:\s]+Pool|Prize|Pool)[:\s]+([^\n$]+)/i);
  if (prizeMatch) info["Prize Pool"] = prizeMatch[1].trim();
  
  // Also try specific selectors for prize
  $(".event-detail-header-prize, .event-header-prize, .prize-pool").each((_, el) => {
    const prizeText = clean($(el).text());
    if (prizeText && !info["Prize Pool"]) {
      info["Prize Pool"] = prizeText;
    }
  });
  
  // Location/Region
  const locationMatch = text.match(/(?:Location|Region|Venue)[:\s]+([^\n]+)/i);
  if (locationMatch) info["Region"] = locationMatch[1].trim();
  
  // Also try specific selectors for region
  $(".event-detail-header-region, .event-header-region, .event-location").each((_, el) => {
    const regionText = clean($(el).text());
    if (regionText && !info["Region"]) {
      info["Region"] = regionText;
    }
  });
  
  // Teams - try to find team links
  const teams = [];
  $("a[href^='/team/'], a[href*='/team/']").each((_, el) => {
    const teamName = clean($(el).text());
    if (teamName && !teams.includes(teamName) && teamName !== "TBD") {
      teams.push(teamName);
    }
  });
  
  // Also try to find teams in match items on the event page
  $(".match-item-vs-team-name, .match-item-vs-team a").each((_, el) => {
    const teamName = clean($(el).text());
    if (teamName && !teams.includes(teamName) && teamName !== "TBD") {
      teams.push(teamName);
    }
  });
  
  if (teams.length > 0) {
    info["Teams"] = teams.join(", ");
  }
  
  return info;
}

const clean = (s) => s ? s.replace(/\s+/g, " ").trim() : "";

// Generate slug from event name
function generateSlug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Extract matches from HTML and get event information
function extractMatchesFromHtml(html) {
  const $ = cheerio.load(html);
  const out = [];
  
  $(".wf-label.mod-large").each((_, h) => {
    const label = clean($(h).clone().children().remove().end().text()).replace(/^\w+,\s*/, "");
    if (!label) return;
    
    $(h).next(".wf-card").find("a.match-item").each((_, el) => {
      const matchItem = $(el);
      const href = matchItem.attr("href") || "";
      const tm = matchItem.find(".match-item-time").text().match(/(\d+):(\d+)\s*(AM|PM)/i);
      const hh = tm ? (+tm[1] % 12) + (tm[3].toUpperCase() === "PM" ? 12 : 0) : 0;
      const teams = matchItem.find(".match-item-vs-team").toArray().map((t) => ({
        name: clean($(t).find(".match-item-vs-team-name").text()),
        score: clean($(t).find(".match-item-vs-team-score").text()),
      }));
      if (teams.length < 2) return;
      
      const ev = matchItem.find(".match-item-event");
      
      // Extract event URL, ID, and slug from the event element
      let eventUrl = null;
      let eventId = null;
      let eventSlug = null;
      
      // Strategy 1: Check if the event element itself has an href
      if (ev.length > 0) {
        if (ev.is("a")) {
          eventUrl = ev.attr("href");
        } else {
          // Check for a link inside the event element
          const eventLink = ev.find("a").first();
          if (eventLink.length > 0) {
            eventUrl = eventLink.attr("href");
          }
        }
      }
      
      // Strategy 2: Look for event link in the match item
      if (!eventUrl) {
        const matchEventLink = matchItem.find("a[href^='/event/'], a[href*='/event/']").first();
        if (matchEventLink.length > 0) {
          eventUrl = matchEventLink.attr("href");
        }
      }
      
      // Parse the event URL to get ID and slug
      if (eventUrl) {
        // Handle both /event/123/name and /event/name formats
        const parts = eventUrl.split("/").filter(p => p && p !== "event");
        if (parts.length > 0) {
          // Check if first part is a number (event ID)
          if (/^\d+$/.test(parts[0])) {
            eventId = parts[0];
            eventSlug = parts.slice(1).join("/");
          } else {
            // If first part is not a number, the slug is the first part
            eventSlug = parts[0];
            // Try to find the ID in the URL or use unknown
            eventId = "unknown";
          }
        }
      }
      
      // Strategy 3: If we still don't have an ID, try to extract from the match item's data
      if (!eventId) {
        // Look for data attributes
        const dataEventId = matchItem.attr("data-event-id") || ev.attr("data-event-id");
        if (dataEventId) {
          eventId = dataEventId;
        }
      }
      
      // If we have an event name but no ID, generate a slug
      const eventName = clean(ev.clone().children().remove().end().text());
      if (!eventId && eventName) {
        eventId = generateSlug(eventName);
      }
      
      // If we still don't have an ID, use unknown
      if (!eventId) {
        eventId = "unknown";
      }
      
      // If we have an ID but no slug, generate one from the event name
      if (!eventSlug && eventName) {
        eventSlug = generateSlug(eventName);
      }
      
      // If we have an ID but no URL, construct one
      if (!eventUrl && eventId && eventSlug) {
        eventUrl = `/event/${eventId}/${eventSlug}`;
      } else if (!eventUrl && eventId) {
        eventUrl = `/event/${eventId}`;
      } else if (!eventUrl) {
        eventUrl = `/event/${eventId}/${eventSlug || generateSlug(eventName || "")}`;
      }
      
      const sc = /^\d+$/.test(teams[0].score) && /^\d+$/.test(teams[1].score) ? `${teams[0].score}-${teams[1].score}` : "";
      const date = label ? new Date(label + " 12:00 UTC").toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      
      out.push({
        id: href.split("/")[1],
        url: BASE + href,
        t: `${date}T${String(hh).padStart(2, "0")}:${tm ? tm[2] : "00"}`,
        a: teams[0].name,
        b: teams[1].name,
        e: eventName,
        s: clean(ev.find(".match-item-event-series").text()),
        sc,
        status: clean(matchItem.find(".ml-status").text()),
        eventUrl: eventUrl ? BASE + eventUrl : null,
        eventId: eventId,
        eventSlug: eventSlug
      });
    });
  });
  
  return out;
}

// Extract event data from a match page
function extractEventFromMatchPage(html) {
  const $ = cheerio.load(html);
  
  // Try to find event logo
  const logo = $(".event-header-logo img, .match-event-logo img, .event-logo img, .event-detail-logo img").attr("src");
  
  // Try to find event URL
  let eventUrl = null;
  const eventLink = $("a[href^='/event/'], a[href*='/event/']").first();
  if (eventLink.length > 0) {
    eventUrl = BASE + eventLink.attr("href");
  }
  
  // Extract info
  const info = {};
  const text = $("body").text();
  
  const dateMatch = text.match(/(?:Date|Start|End)[:\s]+([^\n]+)/i);
  if (dateMatch) {
    const dateValue = dateMatch[1].trim();
    if (dateValue.includes("-") || dateValue.includes("to")) {
      const dates = dateValue.split(/[-to]/i).map(d => d.trim());
      if (dates[0]) info["Start Date"] = dates[0];
      if (dates[1]) info["End Date"] = dates[1];
    } else {
      info["Date"] = dateValue;
    }
  }
  
  const prizeMatch = text.match(/(?:Prize[:\s]+Pool|Prize|Pool)[:\s]+([^\n$]+)/i);
  if (prizeMatch) info["Prize Pool"] = prizeMatch[1].trim();
  
  const locationMatch = text.match(/(?:Location|Region|Venue)[:\s]+([^\n]+)/i);
  if (locationMatch) info["Region"] = locationMatch[1].trim();
  
  if (!logo && !eventUrl && Object.keys(info).length === 0) {
    return null;
  }
  
  return {
    logo: logo ? new URL(logo, BASE).href : null,
    url: eventUrl,
    info: info
  };
}

// Main function to extract events
async function main() {
  fs.mkdirSync("data", { recursive: true });
  
  // Load existing data
  const db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  
  console.log("=== vlr.gg Event Scraper ===\n");
  console.log("Expected URL pattern: /event/{id}/{slug}\n");
  
  try {
    // Step 1: Get all matches (upcoming and results) to extract events
    console.log("Step 1: Collecting event names and URLs from matches...\n");
    
    const allMatches = [];
    const maxPages = 20;
    
    // Get upcoming matches
    try {
      console.log("  Fetching upcoming matches...");
      const html = await get("/matches");
      const matches = extractMatchesFromHtml(html);
      allMatches.push(...matches);
      console.log(`  Found ${matches.length} upcoming matches`);
    } catch (e) {
      console.log(`  Error fetching /matches: ${e.message}`);
    }
    
    // Get results pages
    for (let page = 1; page <= maxPages; page++) {
      try {
        console.log(`  Fetching results page ${page}...`);
        const html = await get(`/matches/results/?page=${page}`);
        const matches = extractMatchesFromHtml(html);
        if (matches.length === 0) {
          console.log(`  No more matches on page ${page}, stopping.`);
          break;
        }
        allMatches.push(...matches);
        console.log(`  Page ${page}: ${matches.length} matches`);
      } catch (e) {
        console.log(`  Error on page ${page}: ${e.message}`);
        break;
      }
    }
    
    console.log(`\nTotal matches: ${allMatches.length}`);
    
    // Extract unique events from all matches
    const eventsMap = new Map();
    for (const match of allMatches) {
      if (match.e && match.e !== "TBD") {
        if (!eventsMap.has(match.e)) {
          eventsMap.set(match.e, {
            name: match.e,
            url: match.eventUrl,
            id: match.eventId,
            slug: match.eventSlug,
            matchIds: [match.id]
          });
        } else {
          const existing = eventsMap.get(match.e);
          existing.matchIds.push(match.id);
        }
      }
    }
    
    const events = Array.from(eventsMap.values());
    console.log(`\nUnique events found: ${events.length}`);
    
    // Count how many have URLs
    const withUrls = events.filter(e => e.url).length;
    const withIds = events.filter(e => e.id && e.id !== "unknown").length;
    console.log(`Events with URLs: ${withUrls}/${events.length}`);
    console.log(`Events with IDs: ${withIds}/${events.length}\n`);
    
    if (events.length === 0) {
      console.log("ERROR: No events found in any matches.");
      process.exit(1);
    }
    
    // Step 2: For each event, try to scrape its data
    console.log("Step 2: Scraping event details...\n");
    
    let count = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const event of events) {
      if (db[event.name]?.logo) {
        console.log(`Skipping ${event.name} (already scraped)`);
        skipped++;
        continue;
      }
      
      console.log(`\nScraping: ${event.name}`);
      if (DEBUG) {
        console.log(`  Event data:`, JSON.stringify(event, null, 2));
      }
      
      try {
        let eventHtml = null;
        let eventUrl = null;
        let logo = null;
        let info = {};
        
        // Strategy 1: If we have a full URL from the match page, use it
        if (event.url) {
          try {
            if (DEBUG) console.log(`  Strategy 1: Trying direct URL: ${event.url}`);
            const urlPath = event.url.replace(BASE, "");
            eventHtml = await get(urlPath);
            eventUrl = event.url;
            if (DEBUG) console.log(`    ✓ Direct URL worked!`);
          } catch (e) {
            if (DEBUG) console.log(`    ✗ Direct URL failed: ${e.message}`);
          }
        }
        
        // Strategy 2: If we have ID and slug, try /event/{id}/{slug}
        if (!eventHtml && event.id && event.id !== "unknown" && event.slug) {
          try {
            const url = `/event/${event.id}/${event.slug}`;
            if (DEBUG) console.log(`  Strategy 2: Trying /event/${event.id}/${event.slug}`);
            eventHtml = await get(url);
            eventUrl = BASE + url;
            if (DEBUG) console.log(`    ✓ /event/{id}/{slug} worked!`);
          } catch (e) {
            if (DEBUG) console.log(`    ✗ /event/{id}/{slug} failed: ${e.message}`);
          }
        }
        
        // Strategy 3: If we have ID, try /event/{id}
        if (!eventHtml && event.id && event.id !== "unknown") {
          try {
            const url = `/event/${event.id}`;
            if (DEBUG) console.log(`  Strategy 3: Trying /event/${event.id}`);
            eventHtml = await get(url);
            eventUrl = BASE + url;
            if (DEBUG) console.log(`    ✓ /event/{id} worked!`);
          } catch (e) {
            if (DEBUG) console.log(`    ✗ /event/{id} failed: ${e.message}`);
          }
        }
        
        // Strategy 4: Generate slug from name and try /event/{id}/{slug}
        if (!eventHtml && event.id && event.id !== "unknown") {
          const slug = generateSlug(event.name);
          try {
            const url = `/event/${event.id}/${slug}`;
            if (DEBUG) console.log(`  Strategy 4: Trying /event/${event.id}/${slug}`);
            eventHtml = await get(url);
            eventUrl = BASE + url;
            if (DEBUG) console.log(`    ✓ /event/{id}/{generated-slug} worked!`);
          } catch (e) {
            if (DEBUG) console.log(`    ✗ /event/{id}/{generated-slug} failed: ${e.message}`);
          }
        }
        
        // Strategy 5: Try /tournament/{id}/{slug}
        if (!eventHtml && event.id && event.id !== "unknown") {
          const slug = event.slug || generateSlug(event.name);
          try {
            const url = `/tournament/${event.id}/${slug}`;
            if (DEBUG) console.log(`  Strategy 5: Trying /tournament/${event.id}/${slug}`);
            eventHtml = await get(url);
            eventUrl = BASE + url;
            if (DEBUG) console.log(`    ✓ /tournament/{id}/{slug} worked!`);
          } catch (e) {
            if (DEBUG) console.log(`    ✗ /tournament/{id}/{slug} failed: ${e.message}`);
          }
        }
        
        // Strategy 6: Try various name-based patterns
        if (!eventHtml) {
          const slug = generateSlug(event.name);
          const patterns = [
            `/event/${slug}`,
            `/event/${encodeURIComponent(slug)}`,
            `/tournament/${slug}`,
            `/tournament/${encodeURIComponent(slug)}`,
          ];
          
          for (const pattern of patterns) {
            try {
              if (DEBUG) console.log(`  Strategy 6: Trying ${pattern}`);
              eventHtml = await get(pattern);
              eventUrl = BASE + pattern;
              if (DEBUG) console.log(`    ✓ ${pattern} worked!`);
              break;
            } catch (e) {
              if (DEBUG) console.log(`    ✗ ${pattern} failed: ${e.message}`);
            }
          }
        }
        
        // Strategy 7: Last resort - scrape a match page for this event
        if (!eventHtml && event.matchIds && event.matchIds.length > 0) {
          try {
            if (DEBUG) console.log(`  Strategy 7: Trying match page: /match/${event.matchIds[0]}`);
            const matchHtml = await get(`/match/${event.matchIds[0]}`);
            const extracted = extractEventFromMatchPage(matchHtml);
            if (extracted) {
              logo = extracted.logo;
              info = extracted.info;
              eventUrl = extracted.url;
              if (DEBUG) console.log(`    ✓ Extracted from match page`);
            } else {
              if (DEBUG) console.log(`    ✗ No event info in match page`);
            }
          } catch (e) {
            if (DEBUG) console.log(`    ✗ Match page failed: ${e.message}`);
          }
        }
        
        // Extract logo and info if we have HTML
        if (eventHtml) {
          logo = extractEventLogo(eventHtml);
          info = extractEventInfo(eventHtml, event.name);
        }
        
        // If we still don't have a logo, try to get it from a match page
        if (!logo && event.matchIds && event.matchIds.length > 0) {
          try {
            const matchHtml = await get(`/match/${event.matchIds[0]}`);
            const extracted = extractEventFromMatchPage(matchHtml);
            if (extracted?.logo) {
              logo = extracted.logo;
              if (DEBUG) console.log(`  Got logo from match page`);
            }
          } catch (e) {
            // Ignore
          }
        }
        
        // Set final URL
        if (!eventUrl) {
          const slug = generateSlug(event.name);
          const id = event.id && event.id !== "unknown" ? event.id : "unknown";
          eventUrl = BASE + `/event/${id}/${slug}`;
        }
        
        db[event.name] = {
          id: event.id && event.id !== "unknown" ? event.id : event.name.toLowerCase().replace(/\s+/g, "-"),
          url: eventUrl,
          logo: logo,
          info: info,
          scrapedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(OUT, JSON.stringify(db, null, 2));
        count++;
        
        console.log(`  ✓ Success! Logo: ${logo ? "found" : "none"}, Info: ${Object.keys(info).length} fields`);
      } catch (e) {
        console.error(`  ✗ Failed: ${e.message}`);
        failed++;
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Scraped: ${count}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${Object.keys(db).length} events -> ${OUT}`);
    
    if (failed > 0) {
      console.log(`\n${failed} events failed.`);
      console.log("Run with DEBUG=1 to see which URLs were tried.");
    }
    
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

main().catch(console.error);
