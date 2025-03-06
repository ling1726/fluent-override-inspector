document.addEventListener('DOMContentLoaded', function () {
  console.log('Popup DOM loaded');

  const scanButton = document.getElementById('scanGriffel');
  const highlightButton = document.getElementById('highlightGriffel');
  const clearHighlightsButton = document.getElementById('clearHighlights');
  const sourceFilterInput = document.getElementById('sourceFilter');
  const excludeFilterInput = document.getElementById('excludeFilter');
  const componentSelect = document.getElementById('componentSelect');
  const statusDiv = document.getElementById('status');
  const scanInfoDiv = document.getElementById('scanInfo');
  const griffelListDiv = document.getElementById('griffelList');

  // Load Fluent UI components
  fetch(chrome.runtime.getURL('classnames.json'))
    .then(response => response.json())
    .then(classNames => {
      const components = Object.keys(classNames);
      components.forEach(component => {
        const option = document.createElement('option');
        option.value = component;
        option.textContent = component;
        componentSelect.appendChild(option);
      });

      chrome.storage.local.get('selectedComponent', function (data) {
        if (data.selectedComponent) {
          componentSelect.value = data.selectedComponent;
        }
      });
    })
    .catch(error => {
      console.error('Error loading Fluent UI components:', error);
    });

  // Load existing data
  chrome.storage.local.get([
    'currentPageGriffelElements',
    'lastScan',
    'sourceFilter',
    'excludeFilter',
    'highlightedElementIndex',
    'selectedComponent'
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
  sourceFilterInput.addEventListener('input', function () {
    chrome.storage.local.set({ sourceFilter: sourceFilterInput.value });
  });

  excludeFilterInput.addEventListener('input', function () {
    chrome.storage.local.set({ excludeFilter: excludeFilterInput.value });
  });

  // Save selected component when it changes
  componentSelect.addEventListener('change', function () {
    chrome.storage.local.set({ selectedComponent: componentSelect.value });
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
      const selectedComponent = componentSelect.value;

      console.log('Sending message to content script with filters:', { sourceFilter, excludeFilter, selectedComponent });

      chrome.tabs.sendMessage(activeTab.id, {
        action: 'clearAllHighlights'
      }, function () {
        chrome.tabs.sendMessage(activeTab.id, {
          action: 'findGriffelElements',
          sourceFilter: sourceFilter,
          excludeFilter: excludeFilter,
          selectedComponent: selectedComponent
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
            displayGriffelElements(response.elements);
            chrome.storage.local.set({
              currentPageGriffelElements: response.elements,
              lastScan: new Date().toISOString()
            });
            scanInfoDiv.textContent = `Last scan: ${new Date().toLocaleString()}`;
            showStatus(`Found ${response.elements.length} Griffel elements${getFilterStatus(sourceFilter, excludeFilter, selectedComponent)}`, 'success');
          } else if (response && response.error) {
            console.error('Error from content script:', response.error);
            showStatus(`Error: ${response.error}`, 'error');
          } else {
            console.log('No elements found');
            showStatus('No Griffel elements found. Make sure you are on a page that uses Griffel.', 'error');
          }
        });
      });

      // Send message to content script

    });
  });

  highlightButton.addEventListener('click', function () {
    highlightButton.disabled = true;
    showStatus('Highlighting Griffel elements...', 'info');

    // Toggle button text immediately
    highlightButton.textContent = 'Highlight All';

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
      const selectedComponent = componentSelect.value;

      // Send message to content script
      chrome.tabs.sendMessage(activeTab.id, {
        action: 'highlightGriffelElements',
        sourceFilter: sourceFilter,
        excludeFilter: excludeFilter,
        selectedComponent: selectedComponent
      }, function (response) {
        highlightButton.disabled = false;

        if (chrome.runtime.lastError) {
          showStatus('Error: Could not connect to the page. Make sure you are on a valid webpage.', 'error');
          return;
        }

        if (response && response.success) {
          showStatus(`Griffel elements${getFilterStatus(sourceFilter, excludeFilter, selectedComponent)} highlighted on the page`, 'success');
        } else {
          showStatus('Error highlighting Griffel elements', 'error');
        }
      });
    });
  });

  // Add clear highlights button handler
  clearHighlightsButton.addEventListener('click', function () {
    clearHighlightsButton.disabled = true;
    showStatus('Clearing highlights...', 'info');

    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]) {
        showStatus('No active tab found', 'error');
        clearHighlightsButton.disabled = false;
        return;
      }

      const activeTab = tabs[0];

      // Reset highlight button text
      highlightButton.textContent = 'Highlight All';

      // Send message to content script
      chrome.tabs.sendMessage(activeTab.id, {
        action: 'clearAllHighlights'
      }, function (response) {
        clearHighlightsButton.disabled = false;

        if (chrome.runtime.lastError) {
          showStatus('Error: Could not connect to the page. Make sure you are on a valid webpage.', 'error');
          return;
        }

        // Clear highlighted index from storage
        chrome.storage.local.set({ highlightedElementIndex: null });

        // Update any highlighted buttons in the list
        const highlightButtons = document.querySelectorAll('.griffel-item button');
        highlightButtons.forEach(btn => {
          btn.textContent = 'Highlight';
        });

        showStatus('All highlights cleared', 'success');
      });
    });
  });

  function getFilterStatus(sourceFilter, excludeFilter, selectedComponent) {
    const parts = [];
    if (sourceFilter) {
      parts.push(`matching "${sourceFilter}"`);
    }
    if (excludeFilter) {
      parts.push(`excluding "${excludeFilter}"`);
    }
    if (selectedComponent) {
      parts.push(`component "${selectedComponent}"`);
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

      // Filter classes to only include those starting with 'fui-'
      const fuiClasses = element.element.className.split(' ')
        .filter(className => className.startsWith('fui-'))
        .join(' ');

      const elementInfo = document.createElement('div');
      elementInfo.textContent = `Element ${index + 1}: ${element.element.tagName.toLowerCase()}`;

      // Add highlight button
      const highlightButton = document.createElement('button');
      highlightButton.textContent = 'Highlight';
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
          highlightButton.textContent = 'Highlight';
          chrome.storage.local.set({ highlightedElementIndex: index });

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

      // Add toggle button for CSS rules
      const toggleButton = document.createElement('button');
      toggleButton.textContent = 'Show CSS Rules';
      toggleButton.style.marginLeft = '8px';
      toggleButton.style.padding = '2px 8px';
      toggleButton.style.fontSize = '0.8em';
      toggleButton.style.cursor = 'pointer';
      toggleButton.style.backgroundColor = '#f5f5f5';
      toggleButton.style.border = '1px solid #ddd';
      toggleButton.style.borderRadius = '4px';
      toggleButton.style.color = '#333';

      let cssRulesVisible = false;
      let cssRulesContainer = null;

      toggleButton.addEventListener('click', function() {
        if (cssRulesVisible) {
          if (cssRulesContainer) {
            cssRulesContainer.remove();
            cssRulesContainer = null;
          }
          toggleButton.textContent = 'Show CSS Rules';
        } else {
          cssRulesContainer = displayElementInfo(element);
          itemDiv.appendChild(cssRulesContainer);
          toggleButton.textContent = 'Hide CSS Rules';
        }
        cssRulesVisible = !cssRulesVisible;
      });

      elementInfo.appendChild(toggleButton);

      const attributesDiv = document.createElement('div');
      attributesDiv.className = 'griffel-attributes';

      // Display Griffel-specific attributes
      const attributes = [];
      if (element.attributes.class) {
        attributes.push(`Class: ${fuiClasses}`);
      }

      attributesDiv.textContent = attributes.join(' | ');

      itemDiv.appendChild(elementInfo);
      itemDiv.appendChild(attributesDiv);
      griffelListDiv.appendChild(itemDiv);
    });
  }

  function displayCSSRules(info) {
    const container = document.createElement('div');
    container.className = 'css-rules-container';

    // Collect all rules from the tree
    function collectAllRules(sequence) {
      let allRules = [];
      
      if (!sequence) return allRules;

      // Process children first (DFS)
      if (sequence.children && sequence.children.length > 0) {
        sequence.children.forEach(child => {
          allRules = allRules.concat(collectAllRules(child));
        });
      }

      // Then process current node's rules
      if (sequence.rules && sequence.slot !== 'makeResetStyles()') {
        sequence.debugClassNames.filter(x => Boolean(x.className)).forEach(({ className }) => {
          if (sequence.rules[className]) {
            // Extract just the CSS properties from the rule
            const cssRule = sequence.rules[className];
            const properties = cssRule.substring(cssRule.indexOf('{') + 1, cssRule.lastIndexOf('}')).trim();
            
            allRules.push({
              properties,
              slot: sequence.slot || 'unknown',
              sourceURL: sequence.sourceURL
            });
          }
        });
      }

      return allRules;
    }

    const allRules = collectAllRules(info);

    // Use Maps to preserve insertion order and track source URLs
    const rulesBySlot = new Map();
    const slotToSourceURL = new Map();
    
    // Get the exclude filter value
    const excludeFilter = document.getElementById('excludeFilter').value.trim();
    
    // Group rules by slot while preserving order of first encounter
    allRules.forEach(rule => {
      // Skip slots whose source URL matches the exclude filter
      if (excludeFilter && rule.sourceURL && rule.sourceURL.includes(excludeFilter)) {
        return;
      }

      if (!rulesBySlot.has(rule.slot)) {
        rulesBySlot.set(rule.slot, []);
        if (rule.sourceURL) {
          slotToSourceURL.set(rule.slot, rule.sourceURL);
        }
      }
      rulesBySlot.get(rule.slot).push(rule);
    });

    // Create the flattened display using Map entries to preserve order
    rulesBySlot.forEach((rules, slot) => {
      const slotDiv = document.createElement('div');
      slotDiv.className = 'slot-container';
      
      const slotHeader = document.createElement('div');
      slotHeader.className = 'slot-header';
      
      // Create slot name text
      const slotName = document.createElement('span');
      slotName.textContent = `Slot: ${slot}`;
      slotHeader.appendChild(slotName);

      // Add info button with tooltip if sourceURL exists
      const sourceURL = slotToSourceURL.get(slot);
      if (sourceURL) {
        const infoButton = document.createElement('button');
        infoButton.className = 'info-button';
        infoButton.textContent = 'Source';
        infoButton.title = `Source: ${sourceURL}`;
        slotHeader.appendChild(infoButton);
      }

      slotDiv.appendChild(slotHeader);

      const rulesDiv = document.createElement('pre');
      rulesDiv.className = 'css-rules';
      
      // Combine all properties for this slot
      const combinedProperties = rules.map(rule => rule.properties).join('\n');
      rulesDiv.textContent = combinedProperties;
      
      slotDiv.appendChild(rulesDiv);
      container.appendChild(slotDiv);
    });

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .css-rules-container {
        font-family: system-ui, -apple-system, sans-serif;
        padding: 10px;
      }
      .slot-container {
        margin-bottom: 20px;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
      }
      .slot-header {
        font-weight: bold;
        color: #333;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 1px solid #eee;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .info-button {
        margin-left: 8px;
        padding: 2px 8px;
        font-size: 0.8em;
        cursor: help;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        color: #333;
      }
      .css-rules {
        background: #f5f5f5;
        padding: 8px;
        border-radius: 4px;
        margin: 0;
        white-space: pre-wrap;
        font-family: monospace;
        line-height: 1.4;
      }
    `;
    container.appendChild(style);

    return container;
  }

  // Update the displayElementInfo function to use the new displayCSSRules function
  function displayElementInfo(elementInfo) {
    const container = document.createElement('div');
    container.className = 'element-info';

    // Add basic element info
    const basicInfo = document.createElement('div');
    basicInfo.className = 'basic-info';
    basicInfo.innerHTML = `
      ${elementInfo.element.id ? `<div>ID: ${elementInfo.element.id}</div>` : ''}
    `;
    container.appendChild(basicInfo);

    // Add CSS rules if Griffel info is available
    if (elementInfo.info) {
      const rulesContainer = displayCSSRules(elementInfo.info);
      container.appendChild(rulesContainer);
    }

    return container;
  }
}); 