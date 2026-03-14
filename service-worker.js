// Service worker — context menu translate, media storage, downloads

// ── Per-tab media storage ──

const tabMedia = new Map(); // tabId -> { media: [], title: '' }

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
    const tabId = sender.tab?.id;
    if (tabId) {
      tabMedia.set(tabId, {
        media: msg.media || [],
        title: msg.title || '',
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GET_MEDIA') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      const data = tabId ? tabMedia.get(tabId) : null;
      sendResponse({
        media: data?.media || [],
        title: data?.title || '',
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
    // Fetch subtitle content and save as file
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
