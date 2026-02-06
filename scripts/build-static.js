const fs = require('fs/promises');
const path = require('path');
const ejs = require('ejs');

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
  ];

  for (const page of pages) {
    const outPath = path.join(outputDir, page.out);
    await renderToFile(page.view, page.data, outPath);
  }
}

async function buildSongs() {
  const songs = await loadSongs('main');
  const labSongs = await loadSongs('lab');
  const allSongs = [...songs, ...labSongs];

  for (const song of allSongs) {
    const slug = song['artist-song'];
    if (!slug) continue;
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

async function build() {
  await buildIndexes();
  await buildSongs();
  await buildSetlists();
  await ensureNoJekyll();
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
