// MAIN world — intercept page data for subtitle tracks and media URLs (Netflix + YouTube)
(function () {
  'use strict';

  const _parse = JSON.parse;
  const hostname = location.hostname;
  const isNetflix = hostname.includes('netflix.com');
  const isYouTube = hostname.includes('youtube.com');

  // ── JSON.parse intercept ──

  JSON.parse = function (text, reviver) {
    const result = _parse.call(this, text, reviver);
    if (typeof text !== 'string') return result;

    try {
      if (isNetflix && text.includes('timedtexttracks')) {
        processNetflixParse(result);
      }
      if (isYouTube && (text.includes('captionTracks') || text.includes('streamingData'))) {
        processYouTubeParse(result);
      }
    } catch (err) {
      console.error('[DualSubs] JSON.parse intercept error:', err);
    }

    return result;
  };

  // ── Fetch intercept ──

  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _fetch.apply(this, args);
    try {
      const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url) || '';

      if (isNetflix && (url.includes('manifest') || url.includes('metadata') || url.includes('shakti'))) {
        const clone = response.clone();
        clone.text().then((text) => {
          if (text.includes('timedtexttracks')) {
            try { processNetflixParse(_parse(text)); } catch (_) {}
          }
        });
      }

      if (isYouTube && url.includes('/youtubei/v1/player')) {
        const clone = response.clone();
        clone.json().then((data) => {
          try { processYouTubeParse(data); } catch (_) {}
        });
      }
    } catch (_) {}
    return response;
  };

  // ── YouTube: intercept initial player response ──

  if (isYouTube) {
    try {
      let _ytPR;
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        configurable: true,
        enumerable: true,
        get() { return _ytPR; },
        set(val) {
          _ytPR = val;
          try { processYouTubeParse(val); } catch (e) {
            console.error('[DualSubs] ytInitialPlayerResponse error:', e);
          }
        },
      });
    } catch (_) {
      // Fallback: poll
      const poll = setInterval(() => {
        if (window.ytInitialPlayerResponse) {
          try { processYouTubeParse(window.ytInitialPlayerResponse); } catch (_) {}
          clearInterval(poll);
        }
      }, 1000);
      setTimeout(() => clearInterval(poll), 30000);
    }
  }

  // ── Replay listeners ──

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data?.type === 'netflix_dual_subs_replay' && window.__dualSubsTracks) {
      window.postMessage({ type: 'netflix_dual_subs', tracks: window.__dualSubsTracks }, '*');
    }
    if (e.data?.type === 'dual_subs_media_replay' && window.__dualSubsMedia) {
      window.postMessage({
        type: 'dual_subs_media',
        media: window.__dualSubsMedia,
        title: window.__dualSubsTitle || '',
      }, '*');
    }
  });

  // ═══════════════════════════════════════════════
  // Netflix
  // ═══════════════════════════════════════════════

  function processNetflixParse(result) {
    const allTracks = [];
    findTimedTextTracks(result, 0, allTracks);

    if (allTracks.length > 0) {
      console.log('[DualSubs] Raw timedtexttracks:', allTracks.length, 'tracks found');
      const payload = allTracks.map(normalizeNetflixTrack).filter(Boolean);
      console.log('[DualSubs] After normalize:', payload.length, 'usable tracks');
      if (payload.length > 0) {
        console.log('[DualSubs] Languages:', payload.map(t => t.displayName).join(', '));
        window.postMessage({ type: 'netflix_dual_subs', tracks: payload }, '*');
        window.__dualSubsTracks = payload;
      }
    }
  }

  function findTimedTextTracks(obj, depth, out) {
    if (!obj || typeof obj !== 'object' || depth > 6) return;

    if (Array.isArray(obj.timedtexttracks)) {
      for (const t of obj.timedtexttracks) {
        if (t && !t.isNoneTrack) out.push(t);
      }
      return;
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

  function normalizeNetflixTrack(track) {
    if (!track || track.isNoneTrack) return null;

    const bcp47 = track.language || track.bcp47 || '';
    const displayName =
      track.languageDescription ||
      track.language_description ||
      bcp47;

    const urls = [];
    const downloadables = track.ttDownloadables || track.downloadables || {};

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

  // ═══════════════════════════════════════════════
  // YouTube
  // ═══════════════════════════════════════════════

  function processYouTubeParse(result) {
    if (!result || typeof result !== 'object') return;

    // Skip ad responses
    if (result.adPlacements || result.playerAds) return;

    // Extract subtitle tracks
    const captionTracks = findCaptionTracks(result);
    if (captionTracks.length > 0) {
      const tracks = captionTracks.map(normalizeYouTubeTrack).filter(Boolean);
      if (tracks.length > 0) {
        console.log('[DualSubs] YouTube subtitles:', tracks.map(t => t.displayName).join(', '));
        window.postMessage({ type: 'netflix_dual_subs', tracks }, '*');
        window.__dualSubsTracks = tracks;
      }
    }

    // Extract media for downloads
    const media = extractYouTubeMedia(result);
    const title = result.videoDetails?.title || document.title || '';
    if (media.length > 0) {
      console.log('[DualSubs] YouTube media:', media.length, 'streams detected');
      window.postMessage({ type: 'dual_subs_media', media, title }, '*');
      window.__dualSubsMedia = media;
      window.__dualSubsTitle = title;
    }
  }

  function findCaptionTracks(obj, depth) {
    if (!obj || typeof obj !== 'object' || (depth || 0) > 6) return [];
    if (obj.captionTracks && Array.isArray(obj.captionTracks)) return obj.captionTracks;
    if (obj.playerCaptionsTracklistRenderer?.captionTracks) {
      return obj.playerCaptionsTracklistRenderer.captionTracks;
    }
    for (const key of Object.keys(obj)) {
      if (obj[key] && typeof obj[key] === 'object') {
        const found = findCaptionTracks(obj[key], (depth || 0) + 1);
        if (found.length > 0) return found;
      }
    }
    return [];
  }

  function normalizeYouTubeTrack(track) {
    if (!track.baseUrl) return null;
    const vttUrl =
      track.baseUrl + (track.baseUrl.includes('?') ? '&' : '?') + 'fmt=vtt';
    return {
      language: track.languageCode || 'unknown',
      displayName:
        track.name?.simpleText ||
        track.name?.runs?.[0]?.text ||
        track.languageCode ||
        'Unknown',
      trackType: track.kind === 'asr' ? 'AUTO' : 'SUBTITLES',
      urls: [{ url: vttUrl, format: 'webvtt' }],
      movieId: null,
      isForced: false,
    };
  }

  function extractYouTubeMedia(result) {
    const media = [];
    const sd = findStreamingData(result);
    if (!sd) return media;

    // Muxed formats (video + audio together — directly playable)
    for (const f of sd.formats || []) {
      if (!f.url) continue;
      media.push({
        url: f.url,
        type: 'video+audio',
        mimeType: f.mimeType || 'video/mp4',
        quality: f.qualityLabel || f.quality || '?',
        size: f.contentLength ? parseInt(f.contentLength) : null,
        width: f.width || null,
        height: f.height || null,
      });
    }

    // Adaptive formats (separate streams)
    for (const f of sd.adaptiveFormats || []) {
      if (!f.url) continue;
      const mime = f.mimeType || '';
      const isAudio = mime.startsWith('audio/');
      media.push({
        url: f.url,
        type: isAudio ? 'audio' : 'video',
        mimeType: mime,
        quality: isAudio
          ? `${Math.round((f.bitrate || 0) / 1000)}kbps`
          : f.qualityLabel || `${f.height || '?'}p`,
        size: f.contentLength ? parseInt(f.contentLength) : null,
        width: f.width || null,
        height: f.height || null,
      });
    }

    return media;
  }

  function findStreamingData(obj, depth) {
    if (!obj || typeof obj !== 'object' || (depth || 0) > 4) return null;
    if (obj.streamingData) return obj.streamingData;
    for (const key of Object.keys(obj)) {
      if (obj[key] && typeof obj[key] === 'object') {
        const found = findStreamingData(obj[key], (depth || 0) + 1);
        if (found) return found;
      }
    }
    return null;
  }
})();
