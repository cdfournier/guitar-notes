fetch("https://api.musixmatch.com/ws/1.1/track.lyrics.get?apikey=fc2ff1da6a867bf43df0fad9dce2dc2a&track_id=9596502",
{
  mode: "no-cors"
})
.then(function (response) {
  return response.json();
})
.then(function (data) {
  appendData(data);
})
.catch(function (err) {
  console.log(err);
});
