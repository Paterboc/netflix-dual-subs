# NovaVox

Watch in any language. Dual subtitles, media downloads from any site, and instant translate — zero setup, runs entirely in your browser.

## What It Does

- **Dual Subtitles** — display two subtitle languages at once on Netflix and YouTube
- **Download Media** — save video and audio from Instagram, Twitter/X, Reddit, TikTok, YouTube, and any site that serves unencrypted media
- **Instant Translate** — right-click any text on any website to translate it

## Installation

1. Clone or download this repository
   ```
   git clone https://github.com/Paterboc/novavox.git
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `novavox` folder
5. The NovaVox icon appears in your toolbar

No API keys, no accounts, no external software.

## Features

### Dual Subtitles

Display a secondary subtitle language below the native subtitles while watching Netflix or YouTube.

- Automatic subtitle detection — NovaVox reads every subtitle language the platform offers
- Pick a language from the dropdown and it appears instantly
- Auto-sync with calibration — timing adjusts on seek, skip, and resume
- Three font sizes (S / M / L)
- Works in fullscreen

**How to use:**
1. Play a video on Netflix or YouTube
2. Click the NovaVox icon → **Subtitles** tab
3. Toggle **Dual subtitles** on
4. Pick your secondary language from the dropdown

### Media Downloads

Save video and audio from any website that serves unencrypted media. NovaVox automatically detects video and audio files as they load on the page.

**Works on:**
- Instagram (reels, stories, posts)
- Twitter / X (videos, voice notes)
- Reddit (hosted videos)
- TikTok
- YouTube (video, audio, subtitles)
- Facebook (non-DRM videos)
- Vimeo, Dailymotion, Twitch clips
- Blogs, news sites, forums — any site with embedded video/audio

**How to use:**
1. Open a page with video or audio content
2. Play the video (NovaVox detects it as it loads)
3. Click the NovaVox icon → **Downloads** tab
4. Click **Download** on any detected item

> DRM-encrypted streams (Netflix video, some Hulu/Disney+ content) cannot be downloaded. Netflix subtitles (plain text) can still be downloaded.

### Instant Translate

Translate selected text on any website with a right-click. Works everywhere — not just streaming sites.

- Select text on Reddit, Wikipedia, Twitter/X, news articles, blogs, Amazon, forums — literally any webpage
- Right-click → **Translate** — a tooltip shows the translation and detected source language
- Auto-detects the source language
- 32 target languages
- Works on Netflix/YouTube subtitles and the dual subtitle overlay too

**How to use:**
1. Select text on any page
2. Right-click → **Translate "[text]"**
3. Change target language anytime in the NovaVox popup

## Supported Sites

| | Dual Subs | Media Download | Subtitle Download | Translate |
|---|---|---|---|---|
| **Netflix** | Yes | No (DRM) | Yes | Yes |
| **YouTube** | Yes | Yes | Yes | Yes |
| **Instagram** | — | Yes | — | Yes |
| **Twitter / X** | — | Yes | — | Yes |
| **Reddit** | — | Yes | — | Yes |
| **TikTok** | — | Yes | — | Yes |
| **Facebook** | — | Most content | — | Yes |
| **Vimeo** | — | Yes | — | Yes |
| **Any website** | — | If unencrypted | — | Yes |

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your language and font preferences |
| `activeTab` | Reads the current tab to overlay subtitles |
| `contextMenus` | Adds "Translate" to right-click menu |
| `scripting` | Injects the translate tooltip on demand |
| `downloads` | Saves files to your computer |
| `webRequest` | Detects video/audio files loading on any page |
| Host access | All URLs — needed to detect and download media from any site |

## Requirements

- Google Chrome, Edge, Brave, Arc, or any Chromium-based browser
- Netflix subscription (for Netflix features)

## License

MIT
