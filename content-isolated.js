// Function to perform initial scan
function performInitialScan() {
  // Forward the request to the main world content script
  window.postMessage({ 
    type: 'GRIFFEL_INSPECTOR_REQUEST',
    data: {
      action: 'findGriffelElements',
      sourceFilter: '',
      excludeFilter: '',
      selectedComponent: ''
    }
  }, '*');
  
  // Set up a one-time listener for the response
  const messageHandler = (event) => {
    if (event.data && event.data.type === 'GRIFFEL_INSPECTOR_RESPONSE') {
      window.removeEventListener('message', messageHandler);
      // Store the results
      chrome.storage.local.set({ 
        currentPageGriffelElements: event.data.data.elements,
        lastScan: new Date().toISOString()
      });
    }
  };
  
  window.addEventListener('message', messageHandler);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'findGriffelElements') {
    // Forward the request to the main world content script
    window.postMessage({ 
      type: 'GRIFFEL_INSPECTOR_REQUEST',
      data: {
        action: 'findGriffelElements',
        sourceFilter: request.sourceFilter,
        excludeFilter: request.excludeFilter,
        selectedComponent: request.selectedComponent
      }
    }, '*');
    
    // Set up a one-time listener for the response
    const messageHandler = (event) => {
      if (event.data && event.data.type === 'GRIFFEL_INSPECTOR_RESPONSE') {
        window.removeEventListener('message', messageHandler);
        sendResponse(event.data.data);
      }
    };
    
    window.addEventListener('message', messageHandler);
    return true; // Keep the message channel open for async response
  } else if (request.action === 'highlightGriffelElements') {
    // Forward the highlight request to the main world content script
    window.postMessage({ 
      type: 'GRIFFEL_INSPECTOR_REQUEST',
      data: {
        action: 'highlightGriffelElements',
        sourceFilter: request.sourceFilter || '',
        excludeFilter: request.excludeFilter || '',
        selectedComponent: request.selectedComponent || ''
      }
    }, '*');
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'highlightElement') {
    // Forward the element highlight request to the main world content script
    window.postMessage({
      type: 'GRIFFEL_INSPECTOR_REQUEST',
      data: {
        action: 'highlightElement',
        elementIndex: request.elementIndex,
        color: request.color
      }
    }, '*');
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'clearAllHighlights') {
    // Forward the clear all highlights request to the main world content script
    window.postMessage({
      type: 'GRIFFEL_INSPECTOR_REQUEST',
      data: { action: 'clearAllHighlights' }
    }, '*');
  }
});

// Run initial scan when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', performInitialScan);
} else {
  performInitialScan();
} 