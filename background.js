// background.js — Service Worker
//
// Runs in the background, independently of any webpage.
// Its only job right now is to listen for the keyboard shortcut
// and forward a "toggle" message to the active tab's content script.

chrome.commands.onCommand.addListener(async (cmd) => {
  // Guard: only act on our specific command, ignore anything else
  if (cmd !== "toggle-panel") return;

  // Find the tab the user is currently looking at
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Guard: if no active tab found, do nothing
  if (!tab?.id) return;

  // Send a message to content.js running inside that tab
  // content.js listens for this and toggles the panel's visibility
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
});
