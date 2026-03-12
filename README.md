# Netflix Dual Subtitles

A Chrome extension that displays a second subtitle language on Netflix and lets you right-click translate selected text on any website.

## Features

- **Dual subtitles** — overlay a secondary subtitle track below Netflix's native subtitles
- **Auto-sync** — automatically calibrates subtitle timing using Netflix's native subs as reference, recalibrates on seek, and runs periodic re-checks
- **Right-click translate** — select any text on any webpage, right-click, and choose "Translate" to see an instant translation tooltip
- **Auto-detect source language** — the translation automatically detects the source language
- **Configurable target language** — choose from 32 target languages for translations
- **Adjustable font size** — small, medium, or large secondary subtitles

## Installation

1. Clone or download this repository
   ```
   git clone https://github.com/Paterboc/netflix-dual-subs.git
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `netflix-dual-subs` folder
6. The extension icon will appear in your Chrome toolbar

## Usage

### Dual Subtitles

1. Navigate to any Netflix title and start playback
2. Click the extension icon in the toolbar
3. Toggle **Dual subtitles** on
4. Select your desired **Secondary language** from the dropdown
5. Choose a **Font size** (S / M / L)

The secondary subtitles will appear below Netflix's native subtitles. Timing is automatically synced — if you seek or skip around, the extension recalibrates on its own.

### Right-Click Translate

1. On any webpage, select some text
2. Right-click and choose **Translate "[selected text]"**
3. A tooltip appears showing the translation and detected source language

You can change the target language in the extension popup under **Translate to**. The translate feature can be toggled on/off independently of dual subtitles.

## Requirements

- Google Chrome (or any Chromium-based browser)
- A Netflix subscription

## Permissions

- **storage** — saves your language preferences and settings
- **activeTab** — accesses the current tab for subtitle overlay and translation
- **contextMenus** — adds the "Translate" option to the right-click menu
- **scripting** — injects the translation script on demand
- **Host permissions** — Netflix domains (for subtitle fetching) and Google Translate API (for translations)
