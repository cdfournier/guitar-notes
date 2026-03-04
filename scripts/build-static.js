const fs = require('fs/promises');
const path = require('path');
const ejs = require('ejs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const {
  loadSongs,
  getSongText,
  groupSongsByArtist,
  textToParagraphs,
} = require('../routes/songs-data');

const { getSetlistsIndex, getSetlistByKey } = require('../routes/setlists-data');

const viewsDir = path.join(__dirname, '..', 'views');
const outputDir = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(__dirname, '..', 'public');

const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '');
const dataDir = path.join(__dirname, '..', 'public', 'assets', 'data');
const canonicalSetlistsFile = 'guitar-notes-setlists.json';
const pwaBasePath = basePath || '';
const pwaScope = `${pwaBasePath}/` || '/';

function getChangedFiles() {
  if (process.env.INCREMENTAL !== '1') return null;
  const base = process.env.GIT_BASE;
  const head = process.env.GIT_HEAD;
  if (!base || !head) return null;
  try {
    const output = execSync(`git diff --name-only ${base} ${head}`, { encoding: 'utf8' });
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (err) {
    console.warn('Incremental build disabled: unable to read git diff.');
    return null;
  }
}

function slugsFromSongFiles(files) {
  const slugs = new Set();
  for (const file of files) {
    const match = file.match(/public\/assets\/songs\/(.+)\.txt$/);
    if (!match) continue;
    let name = match[1];
    if (name.endsWith('-a') || name.endsWith('-b') || name.endsWith('-c')) {
      name = name.slice(0, -2);
    }
    slugs.add(name);
  }
  return slugs;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function toPublicUrl(relPath) {
  let rel = toPosixPath(relPath);
  if (rel.endsWith('/index.html')) {
    rel = rel.slice(0, -'index.html'.length);
  }
  const leading = rel.startsWith('/') ? rel : `/${rel}`;
  let url = `${pwaBasePath}${leading}`;
  if (url.endsWith('/index.html')) {
    url = url.slice(0, -'index.html'.length);
  }
  return url;
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

async function collectFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const childFiles = await collectFilesRecursive(fullPath);
      files.push(...childFiles);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function shouldIncludeInPrecache(relPath) {
  const rel = toPosixPath(relPath);

  if (rel.startsWith('v0/')) return false;
  if (rel.startsWith('setlists/')) return false;
  if (rel === 'setlists.html') return false;
  if (rel === 'assets/data/guitar-notes-setlists.json') return false;
  if (rel === 'assets/data/offline-cache-manifest.json') return false;
  if (rel === 'sw.js') return false;
  if (rel.endsWith('.map')) return false;
  if (rel.startsWith('songs/')) return false;
  if (rel.startsWith('assets/songs/')) return false;

  return (
    rel.endsWith('.html') ||
    rel.endsWith('.css') ||
    rel.endsWith('.js') ||
    rel.endsWith('.svg') ||
    rel.endsWith('.png') ||
    rel.endsWith('.jpg') ||
    rel.endsWith('.jpeg') ||
    rel.endsWith('.webp') ||
    rel.endsWith('.ico') ||
    rel.endsWith('.json') ||
    rel.endsWith('.txt') ||
    rel.endsWith('.webmanifest')
  );
}

function shouldIncludeInOfflineManifest(relPath) {
  const rel = toPosixPath(relPath);

  if (rel.startsWith('v0/')) return false;
  if (rel === 'sw.js') return false;
  if (rel.endsWith('.map')) return false;
  if (rel === 'assets/data/offline-cache-manifest.json') return false;

  return (
    rel.endsWith('.html') ||
    rel.endsWith('.css') ||
    rel.endsWith('.js') ||
    rel.endsWith('.svg') ||
    rel.endsWith('.png') ||
    rel.endsWith('.jpg') ||
    rel.endsWith('.jpeg') ||
    rel.endsWith('.webp') ||
    rel.endsWith('.ico') ||
    rel.endsWith('.json') ||
    rel.endsWith('.txt') ||
    rel.endsWith('.webmanifest')
  );
}

async function renderToFile(view, data, outPath) {
  const viewPath = path.join(viewsDir, `${view}.ejs`);
  const html = await new Promise((resolve, reject) => {
    ejs.renderFile(
      viewPath,
      { ...data, basePath },
      { views: [viewsDir] },
      (err, str) => {
        if (err) reject(err);
        else resolve(str);
      }
    );
  });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, html);
}

async function buildIndexes() {
  const groups = await groupSongsByArtist('main');
  const labGroups = await groupSongsByArtist('lab');

  const pages = [
    {
      view: 'songs-index',
      out: 'index.html',
      data: { title: 'Guitar Notes', groups },
    },
    {
      view: 'songs-index',
      out: 'grid.html',
      data: { title: 'Guitar Notes', groups },
    },
    {
      view: 'songs-index',
      out: path.join('songs', 'index.html'),
      data: { title: 'Guitar Notes', groups },
    },
    {
      view: 'songs-list',
      out: path.join('songs', 'list', 'index.html'),
      data: { title: 'Guitar Notes list', groups },
    },
    {
      view: 'songs-list',
      out: 'list.html',
      data: { title: 'Guitar Notes list', groups },
    },
    {
      view: 'lab-grid',
      out: path.join('lab', 'index.html'),
      data: { title: 'Guitar Notes Lab', groups: labGroups },
    },
    {
      view: 'lab-grid',
      out: 'lab-grid.html',
      data: { title: 'Guitar Notes Lab', groups: labGroups },
    },
    {
      view: 'lab-list',
      out: path.join('lab', 'list', 'index.html'),
      data: { title: 'Guitar Notes Lab list', groups: labGroups },
    },
    {
      view: 'lab-list',
      out: 'lab-list.html',
      data: { title: 'Guitar Notes Lab list', groups: labGroups },
    },
    {
      view: 'show',
      out: path.join('show', 'index.html'),
      data: { title: 'Setlist Builder | Guitar Notes' },
    },
    {
      view: 'show',
      out: 'show.html',
      data: { title: 'Setlist Builder | Guitar Notes' },
    },
  ];

  for (const page of pages) {
    const outPath = path.join(outputDir, page.out);
    await renderToFile(page.view, page.data, outPath);
  }
}

async function buildSongs(options = {}) {
  const songs = await loadSongs('main');
  const labSongs = await loadSongs('lab');
  const allSongs = [...songs, ...labSongs];
  const onlySlugs = options.onlySlugs ? new Set(options.onlySlugs) : null;

  for (const song of allSongs) {
    const slug = song['artist-song'];
    if (!slug) continue;
    if (onlySlugs && !onlySlugs.has(slug)) continue;
    const text = await getSongText(slug);
    const paragraphs = textToParagraphs(text || '');
    const outPath = path.join(outputDir, 'songs', slug, 'index.html');
    await renderToFile('song', {
      title: `${song.song} | Guitar Notes`,
      song,
      paragraphs,
      isLab: false,
    }, outPath);
  }
}

async function buildSetlists() {
  const years = await getSetlistsIndex();

  await renderToFile(
    'setlists-index',
    { title: 'Guitar Notes Setlists', years },
    path.join(outputDir, 'setlists', 'index.html')
  );

  await renderToFile(
    'setlists-index',
    { title: 'Guitar Notes Setlists', years },
    path.join(outputDir, 'setlists.html')
  );

  for (const year of years) {
    for (const month of year.months) {
      for (const entry of month.dates) {
        const setlist = await getSetlistByKey(entry.ymd);
        if (!setlist) continue;
        await renderToFile(
          'setlist',
          {
            title: `${setlist.date} | Guitar Notes`,
            date: setlist.date,
            sets: setlist.sets,
            hasAcoustic: setlist.hasAcoustic,
            noteDetails: setlist.noteDetails,
            prev: setlist.prev,
            next: setlist.next,
          },
          path.join(outputDir, 'setlists', entry.ym, entry.ymd, 'index.html')
        );
      }
    }
  }
}

async function buildPwaArtifacts() {
  const manifest = {
    name: 'Guitar Notes',
    short_name: 'Guitar Notes',
    start_url: `${pwaBasePath}/songs/` || '/songs/',
    scope: pwaScope,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#333333',
    icons: [
      {
        src: 'assets/icons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'assets/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'assets/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };

  await fs.writeFile(
    path.join(outputDir, 'site.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  await fs.mkdir(path.join(outputDir, 'offline'), { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'offline', 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Offline | Guitar Notes</title>
    <style>
      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        font-family: "Courier", monospace;
        color: #333333;
        background: #ffffff;
      }
      main { max-width: 40rem; text-align: center; }
      h1 { margin: 0 0 1rem; font-size: 1.75rem; line-height: 1.2; }
      p { margin: 0; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>Offline</h1>
      <p>Guitar Notes is currently offline. Reconnect to load content not yet cached.</p>
    </main>
  </body>
</html>
`
  );

  const files = await collectFilesRecursive(outputDir);
  const precacheEntries = [];
  const seen = new Set();
  const offlineManifestEntries = [];
  const offlineSeen = new Set();

  for (const fullPath of files) {
    const relPath = path.relative(outputDir, fullPath);
    if (!shouldIncludeInPrecache(relPath)) continue;

    const raw = await fs.readFile(fullPath);
    const rev = hashContent(raw);
    const baseUrl = toPublicUrl(relPath);
    const cacheUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}v=${rev}`;

    if (seen.has(cacheUrl)) continue;
    seen.add(cacheUrl);
    precacheEntries.push(cacheUrl);
  }

  for (const fullPath of files) {
    const relPath = path.relative(outputDir, fullPath);
    if (!shouldIncludeInOfflineManifest(relPath)) continue;
    const url = toPublicUrl(relPath);
    if (offlineSeen.has(url)) continue;
    offlineSeen.add(url);
    offlineManifestEntries.push(url);
  }

  const offlineUrl = `${pwaBasePath}/offline/` || '/offline/';
  if (!precacheEntries.some((value) => value.startsWith(`${offlineUrl}?v=`))) {
    const offlineRaw = await fs.readFile(path.join(outputDir, 'offline', 'index.html'));
    const offlineRev = hashContent(offlineRaw);
    precacheEntries.push(`${offlineUrl}?v=${offlineRev}`);
  }

  precacheEntries.sort();
  const cacheVersion = hashContent(Buffer.from(precacheEntries.join('\n')));
  offlineManifestEntries.sort();

  const offlineManifestOut = path.join(outputDir, 'assets', 'data', 'offline-cache-manifest.json');
  await fs.mkdir(path.dirname(offlineManifestOut), { recursive: true });
  await fs.writeFile(
    offlineManifestOut,
    JSON.stringify(
      {
        version: cacheVersion,
        urls: offlineManifestEntries
      },
      null,
      2
    )
  );

  const swSource = `/* autogenerated by scripts/build-static.js */
const CACHE_VERSION = ${JSON.stringify(cacheVersion)};
const BASE_PATH = ${JSON.stringify(pwaBasePath)};
const OFFLINE_URL = ${JSON.stringify(offlineUrl)};
const PRECACHE = ${JSON.stringify(precacheEntries, null, 2)};
const STATIC_CACHE = \`guitar-notes-static-\${CACHE_VERSION}\`;
const RUNTIME_CACHE = \`guitar-notes-runtime-\${CACHE_VERSION}\`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    try {
      await cache.addAll(PRECACHE);
    } catch (err) {
      // If full precache fails (storage/network), runtime cache still works.
      console.warn('Precache incomplete', err);
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
        return caches.delete(key);
      }
      return Promise.resolve();
    }));
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const runtime = await caches.open(RUNTIME_CACHE);
    const destination = request.destination || '';
    const isDocument = request.mode === 'navigate' || destination === 'document';
    const isCoreAsset = destination === 'script' || destination === 'style' || destination === 'worker';
    const cached = isDocument
      ? await caches.match(request, { ignoreSearch: true })
      : await caches.match(request);

    const fetchAndCache = () => fetch(request)
      .then((response) => {
        if (response && response.ok) {
          runtime.put(request, response.clone());
        }
        return response;
      });

    // Network-first for HTML + JS/CSS so code updates land predictably.
    if (isDocument || isCoreAsset) {
      try {
        return await fetchAndCache();
      } catch (networkError) {
        if (cached) return cached;
        if (isDocument) {
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    }

    // Cache-first for media/data to keep PWA snappy offline.
    if (cached) {
      fetchAndCache().catch(() => null);
      return cached;
    }

    try {
      return await fetchAndCache();
    } catch (networkError) {
      if (isDocument) {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
`;

  await fs.writeFile(path.join(outputDir, 'sw.js'), swSource);
}

async function ensureNoJekyll() {
  const target = path.join(outputDir, '.nojekyll');
  try {
    await fs.writeFile(target, '');
  } catch (err) {
    console.error('Failed to write .nojekyll:', err);
  }
}

async function validateSetlistsDataFilename() {
  const files = await fs.readdir(dataDir);
  const candidates = files.filter((name) => /^guitar-notes-setlists.*\.json$/i.test(name));
  const extras = candidates.filter((name) => name !== canonicalSetlistsFile);
  if (extras.length === 0) return;

  throw new Error(
    `Unexpected setlists data file(s): ${extras.join(', ')}. ` +
    `Use only ${canonicalSetlistsFile} in public/assets/data/.`
  );
}

async function build() {
  await validateSetlistsDataFilename();

  const changedFiles = getChangedFiles();
  const hasChanges = Array.isArray(changedFiles) && changedFiles.length > 0;

  const dataMain = 'public/assets/data/guitar-notes-data.json';
  const dataLab = 'public/assets/data/guitar-notes-lab-data.json';
  const dataSetlists = 'public/assets/data/guitar-notes-setlists.json';
  const songsPrefix = 'public/assets/songs/';
  const fullBuildPrefixes = ['views/', 'routes/', 'public/assets/js/', 'public/assets/style/'];

  const changedSet = new Set(changedFiles || []);
  const dataChanged = hasChanges && (changedSet.has(dataMain) || changedSet.has(dataLab));
  const setlistsChanged = hasChanges && changedSet.has(dataSetlists);
  const songTextChanged = hasChanges && Array.from(changedSet).some((file) => file.startsWith(songsPrefix));
  const forceFullBuild = hasChanges && Array.from(changedSet).some((file) => (
    fullBuildPrefixes.some((prefix) => file.startsWith(prefix)) ||
    file === 'scripts/build-static.js' ||
    file === 'app.js' ||
    file === '.github/workflows/pages.yml'
  ));

  if (!hasChanges) {
    await buildIndexes();
    await buildSongs();
    await buildSetlists();
    await buildPwaArtifacts();
    await ensureNoJekyll();
    return;
  }

  if (forceFullBuild) {
    await buildIndexes();
    await buildSongs();
    await buildSetlists();
    await buildPwaArtifacts();
    await ensureNoJekyll();
    return;
  }

  if (dataChanged) {
    await buildIndexes();
  }

  if (dataChanged) {
    await buildSongs();
  } else if (songTextChanged) {
    const onlySlugs = slugsFromSongFiles(changedFiles);
    if (onlySlugs.size > 0) {
      await buildSongs({ onlySlugs });
    }
  }

  if (dataChanged || setlistsChanged) {
    await buildSetlists();
  }

  await buildPwaArtifacts();
  await ensureNoJekyll();
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
