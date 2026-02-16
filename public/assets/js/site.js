// COLOR MODE CONTROLS
window.addEventListener('DOMContentLoaded', function (theme) {
  if (localStorage.getItem('theme') === 'true') {
    $('html').toggleClass('dark');
    $('input#switch-theme').prop('checked', true);
  }
  else {
    localStorage.setItem('theme', false);
  }
});
$('input#switch-theme').click(function () {
  $('html').toggleClass('dark');
  if (localStorage.getItem('theme') === 'true') {
    $('input#switch-theme').prop('checked', false);
    localStorage.setItem('theme', false);
  }
  else {
    $('input#switch-theme').prop('checked', true);
    localStorage.setItem('theme', true);
  }
});

// WELCOME LOGO
window.addEventListener('DOMContentLoaded', function (visited) {
  if (localStorage.getItem('visited') === 'true') {
    $('.welcome').toggleClass('dismissed');
  }
  else {
    localStorage.setItem('visited', true);
  }
});
$('button.dismiss-welcome').click(function () {
  $('.welcome').addClass('dismissed');
});

// ALERTS
window.addEventListener('DOMContentLoaded', function (alerts) {
  $('.alert').addClass('show');
  setTimeout(function () {
    $('.alert').removeClass('show')
  }, 10000);
});
$('.alert .message button.close').click(function () {
  $('.alert').removeClass('show');
});
$('.info button').click(function () {
  $('.alert').addClass('show');
  setTimeout(function () {
    $('.alert').removeClass('show')
  }, 10000);
});

