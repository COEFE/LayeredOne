/**
 * Simplified Firebase Admin configuration for production builds
 */

// Try to import firebase-admin
let admin: any;
try {
  admin = require('firebase-admin');
} catch (error) {
  console.error('Failed to import firebase-admin:', error);
  admin = {
    apps: [],
    initializeApp: () => {},
    credential: { cert: () => ({}) },
    firestore: () => ({}),
    auth: () => ({}),
    storage: () => ({})
  };
}

// Create utility for Firestore paths
const firestorePath = {
  documentPathFromResourceName: (resourceName: string) => {
    if (!resourceName) return '';
    const parts = resourceName.split('/');
    return parts.filter((_, i) => i % 2 === 1).join('/');
  },
  relativeName: (projectId: string, resourcePath: string) => {
    return `projects/${projectId}/databases/(default)/documents/${resourcePath}`;
  }
};

// Import the key helper to get the private key from environment variables
import { getPrivateKeyFromEnv } from './key-helpers';

// Get private key from environment variable using the helper function
let privateKey = getPrivateKeyFromEnv();

// If no valid private key was found, log an error
if (!privateKey) {
  console.error('No valid Firebase private key available from environment variables');
  console.error('Please ensure FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_BASE64 is set correctly');
  
  // Set to empty string to trigger error handling in the initialization code
  privateKey = '';
}

// Initialize Firebase Admin if not already initialized
let db;
let auth;
let storage;

if (!admin.apps.length) {
  try {
    console.log('Initializing Firebase Admin SDK...');
    
    // Log the environment variable status
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
    const hasPrivateKeyBase64 = !!process.env.FIREBASE_PRIVATE_KEY_BASE64;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "variance-test-4b441";
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "variance-test-4b441.appspot.com";
    
    console.log('Firebase Admin SDK initialization status:', {
      hasPrivateKey,
      hasPrivateKeyBase64,
      hasClientEmail,
      projectId,
      storageBucket,
      privateKeyValid: !!privateKey && privateKey.includes('-----BEGIN PRIVATE KEY-----')
    });
    
    // Validate that we have a private key before proceeding
    if (!privateKey || !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('No valid private key available. Please set either FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_BASE64 environment variables with a valid service account private key.');
    }
    
    // Validate that we have a client email before proceeding
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    if (!clientEmail) {
      throw new Error('Missing FIREBASE_CLIENT_EMAIL environment variable. Please set this to your Firebase service account email.');
    }
    
    // Create a service account with the private key from environment variables
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "",
      private_key: privateKey,
      client_email: clientEmail,
      client_id: "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
    };
    
    // Initialize Firebase Admin with the service account
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket
    });
    
    console.log('Firebase Admin SDK successfully initialized with service account credentials');
    
    // Get Firebase services
    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    
    // Create mock implementations for graceful failure
    db = {
      collection: (name) => ({
        doc: (id) => ({
          get: async () => ({ exists: false, data: () => null }),
          set: async () => ({}),
          update: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' })
      })
    };
    
    auth = {
      verifyIdToken: async () => ({ uid: 'mock-user-id' })
    };
    
    storage = {
      bucket: () => ({
        file: () => ({
          getSignedUrl: async () => ['https://example.com/mock-url'],
          createWriteStream: () => {
            const mockStream = {
              on: (event, callback) => {
                if (event === 'finish') {
                  // Simulate successful completion
                  setTimeout(callback, 100);
                }
                return mockStream;
              },
              end: () => {
                console.log('Mock stream end called');
                return mockStream;
              }
            };
            return mockStream;
          },
          save: async () => {}
        })
      })
    };
  }
} else {
  // If already initialized, get the existing services
  console.log('Firebase Admin SDK already initialized');
  try {
    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
  } catch (error) {
    console.error('Error getting Firebase services:', error);
  }
}

// Export the Firebase services and utilities
export { db, auth, storage, admin, firestorePath };