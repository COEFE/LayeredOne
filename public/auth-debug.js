(function() {
  console.log('Auth Debug Helper Loaded');

  // Create methods for debugging authentication
  window.authDebug = {
    checkAuth: function() {
      try {
        // Check if Firebase auth is directly available
        if (typeof firebase !== 'undefined' && firebase.auth) {
          console.log('Firebase found globally');
          const auth = firebase.auth();
          const user = auth.currentUser;
          
          console.log('Auth state:', user ? 'Logged in' : 'Not logged in');
          if (user) {
            console.log('User ID:', user.uid);
            console.log('Email:', user.email);
            user.getIdToken(true)
              .then(token => {
                console.log('Token available:', !!token);
                console.log('Token length:', token.length);
                console.log('Token preview:', token.substring(0, 10) + '...' + token.substring(token.length - 5));
                localStorage.setItem('authToken', token);
                console.log('Token saved to localStorage');
                return { success: true, token: true };
              })
              .catch(err => {
                console.error('Token retrieval error:', err);
                return { success: false, error: err };
              });
          }
          return user ? { loggedIn: true, user: { uid: user.uid, email: user.email } } : { loggedIn: false };
        } 
        // Check for our window.firebase helper
        else if (window.firebase && window.firebase.getAuth) {
          console.log('Using window.firebase helper');
          const auth = window.firebase.getAuth();
          const user = auth.currentUser;
          
          console.log('Auth state:', user ? 'Logged in' : 'Not logged in');
          if (user) {
            console.log('User ID:', user.uid);
            console.log('Email:', user.email);
            user.getIdToken(true)
              .then(token => {
                console.log('Token available:', !!token);
                console.log('Token length:', token.length);
                console.log('Token preview:', token.substring(0, 10) + '...' + token.substring(token.length - 5));
                localStorage.setItem('authToken', token);
                console.log('Token saved to localStorage');
                return { success: true, token: true };
              })
              .catch(err => {
                console.error('Token retrieval error:', err);
                return { success: false, error: err };
              });
          }
          return user ? { loggedIn: true, user: { uid: user.uid, email: user.email } } : { loggedIn: false };
        } else {
          console.error('Firebase auth not available globally');
          return { success: false, error: 'Firebase auth not available globally' };
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        return { success: false, error: error };
      }
    },
    
    saveTokenToStorage: function() {
      try {
        // Try both global firebase and our helper
        const auth = (window.firebase && window.firebase.getAuth) ? 
                    window.firebase.getAuth() : 
                    (typeof firebase !== 'undefined' ? firebase.auth() : null);
        
        if (!auth) {
          console.error('Auth not available');
          return { success: false, error: 'Auth not available' };
        }
        
        const user = auth.currentUser;
        if (!user) {
          console.error('No user logged in');
          return { success: false, error: 'No user logged in' };
        }
        
        return user.getIdToken(true)
          .then(token => {
            localStorage.setItem('authToken', token);
            console.log('Token saved to localStorage:', token.substring(0, 10) + '...');
            return { success: true };
          })
          .catch(err => {
            console.error('Error getting token:', err);
            return { success: false, error: err };
          });
      } catch (error) {
        console.error('Error saving token:', error);
        return { success: false, error: error };
      }
    },
    
    checkStorage: function() {
      // Check for auth data in localStorage
      const keys = Object.keys(localStorage);
      console.log('All localStorage keys:', keys);
      
      // Look for Firebase auth entries
      const firebaseKeys = keys.filter(key => key.includes('firebase') || key.includes('auth'));
      console.log('Firebase-related localStorage keys:', firebaseKeys);
      
      // Check for our custom auth token
      const hasAuthToken = !!localStorage.getItem('authToken');
      console.log('Has authToken in localStorage:', hasAuthToken);
      
      if (hasAuthToken) {
        const token = localStorage.getItem('authToken');
        console.log('Token length:', token.length);
        console.log('Token preview:', token.substring(0, 10) + '...' + token.substring(token.length - 5));
      }
      
      return {
        allKeys: keys,
        firebaseKeys: firebaseKeys,
        hasAuthToken: hasAuthToken
      };
    },
    
    fixAuth: function() {
      // Try to fix common auth issues
      console.log('Attempting to fix auth issues...');
      
      // Check if already logged in
      const loggedIn = this.checkAuth().loggedIn;
      
      if (!loggedIn) {
        console.log('Not logged in - redirecting to login page');
        // Save current page to return after login
        localStorage.setItem('redirectAfterLogin', window.location.pathname);
        // Redirect to login
        window.location.href = '/login';
        return { action: 'redirect', destination: '/login' };
      }
      
      // Try to refresh and save token
      return this.saveTokenToStorage();
    }
  };
  
  console.log('Auth Debug Helper ready - use window.authDebug.checkAuth() to check authentication');
})();