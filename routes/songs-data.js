const fs = require('fs/promises');
const path = require('path');

const DATA_PATHS = {
  main: path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-data.json'),
  lab: path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-lab-data.json'),
};
const ENRICHMENT_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-enrichment.json');
const SONGS_DIR = path.join(__dirname, '..', 'public', 'assets', 'songs');

let cachedSongs = new Map();
let fileIndex = null;
let cachedEnrichment = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeTags(tags) {
  if (!tags) return [];
  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function parseEnrichment(raw) {
  if (!raw || typeof raw !== 'object') return new Map();
  const map = new Map();
  const records = raw.records && typeof raw.records === 'object'
    ? raw.records
    : null;
  const items = Array.isArray(raw.items) ? raw.items : null;

  if (records) {
    for (const [slug, value] of Object.entries(records)) {
      if (slug) map.set(slug, value || null);
    }
    return map;
  }

  if (items) {
    for (const item of items) {
      if (item && item.slug) {
        map.set(item.slug, item);
      }
    }
  }

  return map;
}

async function loadEnrichment() {
  if (cachedEnrichment) return cachedEnrichment;
  try {
    const raw = await fs.readFile(ENRICHMENT_PATH, 'utf8');
    cachedEnrichment = parseEnrichment(JSON.parse(raw));
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      cachedEnrichment = new Map();
    } else {
      throw err;
    }
  }
  return cachedEnrichment;
}

async function loadSongs(kind = 'main') {
  if (cachedSongs.has(kind)) return cachedSongs.get(kind);
  const dataPath = DATA_PATHS[kind] || DATA_PATHS.main;
  const raw = await fs.readFile(dataPath, 'utf8');
  const data = JSON.parse(raw);
  const enrichment = await loadEnrichment();
  const normalized = data.map((song) => {
    const entry = enrichment.get(song['artist-song']) || null;
    const manualAlbum = typeof song.album === 'string' ? song.album.trim() : song.album;
    const manualYear = song.year;
    const fallbackAlbum = entry && typeof entry.album === 'string' ? entry.album.trim() : '';
    const fallbackYear = entry && entry.year !== undefined && entry.year !== null && String(entry.year).trim() !== ''
      ? Number(entry.year)
      : null;

    return {
      ...song,
      artist: typeof song.artist === 'string' ? song.artist.trim() : song.artist,
      song: typeof song.song === 'string' ? song.song.trim() : song.song,
      album: isBlank(manualAlbum) ? fallbackAlbum : manualAlbum,
      year: isBlank(manualYear) ? fallbackYear : manualYear,
      tags: typeof song.tags === 'string' ? song.tags.trim() : song.tags,
      tagsArray: normalizeTags(song.tags),
      enrichment: entry,
    };
  });
  cachedSongs.set(kind, normalized);
  return normalized;
}

async function buildFileIndex() {
  if (fileIndex) return fileIndex;
  const files = await fs.readdir(SONGS_DIR);
  fileIndex = new Map();
  for (const file of files) {
    if (!file.endsWith('.txt')) continue;
    const base = file.replace(/\.txt$/i, '');
    if (!fileIndex.has(base)) {
      fileIndex.set(base, file);
    }
  }
  return fileIndex;
}

function sortSongs(a, b) {
  const artistA = (a['artist-sort'] || a.artist || '').toLowerCase();
  const artistB = (b['artist-sort'] || b.artist || '').toLowerCase();
  if (artistA < artistB) return -1;
  if (artistA > artistB) return 1;
  const songA = (a.song || '').toLowerCase();
  const songB = (b.song || '').toLowerCase();
  return songA.localeCompare(songB);
}

async function getSongBySlug(slug, kind = 'main') {
  const songs = await loadSongs(kind);
  return songs.find((song) => song['artist-song'] === slug);
}

async function getSongText(slug) {
  const index = await buildFileIndex();
  const candidates = [slug, `${slug}-a`, `${slug}-b`, `${slug}-c`];
  let filename = null;
  for (const candidate of candidates) {
    if (index.has(candidate)) {
      filename = index.get(candidate);
      break;
    }
  }
  if (!filename) {
    for (const [key, value] of index.entries()) {
      if (key.startsWith(slug)) {
        filename = value;
        break;
      }
    }
  }
  if (!filename) return null;
  const raw = await fs.readFile(path.join(SONGS_DIR, filename), 'utf8');
  return raw;
}

async function groupSongsByArtist(kind = 'main') {
  const songs = await loadSongs(kind);
  const sorted = [...songs].sort(sortSongs);
  const groups = new Map();
  for (const song of sorted) {
    const artistId = song['artist-id'] || song.artist || 'unknown';
    if (!groups.has(artistId)) {
      groups.set(artistId, {
        id: artistId,
        artist: song.artist || artistId,
        img: song.img || '',
        songs: [],
      });
    }
    groups.get(artistId).songs.push(song);
  }
  return Array.from(groups.values());
}

function textToParagraphs(text) {
  if (!text) return [];
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];
  return cleaned.split(/\n{2,}/).map((block) => escapeHtml(block));
}

module.exports = {
  loadSongs,
  getSongBySlug,
  getSongText,
  groupSongsByArtist,
  textToParagraphs,
};
