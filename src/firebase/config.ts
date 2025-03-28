'use client';

// Import the functions you need from the SDKs you need
import { initializeApp, getApps, setLogLevel } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import * as firebaseModule from "firebase/app";
import * as firebaseAuthModule from "firebase/auth";

// Enable debug logging if we're in the browser
if (typeof window !== 'undefined') {
  // Set log level to debug to help diagnose issues
  setLogLevel('debug');
  console.log('Firebase debug logging enabled');
  
  // Make Firebase available globally for debugging
  // @ts-ignore - Intentionally exposing as global
  window.firebase = {
    app: firebaseModule,
    auth: firebaseAuthModule,
    // Add a helper method to get the current Auth instance
    getAuth: () => {
      return getAuth();
    }
  };
  
  console.log('Firebase exposed to window.firebase for debugging');
}

// Dynamically import Firestore functions at runtime to prevent build issues
let getFirestore;
let collection;
let doc;
let getDoc;
let setDoc;
let addDoc;
let serverTimestamp;
let query;
let orderBy;
let onSnapshot;
let Timestamp;
let where;
let getDocs;
let updateDoc;
let deleteDoc;
let arrayUnion;
let arrayRemove;

// Use dynamic imports for client-side to prevent SSR issues
if (typeof window !== 'undefined') {
  // Asynchronously import Firebase modules
  const loadFirebaseModules = async () => {
    try {
      // Import Firestore using dynamic import
      const firestoreModule = await import('firebase/firestore');
      getFirestore = firestoreModule.getFirestore;
      collection = firestoreModule.collection;
      doc = firestoreModule.doc;
      getDoc = firestoreModule.getDoc;
      setDoc = firestoreModule.setDoc;
      addDoc = firestoreModule.addDoc;
      serverTimestamp = firestoreModule.serverTimestamp;
      query = firestoreModule.query;
      orderBy = firestoreModule.orderBy;
      onSnapshot = firestoreModule.onSnapshot;
      Timestamp = firestoreModule.Timestamp;
      where = firestoreModule.where;
      getDocs = firestoreModule.getDocs;
      updateDoc = firestoreModule.updateDoc;
      deleteDoc = firestoreModule.deleteDoc;
      arrayUnion = firestoreModule.arrayUnion;
      arrayRemove = firestoreModule.arrayRemove;
      
      console.log('Firebase Firestore modules loaded successfully');
      
      // Initialize services AFTER modules are loaded
      initializeFirebaseServices();
      
    } catch (error) {
      console.warn('Error importing Firestore modules, using fallbacks:', error);
      createMockImplementations();
    }
  };
  
  // Execute the async function
  loadFirebaseModules();
} else {
  // For server-side, create mock implementations immediately
  console.warn('Running in server environment, using mock implementations');
  
  // Create mock implementations
  // Define mock objects
  const mockDoc = {
    get: async () => ({ exists: false, data: () => null, id: 'mock-id' }),
    set: async () => ({}),
    update: async () => ({}),
    delete: async () => ({})
  };
  
  const mockCollection = {
    doc: () => mockDoc,
    add: async () => ({ id: 'mock-id' }),
    get: async () => ({ docs: [] }),
    where: () => mockCollection,
    orderBy: () => mockCollection,
    limit: () => mockCollection,
    onSnapshot: (callback) => {
      callback({ docs: [] });
      return () => {};
    }
  };
  
  const mockFirestore = {
    collection: () => mockCollection
  };
  
  getFirestore = () => mockFirestore;
  collection = () => mockCollection;
  doc = () => mockDoc;
  getDoc = async () => ({ exists: () => false, data: () => null });
  setDoc = async () => {};
  addDoc = async () => ({ id: 'mock-id' });
  serverTimestamp = () => new Date().toISOString();
  query = () => ({});
  orderBy = () => ({});
  onSnapshot = (_, callback) => {
    callback({ docs: [] });
    return () => {};
  };
  Timestamp = { now: () => new Date() };
  where = () => ({});
  getDocs = async () => ({ docs: [] });
  updateDoc = async () => {};
  deleteDoc = async () => {};
  arrayUnion = (...items) => items;
  arrayRemove = (...items) => items;
}

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy-key-for-build',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dummy-domain-for-build',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy-project-for-build',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dummy-bucket-for-build',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-0000000000',
};

// Dynamically set authDomain based on environment
if (typeof window !== 'undefined') {
  // We're on the client-side
  if (process.env.NODE_ENV === 'production') {
    // For Vercel preview deployments, use the current hostname
    // This allows authentication to work on dynamic preview URLs
    firebaseConfig.authDomain = window.location.hostname;
    
    // Log the domain being used for debugging
    console.log(`Using dynamic authDomain: ${window.location.hostname}`);
    
    // Note: For this to work, you'll need to add all Vercel preview domains 
    // to your Firebase project's Authorized Domains list
    // Or use a wildcard domain if your Firebase plan supports it
  } else if (process.env.NODE_ENV === 'development') {
    // In development, use localhost or the specified auth domain
    firebaseConfig.authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'localhost';
  }
}

