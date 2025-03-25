'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { isVercelPreview, getRecommendedAuthorizedDomains } from '../utils/deployment';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  
  // Create a separate effect for token refresh
  useEffect(() => {
    let refreshTokenInterval: NodeJS.Timeout | null = null;
    
    // Set up token refresh when user is available
    if (user) {
      // Get initial token
      user.getIdToken()
        .then(token => {
          localStorage.setItem('authToken', token);
        })
        .catch(err => {
          console.error('Error getting initial token:', err);
        });
      
      // Set up refresh interval (tokens expire after 1 hour by default)
      refreshTokenInterval = setInterval(async () => {
        try {
          if (auth.currentUser) {
            const freshToken = await auth.currentUser.getIdToken(true); // force refresh
            localStorage.setItem('authToken', freshToken);
            console.log('Auth token refreshed');
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
        }
      }, 30 * 60 * 1000); // Refresh every 30 minutes
    } else {
      // Clear token if user is logged out
      localStorage.removeItem('authToken');
    }
    
    // Clean up interval on effect cleanup
    return () => {
      if (refreshTokenInterval) {
        clearInterval(refreshTokenInterval);
      }
    };
  }, [user]); // This effect depends on user state
  
  // Main auth state listener effect
  useEffect(() => {
    // Only run auth state listener on the client
    if (typeof window !== 'undefined') {
      const unsubscribe = onAuthStateChanged(
        auth, 
        (user) => {
          setUser(user);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.error('Auth state change error:', error);
          setError(error.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message);
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setError(null);
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      
      // Add custom OAuth parameters for better compatibility
      provider.setCustomParameters({
        // Force account selection even when one account is available
        prompt: 'select_account',
        // Use current hostname to improve domain matching
        login_hint: window.location.hostname
      });

      // Log authentication attempt for debugging
      console.log("Attempting Google sign-in with domain:", window.location.hostname);
      
      // Enhanced error handling for Vercel preview deployments
      const currentDomain = window.location.hostname;
      const isPreviewDeployment = isVercelPreview();
      
      if (isPreviewDeployment) {
        console.log("Detected Vercel preview deployment - may require domain authorization in Firebase");
        console.log("Recommended authorized domains:", getRecommendedAuthorizedDomains());
      }
      
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      
      // Provide more specific error message for unauthorized domain
      if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        
        // Check if this is a Vercel preview deployment
        const isPreviewDeployment = isVercelPreview();
        
        if (isPreviewDeployment) {
          // Special handling for Vercel preview domains
          setError(`This preview deployment (${currentDomain}) is not authorized in Firebase. Use the production URL or add this domain in Firebase Console > Authentication > Settings > Authorized Domains. See the VERCEL_PREVIEW_AUTH.md file for more information.`);
          
          // Get recommended domains to authorize
          const recommendedDomains = getRecommendedAuthorizedDomains();
          
          // Log detailed troubleshooting steps
          console.error(`
            Vercel Preview Domain Authentication Error:
            --------------------------------------
            Current domain: ${currentDomain}
            
            To fix this issue:
            1. Go to Firebase Console > Authentication > Settings
            2. Add the following to Authorized Domains list:
               ${recommendedDomains.map(domain => `- ${domain}`).join('\n               ')}
            3. For each new preview deployment, you'll need to add its domain
            
            Alternative solutions:
            - Use a custom domain for previews (see VERCEL_PREVIEW_AUTH.md)
            - Create a separate Firebase project for development/staging
          `);
        } else {
          // Standard unauthorized domain error
          setError(`Authentication domain error: ${currentDomain} is not authorized in Firebase. Please contact support.`);
          console.error(`Domain ${currentDomain} needs to be added to Firebase Console > Authentication > Settings > Authorized Domains`);
        }
      } else if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup - provide a clearer message
        setError('Sign-in was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        // Browser blocked the popup
        setError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Multiple popup requests - not a critical error
        setError('Authentication process was interrupted. Please try again.');
      } else if (err.code === 'auth/network-request-failed') {
        // Network issues
        setError('Network error during authentication. Please check your internet connection and try again.');
      } else if (err.code === 'auth/invalid-credential') {
        // Invalid credentials (commonly occurs with expired tokens or credential issues)
        setError('Authentication failed. Please try again or use a different sign-in method.');
        console.error('Invalid credential error during Google sign-in. This may be due to an expired token or authentication configuration issue.');
      } else {
        setError(err.message || 'An unexpected error occurred during Google sign-in');
      }
      
      throw err;
    }
  };

  // Function to get a token, with optional force refresh
  const getToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      if (!auth.currentUser) {
        console.warn('No user logged in when attempting to get token');
        return null;
      }
      
      const token = await auth.currentUser.getIdToken(forceRefresh);
      localStorage.setItem('authToken', token);
      return token;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    logout,
    signInWithGoogle,
    getToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};