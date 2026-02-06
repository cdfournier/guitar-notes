var express = require('express');
var createError = require('http-errors');
var router = express.Router();

var {
  getSongBySlug,
  getSongText,
  groupSongsByArtist,
  textToParagraphs,
} = require('./songs-data');

var { getSetlistsIndex, getSetlistByKey } = require('./setlists-data');

router.get('/', async function (req, res, next) {
  try {
    const groups = await groupSongsByArtist('main');
    res.render('songs-index', { title: 'Guitar Notes', groups });
  } catch (err) {
    next(err);
  }
});

router.get('/songs', async function (req, res, next) {
  try {
    const groups = await groupSongsByArtist('main');
    res.render('songs-index', { title: 'Guitar Notes', groups });
  } catch (err) {
    next(err);
  }
});

router.get('/songs/list', async function (req, res, next) {
  try {
    const groups = await groupSongsByArtist('main');
    res.render('songs-list', { title: 'Guitar Notes list', groups });
  } catch (err) {
    next(err);
  }
});

router.get('/lab', async function (req, res, next) {
  try {
    const groups = await groupSongsByArtist('lab');
    res.render('lab-grid', { title: 'Guitar Notes Lab', groups });
  } catch (err) {
    next(err);
  }
});

router.get('/lab/list', async function (req, res, next) {
  try {
    const groups = await groupSongsByArtist('lab');
    res.render('lab-list', { title: 'Guitar Notes Lab list', groups });
  } catch (err) {
    next(err);
  }
});


router.get('/setlists', async function (req, res, next) {
  try {
    const years = await getSetlistsIndex();
    res.render('setlists-index', { title: 'Guitar Notes Setlists', years });
  } catch (err) {
    next(err);
  }
});

router.get('/setlists/:ym/:ymd', async function (req, res, next) {
  try {
    const ymd = req.params.ymd;
    const setlist = await getSetlistByKey(ymd);
    if (!setlist) return next(createError(404));
    res.render('setlist', {
      title: `${setlist.date} | Guitar Notes`,
      date: setlist.date,
      sets: setlist.sets,
      hasAcoustic: setlist.hasAcoustic,
      noteDetails: setlist.noteDetails,
      prev: setlist.prev,
      next: setlist.next,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/songs/:slug', async function (req, res, next) {
  try {
    const slug = req.params.slug;
    const kind = req.query.lab === '1' ? 'lab' : 'main';
    const song = await getSongBySlug(slug, kind);
    if (!song) return next(createError(404));

    const text = await getSongText(slug);
    const paragraphs = textToParagraphs(text || '');
    const isLab = kind === 'lab';
    res.render('song', {
      title: `${song.song} | Guitar Notes`,
      song,
      paragraphs,
      isLab,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