// Initialize Firebase only if not already initialized with improved error handling
// Add verbose logging around Firebase initialization
console.log('Initializing Firebase with config:', {
  apiKey: firebaseConfig.apiKey ? '***' : 'missing',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId,
  hasMeasurementId: !!firebaseConfig.measurementId
});

let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  console.log('Firebase initialization successful');
} catch (error) {
  console.error('Error initializing Firebase app:', error);
  throw error; // Re-throw to make sure the error is visible
}

// Configure Auth with custom settings for better reliability
const auth = getAuth(app);

// Apply additional settings to make auth more resilient
if (typeof window !== 'undefined') {
  // Set longer timeout for auth operations (10 seconds)
  (auth as any)._networkTimeout = 10000;
  
  // Add connection status monitoring
  window.addEventListener('online', () => {
    console.log('Network connection restored. Firebase services should resume.');
  });
  
  window.addEventListener('offline', () => {
    console.warn('Network connection lost. Firebase services may be unavailable.');
  });
  
  // Set auth persistence to LOCAL to ensure the user stays logged in
  // This is critical for maintaining auth state between page loads
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase Auth persistence set to LOCAL');
      
      // Check if the user is already logged in
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('User already logged in:', currentUser.uid);
        // Force token refresh to ensure we have a valid token
        currentUser.getIdToken(true)
          .then(token => {
            console.log('Token refreshed, length:', token.length);
            localStorage.setItem('authToken', token);
          })
          .catch(err => {
            console.error('Error refreshing token:', err);
          });
      } else {
        console.log('No user currently logged in');
      }
    })
    .catch(error => {
      console.error('Error setting auth persistence:', error);
    });
}

// Create safer versions of Firebase services with error handling
let db;
let storage;

// Function to initialize Firebase services
function initializeFirebaseServices() {
  try {
    // Initialize Firestore with error handling
    if (typeof getFirestore === 'function') {
      db = getFirestore(app);
    }
    
    // Initialize Storage with error handling
    storage = getStorage(app);
  } catch (error) {
    console.error('Error initializing Firebase services:', error);
    createMockImplementations();
  }
}

// Function to create mock implementations
function createMockImplementations() {
  // Create mock implementations as fallbacks
  if (!db) {
    console.warn('Using mock Firestore implementation');
    db = {
      collection: (name) => ({
        doc: (id) => ({
          get: async () => ({ 
            exists: false, 
            data: () => null,
            id: id || 'mock-id'
          }),
          set: async () => ({}),
          update: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' }),
        orderBy: () => ({
          onSnapshot: (callback) => {
            callback({ docs: [] });
            return () => {};
          }
        })
      })
    };
  }
  
  if (!storage) {
    console.warn('Using mock Storage implementation');
    storage = {
      ref: () => ({
        child: () => ({
          put: async () => ({
            ref: {
              getDownloadURL: async () => 'https://example.com/mock-url'
            }
          })
        })
      })
    };
  }
}

// Initial attempt to initialize services
try {
  // Only initialize if getFirestore is available synchronously
  if (typeof getFirestore === 'function') {
    db = getFirestore(app);
  }
  
  // Initialize Storage with error handling
  storage = getStorage(app);
} catch (error) {
  console.error('Error in initial Firebase service initialization:', error);
  createMockImplementations();
}

// Initialize Analytics conditionally (only on client-side)
// TEMPORARILY DISABLE ANALYTICS TO RESOLVE 403 PERMISSION ERROR
let analytics = null;
// if (typeof window !== 'undefined') {
//   // We're on the client-side
//   isSupported().then(supported => {
//     if (supported) {
//       analytics = getAnalytics(app);
//     }
//   });
// }
console.log('Firebase Analytics initialization is currently disabled to resolve permission issues');

// Connect to emulators in development mode (client-side only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const EMULATOR_HOST = 'localhost';
  // Check if we explicitly want to use emulators
  const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
  
  if (useEmulators) {
    console.log('Using Firebase emulators');
    
    // Import needed functions
    import('firebase/auth').then(({ connectAuthEmulator }) => {
      connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    });
    
    import('firebase/firestore').then(({ connectFirestoreEmulator }) => {
      connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    });
    
    import('firebase/storage').then(({ connectStorageEmulator }) => {
      connectStorageEmulator(storage, EMULATOR_HOST, 9199);
    });
  }

  // Enable offline persistence for Firestore (client-side only)
  try {
    import('firebase/firestore').then(({ enableIndexedDbPersistence }) => {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser does not support all of the features required to enable persistence');
        }
      });
    });
  } catch (error) {
    console.warn('Error enabling offline persistence:', error);
  }
}

// Helper function to get download URLs from Firebase Storage
// We no longer need a proxy since CORS is properly configured
export const getProxiedDownloadURL = async (fileRef: any) => {
  // Import getDownloadURL dynamically to avoid SSR issues
  const { getDownloadURL } = await import("firebase/storage");
  
  // Get the original download URL from Firebase
  const originalUrl = await getDownloadURL(fileRef);
  
  // Return the original URL for both development and production
  // CORS is now properly configured in Firebase Storage
  return originalUrl;
};

export { 
  app, 
  auth, 
  db, 
  storage, 
  analytics,
  // Export Firestore functions for direct import
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove
};