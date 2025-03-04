document.addEventListener('DOMContentLoaded', function () {
  console.log('Popup DOM loaded');

  const scanButton = document.getElementById('scanGriffel');
  const highlightButton = document.getElementById('highlightGriffel');
  const sourceFilterInput = document.getElementById('sourceFilter');
  const excludeFilterInput = document.getElementById('excludeFilter');
  const statusDiv = document.getElementById('status');
  const scanInfoDiv = document.getElementById('scanInfo');
  const griffelListDiv = document.getElementById('griffelList');

  // Load existing data
  chrome.storage.local.get([
    'currentPageGriffelElements',
    'lastScan',
    'sourceFilter',
    'excludeFilter',
    'highlightedElementIndex'
  ], function (data) {
    console.log('Loaded storage data:', data);
    
    // Restore filter values
    if (data.sourceFilter) {
      sourceFilterInput.value = data.sourceFilter;
    }
    if (data.excludeFilter) {
      excludeFilterInput.value = data.excludeFilter;
    }
    
    // Restore scan results
    if (data.currentPageGriffelElements) {
      displayGriffelElements(data.currentPageGriffelElements, data.highlightedElementIndex);
      if (data.lastScan) {
        scanInfoDiv.textContent = `Last scan: ${new Date(data.lastScan).toLocaleString()}`;
      }
    }
  });

  // Save filter values when they change
  sourceFilterInput.addEventListener('input', function() {
    chrome.storage.local.set({ sourceFilter: sourceFilterInput.value });
  });

  excludeFilterInput.addEventListener('input', function() {
    chrome.storage.local.set({ excludeFilter: excludeFilterInput.value });
  });

  scanButton.addEventListener('click', function () {
    console.log('Scan button clicked');
    scanButton.disabled = true;
    showStatus('Scanning for Griffel elements...', 'info');

    // Clear highlighted state
    chrome.storage.local.set({ highlightedElementIndex: null });

    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      console.log('Active tab:', tabs[0]);
      if (!tabs[0]) {
        showStatus('No active tab found', 'error');
        scanButton.disabled = false;
        return;
      }

      const activeTab = tabs[0];
      const sourceFilter = sourceFilterInput.value.trim();
      const excludeFilter = excludeFilterInput.value.trim();

      console.log('Sending message to content script with filters:', { sourceFilter, excludeFilter });

      chrome.tabs.sendMessage(activeTab.id, {
        action: 'clearAllHighlights'
      });

      // Send message to content script
      chrome.tabs.sendMessage(activeTab.id, {
        action: 'findGriffelElements',
        sourceFilter: sourceFilter,
        excludeFilter: excludeFilter
      }, function (response) {
        console.log('Received response from content script:', response);
        scanButton.disabled = false;

        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          showStatus('Error: Could not connect to the page. Make sure you are on a valid webpage.', 'error');
          return;
        }

        if (response && response.elements) {
          console.log('Found elements:', response.elements);
          displayGriffelElements(response.elements); // No highlightedIndex passed, so all buttons will be "Highlight"
          chrome.storage.local.set({
            currentPageGriffelElements: response.elements,
            lastScan: new Date().toISOString()
          });
          scanInfoDiv.textContent = `Last scan: ${new Date().toLocaleString()}`;
          showStatus(`Found ${response.elements.length} Griffel elements${getFilterStatus(sourceFilter, excludeFilter)}`, 'success');
        } else if (response && response.error) {
          console.error('Error from content script:', response.error);
          showStatus(`Error: ${response.error}`, 'error');
        } else {
          console.log('No elements found');
          showStatus('No Griffel elements found. Make sure you are on a page that uses Griffel.', 'error');
        }
      });
    });
  });

  highlightButton.addEventListener('click', function () {
    highlightButton.disabled = true;
    showStatus('Highlighting Griffel elements...', 'info');

    // Toggle button text immediately
    highlightButton.textContent = highlightButton.textContent === 'Highlight All' ? 'Unhighlight All' : 'Highlight All';

    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]) {
        showStatus('No active tab found', 'error');
        highlightButton.disabled = false;
        return;
      }

      const activeTab = tabs[0];
      const sourceFilter = sourceFilterInput.value.trim();
      const excludeFilter = excludeFilterInput.value.trim();

      // Send message to content script
      chrome.tabs.sendMessage(activeTab.id, {
        action: 'highlightGriffelElements',
        sourceFilter: sourceFilter,
        excludeFilter: excludeFilter
      }, function (response) {
        highlightButton.disabled = false;

        if (chrome.runtime.lastError) {
          showStatus('Error: Could not connect to the page. Make sure you are on a valid webpage.', 'error');
          return;
        }

        if (response && response.success) {
          showStatus(`Griffel elements${getFilterStatus(sourceFilter, excludeFilter)} highlighted on the page`, 'success');
        } else {
          showStatus('Error highlighting Griffel elements', 'error');
        }
      });
    });
  });

  function getFilterStatus(sourceFilter, excludeFilter) {
    const parts = [];
    if (sourceFilter) {
      parts.push(`matching "${sourceFilter}"`);
    }
    if (excludeFilter) {
      parts.push(`excluding "${excludeFilter}"`);
    }
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }

  function displayGriffelElements(elements, highlightedIndex = null) {
    console.log('Displaying elements:', elements);
    griffelListDiv.innerHTML = '';

    if (!elements || elements.length === 0) {
      griffelListDiv.innerHTML = '<div class="griffel-item">No Griffel elements found on this page</div>';
      return;
    }

    // Create an array to store all highlight buttons
    const highlightButtons = [];

    elements.forEach((element, index) => {
      console.log(`Processing element ${index + 1}:`, element);
      const itemDiv = document.createElement('div');
      itemDiv.className = 'griffel-item';

      const elementInfo = document.createElement('div');
      elementInfo.textContent = `Element ${index + 1}: ${element.element.tagName.toLowerCase()}`;
      if (element.element.id) {
        elementInfo.textContent += ` (ID: ${element.element.id})`;
      }

      // Add highlight button
      const highlightButton = document.createElement('button');
      highlightButton.textContent = highlightedIndex === index ? 'Unhighlight' : 'Highlight';
      highlightButton.style.marginLeft = '8px';
      highlightButton.style.padding = '2px 8px';
      highlightButton.style.fontSize = '0.8em';
      highlightButton.style.cursor = 'pointer';
      highlightButton.style.backgroundColor = '#e3f2fd';
      highlightButton.style.border = '1px solid #bbdefb';
      highlightButton.style.borderRadius = '4px';
      highlightButton.style.color = '#1565c0';

      // Add this button to our array
      highlightButtons.push(highlightButton);

      // Generate a unique color for this element using golden ratio
      const hue = (index * 137.5) % 360;
      const color = `hsl(${hue}, 70%, 80%)`;

      highlightButton.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (!tabs[0]) return;

          // Toggle button text immediately
          highlightButton.textContent = highlightButton.textContent === 'Highlight' ? 'Unhighlight' : 'Highlight';

          // If this button is being highlighted, untoggle all other buttons
          if (highlightButton.textContent === 'Unhighlight') {
            highlightButtons.forEach(btn => {
              if (btn !== highlightButton && btn.textContent === 'Unhighlight') {
                btn.textContent = 'Highlight';
              }
            });
            // Save the highlighted index
            chrome.storage.local.set({ highlightedElementIndex: index });
          } else {
            // Clear the highlighted index
            chrome.storage.local.set({ highlightedElementIndex: null });
          }

          // Send message to content script through the isolated world
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'GRIFFEL_INSPECTOR_REQUEST',
            action: 'highlightElement',
            elementIndex: index,
            color: color
          });
        });
      });

      elementInfo.appendChild(highlightButton);

      const attributesDiv = document.createElement('div');
      attributesDiv.className = 'griffel-attributes';

      // Display Griffel-specific attributes
      const attributes = [];
      if (element.attributes.class) {
        attributes.push(`Class: ${element.attributes.class}`);
      }
      if (element.attributes.dataAttributes.length > 0) {
        attributes.push('Data attributes: ' + element.attributes.dataAttributes
          .map(attr => `${attr.name}: ${attr.value}`)
          .join(', '));
      }

      attributesDiv.textContent = attributes.join(' | ');

      itemDiv.appendChild(elementInfo);
      itemDiv.appendChild(attributesDiv);
      griffelListDiv.appendChild(itemDiv);
    });
  }
}); 