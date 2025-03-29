// Static export middleware for handling authentication in a static export environment

/**
 * Detects if the current environment is a static export build
 * 
 * @returns {boolean} True if the current environment is a static export build
 */
export const isStaticExport = () => {
  // Always return false - we want to use real Firebase in all environments
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
  
  // Get the authorization header with improved robustness
  const authHeader = req.headers.get('authorization') || '';
  
  // Log debug info to help diagnose token issues
  console.log('Authorization header present:', !!authHeader);
  if (authHeader) {
    console.log('Authorization header format:', authHeader.startsWith('Bearer ') ? 'Valid Bearer format' : 'Invalid format');
  }
  
  // More robust token extraction that handles different formats
  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (authHeader && !authHeader.includes(' ')) {
    // Handle case where token is sent without 'Bearer ' prefix
    token = authHeader;
    console.log('Found token without Bearer prefix, still using it');
  }
  
  // Log token status (don't log the actual token for security)
  console.log('Token extracted:', token ? 'Yes (length: ' + token.length + ')' : 'No');
  
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
    
    // We're disabling the API failure detection to ensure we always use real cloud storage
    // const hasDetectedAPIFailure = localStorage.getItem('API_FAILURE_DETECTED') === 'true';
    
    // Add helpful debugging for static export detection
    if (isGithubPages || hasStaticExportMeta || isFileProtocol || isStaticHost) {
      console.log('Static export environment detected based on:', { 
        isGithubPages, 
        hasStaticExportMeta, 
        isFileProtocol, 
        isStaticHost,
        pathname 
      });
      
      // Clear any API failure flags that might be set
      if (localStorage.getItem('API_FAILURE_DETECTED') === 'true') {
        console.log('Clearing API_FAILURE_DETECTED flag');
        localStorage.removeItem('API_FAILURE_DETECTED');
      }
      
      if (localStorage.getItem('FORCE_STATIC_EXPORT') === 'true') {
        console.log('Clearing FORCE_STATIC_EXPORT flag');
        localStorage.removeItem('FORCE_STATIC_EXPORT');
      }
    }
    
    // Mock mode is disabled - use actual cloud storage even on static hosts
    // return isGithubPages || hasStaticExportMeta || isFileProtocol || isStaticHost;
    return false;
  }
  return false;
};

/**
 * Utility function that previously marked API failures
 * Now disabled to ensure we always use real cloud storage
 */
export const markAPIFailureDetected = () => {
  if (typeof window !== 'undefined') {
    // Disabled - no longer mark API failures to prevent mock mode
    // localStorage.setItem('API_FAILURE_DETECTED', 'true');
    console.log('API failure detected, but mock mode is disabled');
    
    // Actually clear the flag if it's set
    if (localStorage.getItem('API_FAILURE_DETECTED') === 'true') {
      localStorage.removeItem('API_FAILURE_DETECTED');
    }
  }
};

/**
 * Client-side helper to get authentication token or handle static export
 * This performs multiple checks to ensure we always get a token to work with
 */
export const getClientAuthToken = async (user?: any) => {
  // Static export mode is disabled, so this will never be true
  if (isClientStaticExport()) {
    console.log('Static export detected, but mock mode is disabled');
    // Do not return a mock token
    // return 'static-export-mock-token';
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
  if (typeof window !== 'undefined') {
    // Get the hostname for logging
    const hostname = window.location.hostname;
    console.log(`Current hostname: ${hostname} - checking for special auth handling`);
    
    // Special handling for Vercel deployments
    const isVercelDeployment = hostname.includes('vercel.app') || 
                              process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true';
    
    // For localhost, we can use a mock token since it's development
    if (hostname === 'localhost') {
      console.log('Using localhost-specific authentication method');
      return 'localhost-mock-token';
    }
    
    // For Vercel deployments, try more aggressively to get a token
    if (isVercelDeployment) {
      console.log('Vercel deployment detected, using enhanced token retrieval');
      
      // Check if Firebase web SDK is available globally
      // @ts-ignore - Ignore TypeScript errors for global firebase reference
      if (window.firebase?.auth) {
        try {
          // @ts-ignore
          const auth = window.firebase.auth();
          if (auth && auth.currentUser) {
            console.log('Using global Firebase auth from window.firebase');
            const token = await auth.currentUser.getIdToken(true);
            localStorage.setItem('authToken', token);
            return token;
          }
        } catch (e) {
          console.error('Failed to get token from global Firebase Auth:', e);
        }
      }
      
      // On Vercel, we need to make sure we have a valid token
      // Try to re-authenticate by redirecting to login if no token is available
      if (window.location.pathname !== '/login') {
        console.warn('No authentication token available on Vercel deployment - redirecting to login');
        // Store the current URL to redirect back after login
        localStorage.setItem('redirectAfterLogin', window.location.pathname);
        // Redirect to login page
        window.location.href = '/login';
        // Return a temporary token to prevent immediate errors while redirecting
        return 'redirect-to-login';
      }
    }
  }

  // Last resort - try a different way to get Firebase Auth
  try {
    // Try to access Firebase Auth in a global context
    // @ts-ignore - Ignore TypeScript errors for global firebase reference
    const globalAuth = window.firebase?.auth?.();
    if (globalAuth && globalAuth.currentUser) {
      console.log('Successfully retrieved token from global Firebase Auth');
      const token = await globalAuth.currentUser.getIdToken(true);
      localStorage.setItem('authToken', token);
      return token;
    }
  } catch (e) {
    console.error('Failed to get token from global Firebase Auth:', e);
  }
  
  // If we STILL can't get a token, return a special token for Vercel
  // This is a last resort to avoid breaking functionality
  console.warn('No valid token available - this will likely fail for authenticated operations');
  
  // For Vercel deployments, return a more descriptive token that will trigger proper error handling
  if (typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') || 
      process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true'
  )) {
    console.error('Authentication missing on Vercel deployment!');
    return 'vercel-auth-missing-token';
  }
  
  return 'fallback-mock-token';
};