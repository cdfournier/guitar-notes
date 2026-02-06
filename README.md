# Guitar Notes

A song notebook with grid/list indexes, individual song pages, and setlists. The site is authored with EJS templates and JSON/text data, then **pre-rendered to static HTML** for GitHub Pages.

## Live Site
https://cdfournier.github.io/guitar-notes/

## How It Works
- Templates live in `views/` (EJS).
- Data lives in `public/assets/data/` (JSON).
- Song text lives in `public/assets/songs/` (plain text).
- A build script renders everything to `public/` so GitHub Pages can serve it.

## Build (Static)
```bash
cd /Users/chris/Sites/guitar-notes/site
npm run build:static
```

### Base Path
GitHub Pages serves this repo at `/guitar-notes`, so builds should use:
```bash
BASE_PATH=/guitar-notes npm run build:static
```
The GitHub Action does this automatically on pushes to `master`.

## Local Preview (Express)
You can still run the Express app locally for previews:
```bash
cd /Users/chris/Sites/guitar-notes/site
npm start
```
Then visit `http://localhost:3000`.

## Deployment (GitHub Pages)
- GitHub Actions builds on **push to `master`**.
- Output is deployed from `public/`.
- Workflow file: `.github/workflows/pages.yml`.

## Scripts
- `npm start` — run Express locally
- `npm run build:static` — render static site into `public/`

## Built With
- [Express](https://expressjs.com/)
- [EJS](https://ejs.co/)

## License
Distributed under the MIT License. See `LICENSE.txt` for details.
