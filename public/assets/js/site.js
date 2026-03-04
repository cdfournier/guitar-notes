// COLOR MODE CONTROLS
window.addEventListener('DOMContentLoaded', function (theme) {
  var prefersDark = localStorage.getItem('theme') === 'true';
  document.documentElement.classList.toggle('dark', prefersDark);
  $('input#switch-theme').prop('checked', prefersDark);
  if (localStorage.getItem('theme') === null) {
    localStorage.setItem('theme', false);
  }
});
$('input#switch-theme').click(function () {
  var nextDark = localStorage.getItem('theme') !== 'true';
  document.documentElement.classList.toggle('dark', nextDark);
  $('input#switch-theme').prop('checked', nextDark);
  localStorage.setItem('theme', nextDark ? 'true' : 'false');
  document.dispatchEvent(new CustomEvent('theme:changed', {
    detail: { dark: nextDark }
  }));
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

  function ensureToastElements() {
    var toast = document.querySelector('[data-setlist-toast]');
    var toastMessage = document.querySelector('[data-setlist-toast-message]');
    if (toast && toastMessage) {
      return { toast: toast, message: toastMessage };
    }

    toast = document.createElement('div');
    toast.className = 'setlist-toast';
    toast.setAttribute('data-setlist-toast', '');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');

    toastMessage = document.createElement('span');
    toastMessage.className = 'setlist-toast-message';
    toastMessage.setAttribute('data-setlist-toast-message', '');

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'setlist-toast-close';
    closeButton.setAttribute('data-setlist-toast-close', '');
    closeButton.setAttribute('aria-label', 'Close setlist message');
    closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>';

    toast.appendChild(toastMessage);
    toast.appendChild(closeButton);
    document.body.appendChild(toast);

    return { toast: toast, message: toastMessage };
  }

  function hideToast() {
    var refs = ensureToastElements();
    var toast = refs.toast;
    if (!toast) return;
    toast.classList.remove('is-visible');
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function relayToastToParent(message) {
    if (!message) return;
    try {
      if (!window.parent || window.parent === window) return;
      window.parent.postMessage({
        type: 'gn:setlist-toast',
        message: message
      }, window.location.origin);
    } catch (err) {
      // Ignore cross-context errors.
    }
  }

  function showToast(message) {
    var refs = ensureToastElements();
    var toast = refs.toast;
    var toastMessage = refs.message;
    if (!toast || !toastMessage || !message) return;

    hideToast();
    toastMessage.textContent = message;
    toast.classList.add('is-visible');

    toastTimer = setTimeout(function () {
      hideToast();
    }, 2400);

    relayToastToParent(message);
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
    if (index < 0 || index >= entries.length) return false;
    entries.splice(index, 1);
    writeSetlist(entries);
    return true;
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
      link.setAttribute('data-song-open-panel', '');
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
      var key = getButtonKey(addButton);
      var isInSetlist = addButton.classList.contains('is-in-setlist');
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
      if (removeSong(index)) {
        showToast('Song removed from setlist.');
      }
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

  window.addEventListener('message', function (event) {
    if (!event || event.origin !== window.location.origin) return;
    var data = event.data || {};
    if (data.type !== 'gn:setlist-toast') return;
    if (!data.message || typeof data.message !== 'string') return;
    showToast(data.message);
  });

  window.addEventListener('gn:toast', function (event) {
    var detail = event && event.detail ? event.detail : null;
    if (!detail || typeof detail.message !== 'string' || !detail.message) return;
    showToast(detail.message);
  });

  window.addEventListener('DOMContentLoaded', function () {
    autologSongPageVisitIfTracking();
    refreshSetlistUi();
    refreshTrackerUi();
  });
})();

// PWA RUNTIME
(function pwaRuntime() {
  var forceModeKey = 'gn-force-app-mode';
  var offlineManifestUrl = '/assets/data/offline-cache-manifest.json';
  var offlineProgressKey = 'gn-offline-cache-progress';
  var offlineStatusTimer = null;
  var songPanel = null;

  function getBasePath() {
    if (typeof window.__BASE_PATH__ === 'string') {
      return window.__BASE_PATH__.replace(/\/$/, '');
    }
    return '';
  }

  function getOfflineManifestUrl() {
    return (getBasePath() || '') + offlineManifestUrl;
  }

  function shouldRunOfflineWarmOnPage() {
    var path = (window.location.pathname || '').split('?')[0];
    var basePath = getBasePath();

    if (basePath && path.indexOf(basePath + '/') === 0) {
      path = path.slice(basePath.length) || '/';
    }

    if (!path.startsWith('/')) path = '/' + path;
    if (isSongDetailPath(path)) return false;

    return (
      path === '/' ||
      path === '/index.html' ||
      path === '/grid.html' ||
      path === '/list.html' ||
      path === '/songs/' ||
      path === '/songs' ||
      path === '/songs/list/' ||
      path === '/songs/list' ||
      path === '/lab/' ||
      path === '/lab' ||
      path === '/lab/list/' ||
      path === '/lab/list' ||
      path === '/show/' ||
      path === '/show' ||
      path === '/show.html'
    );
  }

  function isStandaloneMode() {
    try {
      if (window.localStorage) {
        var forced = window.localStorage.getItem(forceModeKey);
        if (forced === '1') return true;
        if (forced === '0') return false;
      }
    } catch (error) {
      // No-op when storage is unavailable.
    }

    var displayModeStandalone = false;
    if (window.matchMedia) {
      displayModeStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches;
    }
    var iosStandalone = window.navigator && window.navigator.standalone === true;
    if (displayModeStandalone || iosStandalone) return true;

    return false;
  }

  function syncForceAppModeFromQuery() {
    var params;
    try {
      params = new URLSearchParams(window.location.search || '');
    } catch (error) {
      return;
    }

    var enabled = params.get('appmode');
    if (enabled !== '1' && enabled !== '0') return;

    try {
      if (!window.localStorage) return;
      if (enabled === '1') {
        window.localStorage.setItem(forceModeKey, '1');
      } else {
        window.localStorage.setItem(forceModeKey, '0');
      }
    } catch (error) {
      // No-op when storage is unavailable.
    }
  }

  function applyStandaloneNavMode() {
    if (!isStandaloneMode()) return;

    var setlistsLinks = document.querySelectorAll('[data-nav-setlists]');
    setlistsLinks.forEach(function (node) {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
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
    if (!pathname) return false;
    var cleanPath = pathname.split('?')[0].split('#')[0];
    var segments = cleanPath.split('/').filter(Boolean);
    var baseSegments = getBasePath().split('/').filter(Boolean);
    if (segments.length !== baseSegments.length + 2) return false;
    for (var i = 0; i < baseSegments.length; i += 1) {
      if (segments[i] !== baseSegments[i]) return false;
    }
    if (segments[baseSegments.length] !== 'songs') return false;
    if (segments[baseSegments.length + 1] === 'list') return false;
    return true;
  }

  function resolveHref(url) {
    try {
      return new URL(url, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function readOfflineProgress() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(offlineProgressKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeOfflineProgress(progress) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(offlineProgressKey, JSON.stringify(progress));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function dispatchToast(message) {
    window.dispatchEvent(new CustomEvent('gn:toast', { detail: { message: message } }));
  }

  function ensureOfflineStatusChip() {
    var chip = document.querySelector('[data-offline-cache-status]');
    if (chip) return chip;

    chip = document.createElement('div');
    chip.className = 'offline-cache-status';
    chip.setAttribute('data-offline-cache-status', '');
    chip.setAttribute('role', 'status');
    chip.setAttribute('aria-live', 'polite');
    chip.textContent = 'Preparing offline cache...';
    document.body.appendChild(chip);
    return chip;
  }

  function showOfflineStatus(text, persistent) {
    var chip = ensureOfflineStatusChip();
    chip.textContent = text;
    chip.classList.add('is-visible');
    if (offlineStatusTimer) {
      clearTimeout(offlineStatusTimer);
      offlineStatusTimer = null;
    }
    if (!persistent) {
      offlineStatusTimer = setTimeout(function () {
        chip.classList.remove('is-visible');
      }, 2500);
    }
  }

  function hideOfflineStatus() {
    var chip = document.querySelector('[data-offline-cache-status]');
    if (!chip) return;
    chip.classList.remove('is-visible');
    if (offlineStatusTimer) {
      clearTimeout(offlineStatusTimer);
      offlineStatusTimer = null;
    }
  }

  function formatOfflineProgress(done, total) {
    if (!total) return 'Offline cache: 0%';
    var percent = Math.min(100, Math.floor((done / total) * 100));
    return 'Offline cache: ' + percent + '% (' + done + '/' + total + ')';
  }

  function normalizeManifestUrls(urls) {
    var seen = {};
    var list = [];
    var basePath = getBasePath();
    urls.forEach(function (url) {
      if (typeof url !== 'string' || !url) return;
      if (!url.startsWith('/')) return;
      if (url === '/sw.js') return;
      if (url.indexOf('/offline/') === 0) return;
      var prefixed = url;
      if (basePath && url.indexOf(basePath + '/') !== 0) {
        prefixed = basePath + url;
      }
      if (seen[prefixed]) return;
      seen[prefixed] = true;
      list.push(prefixed);
    });
    return list;
  }

  async function isUrlCached(url) {
    if (!('caches' in window)) return false;
    try {
      var resolved = resolveHref(url);
      var candidates = [];
      var basePath = getBasePath();

      if (resolved) {
        candidates.push(resolved.href);
        candidates.push(resolved.origin + resolved.pathname);
        candidates.push(resolved.pathname);
        if (basePath && resolved.pathname.indexOf(basePath + '/') === 0) {
          var withoutBase = resolved.pathname.slice(basePath.length) || '/';
          candidates.push(withoutBase);
        }
      } else if (typeof url === 'string' && url) {
        candidates.push(url);
      }

      for (var i = 0; i < candidates.length; i += 1) {
        var candidate = candidates[i];
        if (!candidate) continue;
        var match = await caches.match(candidate, { ignoreSearch: true });
        if (match) return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  function ensureSongPanel() {
    if (songPanel) return songPanel;

    var panel = document.createElement('section');
    panel.className = 'song-panel';
    panel.setAttribute('data-song-panel', '');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div class="song-panel__backdrop" data-song-panel-close></div><div class="song-panel__sheet"><button type="button" class="song-panel__back-fab" data-song-panel-close aria-label="Back"><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-chevron-left" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M15 6l-6 6l6 6"></path></svg></button><iframe class="song-panel__frame" data-song-panel-frame loading="eager"></iframe></div>';
    document.body.appendChild(panel);
    songPanel = panel;
    return panel;
  }

  function getPanelFrame() {
    var panel = ensureSongPanel();
    return panel.querySelector('[data-song-panel-frame]');
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
    syncFrameTheme(frame);
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

  function openSongPanel(url, titleText) {
    if (!navigator.onLine) {
      isUrlCached(url).then(function () {
        showSongPanel(url, titleText);
      });
      return;
    }
    showSongPanel(url, titleText);
  }

  function closeSongPanel() {
    if (!isPanelOpen()) return;
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
      openSongPanel(resolved.href, link.textContent.trim());
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!isPanelOpen()) return;
      closeSongPanel();
    });

    document.addEventListener('theme:changed', function () {
      if (!isPanelOpen()) return;
      var frame = getPanelFrame();
      if (!frame) return;
      syncFrameTheme(frame);
    });
  }

  function syncFrameTheme(frame) {
    try {
      if (!frame || !frame.contentDocument || !frame.contentDocument.documentElement) return;
      var root = frame.contentDocument.documentElement;
      var isDark = document.documentElement.classList.contains('dark');
      root.classList.toggle('dark', isDark);
    } catch (error) {
      // Ignore frames that are not same-origin.
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    var basePath = getBasePath();
    var swUrl = (basePath || '') + '/sw.js';

    navigator.serviceWorker.register(swUrl).catch(function () {
      // No-op in environments where SW registration is unavailable.
    });
  }

  async function fetchOfflineManifest() {
    var response = await fetch(getOfflineManifestUrl(), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Offline manifest unavailable');
    }
    var manifest = await response.json();
    if (!manifest || !Array.isArray(manifest.urls)) {
      throw new Error('Offline manifest invalid');
    }
    return {
      version: manifest.version || 'v1',
      urls: normalizeManifestUrls(manifest.urls)
    };
  }

  async function cacheUrl(cache, url) {
    var request = new Request(url, { credentials: 'same-origin' });
    var existing = await cache.match(request);
    if (existing) return true;
    try {
      var response = await fetch(request);
      if (!response || !response.ok) return false;
      await cache.put(request, response.clone());
      return true;
    } catch (error) {
      return false;
    }
  }

  async function warmOfflineLibrary() {
    if (!isStandaloneMode()) return;
    if (!shouldRunOfflineWarmOnPage()) return;
    if (!('caches' in window) || !('fetch' in window)) return;

    var manifest;
    try {
      manifest = await fetchOfflineManifest();
    } catch (error) {
      return;
    }

    var total = manifest.urls.length;
    if (!total) return;

    var cacheName = 'guitar-notes-library-' + manifest.version;
    var cache = await caches.open(cacheName);
    var progress = readOfflineProgress();
    var startIndex = 0;
    var cachedCount = 0;

    if (progress && progress.version === manifest.version) {
      if (progress.complete === true) {
        return;
      }
      startIndex = Math.max(0, Math.min(total, Number(progress.nextIndex) || 0));
      cachedCount = Math.max(0, Math.min(total, Number(progress.cachedCount) || 0));
    }

    showOfflineStatus(formatOfflineProgress(cachedCount, total), true);

    if (!navigator.onLine) {
      dispatchToast('Offline cache paused. Reconnect to continue.');
      return;
    }

    var batchSize = 12;
    for (var index = startIndex; index < total; index += batchSize) {
      var batch = manifest.urls.slice(index, Math.min(index + batchSize, total));
      var results = await Promise.all(batch.map(function (url) {
        return cacheUrl(cache, url);
      }));

      for (var i = 0; i < results.length; i += 1) {
        if (results[i]) cachedCount += 1;
      }

      var nextIndex = Math.min(index + batch.length, total);
      writeOfflineProgress({
        version: manifest.version,
        nextIndex: nextIndex,
        cachedCount: cachedCount,
        total: total,
        updatedAt: Date.now(),
        complete: nextIndex >= total
      });

      showOfflineStatus(formatOfflineProgress(cachedCount, total), true);

      if (!navigator.onLine) {
        dispatchToast('Offline cache paused. Reconnect to continue.');
        return;
      }

      await new Promise(function (resolve) {
        setTimeout(resolve, 80);
      });
    }

    showOfflineStatus('Offline library ready.', false);
    dispatchToast('Offline cache complete.');
    writeOfflineProgress({
      version: manifest.version,
      nextIndex: total,
      cachedCount: total,
      total: total,
      updatedAt: Date.now(),
      complete: true
    });

    setTimeout(function () {
      hideOfflineStatus();
    }, 2800);
  }

  window.addEventListener('DOMContentLoaded', function () {
    syncForceAppModeFromQuery();
    applyStandaloneNavMode();
    normalizeStandaloneSongLinks();
    bindSongPanelInteractions();
    registerServiceWorker();
    warmOfflineLibrary();

    var frame = getPanelFrame();
    if (frame) {
      frame.addEventListener('load', function () {
        syncFrameTheme(frame);
      });
    }
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
