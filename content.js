// Function to collect all source URLs from a sequence and its children
function collectSourceURLs(sequence) {
  if (!sequence) return [];
  
  const urls = [];
  
  // Add current sequence's sourceURL if it exists
  if (sequence.sourceURL) {
    urls.push(sequence.sourceURL);
  }
  
  // Collect URLs from children
  if (sequence.children) {
    sequence.children.forEach(child => {
      if (child.sourceURL) {
        urls.push(...collectSourceURLs(child));
      }
    });
  }
  
  return urls;
}

// Function to check if any sequence in the tree has a matching source URL
function hasMatchingSourceURL(sequence, sourceFilter, excludeFilter) {
  if (!sequence) return false;
  
  // If no filters are active, include all elements
  if (!sourceFilter && !excludeFilter) {
    return true;
  }
  
  // Collect all source URLs from the sequence and its children
  const sourceURLs = collectSourceURLs(sequence);
  
  // If there are no source URLs, return false
  if (sourceURLs.length === 0) {
    return false;
  }
  
  // Check if any URL matches the exclude filter
  if (excludeFilter) {
    const hasExcludedURL = sourceURLs.some(url => 
      url.toLowerCase().includes(excludeFilter.toLowerCase())
    );
    if (hasExcludedURL) {
      return false;
    }
  }
  
  // Check if any URL matches the include filter
  if (sourceFilter) {
    return sourceURLs.some(url => 
      url.toLowerCase().includes(sourceFilter.toLowerCase())
    );
  }
  
  // If we have no include filter but have source URLs, return true
  return true;
}

// Function to find Griffel elements
function findGriffelElements(sourceFilter, excludeFilter) {
  try {
    const griffelElements = [];
    
    // Check if Griffel devtools is available
    if (typeof window.__GRIFFEL_DEVTOOLS__ === 'undefined') {
      console.log('Griffel devtools not available');
      return griffelElements;
    }

    // Remove any existing data attributes from previous scans
    document.querySelectorAll('[data-griffel-index]').forEach(el => {
      el.removeAttribute('data-griffel-index');
    });

    // Get all elements that can be inspected with Griffel devtools
    const elements = document.querySelectorAll('*');
    
    elements.forEach(element => {
      try {
        // Use Griffel devtools to get element info
        const info = window.__GRIFFEL_DEVTOOLS__.getInfo(element);
        
        if (info) {
          // Check if any sequence in the tree has a matching source URL
          const hasMatchingSource = hasMatchingSourceURL(info, sourceFilter, excludeFilter);
          
          if (hasMatchingSource) {
            // Add a data attribute to identify this element
            const index = griffelElements.length;
            element.setAttribute('data-griffel-index', index.toString());
            
            griffelElements.push({
              element: {
                tagName: element.tagName,
                className: element.className,
                id: element.id,
                index: index
              },
              type: 'Griffel Element',
              info: info,
              attributes: {
                class: element.className,
                dataAttributes: Array.from(element.attributes)
                  .filter(attr => attr.name.startsWith('data-'))
                  .map(attr => ({ name: attr.name, value: attr.value }))
              }
            });
          }
        }
      } catch (elementError) {
        console.error('Error processing element:', elementError);
      }
    });
    
    return griffelElements;
  } catch (error) {
    console.error('Error in findGriffelElements:', error);
    return [];
  }
}

// Store the currently highlighted elements
let highlightedElements = new Map();
let isHighlightAllActive = false;
let stylesInitialized = false;

// Function to initialize highlight styles
function initializeHighlightStyles() {
  if (!stylesInitialized) {
    const style = document.createElement('style');
    style.id = 'griffel-highlight-style';
    style.textContent = `
      [data-griffel-highlight="all"] {
        outline: 2px solid red !important;
        outline-offset: 2px !important;
        position: relative;
        z-index: 10000;
      }
      [data-griffel-highlight="all"]::before {
        content: 'Griffel';
        position: absolute;
        top: -20px;
        left: 0;
        background: red;
        color: white;
        padding: 2px 4px;
        font-size: 12px;
        border-radius: 2px;
        z-index: 10001;
      }
      /* Individual element highlight takes precedence */
      [data-griffel-highlight="single"] {
        outline: 2px solid purple !important;
        outline-offset: 2px !important;
        position: relative;
        z-index: 10002;
      }
      [data-griffel-highlight="single"]::before {
        content: attr(data-griffel-label);
        position: absolute;
        top: -20px;
        left: 0;
        background: purple;
        color: white;
        padding: 2px 4px;
        font-size: 12px;
        border-radius: 2px;
        z-index: 10003;
      }
      /* Combined highlight styles */
      [data-griffel-highlight="all"][data-griffel-highlight="single"] {
        outline: 2px solid purple !important;
        outline-offset: 2px !important;
        position: relative;
        z-index: 10002;
      }
      [data-griffel-highlight="all"][data-griffel-highlight="single"]::before {
        content: attr(data-griffel-label);
        position: absolute;
        top: -20px;
        left: 0;
        background: purple;
        color: white;
        padding: 2px 4px;
        font-size: 12px;
        border-radius: 2px;
        z-index: 10003;
      }
    `;
    document.head.appendChild(style);
    stylesInitialized = true;
  }
}

