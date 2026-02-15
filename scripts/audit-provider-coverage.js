const fs = require('fs/promises');
const path = require('path');

const MAIN_SONGS_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-data.json');
const LAB_SONGS_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-lab-data.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'reports', 'provider-audit');

function parseArgs(argv) {
  const args = {
    limit: 50,
    offset: 0,
    includeLab: false,
    output: null,
    markdown: null,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    appleToken: process.env.APPLE_MUSIC_TOKEN || '',
    appleStorefront: process.env.APPLE_MUSIC_STOREFRONT || 'us',
    throttleMs: Number(process.env.AUDIT_THROTTLE_MS || 1100),
    timeoutMs: Number(process.env.AUDIT_TIMEOUT_MS || 10000),
    musicbrainzArtworkCheck: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--limit') args.limit = Number(argv[++i]);
    else if (value === '--offset') args.offset = Number(argv[++i]);
    else if (value === '--include-lab') args.includeLab = true;
    else if (value === '--output') args.output = argv[++i];
    else if (value === '--markdown') args.markdown = argv[++i];
    else if (value === '--spotify-client-id') args.spotifyClientId = argv[++i] || '';
    else if (value === '--spotify-client-secret') args.spotifyClientSecret = argv[++i] || '';
    else if (value === '--apple-token') args.appleToken = argv[++i] || '';
    else if (value === '--apple-storefront') args.appleStorefront = (argv[++i] || 'us').toLowerCase();
    else if (value === '--throttle-ms') args.throttleMs = Number(argv[++i]);
    else if (value === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (value === '--musicbrainz-artwork-check') args.musicbrainzArtworkCheck = true;
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = 50;
  if (!Number.isFinite(args.offset) || args.offset < 0) args.offset = 0;
  if (!Number.isFinite(args.throttleMs) || args.throttleMs < 0) args.throttleMs = 350;
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) args.timeoutMs = 10000;

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isLikelyExactMatch(song, recording) {
  const songTitle = normalize(song.song);
  const songArtist = normalize(song.artist);
  const recordingTitle = normalize(recording.title);
  const recordingArtist = normalize(
    ((recording['artist-credit'] || [])[0] || {}).name ||
    ((recording['artist-credit'] || [])[0] || {}).artist?.name || ''
  );
  return songTitle === recordingTitle && songArtist === recordingArtist;
}

function getDateStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}`;
}

async function readSongs(includeLab) {
  const rawMain = await fs.readFile(MAIN_SONGS_PATH, 'utf8');
  const mainSongs = JSON.parse(rawMain);
  let allSongs = mainSongs;

  if (includeLab) {
    const rawLab = await fs.readFile(LAB_SONGS_PATH, 'utf8');
    const labSongs = JSON.parse(rawLab);
    allSongs = mainSongs.concat(labSongs);
  }

  const unique = new Map();
  for (const song of allSongs) {
    const key = `${normalize(song.artist)}|${normalize(song.song)}`;
    if (!unique.has(key)) {
      unique.set(key, {
        artist: String(song.artist || '').trim(),
        song: String(song.song || '').trim(),
        slug: song['artist-song'] || '',
        source: includeLab && song.category ? 'lab' : 'main',
      });
    }
  }

  return Array.from(unique.values());
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
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHead(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: options.headers || {},
      redirect: 'follow',
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

function createMusicBrainzProvider(args) {
  const queryCache = new Map();
  const artworkCache = new Map();

  return {
    key: 'musicbrainz',
    enabled: true,
    note: args.musicbrainzArtworkCheck
      ? 'Artwork check uses Cover Art Archive HEAD request for top release.'
      : 'Artwork check disabled. Artwork marked when release metadata exists.',
    async audit(song) {
      const query = `recording:"${song.song}" AND artist:"${song.artist}"`;
      if (queryCache.has(query)) return queryCache.get(query);

      const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
      const data = await fetchJson(url, {
        timeoutMs: args.timeoutMs,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'guitar-notes-provider-audit/1.0 (https://github.com/chris/guitar-notes)',
        },
      });

      const recordings = Array.isArray(data.recordings) ? data.recordings : [];
      const best = recordings[0] || null;
      let artwork = false;
      const firstReleaseId = best && Array.isArray(best.releases) && best.releases[0] ? best.releases[0].id : '';

      if (firstReleaseId) {
        if (args.musicbrainzArtworkCheck) {
          if (artworkCache.has(firstReleaseId)) {
            artwork = artworkCache.get(firstReleaseId);
          } else {
            const hasArt = await fetchHead(`https://coverartarchive.org/release/${firstReleaseId}/front-250`, {
              timeoutMs: args.timeoutMs,
              headers: {
                'User-Agent': 'guitar-notes-provider-audit/1.0 (https://github.com/chris/guitar-notes)',
              },
            }).catch(() => false);
            artworkCache.set(firstReleaseId, hasArt);
            artwork = hasArt;
          }
        } else {
          artwork = true;
        }
      }

      const result = {
        songInfo: Boolean(best),
        artistInfo: Boolean(best && Array.isArray(best['artist-credit']) && best['artist-credit'].length),
        albumInfo: Boolean(best && Array.isArray(best.releases) && best.releases.length),
        yearInfo: Boolean(best && (best['first-release-date'] || (best.releases && best.releases[0] && best.releases[0].date))),
        artwork,
        listenLink: false,
        confidence: best ? (isLikelyExactMatch(song, best) ? 'high' : 'medium') : 'none',
        ids: {
          recordingMbid: best ? best.id : '',
          releaseMbid: firstReleaseId || '',
        },
      };

      queryCache.set(query, result);
      return result;
    },
  };
}

