// ONE-TIME import of events from vlr.gg -> data/events.json
//
// Usage: node scrape-events.js
//
// Scrapes all events from vlr.gg and their logos.
// Events are stored with their logo URLs (hotlinked from vlr.gg).

import fs from "node:fs";
import * as cheerio from "cheerio";

const BASE = "https://www.vlr.gg";
const UA = "match-schedule/1.0 (one-time import)";
const OUT = "data/events.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let last = 0;
async function get(path) {
  const wait = last + 1000 - Date.now(); // Be polite, 1 second between requests
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const r = await fetch(BASE + path, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.text();
}

// Extract event logo URL from event page
function extractEventLogo(html) {
  const $ = cheerio.load(html);
  // Look for event logo in the header
  const logo = $(".event-header-logo img").attr("src") || 
               $(".event-detail-header-logo img").attr("src") ||
               $(".mod-event-header img").attr("src");
  
  if (logo) {
    // Make it absolute URL
    return new URL(logo, BASE).href;
  }
  return null;
}

// Extract event info from event page
function extractEventInfo(html) {
  const $ = cheerio.load(html);
  const info = {};
  
  // Try to get event details
  $(".event-detail-header-info-item").each((_, el) => {
    const key = clean($(".event-detail-header-info-item-key", el).text());
    const value = clean($(".event-detail-header-info-item-value", el).text());
    if (key && value) info[key] = value;
  });
  
  // Alternative: from infobox
  $(".wf-card .infobox-description").each((_, el) => {
    const key = clean($(el).text()).replace(/:$/, "");
    const value = clean($(el).next().text());
    if (key && value && key !== "Links") info[key] = value;
  });
  
  return info;
}

const clean = (s) => s.replace(/\s+/g, " ").trim();

async function main() {
  fs.mkdirSync("data", { recursive: true });
  
  // Load existing data
  const db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  
  console.log("Fetching events page...");
  
  try {
    // Get the events page
    const html = await get("/events");
    const $ = cheerio.load(html);
    
    const events = [];
    
    // Find all event links on the main page
    $(".event-item a, .wf-card a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("/event/")) {
        const name = clean($(el).find(".event-item-name, .event-item-title").text()) || 
                     clean($(el).text());
        if (name) {
          events.push({ 
            id: href.split("/")[2],
            name: name,
            url: BASE + href
          });
        }
      }
    });
    
    // Check for pagination
    let page = 2;
    while (true) {
      const nextPage = await get(`/events?page=${page}`);
      const $next = cheerio.load(nextPage);
      const nextEvents = [];
      
      $next(".event-item a, .wf-card a").each((_, el) => {
        const href = $next(el).attr("href");
        if (href && href.startsWith("/event/")) {
          const name = clean($next(el).find(".event-item-name, .event-item-title").text()) || 
                       clean($next(el).text());
          if (name) {
            nextEvents.push({ 
              id: href.split("/")[2],
              name: name,
              url: BASE + href
            });
          }
        }
      });
      
      if (nextEvents.length === 0) break;
      
      events.push(...nextEvents);
      console.log(`  Page ${page}: ${nextEvents.length} more events`);
      page++;
      
      // Safety check: don't go beyond page 50
      if (page > 50) break;
    }
    
    console.log(`Found ${events.length} events total`);
    
    // Remove duplicates by name (keep first occurrence)
    const uniqueEvents = [];
    const seenNames = new Set();
    for (const event of events) {
      if (!seenNames.has(event.name)) {
        seenNames.add(event.name);
        uniqueEvents.push(event);
      }
    }
    console.log(`After deduplication: ${uniqueEvents.length} unique events`);
    
    // Process each event to get logo and info
    let count = 0;
    for (const event of uniqueEvents) {
      if (db[event.name]?.logo) {
        console.log(`  Skipping ${event.name} (already scraped)`);
        continue;
      }
      
      console.log(`Scraping: ${event.name}`);
      try {
        const eventHtml = await get(`/event/${event.id}`);
        const logo = extractEventLogo(eventHtml);
        const info = extractEventInfo(eventHtml);
        
        db[event.name] = {
          id: event.id,
          url: event.url,
          logo: logo,
          info: info,
          scrapedAt: new Date().toISOString()
        };
        
        // Save after each event
        fs.writeFileSync(OUT, JSON.stringify(db, null, 2));
        count++;
        
        console.log(`  ✓ Logo: ${logo || "none"}, Info: ${Object.keys(info).length} fields`);
      } catch (e) {
        console.error(`  ✗ Failed: ${e.message}`);
      }
    }
    
    console.log(`\nDone! Scraped ${count} new events. Total: ${Object.keys(db).length} events -> ${OUT}`);
    
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

main();
