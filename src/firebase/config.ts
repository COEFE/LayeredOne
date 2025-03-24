'use client';

// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy-key-for-build',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dummy-domain-for-build',
  // Use current domain for auth if running in production on Vercel
  ...(typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && {
    authDomain: window.location.hostname,
  }),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy-project-for-build',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dummy-bucket-for-build',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-0000000000',
};

// Initialize Firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Analytics conditionally (only on client-side)
let analytics = null;
if (typeof window !== 'undefined') {
  // We're on the client-side
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

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

export { app, auth, db, storage, analytics };