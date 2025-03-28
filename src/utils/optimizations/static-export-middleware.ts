// Static export middleware for handling authentication in a static export environment

/**
 * Detects if the current environment is a static export build
 * 
 * @returns {boolean} True if the current environment is a static export build
 */
export const isStaticExport = () => {
  if (typeof process !== 'undefined') {
    return (
      process.env.NEXT_STATIC_EXPORT === 'true' ||
      process.env.GITHUB_PAGES === 'true' ||
      process.env.STATIC_EXPORT === 'true' ||
      process.env.NEXT_PHASE === 'phase-export'
    );
  }
  return false;
};

/**
 * Middleware to handle authentication for static exports
 * This skips authentication checks during static export builds
 * 
 * @param req The request object
 * @returns Object with userId and isStaticExport properties
 */
export const handleStaticAuthForAPI = (req: Request) => {
  // Check if we're in a static export environment or build phase
  const staticExport = isStaticExport() || 
                      process.env.NEXT_PHASE === 'phase-production-build' ||
                      process.env.NEXT_PHASE === 'phase-export';
  
  // Get the authorization header
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.split('Bearer ')[1];
  
  return {
    token,
    isStaticExport: staticExport,
    // If in static export, use a placeholder user ID
    mockUserId: staticExport ? 'static-export-user-id' : null
  };
};

/**
 * Client-side helper to detect if we're in a static export environment
 * and handle authentication accordingly
 */
export const isClientStaticExport = () => {
  // Check for indicators that we're in a static export environment
  if (typeof window !== 'undefined') {
    // Check for a forced static export environment via local storage
    // This is useful for debugging or if we want to force static export mode
    if (localStorage.getItem('FORCE_STATIC_EXPORT') === 'true') {
      return true;
    }
    
    // Check for specific paths that indicate static export
    const pathname = window.location.pathname;
    const isGithubPages = pathname.startsWith('/LayeredOne');
    
    // Check for static export meta tag
    const hasStaticExportMeta = document.querySelector('meta[name="static-export"]') !== null;
    
    // Check for direct file access pattern (file:// protocol)
    const isFileProtocol = window.location.protocol === 'file:';
    
    // Check for common static hosts
    const hostname = window.location.hostname;
    const isStaticHost = hostname.includes('github.io') || 
                        hostname.includes('netlify.app') ||
                        hostname.includes('vercel.app') ||
                        hostname.includes('pages.dev');
    
    // Let's also try to detect if API routes are functioning
    // by checking if we have already detected API failure
    const hasDetectedAPIFailure = localStorage.getItem('API_FAILURE_DETECTED') === 'true';
    
    // Add helpful debugging for static export detection
    if (isGithubPages || hasStaticExportMeta || isFileProtocol || isStaticHost || hasDetectedAPIFailure) {
      console.log('Static export detected based on:', { 
        isGithubPages, 
        hasStaticExportMeta, 
        isFileProtocol, 
        isStaticHost,
        hasDetectedAPIFailure,
        pathname 
      });
    }
    
    return isGithubPages || hasStaticExportMeta || isFileProtocol || isStaticHost || hasDetectedAPIFailure;
  }
  return false;
};

/**
 * Utility function to mark that an API failure has been detected
 * This helps future requests recognize they're in a static export environment
 */
export const markAPIFailureDetected = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('API_FAILURE_DETECTED', 'true');
    console.log('API failure detected, marking as static export environment');
  }
};

/**
 * Client-side helper to get authentication token or handle static export
 * This performs multiple checks to ensure we always get a token to work with
 */
export const getClientAuthToken = async (user?: any) => {
  // Check for static export environment first
  if (isClientStaticExport()) {
    console.log('Static export detected, using mock auth token');
    return 'static-export-mock-token';
  }

  // Check for stored token in localStorage, most reliable and fastest approach
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (storedToken) {
    return storedToken;
  }
  
  // Try to get token from user if provided
  if (user) {
    // Safely check if the user has getIdToken method
    if (user.getIdToken && typeof user.getIdToken === 'function') {
      try {
        const token = await user.getIdToken(true); // Force refresh
        if (token) {
          // Store for future use
          localStorage.setItem('authToken', token);
          return token;
        }
      } catch (error) {
        console.error('Error getting token from user object:', error);
        // Continue to fallbacks
      }
    }
  }
  
  // Check for static site generation (SSG) or static export context
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'localhost-mock-token';
  }

  // Last resort - try a different way to get Firebase Auth
  try {
    // Try to access Firebase Auth in a global context - this may or may not work
    // @ts-ignore - Ignore TypeScript errors for global firebase reference
    const globalAuth = window.firebase?.auth?.();
    if (globalAuth && globalAuth.currentUser) {
      const token = await globalAuth.currentUser.getIdToken(true);
      localStorage.setItem('authToken', token);
      return token;
    }
  } catch (e) {
    console.error('Failed to get token from global Firebase Auth', e);
  }
  
  // If we STILL can't get a token, return a mock token for static sites
  // This is a last resort to avoid breaking functionality
  console.warn('Using fallback mock token - authentication will likely fail for dynamic operations');
  return 'fallback-mock-token';
};