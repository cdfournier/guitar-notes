const fs = require('fs/promises');
const path = require('path');
const ejs = require('ejs');
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
    await ensureNoJekyll();
    return;
  }

  if (forceFullBuild) {
    await buildIndexes();
    await buildSongs();
    await buildSetlists();
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

  await ensureNoJekyll();
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
