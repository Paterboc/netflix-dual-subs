// Service worker — context menu translate, media detection, downloads

// ── Per-tab media storage ──

const tabMedia = new Map(); // tabId -> { media: [], title: '', seen: Set }

function getTabData(tabId) {
  if (!tabMedia.has(tabId)) {
    tabMedia.set(tabId, { media: [], title: '', seen: new Set() });
  }
  return tabMedia.get(tabId);
}

// Clean up on tab close or navigation
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMedia.delete(tabId);
  injectedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabMedia.delete(tabId);
    injectedTabs.delete(tabId);
  }
});

// ── Generic media detection via webRequest ──
// Catches video/audio responses from ANY site (Instagram, Twitter, Reddit, etc.)

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId < 0) return; // not from a tab

    // Check content-type header
    const contentType = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type'
    )?.value?.toLowerCase() || '';

    if (!contentType.startsWith('video/') && !contentType.startsWith('audio/')) return;

    // Skip blob/data URLs
    if (details.url.startsWith('blob:') || details.url.startsWith('data:')) return;

    // Skip HLS/DASH segments (tiny, useless individually)
    if (details.url.match(/\.(ts|m4s|m4f|cmfv|cmfa)(\?|$)/i)) return;

    // Skip tiny files (< 100KB — thumbnails, previews, short clips)
    const contentLength = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-length'
    )?.value;
    if (contentLength && parseInt(contentLength) < 100000) return;

    const data = getTabData(tabId);

    // Deduplicate by URL
    if (data.seen.has(details.url)) return;
    data.seen.add(details.url);

    const isAudio = contentType.startsWith('audio/');
    const size = contentLength ? parseInt(contentLength) : null;

    data.media.push({
      url: details.url,
      type: isAudio ? 'audio' : 'video+audio',
      mimeType: contentType.split(';')[0],
      quality: isAudio ? 'Audio' : 'Video',
      size,
      width: null,
      height: null,
      source: 'detected',
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// ── Context menu translate ──

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate "%s"',
    contexts: ['selection'],
  });
});

const injectedTabs = new Set();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'translate-selection' || !info.selectionText || !tab?.id) return;

  if (!injectedTabs.has(tab.id)) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/hover-translate.css'],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/hover-translate.js'],
      });
      injectedTabs.add(tab.id);
    } catch (e) {
      return;
    }
  }

  chrome.tabs.sendMessage(tab.id, {
    type: 'TRANSLATE_SELECTION',
    text: info.selectionText.trim(),
  });
});

// ── Message handling ──

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tabId: tabs[0]?.id });
    });
    return true;
  }

  if (msg.type === 'STORE_MEDIA') {
    // From YouTube/Netflix content scripts — merge with webRequest-detected media
    const tabId = sender.tab?.id;
    if (tabId) {
      const data = getTabData(tabId);
      if (msg.title) data.title = msg.title;
      for (const m of msg.media || []) {
        if (!data.seen.has(m.url)) {
          data.seen.add(m.url);
          data.media.push(m);
        }
      }
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GET_MEDIA') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const tabId = tab?.id;
      const data = tabId ? tabMedia.get(tabId) : null;
      sendResponse({
        media: data?.media || [],
        title: data?.title || tab?.title || '',
      });
    });
    return true;
  }

  if (msg.type === 'DOWNLOAD_FILE') {
    const opts = {
      url: msg.url,
    };
    if (msg.filename) {
      opts.filename = sanitizeFilename(msg.filename);
    }
    chrome.downloads.download(opts, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, downloadId });
      }
    });
    return true;
  }

  if (msg.type === 'DOWNLOAD_SUBTITLE') {
    fetch(msg.url)
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.text();
      })
      .then((text) => {
        const blob = new Blob([text], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        const filename = sanitizeFilename(msg.filename || 'subtitles.vtt');
        chrome.downloads.download({ url: blobUrl, filename }, (downloadId) => {
          URL.revokeObjectURL(blobUrl);
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ ok: true, downloadId });
          }
        });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
});

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}
