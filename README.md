# Guitar Notes

A song notebook with grid/list indexes, individual song pages, and setlists. The site is authored with EJS templates and JSON/text data, then **pre-rendered to static HTML** for GitHub Pages.

## Live Site
https://cdfournier.github.io/guitar-notes/

## Prerequisites
- Node.js 18+ (20 recommended)
- npm

## Install
```bash
npm install
```

## Build (Static)
Generates the static site into `public/`:
```bash
npm run build:static
```

### Base Path (GitHub Pages)
If you’re deploying to GitHub Pages at `https://<user>.github.io/<repo>/`, set:
```bash
BASE_PATH=/<repo> npm run build:static
```
For this repo:
```bash
BASE_PATH=/guitar-notes npm run build:static
```

## Local Preview (Express)
Run the Express app locally for previews:
```bash
npm start
```
Then visit `http://localhost:3000`.

## Data Layout
- Templates: `views/`
- Song data: `public/assets/data/guitar-notes-data.json`
- Lab song data: `public/assets/data/guitar-notes-lab-data.json`
- Setlists data: `public/assets/data/guitar-notes-setlists.json`
- Song text files: `public/assets/songs/*.txt`

## Setlist Builder
- Add songs from grid/list/song pages using the add icon.
- Open the builder at `/show` to review the current setlist, remove individual songs, or clear all songs.
- Setlist order is preserved in the order songs were added.
- Duplicate songs are allowed.
- State is stored in browser `localStorage` under key `setlistDraft`.
- Because state is local browser storage, setlists are device/browser specific.

## Show Tracker
- Tracker start/stop controls are available in headers on grid/list pages and on `/show`.
- While tracking is active, opening any song page auto-logs that song visit.
- Stopping tracker mode automatically downloads `setlist.txt` (title-only, one per line) when there are tracked songs.
- Stopping tracker mode also clears tracker session data from browser `localStorage`.
- Tracker state uses browser `localStorage` keys:
  - `setlistTrackerActive`
  - `setlistTrackerStartedAt`
  - `setlistTrackerSongs`

## Deployment (GitHub Pages)
This repo uses GitHub Actions to build and deploy on push to `master`.
Workflow: `.github/workflows/pages.yml`.

## Scripts
- `npm start` — run Express locally
- `npm run build:static` — render static site into `public/`

## Built With
- [Express](https://expressjs.com/)
- [EJS](https://ejs.co/)

## License
Distributed under the MIT License. See `LICENSE.txt` for details.
