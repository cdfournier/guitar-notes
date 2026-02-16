const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const MAIN_SONGS_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-data.json');
const LAB_SONGS_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-lab-data.json');
const DEFAULT_OUTPUT_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-enrichment.json');
const DEFAULT_OVERRIDES_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-enrichment-overrides.json');

function parseArgs(argv) {
  const args = {
    includeLab: false,
    output: DEFAULT_OUTPUT_PATH,
    limit: 0,
    offset: 0,
    throttleMs: Number(process.env.ENRICHMENT_THROTTLE_MS || 1100),
    timeoutMs: Number(process.env.ENRICHMENT_TIMEOUT_MS || 12000),
    refresh: false,
    overrides: DEFAULT_OVERRIDES_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--include-lab') args.includeLab = true;
    else if (value === '--output') args.output = argv[++i] || DEFAULT_OUTPUT_PATH;
    else if (value === '--limit') args.limit = Number(argv[++i]);
    else if (value === '--offset') args.offset = Number(argv[++i]);
    else if (value === '--throttle-ms') args.throttleMs = Number(argv[++i]);
    else if (value === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (value === '--refresh') args.refresh = true;
    else if (value === '--overrides') args.overrides = argv[++i] || DEFAULT_OVERRIDES_PATH;
    else if (value === '--no-overrides') args.overrides = '';
  }

  if (!Number.isFinite(args.limit) || args.limit < 0) args.limit = 0;
  if (!Number.isFinite(args.offset) || args.offset < 0) args.offset = 0;
  if (!Number.isFinite(args.throttleMs) || args.throttleMs < 0) args.throttleMs = 1100;
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) args.timeoutMs = 12000;

  return args;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getYear(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function getIsoNow() {
  return new Date().toISOString();
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function createSlugMapFromPayload(payload) {
  const map = new Map();
  if (!payload || typeof payload !== 'object') return map;

  if (payload.records && typeof payload.records === 'object') {
    for (const [slug, entry] of Object.entries(payload.records)) {
      if (slug) map.set(slug, entry);
    }
    return map;
  }

  if (Array.isArray(payload.items)) {
    for (const entry of payload.items) {
      if (entry && entry.slug) {
        map.set(entry.slug, entry);
      }
    }
  }

  return map;
}

async function readSongs(includeLab) {
  const mainRaw = await fs.readFile(MAIN_SONGS_PATH, 'utf8');
  const mainSongs = JSON.parse(mainRaw);

  let songs = mainSongs;
  if (includeLab) {
    const labRaw = await fs.readFile(LAB_SONGS_PATH, 'utf8');
    const labSongs = JSON.parse(labRaw);
    songs = songs.concat(labSongs);
  }

  const deduped = new Map();
  for (const song of songs) {
    const slug = String(song['artist-song'] || '').trim();
    if (!slug) continue;
    if (deduped.has(slug)) continue;
    deduped.set(slug, {
      slug,
      artist: String(song.artist || '').trim(),
      song: String(song.song || '').trim(),
      source: includeLab && song.category ? 'lab' : 'main',
    });
  }

  return Array.from(deduped.values());
}

async function readOverrides(overridesPath) {
  if (!overridesPath) return new Map();
  try {
    const raw = await fs.readFile(overridesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return createSlugMapFromPayload(parsed);
  } catch (err) {
    if (err && err.code === 'ENOENT') return new Map();
    throw err;
  }
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: options.headers || {},
      signal: controller.signal,
    });

    if (!response.ok) {
      const preview = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${preview.slice(0, 180)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonViaCurl(url, options) {
  const headers = [];
  for (const [key, value] of Object.entries(options.headers || {})) {
    headers.push('-H', `${key}: ${value}`);
  }

  const args = [
    '-sS',
    '--location',
    '--max-time',
    String(Math.max(1, Math.ceil(options.timeoutMs / 1000))),
    ...headers,
    url,
  ];

  const { stdout } = await execFileAsync('curl', args, {
    maxBuffer: 1024 * 1024 * 4,
  });

  return JSON.parse(stdout);
}

async function fetchMusicBrainzJson(url, args) {
  const requestOptions = {
    timeoutMs: args.timeoutMs,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'guitar-notes-enrichment/1.0 (https://github.com/chris/guitar-notes)',
    },
  };

  let data = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      data = await fetchJson(url, requestOptions);
      break;
    } catch (fetchErr) {
      try {
        data = await fetchJsonViaCurl(url, requestOptions);
        break;
      } catch (curlErr) {
        lastError = curlErr || fetchErr;
        if (attempt < 3) {
          await sleep(400 * attempt);
        }
      }
    }
  }

  if (!data) {
    throw lastError || new Error('MusicBrainz request failed');
  }

  return data;
}

function chooseBestRecording(song, recordings) {
  if (!Array.isArray(recordings) || recordings.length === 0) return null;

  const targetSong = normalize(song.song);
  const targetArtist = normalize(song.artist);

  const scored = recordings.map((recording) => {
    const title = normalize(recording.title);
    const artistName = normalize(
      ((recording['artist-credit'] || [])[0] || {}).name ||
      ((recording['artist-credit'] || [])[0] || {}).artist?.name || ''
    );

    const titleExact = title === targetSong;
    const artistExact = artistName === targetArtist;
    const score = Number(recording.score || 0);

    let rank = score;
    if (titleExact) rank += 100;
    if (artistExact) rank += 100;
    if (titleExact && artistExact) rank += 200;

    return {
      recording,
      rank,
      titleExact,
      artistExact,
      score,
    };
  });

  scored.sort((a, b) => b.rank - a.rank);
  return scored[0];
}

function toRecord(song, match) {
  if (!match || !match.recording) {
    return {
      slug: song.slug,
      artist: song.artist,
      song: song.song,
      source: song.source,
      provider: 'musicbrainz',
      updatedAt: getIsoNow(),
      matched: false,
      matchConfidence: 'none',
      musicbrainz: {
        recordingMbid: '',
        releaseMbid: '',
        score: 0,
      },
      album: '',
      year: null,
      artworkUrl: '',
    };
  }

  const recording = match.recording;
  const firstRelease = Array.isArray(recording.releases) ? recording.releases[0] : null;
  const firstDate = recording['first-release-date'] || (firstRelease && firstRelease.date) || '';

  let confidence = 'low';
  if (match.titleExact && match.artistExact) confidence = 'high';
  else if (match.titleExact || match.artistExact || match.score >= 85) confidence = 'medium';

  const releaseId = (firstRelease && firstRelease.id) || '';

  return {
    slug: song.slug,
    artist: song.artist,
    song: song.song,
    source: song.source,
    provider: 'musicbrainz',
    updatedAt: getIsoNow(),
    matched: true,
    matchConfidence: confidence,
    musicbrainz: {
      recordingMbid: recording.id || '',
      releaseMbid: releaseId,
      score: match.score,
    },
    album: (firstRelease && firstRelease.title) || '',
    year: getYear(firstDate),
    artworkUrl: releaseId ? `https://coverartarchive.org/release/${releaseId}/front-500` : '',
  };
}

async function fetchMusicBrainzRecord(song, args) {
  const query = `recording:"${song.song}" AND artist:"${song.artist}"`;
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
  const data = await fetchMusicBrainzJson(url, args);

  const recordings = Array.isArray(data.recordings) ? data.recordings : [];
  const match = chooseBestRecording(song, recordings);
  return toRecord(song, match);
}

function buildUnmatchedRecord(song, error = '') {
  const payload = {
    slug: song.slug,
    artist: song.artist,
    song: song.song,
    source: song.source,
    provider: 'musicbrainz',
    updatedAt: getIsoNow(),
    matched: false,
    matchConfidence: 'none',
    musicbrainz: {
      recordingMbid: '',
      releaseMbid: '',
      score: 0,
    },
    album: '',
    year: null,
    artworkUrl: '',
  };
  if (error) payload.error = error;
  return payload;
}

async function buildRecordFromOverride(song, override, args) {
  if (!override || typeof override !== 'object') return null;

  if (override.skip === true || override.matched === false) {
    return {
      ...buildUnmatchedRecord(song, String(override.reason || 'Skipped by override')),
      provider: 'override',
    };
  }

  const recordingMbid = String(override.recordingMbid || '').trim();
  const releaseMbid = String(override.releaseMbid || '').trim();

  if (!recordingMbid) {
    return {
      slug: song.slug,
      artist: song.artist,
      song: song.song,
      source: song.source,
      provider: 'override',
      updatedAt: getIsoNow(),
      matched: true,
      matchConfidence: String(override.matchConfidence || 'override'),
      musicbrainz: {
        recordingMbid: '',
        releaseMbid,
        score: Number(override.score || 100),
      },
      album: String(override.album || ''),
      year: toNumberOrNull(override.year),
      artworkUrl: String(override.artworkUrl || ''),
    };
  }

  const detailsUrl = `https://musicbrainz.org/ws/2/recording/${encodeURIComponent(recordingMbid)}?fmt=json&inc=artists+releases`;
  const details = await fetchMusicBrainzJson(detailsUrl, args);
  const releases = Array.isArray(details.releases) ? details.releases : [];
  const selectedRelease = releaseMbid
    ? (releases.find((release) => release && release.id === releaseMbid) || null)
    : (releases[0] || null);
  const resolvedReleaseMbid = (selectedRelease && selectedRelease.id) || releaseMbid;
  const releaseDate = (selectedRelease && selectedRelease.date) || details['first-release-date'] || '';

  return {
    slug: song.slug,
    artist: song.artist,
    song: song.song,
    source: song.source,
    provider: 'override',
    updatedAt: getIsoNow(),
    matched: true,
    matchConfidence: String(override.matchConfidence || 'override'),
    musicbrainz: {
      recordingMbid: String(details.id || recordingMbid),
      releaseMbid: resolvedReleaseMbid,
      score: Number(override.score || 100),
    },
    album: String(override.album || (selectedRelease && selectedRelease.title) || ''),
    year: toNumberOrNull(override.year) ?? getYear(releaseDate),
    artworkUrl: String(
      override.artworkUrl ||
      (resolvedReleaseMbid ? `https://coverartarchive.org/release/${resolvedReleaseMbid}/front-500` : '')
    ),
  };
}

async function readExistingOutput(outputPath) {
  try {
    const raw = await fs.readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw);
    return createSlugMapFromPayload(parsed);
  } catch (err) {
    if (err && err.code === 'ENOENT') return new Map();
    throw err;
  }
}

function buildOutput(recordsBySlug, meta) {
  const sortedSlugs = Array.from(recordsBySlug.keys()).sort();
  const records = {};
  for (const slug of sortedSlugs) {
    records[slug] = recordsBySlug.get(slug);
  }

  return {
    generatedAt: getIsoNow(),
    provider: 'musicbrainz',
    includeLab: meta.includeLab,
    totalSongs: meta.totalSongs,
    matchedSongs: meta.matchedSongs,
    unmatchedSongs: meta.unmatchedSongs,
    records,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const songs = await readSongs(args.includeLab);
  const existing = await readExistingOutput(args.output);
  const overrides = await readOverrides(args.overrides);

  const selected = songs.slice(args.offset, args.limit > 0 ? args.offset + args.limit : undefined);
  const recordsBySlug = new Map();

  let fetchedCount = 0;
  let overrideCount = 0;
  for (let i = 0; i < selected.length; i += 1) {
    const song = selected[i];
    const cached = existing.get(song.slug);
    const override = overrides.get(song.slug);

    if (override) {
      const record = await buildRecordFromOverride(song, override, args);
      if (record) {
        recordsBySlug.set(song.slug, record);
        overrideCount += 1;
        continue;
      }
    }

    if (!args.refresh && cached && cached.matched && cached.musicbrainz && cached.musicbrainz.recordingMbid) {
      recordsBySlug.set(song.slug, {
        ...cached,
        slug: song.slug,
        artist: song.artist,
        song: song.song,
        source: song.source,
      });
      continue;
    }

    process.stdout.write(`[${i + 1}/${selected.length}] ${song.artist} - ${song.song}\n`);

    try {
      const record = await fetchMusicBrainzRecord(song, args);
      recordsBySlug.set(song.slug, record);
      fetchedCount += 1;
    } catch (err) {
      recordsBySlug.set(song.slug, buildUnmatchedRecord(song, String(err && err.message ? err.message : err)));
      fetchedCount += 1;
    }

    if (args.throttleMs > 0 && i < selected.length - 1) {
      await sleep(args.throttleMs);
    }
  }

  // Keep entries outside current selection so incremental runs do not discard previously fetched records.
  for (const [slug, entry] of existing.entries()) {
    if (!recordsBySlug.has(slug)) {
      recordsBySlug.set(slug, entry);
    }
  }

  const allSlugs = new Set(songs.map((song) => song.slug));
  for (const slug of Array.from(recordsBySlug.keys())) {
    if (!allSlugs.has(slug)) {
      recordsBySlug.delete(slug);
    }
  }

  const allRecords = Array.from(recordsBySlug.values());
  const matchedSongs = allRecords.filter((entry) => entry && entry.matched).length;
  const totalSongs = songs.length;
  const unmatchedSongs = Math.max(totalSongs - matchedSongs, 0);

  const payload = buildOutput(recordsBySlug, {
    includeLab: args.includeLab,
    totalSongs,
    matchedSongs,
    unmatchedSongs,
  });

  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  process.stdout.write(`\nWrote ${args.output}\n`);
  process.stdout.write(`Fetched this run: ${fetchedCount}\n`);
  process.stdout.write(`Overrides applied: ${overrideCount}\n`);
  process.stdout.write(`Coverage: ${matchedSongs}/${totalSongs} matched\n`);
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