async function getSpotifyToken(args) {
  if (!args.spotifyClientId || !args.spotifyClientSecret) return '';

  const basic = Buffer.from(`${args.spotifyClientId}:${args.spotifyClientSecret}`).toString('base64');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal,
    });
    if (!response.ok) return '';
    const data = await response.json();
    return data.access_token || '';
  } finally {
    clearTimeout(timeout);
  }
}

function createSpotifyProvider(token) {
  const queryCache = new Map();

  return {
    key: 'spotify',
    enabled: Boolean(token),
    note: token ? 'Enabled via client credentials.' : 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to enable.',
    async audit(song, args) {
      if (!token) {
        return {
          songInfo: false,
          artistInfo: false,
          albumInfo: false,
          yearInfo: false,
          artwork: false,
          listenLink: false,
          confidence: 'none',
          ids: {},
        };
      }

      const query = `track:${song.song} artist:${song.artist}`;
      if (queryCache.has(query)) return queryCache.get(query);

      const url = `https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, {
        timeoutMs: args.timeoutMs,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const item = data && data.tracks && Array.isArray(data.tracks.items) ? data.tracks.items[0] : null;
      const result = {
        songInfo: Boolean(item),
        artistInfo: Boolean(item && Array.isArray(item.artists) && item.artists.length),
        albumInfo: Boolean(item && item.album),
        yearInfo: Boolean(item && item.album && item.album.release_date),
        artwork: Boolean(item && item.album && Array.isArray(item.album.images) && item.album.images.length),
        listenLink: Boolean(item && item.external_urls && item.external_urls.spotify),
        confidence: item ? 'high' : 'none',
        ids: {
          trackId: item ? item.id : '',
          artistId: item && item.artists && item.artists[0] ? item.artists[0].id : '',
          albumId: item && item.album ? item.album.id : '',
        },
      };

      queryCache.set(query, result);
      return result;
    },
  };
}

function createAppleProvider(args) {
  const queryCache = new Map();
  const token = args.appleToken;

  return {
    key: 'appleMusic',
    enabled: Boolean(token),
    note: token ? `Enabled for storefront ${args.appleStorefront}.` : 'Set APPLE_MUSIC_TOKEN to enable.',
    async audit(song) {
      if (!token) {
        return {
          songInfo: false,
          artistInfo: false,
          albumInfo: false,
          yearInfo: false,
          artwork: false,
          listenLink: false,
          confidence: 'none',
          ids: {},
        };
      }

      const term = `${song.artist} ${song.song}`;
      const cacheKey = `${args.appleStorefront}|${term}`;
      if (queryCache.has(cacheKey)) return queryCache.get(cacheKey);

      const url = `https://api.music.apple.com/v1/catalog/${args.appleStorefront}/search?types=songs&limit=1&term=${encodeURIComponent(term)}`;
      const data = await fetchJson(url, {
        timeoutMs: args.timeoutMs,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      const item = data && data.results && data.results.songs && Array.isArray(data.results.songs.data)
        ? data.results.songs.data[0]
        : null;
      const attrs = item && item.attributes ? item.attributes : null;
      const result = {
        songInfo: Boolean(item),
        artistInfo: Boolean(attrs && attrs.artistName),
        albumInfo: Boolean(attrs && attrs.albumName),
        yearInfo: Boolean(attrs && attrs.releaseDate),
        artwork: Boolean(attrs && attrs.artwork && attrs.artwork.url),
        listenLink: Boolean(attrs && attrs.url),
        confidence: item ? 'high' : 'none',
        ids: {
          songId: item ? item.id : '',
        },
      };

      queryCache.set(cacheKey, result);
      return result;
    },
  };
}

function emptyProviderStats() {
  return {
    attempted: 0,
    errors: 0,
    matchedAny: 0,
    fieldCoverage: {
      songInfo: 0,
      artistInfo: 0,
      albumInfo: 0,
      yearInfo: 0,
      artwork: 0,
      listenLink: 0,
    },
    confidence: {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    },
  };
}

function pct(value, total) {
  if (!total) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Provider Coverage Audit');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Songs audited: ${report.sample.size} of ${report.sample.totalUnique}`);
  lines.push(`- Offset: ${report.sample.offset}`);
  lines.push(`- Include lab: ${report.sample.includeLab}`);
  lines.push('');
  lines.push('## Provider Summary');
  lines.push('');
  lines.push('| Provider | Enabled | Matched Any | Song | Artist | Album | Year | Artwork | Listen | Errors |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');

  for (const [providerKey, provider] of Object.entries(report.providers)) {
    const stats = provider.stats;
    const total = stats.attempted || 1;
    lines.push(`| ${providerKey} | ${provider.enabled ? 'yes' : 'no'} | ${pct(stats.matchedAny, total)} | ${pct(stats.fieldCoverage.songInfo, total)} | ${pct(stats.fieldCoverage.artistInfo, total)} | ${pct(stats.fieldCoverage.albumInfo, total)} | ${pct(stats.fieldCoverage.yearInfo, total)} | ${pct(stats.fieldCoverage.artwork, total)} | ${pct(stats.fieldCoverage.listenLink, total)} | ${stats.errors} |`);
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  for (const [providerKey, provider] of Object.entries(report.providers)) {
    lines.push(`- ${providerKey}: ${provider.note}`);
  }

  lines.push('');
  lines.push('## Unmatched Samples (first 20)');
  lines.push('');
  for (const [providerKey, provider] of Object.entries(report.providers)) {
    lines.push(`### ${providerKey}`);
    if (!provider.enabled) {
      lines.push('- Provider disabled');
      lines.push('');
      continue;
    }
    const unmatched = provider.unmatched.slice(0, 20);
    if (!unmatched.length) {
      lines.push('- None');
      lines.push('');
      continue;
    }
    for (const row of unmatched) {
      lines.push(`- ${row.artist} - ${row.song}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allSongs = await readSongs(args.includeLab);
  const sliced = allSongs.slice(args.offset, args.offset + args.limit);

  if (!sliced.length) {
    throw new Error('No songs selected. Adjust --offset/--limit.');
  }

  const spotifyToken = await getSpotifyToken(args);
  const providers = [
    createMusicBrainzProvider(args),
    createSpotifyProvider(spotifyToken),
    createAppleProvider(args),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    sample: {
      totalUnique: allSongs.length,
      size: sliced.length,
      offset: args.offset,
      includeLab: args.includeLab,
      limit: args.limit,
    },
    providers: {},
  };

  for (const provider of providers) {
    report.providers[provider.key] = {
      enabled: provider.enabled,
      note: provider.note,
      stats: emptyProviderStats(),
      unmatched: [],
      errors: [],
    };
  }

  for (let i = 0; i < sliced.length; i += 1) {
    const song = sliced[i];

    for (const provider of providers) {
      const bucket = report.providers[provider.key];
      bucket.stats.attempted += 1;
      if (!provider.enabled) {
        bucket.stats.confidence.none += 1;
        continue;
      }

      try {
        const result = await provider.audit(song, args);
        const fields = ['songInfo', 'artistInfo', 'albumInfo', 'yearInfo', 'artwork', 'listenLink'];
        let any = false;
        for (const field of fields) {
          if (result[field]) {
            bucket.stats.fieldCoverage[field] += 1;
            any = true;
          }
        }

        if (any) bucket.stats.matchedAny += 1;
        else bucket.unmatched.push({ artist: song.artist, song: song.song, slug: song.slug });

        const confidence = result.confidence || 'none';
        if (!bucket.stats.confidence[confidence]) bucket.stats.confidence[confidence] = 0;
        bucket.stats.confidence[confidence] += 1;
      } catch (err) {
        bucket.stats.errors += 1;
        bucket.errors.push({
          artist: song.artist,
          song: song.song,
          message: err && err.message ? err.message : String(err),
        });
      }

      if (provider.enabled && args.throttleMs > 0) {
        await sleep(args.throttleMs);
      }
    }

    if ((i + 1) % 10 === 0 || i === sliced.length - 1) {
      process.stdout.write(`Audited ${i + 1}/${sliced.length}\n`);
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = getDateStamp();
  const jsonPath = args.output
    ? path.resolve(args.output)
    : path.join(OUTPUT_DIR, `provider-audit-${stamp}.json`);
  const mdPath = args.markdown
    ? path.resolve(args.markdown)
    : path.join(OUTPUT_DIR, `provider-audit-${stamp}.md`);

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(mdPath, buildMarkdown(report));

  process.stdout.write(`JSON report: ${jsonPath}\n`);
  process.stdout.write(`Markdown report: ${mdPath}\n`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
