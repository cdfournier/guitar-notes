(function () {
  const items = Array.from(document.querySelectorAll('[data-song-item]'));
  if (!items.length) return;

  const searchInput = document.getElementById('song-filter-search');
  const artistSelect = document.getElementById('song-filter-artist');
  const tagContainer = document.getElementById('tag-filters');
  const resetButton = document.getElementById('song-filter-reset');


  const modal = document.querySelector('[data-filter]');
  const openButtons = Array.from(document.querySelectorAll('[data-filter-open]'));
  const closeButtons = Array.from(document.querySelectorAll('[data-filter-close]'));
  let lastActiveElement = null;

  function openModal() {
    if (!modal) return;
    lastActiveElement = document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('filter--open');
    document.body.classList.add('filter-modal-open');
    const focusTarget = modal.querySelector('#song-filter-search');
    if (focusTarget) focusTarget.focus();
  }

  function closeModal() {
    if (!modal) return;
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    } else if (openButtons[0]) {
      openButtons[0].focus();
    }
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('filter--open');
    document.body.classList.remove('filter-modal-open');
  }

  openButtons.forEach((btn) => btn.addEventListener('click', openModal));
  closeButtons.forEach((btn) => btn.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
  if (!searchInput || !tagContainer) return;

  const artistMap = new Map();
  const tagMap = new Map();

  items.forEach((item) => {
    const artist = (item.getAttribute('data-artist') || '').trim();
    const title = (item.getAttribute('data-title') || '').trim();
    const tagsRaw = (item.getAttribute('data-tags') || '').trim();

    item.dataset.search = `${artist} ${title}`.toLowerCase();

    if (artist) {
      const key = artist.toLowerCase();
      if (!artistMap.has(key)) artistMap.set(key, artist);
    }

    if (tagsRaw) {
      tagsRaw
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => {
          const key = tag.toLowerCase();
          if (!tagMap.has(key)) tagMap.set(key, tag);
        });
    }
  });

  if (artistSelect) {
    Array.from(artistMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .forEach(([key, label]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        artistSelect.appendChild(option);
      });
  }

  Array.from(tagMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([key, label]) => {
      const tagLabel = document.createElement('label');
      tagLabel.className = 'filter-tag';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = key;

      const text = document.createElement('span');
      text.textContent = label;

      tagLabel.appendChild(checkbox);
      tagLabel.appendChild(text);
      tagContainer.appendChild(tagLabel);
    });

  function getSelectedTags() {
    return Array.from(tagContainer.querySelectorAll('input[type="checkbox"]'))
      .filter((input) => input.checked)
      .map((input) => input.value);
  }

  function itemMatchesTags(item, selectedTags) {
    if (!selectedTags.length) return true;
    const tagsRaw = (item.getAttribute('data-tags') || '').toLowerCase();
    const tags = tagsRaw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    return selectedTags.every((tag) => tags.includes(tag));
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const artist = artistSelect ? artistSelect.value : '';
    const selectedTags = getSelectedTags();

    items.forEach((item) => {
      let visible = true;

      if (query && !item.dataset.search.includes(query)) {
        visible = false;
      }

      if (visible && artist) {
        const itemArtist = (item.getAttribute('data-artist') || '').trim().toLowerCase();
        if (itemArtist !== artist) visible = false;
      }

      if (visible && !itemMatchesTags(item, selectedTags)) {
        visible = false;
      }

      item.style.display = visible ? '' : 'none';
    });

    const groups = Array.from(document.querySelectorAll('[data-artist-group]'));
    groups.forEach((group) => {
      const visibleSongs = group.querySelectorAll('[data-song-item]:not([style*="display: none"])');
      group.style.display = visibleSongs.length ? '' : 'none';
    });
  }

  function resetFilters() {
    searchInput.value = '';
    if (artistSelect) artistSelect.value = '';
    tagContainer.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    applyFilters();
  }

  searchInput.addEventListener('input', applyFilters);
  if (artistSelect) artistSelect.addEventListener('change', applyFilters);
  tagContainer.addEventListener('change', applyFilters);
  if (resetButton) resetButton.addEventListener('click', resetFilters);
})();
