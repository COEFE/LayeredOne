(function() {
  // Only run in production environments
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Debug script running in development mode');
  }

  // Create a debug logger that writes to both console and a UI element
  function createDebugLogger() {
    // Create UI element for logs
    const debugContainer = document.createElement('div');
    debugContainer.style.position = 'fixed';
    debugContainer.style.bottom = '0';
    debugContainer.style.right = '0';
    debugContainer.style.width = '400px';
    debugContainer.style.maxHeight = '300px';
    debugContainer.style.overflowY = 'auto';
    debugContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    debugContainer.style.color = '#00ff00';
    debugContainer.style.fontFamily = 'monospace';
    debugContainer.style.fontSize = '12px';
    debugContainer.style.padding = '10px';
    debugContainer.style.zIndex = '10000';
    debugContainer.style.borderRadius = '5px 0 0 0';
    debugContainer.style.display = 'none'; // Hidden by default

    // Create header with title and toggle button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '5px';
    header.style.borderBottom = '1px solid #00ff00';
    header.style.paddingBottom = '5px';

    const title = document.createElement('div');
    title.textContent = 'Debug Console';
    title.style.fontWeight = 'bold';

    const buttonsContainer = document.createElement('div');
    
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.style.marginRight = '5px';
    clearButton.style.background = 'none';
    clearButton.style.border = '1px solid #00ff00';
    clearButton.style.color = '#00ff00';
    clearButton.style.borderRadius = '3px';
    clearButton.style.cursor = 'pointer';
    clearButton.onclick = function() {
      logsContainer.innerHTML = '';
    };

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.background = 'none';
    closeButton.style.border = '1px solid #00ff00';
    closeButton.style.color = '#00ff00';
    closeButton.style.borderRadius = '3px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = function() {
      debugContainer.style.display = 'none';
      debugButton.style.display = 'block';
    };

    buttonsContainer.appendChild(clearButton);
    buttonsContainer.appendChild(closeButton);
    
    header.appendChild(title);
    header.appendChild(buttonsContainer);
    debugContainer.appendChild(header);

    // Create logs container
    const logsContainer = document.createElement('div');
    debugContainer.appendChild(logsContainer);

    // Create toggle button
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug';
    debugButton.style.position = 'fixed';
    debugButton.style.bottom = '10px';
    debugButton.style.right = '10px';
    debugButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    debugButton.style.color = '#00ff00';
    debugButton.style.border = '1px solid #00ff00';
    debugButton.style.borderRadius = '5px';
    debugButton.style.padding = '5px 10px';
    debugButton.style.fontFamily = 'monospace';
    debugButton.style.zIndex = '10000';
    debugButton.style.cursor = 'pointer';
    
    debugButton.onclick = function() {
      debugContainer.style.display = 'block';
      debugButton.style.display = 'none';
    };

    // Add to document
    document.body.appendChild(debugContainer);
    document.body.appendChild(debugButton);

    // Return logger function
    return function(message, type = 'info') {
      // Log to console
      console.log(`[DEBUG] ${message}`);
      
      // Log to UI
      const logEntry = document.createElement('div');
      logEntry.style.borderBottom = '1px solid rgba(0, 255, 0, 0.2)';
      logEntry.style.paddingBottom = '3px';
      logEntry.style.marginBottom = '3px';
      
      // Color based on type
      switch(type) {
        case 'error':
          logEntry.style.color = '#ff5555';
          break;
        case 'warning':
          logEntry.style.color = '#ffff55';
          break;
        case 'success':
          logEntry.style.color = '#55ff55';
          break;
        default:
          logEntry.style.color = '#00ff00';
      }
      
      const timestamp = new Date().toISOString().slice(11, 19);
      logEntry.textContent = `[${timestamp}] ${message}`;
      logsContainer.appendChild(logEntry);
      
      // Auto-scroll to bottom
      logsContainer.scrollTop = logsContainer.scrollHeight;
    };
  }

  // Create the logger once the DOM is fully loaded
  window.addEventListener('DOMContentLoaded', function() {
    // Create a global debug logger
    window.debugLog = createDebugLogger();
    
    // Log basic information
    debugLog('Debug script initialized');
    debugLog(`Page URL: ${window.location.href}`);
    debugLog(`Pathname: ${window.location.pathname}`);

    // Monitor for 404 errors in dynamic routes
    if (window.location.pathname.match(/\/chat\/[^\/]+\/?$/) ||
        window.location.pathname.match(/\/documents\/[^\/]+\/?$/)) {
      debugLog('Dynamic route detected, monitoring for 404 errors', 'warning');
      
      // Check if the page shows a 404 error
      setTimeout(function() {
        if (document.title.includes('404') || document.body.textContent.includes('This page could not be found')) {
          debugLog('404 error detected on dynamic route', 'error');
          
          const currentPath = window.location.pathname;
          // Log potential path formats for debugging
          debugLog(`Current path: ${currentPath}`, 'error');
          
          // Check if it has a trailing slash that needs to be removed
          if (currentPath.endsWith('/') && currentPath.length > 1) {
            debugLog('Path has trailing slash - try removing it', 'warning');
            const fixedPath = currentPath.substring(0, currentPath.length - 1);
            debugLog(`Consider navigating to: ${fixedPath}`, 'success');
            
            // Auto-fix: After 2 seconds, offer an option to try the fix
            setTimeout(function() {
              if (confirm('The page was not found. Would you like to try removing the trailing slash to fix it?')) {
                window.location.href = fixedPath;
              }
            }, 2000);
          }
          // For completeness, also check the other case
          else if (!currentPath.endsWith('/')) {
            debugLog('Path is missing trailing slash - you have the correct format', 'success');
            debugLog('The 404 error must be due to another reason', 'warning');
          }

          // Extract ID from URL
          const matches = currentPath.match(/\/(chat|documents)\/([^\/]+)\/?$/);
          if (matches && matches[2]) {
            const section = matches[1];
            const id = matches[2];
            debugLog(`Section: ${section}, ID: ${id}`, 'info');
            
            // Check for common issues
            if (id.includes('.')) {
              debugLog('ID contains dots which might cause routing issues', 'warning');
            }
            
            if (id.includes('?')) {
              debugLog('ID contains query string characters which should be parsed separately', 'warning');
            }
            
            if (id.includes('#')) {
              debugLog('ID contains fragment identifier which should be parsed separately', 'warning');
            }

            // Log helpful navigation options
            debugLog(`Try using the debug page at /debug/ to test navigation`, 'success');
          }
        } else {
          debugLog('Page loaded successfully', 'success');
        }
      }, 1000);
    }
  });
})();