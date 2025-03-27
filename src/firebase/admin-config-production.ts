/**
 * Firebase Admin SDK configuration optimized for production
 * This file is used in production build to avoid mock implementations
 */

import * as admin from 'firebase-admin';
import * as firestore from '@google-cloud/firestore';

// Initialize Firebase Admin SDK if not already initialized
const initializeAdmin = () => {
  if (!admin.apps.length) {
    try {
      // Get service account from environment variables
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : "";
        
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "variance-test-4b441",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com",
          privateKey: privateKey
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "variance-test-4b441.firebasestorage.app"
      });
      
      console.log('Firebase Admin SDK initialized for production.');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw error; // In production, we should fail fast on initialization errors
    }
  }
  return admin;
};

// Initialize immediately
const adminInstance = initializeAdmin();

// Get Firestore instance with proper typing
const db = adminInstance.firestore();

// Get Auth instance
const auth = adminInstance.auth();

// Get Storage instance
const storage = adminInstance.storage().bucket();

// Export real implementations for production
export { 
  adminInstance as admin,
  db,
  auth,
  storage,
  db as adminDb,
  auth as adminAuth,
  storage as adminStorage,
  firestore
};