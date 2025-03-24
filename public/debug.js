// Resource loading error diagnostic script
(function() {
  // Log all resource loading errors
  window.addEventListener('error', function(e) {
    if (e.target && (e.target.tagName === 'LINK' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'IMG')) {
      console.error('[RESOURCE ERROR]', {
        element: e.target.tagName,
        src: e.target.src || e.target.href,
        path: window.location.pathname,
        time: new Date().toISOString()
      });
    }
  }, true);

  // Log React Server Component errors
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    const promise = originalFetch.apply(this, arguments);
    
    // Check if this is an RSC request
    if (typeof url === 'string' && url.includes('_rsc=')) {
      promise.catch(err => {
        console.error('[RSC FETCH ERROR]', {
          url: url,
          status: err.message,
          path: window.location.pathname,
          time: new Date().toISOString()
        });
      });
    }
    
    return promise;
  };

  console.log('[DEBUG] Diagnostic script loaded at', window.location.href);
  
  // Record loaded resources
  const loadedResources = {
    scripts: [],
    styles: [],
    images: []
  };
  
  // Collect currently loaded resources
  document.querySelectorAll('script[src]').forEach(script => {
    loadedResources.scripts.push(script.src);
  });
  
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    loadedResources.styles.push(link.href);
  });
  
  document.querySelectorAll('img[src]').forEach(img => {
    loadedResources.images.push(img.src);
  });
  
  console.log('[DEBUG] Loaded resources:', loadedResources);
  
  // Make diagnostic info available globally
  window.__debug = {
    resources: loadedResources,
    location: window.location.href,
    userAgent: navigator.userAgent
  };
})();