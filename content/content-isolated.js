// ISOLATED world — orchestrates secondary subtitle fetching, parsing, and overlay rendering
(function () {
  'use strict';

  // State
  let availableTracks = [];
  let currentMovieId = null;
  let secondaryLang = null;
  let store = null;
  let overlayEl = null;
  let rafId = null;
  let lastRenderedText = '';
  let lastSyncTime = 0;
  let currentFontSize = 'small';

  const FONT_SIZES = {
    small: 'clamp(12px, 1.4vw, 22px)',
    medium: 'clamp(16px, 2vw, 30px)',
    large: 'clamp(20px, 2.6vw, 40px)',
  };

  // ── Bootstrap ──

  init();

  function init() {
    listenForTracks();
    listenForMessages();
    loadSavedPreference();

    // Request buffered tracks in case MAIN world captured them before we loaded
    window.postMessage({ type: 'netflix_dual_subs_replay' }, '*');
  }

  // ── Track Capture (from MAIN world via postMessage) ──

  function listenForTracks() {
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      if (!e.data || e.data.type !== 'netflix_dual_subs') return;

      const tracks = e.data.tracks;
      if (!Array.isArray(tracks) || tracks.length === 0) return;

      handleTracks(tracks);
    });
  }

  function handleTracks(tracks) {
    // Detect title change via movieId
    const movieId = tracks[0]?.movieId;
    if (movieId && movieId !== currentMovieId) {
      currentMovieId = movieId;
      clearOverlay();
      store = null;
      availableTracks = [];
    }

    // Merge with existing tracks instead of replacing
    availableTracks = deduplicateTracks([...availableTracks, ...tracks]);

    // Persist for popup (strip URLs to stay within storage limits)
    chrome.storage.local.set({
      availableTracks: availableTracks.map((t) => ({
        language: t.language,
        displayName: t.displayName,
        trackType: t.trackType,
        isForced: t.isForced,
      })),
    });

    // Auto-load if we have a saved preference
    if (secondaryLang) {
      loadSecondaryTrack(secondaryLang);
    }
  }

  function deduplicateTracks(tracks) {
    const seen = new Map();
    for (const t of tracks) {
      const key = `${t.language}:${t.trackType}:${t.isForced}`;
      if (!seen.has(key)) {
        seen.set(key, t);
      }
    }
    return Array.from(seen.values());
  }

  // ── Message Handling (from popup / service worker) ──

  function listenForMessages() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === 'LOAD_SECONDARY') {
        secondaryLang = msg.language;
        if (secondaryLang) {
          loadSecondaryTrack(secondaryLang);
        } else {
          disableOverlay();
        }
        sendResponse({ ok: true });
      } else if (msg.type === 'SET_FONT_SIZE') {
        currentFontSize = msg.size || 'small';
        if (overlayEl) {
          overlayEl.style.fontSize = FONT_SIZES[currentFontSize] || FONT_SIZES.small;
        }
        sendResponse({ ok: true });
      } else if (msg.type === 'GET_STATUS') {
        sendResponse({
          hasTrack: store !== null,
          language: secondaryLang,
          trackCount: availableTracks.length,
        });
      }
      return true;
    });
  }

  function loadSavedPreference() {
    chrome.storage.local.get(['secondaryLang', 'fontSize'], (result) => {
      if (result.secondaryLang) {
        secondaryLang = result.secondaryLang;
      }
      if (result.fontSize) {
        currentFontSize = result.fontSize;
      }
    });
  }

  // ── Subtitle Loading ──

  async function loadSecondaryTrack(lang) {
    const track = availableTracks.find(
      (t) => t.language === lang && !t.isForced
    );
    if (!track || !track.urls.length) {
      console.warn('[DualSubs] No track found for', lang);
      return;
    }

    // Prefer TTML/DFXP over WebVTT (Netflix usually serves TTML)
    const preferred = pickBestUrl(track.urls);

    try {
      const resp = await fetch(preferred.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();

      let cues;
      if (
        preferred.format.includes('dfxp') ||
        preferred.format.includes('ttml') ||
        preferred.format.includes('xml') ||
        text.trimStart().startsWith('<?xml') ||
        text.trimStart().startsWith('<tt')
      ) {
        cues = TTMLParser.parse(text);
      } else {
        cues = WebVTTParser.parse(text);
      }

      store = SubtitleStore.create(cues);
      ensureOverlay();
      startSync();
    } catch (err) {
      console.error('[DualSubs] Failed to load subtitle:', err);
    }
  }

  function pickBestUrl(urls) {
    // Prefer TTML/DFXP, fall back to whatever is available
    const ttml = urls.find(
      (u) =>
        u.format.includes('dfxp') ||
        u.format.includes('ttml') ||
        u.format.includes('xml')
    );
    return ttml || urls[0];
  }

  // ── Overlay DOM ──

  function ensureOverlay() {
    if (overlayEl && document.contains(overlayEl)) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'netflix-dual-subs-overlay';
    overlayEl.setAttribute(
      'style',
      [
        'position: absolute',
        'bottom: 0',
        'left: 0',
        'right: 0',
        'text-align: center',
        'pointer-events: none',
        'z-index: 2147483647',
        'padding: 0 5vw 1vh',
        'font-family: Netflix Sans, Helvetica Neue, Segoe UI, sans-serif',
        'font-size: ' + (FONT_SIZES[currentFontSize] || FONT_SIZES.small),
        'color: rgba(255, 255, 255, 0.75)',
        'text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
        'white-space: pre-wrap',
        'line-height: 1.3',
        'transition: opacity 0.15s',
      ].join('; ')
    );

    injectOverlay();

    // Re-inject if DOM restructures (Netflix SPA navigation)
    const bodyObserver = new MutationObserver(() => {
      if (!document.contains(overlayEl)) {
        injectOverlay();
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  function injectOverlay() {
    // Try to place inside the Netflix player container
    const playerContainer =
      document.querySelector('.watch-video--player-view') ||
      document.querySelector('[data-uia="video-canvas"]') ||
      document.querySelector('.VideoContainer');

    if (playerContainer) {
      // Ensure container is positioned for our absolute child
      const style = getComputedStyle(playerContainer);
      if (style.position === 'static') {
        playerContainer.style.position = 'relative';
      }
      playerContainer.appendChild(overlayEl);
    } else {
      // Fallback: fixed position over viewport
      overlayEl.style.position = 'fixed';
      overlayEl.style.bottom = '10vh';
      document.body.appendChild(overlayEl);
    }
  }

  function clearOverlay() {
    if (overlayEl) {
      overlayEl.textContent = '';
      lastRenderedText = '';
    }
  }

  function disableOverlay() {
    stopSync();
    clearOverlay();
    store = null;
    secondaryLang = null;
  }

  // ── Sync Loop ──

  function startSync() {
    if (rafId) return;
    syncTick();
  }

  function stopSync() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function syncTick() {
    rafId = requestAnimationFrame(syncTick);

    if (!store || !overlayEl) return;

    const video = document.querySelector('video');
    if (!video) return;

    const now = video.currentTime;

    // Throttle to ~4 Hz (250ms) — subtitle resolution doesn't need 60fps
    if (Math.abs(now - lastSyncTime) < 0.2) return;
    lastSyncTime = now;

    const cues = SubtitleStore.getCuesAt(store, now);
    const text = cues.map((c) => c.text).join('\n');

    if (text !== lastRenderedText) {
      lastRenderedText = text;
      overlayEl.textContent = text;

      // Position above native subs by detecting their presence
      adjustPosition();
    }
  }

  function adjustPosition() {
    // Place secondary subs directly below the primary (native) subs
    const nativeSubs = document.querySelector('.player-timedtext');
    if (nativeSubs && nativeSubs.textContent.trim()) {
      const nativeRect = nativeSubs.getBoundingClientRect();
      // Position our overlay so its top edge starts at the bottom of native subs
      overlayEl.style.position = 'fixed';
      overlayEl.style.top = (nativeRect.bottom + 4) + 'px';
      overlayEl.style.bottom = 'auto';
      overlayEl.style.left = '0';
      overlayEl.style.right = '0';
    } else {
      // No native subs visible — show at bottom
      overlayEl.style.position = 'fixed';
      overlayEl.style.top = 'auto';
      overlayEl.style.bottom = '10vh';
    }
  }

  // Also watch for Netflix native subtitle changes to reposition immediately
  const timedTextObserver = new MutationObserver(() => {
    if (overlayEl) adjustPosition();
  });

  function observeNativeSubs() {
    const el = document.querySelector('.player-timedtext');
    if (el) {
      timedTextObserver.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  // Retry observation until Netflix player is ready
  const readyObserver = new MutationObserver(() => {
    if (document.querySelector('.player-timedtext')) {
      observeNativeSubs();
      readyObserver.disconnect();
    }
  });
  readyObserver.observe(document.body, { childList: true, subtree: true });
})();
