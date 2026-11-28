# Scraping Liquipedia Data

This project includes a scraper that imports team and player data from Liquipedia's Valorant wiki.

## Quick Start

### Scrape specific teams
```bash
LP_UA="your-site (you@email.com)" node scrape-liquipedia.js --teams="Team Liquid,Cloud9,Fnatic"
```

### Scrape all teams from Liquipedia
```bash
LP_UA="your-site (you@email.com)" node scrape-liquipedia.js --all-teams
```

**Note:** This will scrape ALL teams in the Liquipedia Valorant "Teams" category, which may take a very long time (hours) due to API rate limits.

### Scrape teams from recent matches
First start the server, then:
```bash
LP_UA="your-site (you@email.com)" node scrape-liquipedia.js --limit=30
```
This scrapes the 30 most frequently appearing teams from vlr.gg matches.

## What gets scraped

- **Team data:**
  - Team logos (light and dark mode) - downloaded locally
  - Team info (location, region, coach, etc.)
  - Team roster (players)
  - Organization/staff
  - Achievements

- **Player data:**
  - Player info (name, country, role, etc.)
  - **Player images** (hotlinked from Liquipedia Commons - no local download)

## Player Images

Player headshots are displayed directly from Liquipedia Commons:
- Images are hotlinked (not downloaded locally)
- Uses Liquipedia's thumbnail URLs (600px width)
- Team logos are still downloaded locally to `public/logos/`

## API Endpoints

- `GET /api/team/:name` - Get team data including players with image URLs
- `GET /api/player/:name` - Get player data including image URL
- `GET /api/logos` - Get all team logo URLs

## Flags

- `--teams="Team1,Team2,Team3"` - Scrape specific teams
- `--all-teams` - Scrape all teams from Liquipedia
- `--limit=N` - Limit number of teams to scrape (default: all)
- `--force` - Re-import teams already saved
- `--debug` - Print page outline and save raw HTML to data/ directory

## Rate Limits

The scraper respects Liquipedia's API rate limits:
- `action=parse`: 1 request per 30 seconds
- Other actions: 1 request per 2 seconds

Scraping all teams and players will take a significant amount of time due to these limits.

## Docker Usage

To run the scraper in Docker:

```bash
# Build and start the container
docker-compose up -d --build

# Execute the scraper inside the container
docker exec -it valar-app sh -c "LP_UA='your-site (you@email.com)' node scrape-liquipedia.js --all-teams"
```

**Note:** The data and public directories are mounted as volumes, so scraped data and images will persist on your host machine.

## Data Files

- `data/liquipedia.json` - All scraped team and player data
- `public/logos/` - Team logos
- `public/players/` - Player headshots
