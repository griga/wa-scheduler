# WA Scheduled Messages

A Chrome Extension (Manifest V3) that sends recurring messages to a WhatsApp Web group chat on a configurable daily schedule — no server required.

> **Warning:** Automating messages with this extension may violate [WhatsApp's Terms of Service](https://www.whatsapp.com/legal/terms-of-service). Sending unsolicited or high-frequency automated messages can result in your **account being temporarily or permanently banned** by WhatsApp. Use responsibly and only for messages that recipients have agreed to receive.

## Features

- Schedule one or more daily send times (e.g. `09:00`, `18:30`)
- Target any WhatsApp group **or personal chat** by exact chat name
- Persists schedule across browser restarts via `chrome.storage`
- Survives service-worker lifecycle restarts using `chrome.alarms`
- Configurable DOM selectors in case WhatsApp Web's markup changes

## Installation

1. Download [`extension.zip`](https://github.com/griga/wa-scheduler/releases/latest/download/extension.zip) from the latest release.
2. Unzip the file on your computer.
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the unzipped `extension` folder.

## How it works

```
Popup → background service worker → content script → WhatsApp Web DOM
```

1. **Popup** collects the group name, message, and schedule times, then sends a `scheduler:start` message to the background.
2. **Background service worker** validates input, saves state to `chrome.storage.local`, and registers a `chrome.alarms` alarm for the next scheduled time.
3. On each alarm, the background finds the active WhatsApp Web tab and dispatches a `whatsapp:send-message` message to the **content script**.
4. **Content script** automates the WhatsApp Web UI: navigates to the group, types the message, and clicks Send.

## Dev Requirements

- Google Chrome (or any Chromium-based browser)
- [Node.js](https://nodejs.org) ≥ 18 and [pnpm](https://pnpm.io)
- WhatsApp Web open in a tab while sends are scheduled

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm run watch      # incremental build with file watching
```

Load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Production build

```bash
pnpm run build
```

Output is placed in `dist/`. Load that folder as an unpacked extension.

## Code quality

```bash
pnpm run check      # lint + format (Biome)
pnpm run lint       # lint only
pnpm run format     # format only
```

## Configuration

### Schedule times

Enter one time per line in `HH:MM` (24-hour) format in the popup, e.g.:

```
08:00
13:30
20:00
```

### DOM selectors

WhatsApp Web uses generated class names that change over time. The popup exposes an **Advanced** section where each UI selector can be overridden without rebuilding the extension. Defaults are stored in the background service worker and can be updated live.

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist scheduler state across restarts |
| `alarms` | Fire sends at scheduled times |
| `tabs` | Find the active WhatsApp Web tab |
| `https://web.whatsapp.com/*` | Inject content script and interact with the page |

## Project structure

```
src/
  background/   # Service worker — scheduling logic, alarm handling
  content/      # Content script — WhatsApp Web DOM automation
  popup/        # Extension popup UI
  shared/       # Shared TypeScript types and message contracts
manifest.json
vite.config.mjs
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Message not sent | Ensure WhatsApp Web is open and logged in |
| "Group not found" error | Verify the group name matches exactly (case-sensitive) |
| Selectors stop working | Update the DOM selectors in the popup's Advanced section |
| Schedule not firing | Check that the extension has not been disabled; reload it |
