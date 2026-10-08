# Stacky Notes

A draggable floating sticky-notes panel that appears on any webpage. Notes are saved with `chrome.storage.sync`, so they persist across restarts and follow you across signed-in browsers.

- Toggle the panel with **Alt+S** or the toolbar icon.
- Add, pin and delete notes; drag the panel anywhere.
- Today's notes are shown; older notes stay in storage.

## Install

### Chrome / Edge (from a release zip)
1. Download `stacky-notes-x.y.z.zip` from the [Releases](../../releases) page and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

### Firefox (temporary)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.

Temporary add-ons are removed when Firefox restarts. For a permanent install, publish through [addons.mozilla.org](https://addons.mozilla.org/developers/).

## Development

No build step. Load the repo root unpacked and reload the extension after edits (refresh open tabs after changing `content.js` or `content.css`).

To build a store/release zip:

```sh
zip -r stacky-notes-1.0.0.zip manifest.json background.js content.js content.css popup.html popup.js icons
```

## Privacy

Stacky Notes stores your notes only in your browser's sync storage. It has no servers, no analytics, and sends no data anywhere.