// SETLIST BUILDER + TRACKER
(function setlistFeatures() {
  var SETLIST_KEY = 'setlistDraft';
  var TRACKER_ACTIVE_KEY = 'setlistTrackerActive';
  var TRACKER_STARTED_AT_KEY = 'setlistTrackerStartedAt';
  var TRACKER_SONGS_KEY = 'setlistTrackerSongs';
  var toastTimer = null;

  function hideToast() {
    var toast = document.querySelector('[data-setlist-toast]');
    if (!toast) return;
    toast.classList.remove('is-visible');
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function showToast(message) {
    var toast = document.querySelector('[data-setlist-toast]');
    var toastMessage = document.querySelector('[data-setlist-toast-message]');
    if (!toast || !toastMessage || !message) return;

    hideToast();
    toastMessage.textContent = message;
    toast.classList.add('is-visible');

    toastTimer = setTimeout(function () {
      hideToast();
    }, 2400);
  }

  function readList(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function readSetlist() {
    return readList(SETLIST_KEY);
  }

  function readTrackerSongs() {
    return readList(TRACKER_SONGS_KEY);
  }

  function isTrackerActive() {
    return localStorage.getItem(TRACKER_ACTIVE_KEY) === 'true';
  }

  function writeSetlist(entries) {
    localStorage.setItem(SETLIST_KEY, JSON.stringify(entries));
    dispatchSetlistUpdated(entries);
  }

  function writeTrackerSongs(entries) {
    localStorage.setItem(TRACKER_SONGS_KEY, JSON.stringify(entries));
    dispatchTrackerUpdated(entries, isTrackerActive());
  }

  function setTrackerActive(active) {
    localStorage.setItem(TRACKER_ACTIVE_KEY, active ? 'true' : 'false');
    if (active && !localStorage.getItem(TRACKER_STARTED_AT_KEY)) {
      localStorage.setItem(TRACKER_STARTED_AT_KEY, new Date().toISOString());
    }
    dispatchTrackerUpdated(readTrackerSongs(), active);
  }

  function clearTracker() {
    localStorage.removeItem(TRACKER_SONGS_KEY);
    localStorage.removeItem(TRACKER_STARTED_AT_KEY);
    dispatchTrackerUpdated([], isTrackerActive());
  }

  function dispatchSetlistUpdated(entries) {
    document.dispatchEvent(new CustomEvent('setlist:updated', {
      detail: { count: entries.length }
    }));
  }

  function dispatchTrackerUpdated(entries, active) {
    document.dispatchEvent(new CustomEvent('setlist:tracker-updated', {
      detail: {
        count: entries.length,
        active: !!active
      }
    }));
  }

  function addSong(entry) {
    var entries = readSetlist();
    entries.push({
      slug: entry.slug || '',
      title: entry.title || '',
      artist: entry.artist || '',
      href: entry.href || '',
      addedAt: Date.now()
    });
    writeSetlist(entries);
  }

  function removeSong(index) {
    var entries = readSetlist();
    if (index < 0 || index >= entries.length) return;
    entries.splice(index, 1);
    writeSetlist(entries);
  }

  function clearSetlist() {
    writeSetlist([]);
  }

  function toggleSetlistButtons(count) {
    var toggles = document.querySelectorAll('[data-setlist-show-toggle]');
    toggles.forEach(function (toggle) {
      var visible = count > 0;
      toggle.classList.toggle('is-visible', visible);
      toggle.classList.toggle('is-hidden', !visible);
      toggle.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (toggle.tagName === 'A') {
        toggle.tabIndex = visible ? 0 : -1;
      }
    });
  }

  function updateSetlistCount(count) {
    var counters = document.querySelectorAll('[data-setlist-count]');
    counters.forEach(function (counter) {
      counter.textContent = String(count);
    });
  }

  function updateTrackerCount(count) {
    var counters = document.querySelectorAll('[data-setlist-tracker-count]');
    counters.forEach(function (counter) {
      counter.textContent = String(count);
    });
  }

  function toggleTrackerButtons(active) {
    var toggles = document.querySelectorAll('[data-setlist-tracker-toggle]');
    toggles.forEach(function (toggle) {
      toggle.classList.toggle('is-active', active);
      toggle.setAttribute('aria-pressed', active ? 'true' : 'false');
      toggle.setAttribute('aria-label', active ? 'Stop show tracker' : 'Start show tracker');
    });
  }

  function renderSetlistPage(entries) {
    var list = document.querySelector('[data-setlist-list]');
    var empty = document.querySelector('[data-setlist-empty]');
    if (!list) return;

    list.innerHTML = '';

    entries.forEach(function (entry, index) {
      var li = document.createElement('li');
      li.className = 'setlist-builder-item';

      var row = document.createElement('span');
      row.className = 'setlist-entry-row';

      var removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'setlist-remove-button';
      removeButton.setAttribute('data-setlist-remove', '');
      removeButton.setAttribute('data-setlist-index', String(index));
      removeButton.setAttribute('aria-label', 'Remove song from setlist');
      removeButton.innerHTML = '<span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-music-minus"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M9 17v-13h10v11" /><path d="M9 8h10" /><path d="M16 19h6" /></svg></span>';

      var link = document.createElement('a');
      link.href = entry.href || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = entry.title || entry.slug || 'Untitled song';

      row.appendChild(removeButton);
      row.appendChild(link);
      li.appendChild(row);
      list.appendChild(li);
    });

    if (empty) {
      empty.style.display = entries.length > 0 ? 'none' : '';
    }
  }

  function renderTrackerPage(entries) {
    var list = document.querySelector('[data-setlist-tracker-list]');
    var empty = document.querySelector('[data-setlist-tracker-empty]');
    if (!list) return;

    list.innerHTML = '';

    entries.forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'setlist-builder-item';
      li.textContent = entry.title || entry.slug || 'Untitled song';
      list.appendChild(li);
    });

    if (empty) {
      empty.style.display = entries.length > 0 ? 'none' : '';
    }
  }

  function exportTrackerList(entries) {
    if (!entries.length) return;
    var lines = entries.map(function (entry) {
      return entry.title || entry.slug || 'Untitled song';
    });
    var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'setlist.txt';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function autologSongPageVisitIfTracking() {
    if (!isTrackerActive()) return;
    var songNode = document.querySelector('[data-song-page]');
    if (!songNode) return;

    var entries = readTrackerSongs();
    entries.push({
      slug: songNode.getAttribute('data-song-slug') || '',
      title: songNode.getAttribute('data-song-title') || '',
      artist: songNode.getAttribute('data-song-artist') || '',
      href: window.location.pathname + window.location.search,
      loggedAt: Date.now()
    });
    writeTrackerSongs(entries);
  }

  function refreshSetlistUi() {
    var entries = readSetlist();
    var count = entries.length;
    updateSetlistCount(count);
    toggleSetlistButtons(count);
    renderSetlistPage(entries);
  }

  function refreshTrackerUi() {
    var active = isTrackerActive();
    var entries = readTrackerSongs();
    updateTrackerCount(entries.length);
    toggleTrackerButtons(active);
    renderTrackerPage(entries);
  }

  document.addEventListener('click', function (event) {
    var addButton = event.target.closest('[data-setlist-add]');
    if (addButton) {
      event.preventDefault();
      addSong({
        slug: addButton.getAttribute('data-setlist-slug') || '',
        title: addButton.getAttribute('data-setlist-title') || '',
        artist: addButton.getAttribute('data-setlist-artist') || '',
        href: addButton.getAttribute('data-setlist-href') || ''
      });
      addButton.classList.add('is-added');
      setTimeout(function () {
        addButton.classList.remove('is-added');
      }, 300);
      showToast('Song added to setlist.');
      return;
    }

    var removeButton = event.target.closest('[data-setlist-remove]');
    if (removeButton) {
      event.preventDefault();
      var index = Number(removeButton.getAttribute('data-setlist-index'));
      removeSong(index);
      return;
    }

    var clearButton = event.target.closest('[data-setlist-clear]');
    if (clearButton) {
      event.preventDefault();
      if (readSetlist().length === 0) return;
      if (window.confirm('Clear the current setlist?')) {
        clearSetlist();
        showToast('Setlist cleared.');
      }
      return;
    }

    var trackerToggleButton = event.target.closest('[data-setlist-tracker-toggle]');
    if (trackerToggleButton) {
      event.preventDefault();
      var currentlyActive = isTrackerActive();
      if (currentlyActive) {
        var trackedEntries = readTrackerSongs();
        if (trackedEntries.length > 0) {
          exportTrackerList(trackedEntries);
          showToast('Set stopped. Downloaded setlist.txt.');
        } else {
          showToast('Set stopped. No songs were tracked.');
        }
        setTrackerActive(false);
        clearTracker();
        return;
      }
      setTrackerActive(true);
      showToast('Set tracking started.');
      return;
    }

    var trackerClearButton = event.target.closest('[data-setlist-tracker-clear]');
    if (trackerClearButton) {
      event.preventDefault();
      if (readTrackerSongs().length === 0) return;
      if (window.confirm('Clear the current tracked show list?')) {
        clearTracker();
        showToast('Tracked list cleared.');
      }
      return;
    }

    var trackerExportButton = event.target.closest('[data-setlist-tracker-export]');
    if (trackerExportButton) {
      event.preventDefault();
      exportTrackerList(readTrackerSongs());
      showToast('Downloaded setlist.txt.');
      return;
    }

    var toastCloseButton = event.target.closest('[data-setlist-toast-close]');
    if (toastCloseButton) {
      event.preventDefault();
      hideToast();
    }
  });

  document.addEventListener('setlist:updated', function () {
    refreshSetlistUi();
  });

  document.addEventListener('setlist:tracker-updated', function () {
    refreshTrackerUi();
  });

  window.addEventListener('storage', function (event) {
    if (event.key === SETLIST_KEY) {
      refreshSetlistUi();
    }
    if (event.key === TRACKER_SONGS_KEY || event.key === TRACKER_ACTIVE_KEY) {
      refreshTrackerUi();
    }
  });

  window.addEventListener('DOMContentLoaded', function () {
    autologSongPageVisitIfTracking();
    refreshSetlistUi();
    refreshTrackerUi();
  });
})();

// CLOCK
function showTime() {
  var date = new Date();
  var h = date.getHours(); // 0 - 23
  var m = date.getMinutes(); // 0 - 59
  var s = date.getSeconds(); // 0 - 59
  var session = "AM";

  if (h == 0) {
    h = 12;
  }

  if (h > 12) {
    h = h - 12;
    session = "PM";
  }

  h = (h < 10) ? "0" + h : h;
  m = (m < 10) ? "0" + m : m;
  s = (s < 10) ? "0" + s : s;

  // var time = h + ":" + m + ":" + s + " " + session;
  var time = h + ":" + m + " " + session;
  document.getElementById("clock").innerText = time;
  document.getElementById("clock").textContent = time;

  setTimeout(showTime, 60000);
}

showTime();
