// Clean up stored gain when a tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove("gain_" + tabId);
});
