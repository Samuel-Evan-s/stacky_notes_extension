// content.js — Floating Panel
//
// Chrome injects this script into every webpage you visit.
// It builds the sticky notes panel, handles all user interactions,
// and syncs notes to chrome.storage.sync.
//
// Wrapped in an IIFE (Immediately Invoked Function Expression) to avoid
// polluting the global scope of the host page with our variables.
console.log("Stacky Notes content script loaded");
(function () {

  // Guard: if the panel already exists on this page, don't inject a second one
  // This can happen if the script somehow runs twice
  if (document.getElementById("stickymind-root")) return;

  // ── State ──────────────────────────────────────────────────────────────────

  let notes = [];          // All notes loaded from chrome.storage.sync
  let panelVisible = false; // Tracks whether the panel is currently open
  let dragState = null;     // Holds drag offset while the user is dragging the panel
  let panelPos = { x: null, y: null }; // Last known panel position after a drag

  // ── Build DOM ──────────────────────────────────────────────────────────────
  // We create a container div and inject the panel HTML into it,
  // then append it to the page's body so it floats on top of everything.

  const root = document.createElement("div");
  root.id = "stickymind-root";
  root.innerHTML = `
    <div id="sm-panel" class="sm-panel sm-hidden">

      <!-- Header: shows the title and acts as the drag handle -->
      <div id="sm-header">
        <span id="sm-drag-handle">📝 Stacky Notes</span>
        <button id="sm-close-btn" title="Close">✕</button>
      </div>

      <!-- Input area: where the user types a new note -->
      <div id="sm-input-area">
        <textarea id="sm-input" placeholder="Quick note… (Enter to save, Shift+Enter for newline)" rows="3"></textarea>
        <button id="sm-add-btn">Add Note</button>
      </div>

      <!-- Notes list: today's notes are rendered here dynamically -->
      <div id="sm-notes-list"></div>

      <!-- Footer: note count and a button to clear today's notes -->
      <div id="sm-footer">
        <span id="sm-count">0 notes</span>
        <button id="sm-clear-btn">Clear Today</button>
      </div>

    </div>
  `;
  document.body.appendChild(root);

  // Grab references to the key DOM elements we'll interact with frequently
  const panel     = root.querySelector("#sm-panel");
  const input     = root.querySelector("#sm-input");
  const notesList = root.querySelector("#sm-notes-list");
  const countEl   = root.querySelector("#sm-count");

  // ── Load notes from storage ────────────────────────────────────────────────
  // On page load, pull existing notes from Chrome's synced storage
  // so the panel is populated even after a browser restart

  chrome.storage.sync.get("notes", ({ notes: stored = [] }) => {
    notes = stored;
    renderNotes();
  });

  // Listen for storage changes — if notes are updated in another tab
  // or on another device, re-render so the panel stays in sync
  chrome.storage.onChanged.addListener(({ notes: c }) => {
    if (c) { notes = c.newValue; renderNotes(); }
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  // Rebuilds the notes list in the DOM.
  // Only shows notes created today — older notes are stored but not displayed.

  function renderNotes() {
    const today = new Date().toDateString();
    const todayNotes = notes.filter(n => new Date(n.createdAt).toDateString() === today);

    notesList.innerHTML = todayNotes.length
      ? todayNotes.map(n => `
          <div class="sm-note ${n.pinned ? "sm-pinned" : ""}" data-id="${n.id}">

            <!-- Timestamp shown at the top of each note -->
            <div class="sm-note-meta">
              <span class="sm-time">${fmtTime(n.createdAt)}</span>
            </div>

            <!-- The note text — escaped to prevent XSS from user input -->
            <div class="sm-note-text">${escHtml(n.text)}</div>

            <!-- Per-note actions: pin to keep it highlighted, or delete -->
            <div class="sm-note-actions">
              <button class="sm-pin-btn" data-id="${n.id}" title="${n.pinned ? "Unpin" : "Pin"}">${n.pinned ? "📌" : "📍"}</button>
              <button class="sm-del-btn" data-id="${n.id}" title="Delete">🗑</button>
            </div>

          </div>`).join("")
      : `<p class="sm-empty">No notes yet today.</p>`;

    // Update the footer count
    countEl.textContent = `${todayNotes.length} note${todayNotes.length !== 1 ? "s" : ""} today`;
  }

  // ── Add note ───────────────────────────────────────────────────────────────
  // Creates a new note object and saves it to storage.
  // Rendering is triggered automatically by the storage.onChanged listener above.

  function addNote() {
    const text = input.value.trim();
    if (!text) return; // Don't save empty notes

    const note = {
      id: Date.now().toString(), // Simple unique ID based on timestamp
      text,
      createdAt: new Date().toISOString(),
      pinned: false
    };

    notes.unshift(note); // Add to the front so newest appears at the top
    chrome.storage.sync.set({ notes });
    input.value = ""; // Clear the input after saving
  }

  // Wire up the Add button
  root.querySelector("#sm-add-btn").addEventListener("click", addNote);

  // Allow Enter to save (Shift+Enter inserts a newline instead)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); }
  });

  // ── Delete / Pin ───────────────────────────────────────────────────────────
  // Single delegated listener on the list container handles both actions.
  // We read the note ID from the button's data-id attribute.

  notesList.addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!id) return; // Click was on the container, not a button

    if (e.target.classList.contains("sm-del-btn")) {
      // Remove the note with this ID from the array and save
      notes = notes.filter(n => n.id !== id);
      chrome.storage.sync.set({ notes });
    }

    if (e.target.classList.contains("sm-pin-btn")) {
      // Toggle the pinned flag on the matching note and save
      const n = notes.find(n => n.id === id);
      if (n) { n.pinned = !n.pinned; chrome.storage.sync.set({ notes }); }
    }
  });

  // ── Clear today ────────────────────────────────────────────────────────────
  // Removes all notes created today, but keeps older notes intact in storage

  root.querySelector("#sm-clear-btn").addEventListener("click", () => {
    const today = new Date().toDateString();
    notes = notes.filter(n => new Date(n.createdAt).toDateString() !== today);
    chrome.storage.sync.set({ notes });
  });

  // ── Toggle panel ──────────────────────────────────────────────────────────
  // Opens or closes the panel. Called by both the close button
  // and the message listener below (which receives signals from background.js).

  function togglePanel() {
    panelVisible = !panelVisible;
    panel.classList.toggle("sm-hidden", !panelVisible);

    if (panelVisible) {
      // On first open, position defaults to bottom-right corner via CSS.
      // After a drag, panelPos will have coordinates — we leave those in place.
      if (panelPos.x === null) {
        panel.style.right = "20px";
        panel.style.bottom = "20px";
      }
      input.focus(); // Ready for immediate typing
    }
  }

  // Close button inside the panel header
  root.querySelector("#sm-close-btn").addEventListener("click", togglePanel);

  // Listen for TOGGLE_PANEL messages sent by background.js
  // (triggered by Alt+S keyboard shortcut or toolbar icon click)
  chrome.runtime.onMessage.addListener((msg) => {
    console.log("content received", msg);
    if (msg.type === "TOGGLE_PANEL") togglePanel();
  });

  // ── Drag to reposition ────────────────────────────────────────────────────
  // Lets the user drag the panel anywhere on the screen by its header.
  // We track the offset between the mouse and the panel's top-left corner
  // so the panel doesn't jump when the drag starts.

  const handle = root.querySelector("#sm-header");

  handle.addEventListener("mousedown", (e) => {
    const rect = panel.getBoundingClientRect();
    // Offset = where inside the panel the user clicked
    dragState = { startX: e.clientX - rect.left, startY: e.clientY - rect.top };
    // Switch from CSS right/bottom positioning to left/top so we can move freely
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", onDragEnd);
    e.preventDefault(); // Prevent text selection while dragging
  });

  function onDrag(e) {
    if (!dragState) return;
    const x = e.clientX - dragState.startX;
    const y = e.clientY - dragState.startY;
    // Clamp to 0 so panel can't be dragged off-screen to the top-left
    panel.style.left = `${Math.max(0, x)}px`;
    panel.style.top  = `${Math.max(0, y)}px`;
    panelPos = { x, y }; // Remember position for next open
  }

  function onDragEnd() {
    dragState = null;
    // Clean up the listeners — only needed while actively dragging
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", onDragEnd);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Escapes user input before inserting it into innerHTML
  // Prevents XSS — e.g. a note containing <script> won't execute
  function escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Formats an ISO timestamp into a readable HH:MM time string
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

})();