// Function to highlight Griffel elements
function highlightGriffelElements(sourceFilter, excludeFilter) {
  try {
    // Initialize styles if this is the first highlight operation
    initializeHighlightStyles();

    // Toggle the highlight state
    isHighlightAllActive = !isHighlightAllActive;

    if (!isHighlightAllActive) {
      // Remove all highlights
      const existingHighlights = document.querySelectorAll('[data-griffel-highlight="all"]');
      existingHighlights.forEach(el => {
        el.removeAttribute('data-griffel-highlight');
      });
      return true;
    }

    let highlightedCount = 0;

    // Find and highlight Griffel elements
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      try {
        if (window.__GRIFFEL_DEVTOOLS__) {
          const info = window.__GRIFFEL_DEVTOOLS__.getInfo(element);
          if (info) {
            // Only highlight if it matches the source filter
            const hasMatchingSource = hasMatchingSourceURL(info, sourceFilter, excludeFilter);
            if (hasMatchingSource) {
              element.setAttribute('data-griffel-highlight', 'all');
              highlightedCount++;
            }
          }
        }
      } catch (error) {
        console.error('Error highlighting element:', error);
      }
    });

    return highlightedCount > 0;
  } catch (error) {
    console.error('Error in highlightGriffelElements:', error);
    return false;
  }
}

// Function to highlight a single element
function highlightElement(elementIndex) {
  // Initialize styles if this is the first highlight operation
  initializeHighlightStyles();

  const element = document.querySelector(`[data-griffel-index="${elementIndex}"]`);
  if (!element) {
    return false;
  }

  // Check if this element is already highlighted
  const isCurrentlyHighlighted = element.hasAttribute('data-griffel-highlight') && 
                               element.getAttribute('data-griffel-highlight') === 'single';

  if (isCurrentlyHighlighted) {
    // Remove highlight
    element.removeAttribute('data-griffel-highlight');
    element.removeAttribute('data-griffel-label');
    highlightedElements.delete(elementIndex);
    
    // Restore the 'all' highlight if it was there and highlight all is active
    if (element.hasAttribute('data-griffel-highlight-all') && isHighlightAllActive) {
      element.setAttribute('data-griffel-highlight', 'all');
    }
  } else {
    // Remove previous individual highlight
    highlightedElements.forEach((el) => {
      el.removeAttribute('data-griffel-highlight');
      el.removeAttribute('data-griffel-label');
      if (el.hasAttribute('data-griffel-highlight-all') && isHighlightAllActive) {
        el.setAttribute('data-griffel-highlight', 'all');
      }
    });
    highlightedElements.clear();

    // Store whether it had the 'all' highlight
    const hadAllHighlight = element.hasAttribute('data-griffel-highlight');
    if (hadAllHighlight) {
      element.setAttribute('data-griffel-highlight-all', 'true');
    }
    element.setAttribute('data-griffel-highlight', 'single');
    element.setAttribute('data-griffel-label', `Element ${elementIndex}`);
    highlightedElements.set(elementIndex, element);
  }

  return true;
}

// Listen for messages from the isolated world
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GRIFFEL_INSPECTOR_REQUEST') {
    try {
      const { data } = event.data;
      const { action, sourceFilter, excludeFilter, elementIndex } = data;
      
      if (action === 'findGriffelElements') {
        const elements = findGriffelElements(sourceFilter, excludeFilter);
        // Send response back to the isolated world
        window.postMessage({
          type: 'GRIFFEL_INSPECTOR_RESPONSE',
          data: { elements }
        }, '*');
      } else if (action === 'highlightGriffelElements') {
        const success = highlightGriffelElements(sourceFilter, excludeFilter);
        window.postMessage({
          type: 'GRIFFEL_INSPECTOR_RESPONSE',
          data: { success, isActive: isHighlightAllActive }
        }, '*');
      } else if (action === 'highlightElement') {
        const success = highlightElement(elementIndex);
        window.postMessage({
          type: 'GRIFFEL_INSPECTOR_RESPONSE',
          data: { success, isHighlighted: !success }
        }, '*');
      }
    } catch (error) {
      console.error('Error handling Griffel inspector request:', error);
      window.postMessage({
        type: 'GRIFFEL_INSPECTOR_RESPONSE',
        data: { error: error.message }
      }, '*');
    }
  }
}); 