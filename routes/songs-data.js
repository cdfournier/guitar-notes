const fs = require('fs/promises');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-data.json');
const SONGS_DIR = path.join(__dirname, '..', 'public', 'assets', 'songs');

let cachedSongs = null;
let fileIndex = null;

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

async function loadSongs() {
  if (cachedSongs) return cachedSongs;
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  cachedSongs = data.map((song) => ({
    ...song,
    tagsArray: normalizeTags(song.tags),
  }));
  return cachedSongs;
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

async function getSongBySlug(slug) {
  const songs = await loadSongs();
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

async function groupSongsByArtist() {
  const songs = await loadSongs();
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
