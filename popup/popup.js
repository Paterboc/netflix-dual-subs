// Popup — reads available tracks from storage, sends language selection to content script
(function () {
  'use strict';

  const selectEl = document.getElementById('secondary-lang');
  const pickerEl = document.getElementById('track-picker');
  const noTracksEl = document.getElementById('no-tracks');
  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');

  const sizeBtns = document.querySelectorAll('.size-btn');

  // Load available tracks and saved preferences
  chrome.storage.local.get(
    ['availableTracks', 'secondaryLang', 'fontSize'],
    (result) => {
      // Set active size button
      const savedSize = result.fontSize || 'small';
      sizeBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.size === savedSize);
      });
      const tracks = result.availableTracks || [];
      const savedLang = result.secondaryLang || '';

      if (tracks.length === 0) {
        noTracksEl.classList.remove('hidden');
        pickerEl.classList.add('hidden');
        return;
      }

      noTracksEl.classList.add('hidden');
      pickerEl.classList.remove('hidden');

      // Populate dropdown — filter out forced narrative tracks
      const subtitleTracks = tracks.filter((t) => !t.isForced);
      for (const track of subtitleTracks) {
        const opt = document.createElement('option');
        opt.value = track.language;
        opt.textContent = track.displayName || track.language;
        if (track.language === savedLang) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      }

      if (savedLang) {
        showStatus(savedLang);
      }
    }
  );

  // Handle selection change
  selectEl.addEventListener('change', () => {
    const lang = selectEl.value;

    // Persist preference
    chrome.storage.local.set({ secondaryLang: lang || null });

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'LOAD_SECONDARY',
          language: lang || null,
        });
      }
    });

    if (lang) {
      showStatus(lang);
    } else {
      statusBar.classList.add('hidden');
    }
  });

  // Handle font size buttons
  sizeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      sizeBtns.forEach((b) => b.classList.toggle('active', b === btn));
      chrome.storage.local.set({ fontSize: size });

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SET_FONT_SIZE',
            size,
          });
        }
      });
    });
  });

  function showStatus(lang) {
    const opt = selectEl.querySelector(`option[value="${lang}"]`);
    const name = opt?.textContent || lang;
    statusText.textContent = `Showing: ${name}`;
    statusBar.classList.remove('hidden');
  }
})();
