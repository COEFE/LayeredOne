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
    // Look for missing API endpoints which would indicate static export
    const pathname = window.location.pathname;
    const isGithubPages = pathname.startsWith('/LayeredOne') || 
                         document.querySelector('meta[name="static-export"]') !== null;
                         
    return isGithubPages;
  }
  return false;
};

/**
 * Client-side helper to get authentication token or handle static export
 */
export const getClientAuthToken = async () => {
  if (isClientStaticExport()) {
    console.log('Static export detected, using mock auth token');
    return 'static-export-mock-token';
  }
  
  // In normal operation, get the token from localStorage or auth context
  const storedToken = localStorage.getItem('authToken');
  if (storedToken) {
    return storedToken;
  }
  
  // If we can't get a token, return null and let the caller handle it
  return null;
};