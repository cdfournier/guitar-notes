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
  var ICON_MUSIC_PLUS = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-music-plus"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M9 17v-13h10v8" /><path d="M9 8h10" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>';
  var ICON_MUSIC_MINUS = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-music-minus"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M9 17v-13h10v11" /><path d="M9 8h10" /><path d="M16 19h6" /></svg>';
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

  function getEntryKey(entry) {
    if (!entry) return '';
    return entry.slug || entry.href || '';
  }

  function getButtonKey(button) {
    if (!button) return '';
    return button.getAttribute('data-setlist-slug') || button.getAttribute('data-setlist-href') || '';
  }

  function setAddButtonState(button, inSetlist) {
    if (!button) return;
    var icon = button.querySelector('.icon');
    button.classList.toggle('is-in-setlist', inSetlist);
    button.setAttribute('aria-label', inSetlist ? 'Remove from setlist' : 'Add to setlist');
    if (icon) {
      icon.innerHTML = inSetlist ? ICON_MUSIC_MINUS : ICON_MUSIC_PLUS;
    }
  }

  function syncAddButtons(entries) {
    var byKey = {};
    entries.forEach(function (entry) {
      var key = getEntryKey(entry);
      if (!key) return;
      byKey[key] = true;
    });

    var buttons = document.querySelectorAll('[data-setlist-add]');
    buttons.forEach(function (button) {
      var inRow = !!button.closest('.song-link-row');
      if (!inRow) {
        setAddButtonState(button, false);
        return;
      }
      var key = getButtonKey(button);
      setAddButtonState(button, !!byKey[key]);
    });
  }

  function removeSongByKey(key) {
    if (!key) return false;
    var entries = readSetlist();
    var index = -1;
    for (var i = entries.length - 1; i >= 0; i -= 1) {
      if (getEntryKey(entries[i]) === key) {
        index = i;
        break;
      }
    }
    if (index < 0) return false;
    entries.splice(index, 1);
    writeSetlist(entries);
    return true;
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
    syncAddButtons(entries);
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
      var inRow = !!addButton.closest('.song-link-row');
      var key = getButtonKey(addButton);
      var isInSetlist = inRow && addButton.classList.contains('is-in-setlist');
      if (isInSetlist && removeSongByKey(key)) {
        showToast('Song removed from setlist.');
        return;
      }

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

// PWA RUNTIME
(function pwaRuntime() {
  var panelStateKey = '__songPanel';
  var songPanel = null;

  function getBasePath() {
    if (typeof window.__BASE_PATH__ === 'string') {
      return window.__BASE_PATH__.replace(/\/$/, '');
    }
    return '';
  }

  function isStandaloneMode() {
    var displayModeStandalone = false;
    if (window.matchMedia) {
      displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
    }
    var iosStandalone = window.navigator && window.navigator.standalone === true;
    return displayModeStandalone || iosStandalone;
  }

  function applyStandaloneNavMode() {
    if (!isStandaloneMode()) return;

    var setlistsLinks = document.querySelectorAll('[data-nav-setlists]');
    setlistsLinks.forEach(function (node) {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    });

    var showToggles = document.querySelectorAll('[data-setlist-show-toggle]');
    showToggles.forEach(function (node) {
      node.classList.remove('is-visible');
      node.classList.add('is-hidden');
      node.setAttribute('aria-hidden', 'true');
      if (node.tagName === 'A') {
        node.tabIndex = -1;
      }
    });
  }

  function normalizeStandaloneSongLinks() {
    if (!isStandaloneMode()) return;

    var links = document.querySelectorAll('a[href]');
    links.forEach(function (link) {
      var resolved = resolveHref(link.getAttribute('href'));
      if (!resolved) return;
      if (!isSongDetailPath(resolved.pathname)) return;

      if (link.hasAttribute('target')) {
        link.setAttribute('data-original-target', link.getAttribute('target') || '');
      }
      link.setAttribute('target', '_self');

      // Keep rel lean and avoid noopener/noreferrer semantics intended for _blank.
      var rel = (link.getAttribute('rel') || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter(function (token) { return token !== 'noopener' && token !== 'noreferrer'; });
      if (rel.length > 0) {
        link.setAttribute('rel', rel.join(' '));
      } else {
        link.removeAttribute('rel');
      }
    });
  }

  function isSongDetailPath(pathname) {
    return /\/songs\/[^\/?#]+\/?$/.test(pathname || '');
  }

  function resolveHref(url) {
    try {
      return new URL(url, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function ensureSongPanel() {
    if (songPanel) return songPanel;

    var panel = document.createElement('section');
    panel.className = 'song-panel';
    panel.setAttribute('data-song-panel', '');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div class="song-panel__backdrop" data-song-panel-close></div><div class="song-panel__sheet"><header class="song-panel__header"><button type="button" class="song-panel__close" data-song-panel-close aria-label="Close song panel"><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-x" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg></button><p class="song-panel__title" data-song-panel-title>Song</p></header><iframe class="song-panel__frame" data-song-panel-frame loading="eager"></iframe></div>';
    document.body.appendChild(panel);
    songPanel = panel;
    return panel;
  }

  function getPanelFrame() {
    var panel = ensureSongPanel();
    return panel.querySelector('[data-song-panel-frame]');
  }

  function setPanelTitle(text) {
    var panel = ensureSongPanel();
    var title = panel.querySelector('[data-song-panel-title]');
    if (!title) return;
    title.textContent = text || 'Song';
  }

  function isPanelOpen() {
    return !!(songPanel && songPanel.classList.contains('is-open'));
  }

  function showSongPanel(url, titleText) {
    var panel = ensureSongPanel();
    var frame = getPanelFrame();

    if (!frame) return;

    if (frame.getAttribute('src') !== url) {
      frame.setAttribute('src', url);
    }
    setPanelTitle(titleText);

    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('song-panel-open');
  }

  function hideSongPanel() {
    if (!songPanel) return;
    songPanel.classList.remove('is-open');
    songPanel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('song-panel-open');
  }

  function openSongPanel(url, titleText, pushState) {
    showSongPanel(url, titleText);

    if (pushState === false) return;

    window.history.pushState({
      url: url,
      title: titleText || 'Song',
      __songPanel: true
    }, '', window.location.href);
  }

  function closeSongPanel() {
    if (!isPanelOpen()) return;

    var state = window.history.state;
    if (state && state[panelStateKey]) {
      window.history.back();
      return;
    }

    hideSongPanel();
  }

  function bindSongPanelInteractions() {
    if (!isStandaloneMode()) return;

    document.addEventListener('click', function (event) {
      var closeTrigger = event.target.closest('[data-song-panel-close]');
      if (closeTrigger) {
        event.preventDefault();
        closeSongPanel();
        return;
      }

      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var link = event.target.closest('a[href]');
      if (!link) return;
      if (link.closest('[data-song-panel]')) return;

      var resolved = resolveHref(link.getAttribute('href'));
      if (!resolved) return;
      if (!isSongDetailPath(resolved.pathname)) return;

      event.preventDefault();
      openSongPanel(resolved.href, link.textContent.trim(), true);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!isPanelOpen()) return;
      closeSongPanel();
    });

    window.addEventListener('popstate', function (event) {
      var state = event.state || {};
      if (state[panelStateKey] && state.url) {
        showSongPanel(state.url, state.title || 'Song');
        return;
      }

      if (isPanelOpen()) {
        hideSongPanel();
      }
    });
  }

  function ensureUpdateToast() {
    var existing = document.querySelector('[data-pwa-update-toast]');
    if (existing) return existing;

    var toast = document.createElement('div');
    toast.className = 'setlist-toast pwa-update-toast';
    toast.setAttribute('data-pwa-update-toast', '');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<span class="setlist-toast-message">Update available.</span><span class="pwa-update-actions"><button type="button" class="pwa-update-button" data-pwa-update-reload>Reload</button><button type="button" class="setlist-toast-close" data-pwa-update-close aria-label="Dismiss update message"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg></button></span>';
    document.body.appendChild(toast);
    return toast;
  }

  function showUpdateToast() {
    var toast = ensureUpdateToast();
    toast.classList.add('is-visible');
  }

  function hideUpdateToast() {
    var toast = document.querySelector('[data-pwa-update-toast]');
    if (!toast) return;
    toast.classList.remove('is-visible');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    var basePath = getBasePath();
    var swUrl = (basePath || '') + '/sw.js';

    navigator.serviceWorker.register(swUrl).then(function (registration) {
      function bindWaitingWorker(worker) {
        if (!worker) return;
        showUpdateToast();
      }

      bindWaitingWorker(registration.waiting);

      registration.addEventListener('updatefound', function () {
        var newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            bindWaitingWorker(newWorker);
          }
        });
      });

      document.addEventListener('click', function (event) {
        var close = event.target.closest('[data-pwa-update-close]');
        if (close) {
          event.preventDefault();
          hideUpdateToast();
          return;
        }

        var reload = event.target.closest('[data-pwa-update-reload]');
        if (!reload) return;
        event.preventDefault();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        window.location.reload();
      });

      navigator.serviceWorker.addEventListener('controllerchange', function () {
        window.location.reload();
      });
    }).catch(function () {
      // No-op in environments where SW registration is unavailable.
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    applyStandaloneNavMode();
    normalizeStandaloneSongLinks();
    bindSongPanelInteractions();
    registerServiceWorker();
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
