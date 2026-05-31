# Auto Blocker 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/release/onedooge/x-auto-blocker)](https://github.com/onedooge/x-auto-blocker/releases)

**Language**: English | [中文](README.md)

A browser extension that automatically detects and blocks inappropriate content on **X (Twitter) and YouTube** based on user-defined keywords.

---

## Dual-Platform Support

| Platform | Detection Scope | Action on Match |
|----------|-----------------|-----------------|
| **𝕏 X / Twitter** | Tweet text + username | First hide locally; after a threshold of triggers within 24h, escalate to permanent account block via X's API |
| **▶ YouTube** | Video title + channel name | Hide videos locally (YouTube has no public block-channel API) |

Switch platforms via the toggle at the top of the popup. Each platform maintains **independent** keywords, whitelists, and history.

---

## Features (by Tab Order)

### ⚙️ Settings

- **X**: Configurable "Block Threshold" (1–99, default 10)
  - Matched tweets are hidden locally (no effect on X servers; refresh restores them)
  - When the same account triggers the threshold within 24h, the account is permanently blocked via X
- **YouTube**: Local hide only, no threshold mechanism

| Action | Scope | Reversible |
|--------|-------|------------|
| 🟡 Hide | Local browser only | Restored on refresh / reinstall |
| 🔴 Block (X only) | Calls X's block API | Must be undone manually in X settings |

**Data Backup**: The "⬇️ Full Backup / ⬆️ Full Restore" buttons at the bottom package **both platforms'** data into a JSON file. Useful for switching browsers, upgrading the extension, or syncing across devices. Import uses smart merge (dedupe + union for keywords/whitelist, dedupe by id for records).

### 🔑 Keywords

- Supports Chinese and English, case-insensitive
- 3-column grid layout, newest at top
- Per-platform export / import
- X matches tweet text and username; YouTube matches video title and channel name
- X auto-translated text is skipped for keyword matching; original Chinese posts still match normally

### 🛡️ Whitelist

Accounts / channels in the whitelist are **never** hidden or blocked, even if they trigger keywords.

### 🚫 Blocked (X only)

History of accounts blocked on X. Click to open the corresponding tweet. Hidden on YouTube tab.

### 👁️ Hidden

History of locally-hidden content (X tweets / YouTube videos). On X, each entry shows a trigger-count progress bar so you can predict which accounts are close to being escalated to a block.

---

## Installation (Chrome / Edge)

1. Download the latest zip from [Releases](https://github.com/onedooge/x-auto-blocker/releases) and unzip (or clone the whole repo)
2. Open `chrome://extensions` or `edge://extensions` in your browser
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the unzipped `x-auto-blocker` folder

---

## Usage

1. Open x.com or youtube.com
2. Click the extension icon in the browser toolbar
3. Switch platform (X / YouTube) at the top of the popup
4. Add keywords on the Keywords tab
5. Refresh the target page — matching content will be hidden automatically

---

## Notes

- Blocking logic depends on the DOM structure of X / YouTube. Site redesigns may require selector updates.
- For X, start with a higher threshold (e.g. 20) and lower it after observing for a while.
- All data lives in the browser's `chrome.storage.local`. Switching browsers or uninstalling the extension wipes the data — use "Full Backup" regularly.
- When upgrading the extension, **do not uninstall and reinstall**. Replace the source files and click the 🔄 reload button on `edge://extensions` instead — your data stays intact.
- Since 1.2.1, maintenance continues through Codex after the Claude account became unavailable, adding X auto-translation filtering.

---

## File Structure

```
x-auto-blocker/
├── manifest.json        # Extension manifest
├── content.js           # X logic (detect + hide + block)
├── content_youtube.js   # YouTube logic (detect + hide)
├── popup.html           # Popup UI
├── popup.js             # Popup logic
├── icons/               # Icons
├── LICENSE              # MIT License
├── README.md            # 中文文档
└── README.en.md         # English docs (this file)
```

---

## License

[MIT License](LICENSE) © 2026 [onedooge](https://github.com/onedooge)

Free to use, modify, and redistribute, commercial or otherwise — just retain the copyright notice.
