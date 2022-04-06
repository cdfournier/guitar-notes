async function populate() {

  const requestURL = 'https://api.musixmatch.com/ws/1.1/track.lyrics.get?apikey=fc2ff1da6a867bf43df0fad9dce2dc2a&track_id=9596502';
  const request = new Request(requestURL);

  const response = await fetch(request);
  const lyrics = await response.json();

  populateLyrics(lyrics);

}

function populateLyrics(obj) {
  const lyricsRaw = document.createElement('div');
  lyricsRaw.textContent = `${obj['lyrics_body']}`;
  lyrics.appendChild(lyricsRaw);
}
