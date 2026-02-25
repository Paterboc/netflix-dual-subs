// MAIN world — intercept Netflix manifest via JSON.parse hijack
(function () {
  'use strict';

  const _parse = JSON.parse;

  JSON.parse = function (text, reviver) {
    const result = _parse.call(this, text, reviver);

    // Fast check: only search objects from JSON strings that mention timedtexttracks
    if (typeof text === 'string' && text.includes('timedtexttracks')) {
      try {
        processParseResult(result);
      } catch (err) {
        console.error('[DualSubs] Error in JSON.parse hijack:', err);
      }
    }

    return result;
  };

  function processParseResult(result) {
    const allTracks = [];
    findTimedTextTracks(result, 0, allTracks);

    if (allTracks.length > 0) {
      console.log('[DualSubs] Raw timedtexttracks:', allTracks.length, 'tracks found');
      const payload = allTracks.map(normalizeTrack).filter(Boolean);
      console.log('[DualSubs] After normalize:', payload.length, 'usable tracks');
      if (payload.length > 0) {
        console.log('[DualSubs] Languages:', payload.map(t => t.displayName).join(', '));
        window.postMessage({ type: 'netflix_dual_subs', tracks: payload }, '*');
        window.__netflixDualSubsTracks = payload;
      }
    }
  }

  // Safe deep search — only runs on JSON that contains "timedtexttracks"
  // so the object is guaranteed to have it somewhere
  function findTimedTextTracks(obj, depth, out) {
    if (!obj || typeof obj !== 'object' || depth > 6) return;

    if (Array.isArray(obj.timedtexttracks)) {
      for (const t of obj.timedtexttracks) {
        if (t && !t.isNoneTrack) out.push(t);
      }
      return; // found at this level, don't go deeper here
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        findTimedTextTracks(item, depth + 1, out);
      }
    } else {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val && typeof val === 'object') {
          findTimedTextTracks(val, depth + 1, out);
        }
      }
    }
  }

  // Also intercept fetch responses as backup
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _fetch.apply(this, args);
    try {
      const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url) || '';
      if (url.includes('manifest') || url.includes('metadata') || url.includes('shakti')) {
        const clone = response.clone();
        clone.text().then((text) => {
          if (text.includes('timedtexttracks')) {
            try {
              processParseResult(_parse(text));
            } catch (_) {}
          }
        });
      }
    } catch (_) {}
    return response;
  };

  // Listen for replay requests from ISOLATED world (handles late injection)
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data?.type === 'netflix_dual_subs_replay' && window.__netflixDualSubsTracks) {
      window.postMessage(
        { type: 'netflix_dual_subs', tracks: window.__netflixDualSubsTracks },
        '*'
      );
    }
  });

  function normalizeTrack(track) {
    if (!track || track.isNoneTrack) return null;

    const bcp47 = track.language || track.bcp47 || '';
    const displayName =
      track.languageDescription ||
      track.language_description ||
      bcp47;

    // Collect download URLs from all available CDN locations
    const urls = [];
    const downloadables =
      track.ttDownloadables || track.downloadables || {};

    for (const [format, dlInfo] of Object.entries(downloadables)) {
      if (!dlInfo || typeof dlInfo !== 'object') continue;

      const urlSources = dlInfo.urls || dlInfo.downloadUrls || {};

      if (typeof urlSources === 'object' && urlSources !== null) {
        for (const entry of Object.values(urlSources)) {
          const url =
            typeof entry === 'string'
              ? entry
              : entry?.url || entry?.cdn_url || null;
          if (url) {
            urls.push({ url, format });
          }
        }
      }

      if (dlInfo.url) {
        urls.push({ url: dlInfo.url, format });
      }
    }

    if (urls.length === 0) {
      console.log('[DualSubs] Track has no URLs:', bcp47, Object.keys(downloadables));
      return null;
    }

    return {
      language: bcp47,
      displayName,
      trackType: track.trackType || 'SUBTITLES',
      urls,
      movieId: track.movieId || track.new_track_id || null,
      isForced: track.isForcedNarrative || false,
    };
  }
})();
