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

// SETLIST BUILDER
(function setlistBuilder() {
  var SETLIST_KEY = 'setlistDraft';

  function readSetlist() {
    try {
      var raw = localStorage.getItem(SETLIST_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeSetlist(entries) {
    localStorage.setItem(SETLIST_KEY, JSON.stringify(entries));
    dispatchSetlistUpdated(entries);
  }

  function dispatchSetlistUpdated(entries) {
    document.dispatchEvent(new CustomEvent('setlist:updated', {
      detail: { count: entries.length }
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

  function togglePlayButtons(count) {
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

  function updateCount(count) {
    var counters = document.querySelectorAll('[data-setlist-count]');
    counters.forEach(function (counter) {
      counter.textContent = String(count);
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

  function refreshSetlistUi() {
    var entries = readSetlist();
    var count = entries.length;
    updateCount(count);
    togglePlayButtons(count);
    renderSetlistPage(entries);
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
      }
    }
  });

  document.addEventListener('setlist:updated', function () {
    refreshSetlistUi();
  });

  window.addEventListener('storage', function (event) {
    if (event.key === SETLIST_KEY) {
      refreshSetlistUi();
    }
  });

  window.addEventListener('DOMContentLoaded', function () {
    refreshSetlistUi();
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
