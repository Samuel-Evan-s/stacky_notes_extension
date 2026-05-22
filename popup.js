document.getElementById("open-btn").addEventListener("click", async () => {
    // Get the tab the user is currently viewing
    console.log("Button clicked");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("active tab", tab);
    // Send a toggle message to that tab's content script
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
    console.log("message sent");

    // Close the popup — the panel is now open on the page
    // window.close();
});
