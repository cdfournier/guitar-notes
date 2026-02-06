const fs = require('fs/promises');
const path = require('path');

const SETLISTS_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-setlists.json');
const SONGS_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'guitar-notes-data.json');

const SET_ORDER = ['0', '1', '2', '3', 'e'];
const SET_LABELS = {
  '0': 'Soundcheck',
  '1': 'Set One',
  '2': 'Set Two',
  '3': 'Set Three',
  'e': 'Encore',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

let cache = null;

function decodeHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateString(value) {
  const match = String(value).match(/^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const monthName = match[1];
  const monthIndex = MONTHS.indexOf(monthName);
  if (monthIndex === -1) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const ym = `${year}${pad2(monthIndex + 1)}`;
  const ymd = `${ym}${pad2(day)}`;
  return {
    year,
    month: monthIndex + 1,
    day,
    ym,
    ymd,
    monthName,
    date: new Date(year, monthIndex, day),
  };
}

function slugify(value, dropLeadingThe = false) {
  let text = decodeHtml(value).toLowerCase().trim();
  if (dropLeadingThe && text.startsWith('the ')) {
    text = text.slice(4);
  }
  text = text.replace(/&/g, 'and');
  text = text.replace(/[‘’']/g, '');
  text = text.replace(/[^a-z0-9]+/g, '-');
  text = text.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return text;
}

async function buildCache() {
  if (cache) return cache;
  const rawSetlists = await fs.readFile(SETLISTS_PATH, 'utf8');
  const setlistData = JSON.parse(rawSetlists.replace(/\r/g, ''));

  const rawSongs = await fs.readFile(SONGS_PATH, 'utf8');
  const songData = JSON.parse(rawSongs);

  const songSlugMap = new Map();
  const songSlugSet = new Set();
  for (const song of songData) {
    const artist = decodeHtml(song.artist || '').trim().toLowerCase();
    const title = decodeHtml(song.song || '').trim().toLowerCase();
    const slug = song['artist-song'];
    if (artist && title && slug) {
      songSlugMap.set(`${artist}|${title}`, slug);
      songSlugSet.add(slug);
    }
  }

  const setlistsByDate = new Map();
  for (const row of setlistData) {
    const dateInfo = parseDateString(row.date);
    if (!dateInfo) continue;
    const normalized = {
      ...row,
      dateInfo,
      dateKey: dateInfo.ymd,
      artist: decodeHtml(row.artist || '').trim(),
      song: decodeHtml(row.song || '').trim(),
      details: decodeHtml(row.details || '').trim(),
    };
    if (!setlistsByDate.has(row.date)) {
      setlistsByDate.set(row.date, []);
    }
    setlistsByDate.get(row.date).push(normalized);
  }

  const dates = Array.from(setlistsByDate.keys()).sort((a, b) => {
    const aInfo = parseDateString(a);
    const bInfo = parseDateString(b);
    return aInfo.date - bInfo.date;
  });

  const setlists = new Map();

  for (const date of dates) {
    const rows = setlistsByDate.get(date) || [];
    const rowsSorted = rows.slice().sort((a, b) => {
      const aIndex = SET_ORDER.indexOf(a.set);
      const bIndex = SET_ORDER.indexOf(b.set);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return (a.order || 0) - (b.order || 0);
    });

    const grouped = new Map();
    for (const row of rowsSorted) {
      if (!grouped.has(row.set)) {
        grouped.set(row.set, []);
      }
      grouped.get(row.set).push(row);
    }

    const sets = [];
    let hasAcoustic = false;
    let noteDetails = null;

    for (const row of rows) {
      if (row.acoustic === 'yes' && row.note !== 'yes') {
        hasAcoustic = true;
      }
      if (!noteDetails && row.note === 'yes') {
        noteDetails = row.details || 'Unfinished';
      }
    }

    for (const setKey of SET_ORDER) {
      if (!grouped.has(setKey)) continue;
      const items = [];
      const list = grouped.get(setKey).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const row of list) {
        const artistKey = row.artist.toLowerCase();
        const songKey = row.song.toLowerCase();
        let slug = songSlugMap.get(`${artistKey}|${songKey}`);
        if (!slug && row.artist && row.song) {
          const candidate = `${slugify(row.artist, true)}-${slugify(row.song)}`;
          if (songSlugSet.has(candidate)) {
            slug = candidate;
          }
        }

        let suffix = '';
        if (row.note === 'yes') {
          suffix += '**';
        } else if (row.acoustic === 'yes') {
          suffix += '*';
        }
        if (row.segue === 'yes') {
          suffix += '&nbsp;&gt;';
        }

        items.push({
          song: row.song,
          artist: row.artist,
          slug,
          suffix,
        });
      }

      sets.push({
        key: setKey,
        label: SET_LABELS[setKey] || 'Set',
        items,
      });
    }

    const dateInfo = rows[0]?.dateInfo || parseDateString(date);

    setlists.set(dateInfo.ymd, {
      date,
      dateInfo,
      sets,
      hasAcoustic,
      noteDetails,
    });
  }

  cache = {
    dates,
    setlists,
  };
  return cache;
}

async function getSetlistsIndex() {
  const { dates } = await buildCache();
  const byYearMonth = new Map();

  for (const date of dates) {
    const info = parseDateString(date);
    if (!info) continue;
    if (!byYearMonth.has(info.year)) {
      byYearMonth.set(info.year, new Map());
    }
    const monthMap = byYearMonth.get(info.year);
    if (!monthMap.has(info.monthName)) {
      monthMap.set(info.monthName, []);
    }
    monthMap.get(info.monthName).push({
      date,
      ym: info.ym,
      ymd: info.ymd,
    });
  }

  const years = Array.from(byYearMonth.keys()).sort((a, b) => b - a);
  const result = [];

  for (const year of years) {
    const monthMap = byYearMonth.get(year);
    const months = Array.from(monthMap.keys()).sort((a, b) => MONTHS.indexOf(b) - MONTHS.indexOf(a));
    const monthEntries = [];
    for (const month of months) {
      const dates = monthMap.get(month).slice().sort((a, b) => (a.ymd < b.ymd ? 1 : -1));
      monthEntries.push({
        name: month,
        dates,
      });
    }
    result.push({
      year,
      months: monthEntries,
    });
  }

  return result;
}

async function getSetlistByKey(ymd) {
  const { dates, setlists } = await buildCache();
  if (!setlists.has(ymd)) return null;
  const index = dates.findIndex((date) => parseDateString(date)?.ymd === ymd);
  const prevDate = index > 0 ? dates[index - 1] : null;
  const nextDate = index >= 0 && index < dates.length - 1 ? dates[index + 1] : null;

  const current = setlists.get(ymd);
  const prevInfo = prevDate ? parseDateString(prevDate) : null;
  const nextInfo = nextDate ? parseDateString(nextDate) : null;

  return {
    ...current,
    prev: prevInfo ? { date: prevDate, ym: prevInfo.ym, ymd: prevInfo.ymd } : null,
    next: nextInfo ? { date: nextDate, ym: nextInfo.ym, ymd: nextInfo.ymd } : null,
  };
}

module.exports = {
  getSetlistsIndex,
  getSetlistByKey,
};
