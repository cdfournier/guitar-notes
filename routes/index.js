var express = require('express');
var createError = require('http-errors');
var router = express.Router();

var {
  getSongBySlug,
  getSongText,
  groupSongsByArtist,
  textToParagraphs,
} = require('./songs-data');

router.get('/', async function (req, res, next) {
  try {
    const groups = await groupSongsByArtist();
    res.render('songs-index', { title: 'Guitar Notes', groups });
  } catch (err) {
    next(err);
  }
});

router.get('/songs', async function (req, res, next) {
  try {
    const groups = await groupSongsByArtist();
    res.render('songs-index', { title: 'Guitar Notes', groups });
  } catch (err) {
    next(err);
  }
});

router.get('/songs/:slug', async function (req, res, next) {
  try {
    const slug = req.params.slug;
    const song = await getSongBySlug(slug);
    if (!song) {
      return next(createError(404));
    }
    const text = await getSongText(slug);
    const paragraphs = textToParagraphs(text || '');
    res.render('song', {
      title: `${song.song} | Guitar Notes`,
      song,
      paragraphs,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
