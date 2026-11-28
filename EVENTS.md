# Events Scraping

This project includes a scraper that imports ALL event data from vlr.gg.

## Quick Start

Scrape ALL current and upcoming events from vlr.gg:
```bash
node scrape-events.js
```

**Debug mode** (to see which URLs are being tried):
```bash
DEBUG=1 node scrape-events.js
```

This will:
1. Scrape 20+ pages of matches (upcoming and results)
2. Extract unique event names from all matches
3. For each event, try multiple URL patterns to find the correct page
4. If event page not found, extract info from match pages
5. Save all data to `data/events.json`

## How It Works

The scraper uses a multi-step approach:

1. **Collect matches**: Scrapes `/matches` and `/matches/results/?page=1-20`
2. **Extract events**: Gets unique event names from all matches
3. **Scrape event data**: For each event:
   - Tries the URL if extracted from match page
   - Tries `/event/{id}` if ID was extracted
   - Tries various URL patterns based on event name
   - Falls back to scraping a match page for that event
4. **Save**: Stores all data in `data/events.json`

## Troubleshooting

If events are failing with 404 errors:

1. **Run in debug mode**: `DEBUG=1 node scrape-events.js`
   - This shows which URLs are being tried for each event
   
2. **Check vlr.gg manually**:
   - Visit https://www.vlr.gg
   - Find an event and note its URL structure
   
3. **Known URL pattern**:
   - `/event/{id}/{slug}` (e.g., `/event/3233/vct-2027-emea-kickoff-europe-qualifier-playoffs`)
   - The scraper now tries this pattern first

4. **The scraper tries these strategies in order**:
   - Direct URL from match page
   - `/event/{id}/{slug}` (with both ID and slug)
   - `/event/{id}` (with just ID)
   - `/event/{id}/{generated-slug}` (generate slug from name)
   - `/tournament/{id}/{slug}`
   - Name-based patterns
   - Fallback to match page scraping

If you find a pattern that's not being tried, add it to the scraper.

The scraper tries all these patterns automatically.

## What gets scraped

- **Event name**
- **Event logo URL** (hotlinked from vlr.gg)
- **Event info** (dates, location, prize pool, etc.)
- **Event URL** on vlr.gg

## API Endpoints

- `GET /api/event-logos` - Get all event logos (returns `{ eventName: { l: logoUrl } }`)
- `GET /api/event/:name` - Get info about a specific event

## Display

Event logos are displayed on the schedule page next to each match's event name.

## Rate Limiting

The scraper waits 1 second between requests to be polite to vlr.gg servers.

## Notes

- Event logos are **hotlinked** (not downloaded locally)
- If an event doesn't have a logo, a placeholder with the first letter is shown
- Re-running the scraper will skip already-scraped events

## Troubleshooting

If the scraper finds 0 events, vlr.gg may have changed their HTML structure. Try:

1. Visit https://www.vlr.gg/events in your browser
2. View the page source (Ctrl+U)
3. Look for links that start with `/event/`
4. Update the selectors in `scrape-events.js` to match the new structure

The scraper uses multiple fallback selectors, but if vlr.gg makes significant changes, the selectors may need to be updated.
