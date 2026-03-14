# StreamGrab Translate

Dual subtitles, video/audio downloads, and instant translate for Netflix & YouTube — all from one Chrome extension with zero setup.

## Features

### Dual Subtitles
- Overlay a secondary subtitle language below the native subtitles on **Netflix** and **YouTube**
- Auto-sync and calibration — timing adjusts automatically on seek, skip, and playback resume
- Load external subtitle files (.srt, .vtt, .ttml) as the secondary track
- Adjustable font size (S / M / L)

### Media Downloads
- Detect available video and audio streams on YouTube
- Download **video + audio** (muxed), **audio only**, or **video only** streams
- Download subtitle tracks as .vtt files
- All detection happens in-browser — no external tools or APIs required

### Right-Click Translate
- Select text on any webpage, right-click, and translate instantly
- Auto-detects source language
- 32 target languages supported
- Works on native subtitles and the dual subtitle overlay

## Installation

1. Clone or download this repository
   ```
   git clone https://github.com/Paterboc/streamgrab-translate.git
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the cloned folder
6. The StreamGrab Translate icon will appear in your Chrome toolbar

No additional software, API keys, or configuration required.

## Usage

### Dual Subtitles

1. Go to any Netflix or YouTube video
2. Click the StreamGrab Translate icon in the toolbar
3. Open the **Subtitles** tab
4. Toggle **Dual subtitles** on
5. Select a **Secondary language** from the detected tracks
6. Adjust **Font size** if needed

The secondary subtitles appear below the native ones. On Netflix they're positioned at the bottom of the viewport; on YouTube they're anchored inside the video player so they scale with fullscreen.

#### Loading External Subtitle Files

1. Click **Browse** in the Subtitles tab
2. Select a `.srt`, `.vtt`, or `.ttml` file from your computer
3. The file is parsed and overlaid on the current video

This is useful for adding subtitles in languages not offered by the platform, or for using subtitle files downloaded from other sources.

### Downloading Media

1. Navigate to a YouTube video
2. Click the StreamGrab Translate icon
3. Open the **Downloads** tab
4. Available streams are listed by category:
   - **Subtitles** — download any detected subtitle track
   - **Video + Audio** — muxed streams (directly playable after download)
   - **Audio Only** — just the audio track
   - **Video Only** — just the video (no audio)
5. Click **Download** on any item

Stream detection happens automatically when the page loads. Media URLs are extracted directly from the page — nothing is proxied or re-encoded.

### Right-Click Translate

1. Select text on any webpage
2. Right-click and choose **Translate "[selected text]"**
3. A tooltip shows the translation and detected source language

Change the target language in the StreamGrab Translate popup under **Translate to**. The translate feature works independently on any website.

## Supported Sites

| Site | Dual Subs | Downloads | Translate |
|------|-----------|-----------|-----------|
| Netflix | Yes | Subtitles | Yes |
| YouTube | Yes | Video, Audio, Subtitles | Yes |
| Any website | — | — | Yes |

## Supported Subtitle Formats

- **TTML / DFXP** (Netflix default)
- **WebVTT** (YouTube default)
- **SRT** (common download format)

## Requirements

- Google Chrome or any Chromium-based browser (Edge, Brave, Arc, etc.)
- A Netflix subscription (for Netflix features)

## Permissions

| Permission | Purpose |
|------------|---------|
| storage | Saves language preferences and settings |
| activeTab | Accesses the current tab for subtitle overlay |
| contextMenus | Adds "Translate" to the right-click menu |
| scripting | Injects the translation script on demand |
| downloads | Triggers video/audio/subtitle file downloads |
| Host permissions | Netflix and YouTube domains for subtitle and media access; Google Translate API for translations |

## How It Works

StreamGrab Translate uses two content script "worlds" per supported site:

- **MAIN world** — intercepts the page's own data (Netflix manifest responses, YouTube player config) to extract subtitle track metadata and streaming URLs. No network requests are made; the extension reads what the site already loads.
- **ISOLATED world** — fetches the selected secondary subtitle file, parses it, and renders a synced overlay on the video element. Also relays detected media URLs to the service worker for the Downloads tab.

Subtitle timing is synced via `requestAnimationFrame` at ~4 Hz with `timeupdate` events as the primary driver. An auto-calibration system detects large desyncs (>1s sustained over 60s) and applies a one-time offset correction.

## License

MIT
