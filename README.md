# VALARANT Match Schedule

A web application that displays VALORANT match schedules, teams, and events with logos and player images scraped from vlr.gg and Liquipedia.

## Features

- **Match Schedule**: View upcoming and completed matches with team logos
- **Teams Page**: Browse all teams with their rosters and player images
- **Events Page**: View all VALORANT events with logos, dates, prize pools, and regions
- **Event Details**: Each event page shows matches, participating teams, start/end dates, prize pool, and region
- **Player Pages**: View player information with images from Liquipedia
- **Light/Dark Mode**: Automatic theme switching based on system preferences
- **Filtering**: Filter matches by event or team
- **Search**: Search for teams and events
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### Using Docker (Recommended)

1. Clone the repository
2. Run the following commands:

```bash
# Build and start the containers
docker-compose up -d

# The application will be available at http://localhost:3000
```

3. To scrape data:

```bash
# Scrape teams and players from Liquipedia
docker-compose exec app node scrapers/scrape-liquipedia.js --all-teams

# Scrape events from vlr.gg
docker-compose exec app node scrape-events.js
```

### Without Docker

1. Install Node.js (v18 or later recommended)
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
node server.js
```

The application will be available at http://localhost:3000

4. To scrape data, run in separate terminals:

```bash
# Scrape teams and players from Liquipedia
node scrapers/scrape-liquipedia.js --all-teams

# Scrape events from vlr.gg
node scrape-events.js
```

## Scraping Data

### Teams and Players (from Liquipedia)

```bash
# Scrape specific teams
LP_UA="your-contact-info" node scrapers/scrape-liquipedia.js --teams="Team Liquid,Cloud9"

# Scrape all teams
LP_UA="your-contact-info" node scrapers/scrape-liquipedia.js --all-teams

# Scrape teams from matches on the server
# (requires server to be running)
LP_UA="your-contact-info" node scrapers/scrape-liquipedia.js --limit=50
```

**Note**: Liquipedia requires a user-agent string with contact information. Replace `your-contact-info` with your email or website.

### Events (from vlr.gg)

```bash
# Scrape all events from matches
node scrape-events.js

# Debug mode (shows which URLs are being tried)
DEBUG=1 node scrape-events.js
```

## Project Structure

```
Valar/
├── data/                    # Scraped data (persisted)
│   ├── liquipedia.json      # Teams and players from Liquipedia
│   └── events.json          # Events from vlr.gg
├── public/                  # Static files
│   ├── css/
│   │   └── style.css        # Styles with light/dark mode support
│   ├── js/                  # JavaScript files
│   │   ├── schedule.js       # Schedule page logic
│   │   ├── teams.js          # Teams page logic
│   │   ├── events.js         # Events page logic
│   │   ├── team.js           # Team page logic
│   │   ├── event.js          # Event page logic
│   │   ├── player.js         # Player page logic
│   │   └── utils.js          # Utility functions
│   ├── logos/               # Downloaded team logos
│   ├── index.html           # Schedule page
│   ├── teams.html           # Teams listing page
│   ├── events.html          # Events listing page
│   ├── team.html            # Individual team page
│   ├── event.html           # Individual event page
│   └── player.html          # Individual player page
├── scrapers/
│   └── scrape-liquipedia.js # Liquipedia scraper
├── lp-parse.js              # Liquipedia HTML parser
├── scrape-events.js         # vlr.gg event scraper
├── server.js                # Express server
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker Compose configuration
├── package.json             # Node.js dependencies
└── README.md                # This file
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `RESULT_PAGES`: Number of result pages to scrape from vlr.gg (default: 3)
- `LP_UA`: User agent string for Liquipedia API (required for scraping)

### Docker Configuration

Edit `docker-compose.yml` to change:
- Port mapping
- Volume mounts
- Environment variables

## API Endpoints

- `GET /api/matches` - Get all matches
- `GET /api/team/:name` - Get team data
- `GET /api/player/:name` - Get player data
- `GET /api/event/:name` - Get event data
- `GET /api/logos` - Get all team logos
- `GET /api/event-logos` - Get all event logos
- `GET /api/team-data` - Get all team data
- `GET /api/event-data` - Get all event data

## Browser Features

- **Local Storage**: Filters are saved in localStorage
- **Auto-refresh**: Matches are refreshed every 2 minutes
- **Lazy loading**: Images are loaded lazily for performance
- **Responsive**: Works on all screen sizes

## Troubleshooting

### 404 Errors

If you see 404 errors for team or event data:
1. Make sure you've run the scrapers
2. Check that the data files exist in the `data/` directory
3. Verify the server is running and accessible

### Images Not Showing

1. Make sure the scrapers have downloaded the logos
2. Check that the `public/logos/` directory contains image files
3. Verify the liquipedia.json file has `logoFile` and `logoDarkFile` fields

### Scraping Fails

1. For Liquipedia: Make sure to set the `LP_UA` environment variable
2. For vlr.gg: The site structure may have changed - check the scrape-events.js selectors
3. Run with `DEBUG=1` to see detailed error messages

## License

This project uses data from:
- [vlr.gg](https://www.vlr.gg) - Match and event data
- [Liquipedia](https://liquipedia.net/valorant) - Team and player data (CC-BY-SA 3.0)

Team logos and player images are copyright of their respective owners.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Acknowledgments

- [Cheerio](https://cheerio.js.org/) - HTML parsing
- [Express](https://expressjs.com/) - Web server framework
- [vlr.gg](https://www.vlr.gg) - VALORANT esports data
- [Liquipedia](https://liquipedia.net/valorant) - VALORANT wiki
