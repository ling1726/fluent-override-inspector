chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  chrome.storage.local.get(['isTracking'], function(result) {
    if (result.isTracking && changeInfo.status === 'complete') {
      // Store the page URL and timestamp
      const pageData = {
        url: tab.url,
        title: tab.title,
        timestamp: new Date().toISOString()
      };

      chrome.storage.local.get(['trackedPages'], function(data) {
        const trackedPages = data.trackedPages || [];
        trackedPages.push(pageData);
        chrome.storage.local.set({ trackedPages: trackedPages });
      });
    }
  });
}); 