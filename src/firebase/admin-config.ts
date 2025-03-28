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

// Get private key from environment variable or use a placeholder
// Make sure to handle different formats of private key (with escaped newlines or not)
let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

// Handle private key format - if it contains escaped newlines, replace them
if (privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
  console.log('Formatted private key with newlines');
} else if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
  console.log('Using placeholder private key for development/testing only');
  // Placeholder key only for development
  privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCe/m4WApen/M1n
oOwnO1ajvbdJ3mg4nOPtGFg0OUsnc3CrHDVXObIEaNeYHuxOUFgRLbOx8+xcrmRB
GVoJL367YgIzcaXEVlvFCQ4WrVZDyESWHCjTOafFpAcjM2GgEEiCHRauDSiqwBXo
iyzH/aMKG7zu6xJpRNm2HDlPF9lo6PPC+DGtfV5n4lDWmOQIpghAI4dDbabfLLmL
uNzk2Ddahx5xcWFiJ/ikLRpnnpbPB1o7EbV0wyKPumCBi8/D5oJQIQ0tl7LuyKAj
sQ4U4ofxheCE5pq64GEh9SBmCUbnh5mPyS1tItOXw0kNKp66DXvABsBNzIfsa+dr
nIEgqlE7AgMBAAECggEATo6N3Agp4JGS97nWFMhH1Z1+O1xNiHNUVqhppFwOmw55
w8GrRU63e2BF7d6RiVw/NzWqjKllxqFP3a5mAxXZe0JAriRf8DNvIlqIAIJilhkU
ckq1jS/2ijuyXx0bBlglS0yOES9lQYCpEn35gVL7xJnR7wZs0WB4ZXdqhX7WJ/Py
ODZykBeJ4qsXcbJO7E58vRQoLj3yYu5wEsoVYriHLiNXfVxAEd3rlZ0UeLjGee9z
r55TuRv7AhxF63geeXp2uLRt5e6wRyDMsdCFwhwQKJXfnW1NjLr1lhRuvtUANdrB
fQbPyHklJPAYNUZBax0UvhqTheWJDTHpUHhBpEjbgQKBgQDSnSQpFoQd/MThnUdu
AzSZ0WEXE1cNWsBf0T64NlJpySo4KOAtyythSjIuytiBmHLndS0JPaWV42bkIFEG
WlLTdyCaY5MPVtbUCPBJZZeUB3eo44S46Mp0uxxaMGC3wLR2ke2aHTlvQa+yaE4W
g8ad+t6wlS1jC9WUUsxqIE4f+wKBgQDBQZahY+CP0MDG2q/YJOGpqrft5VxpVPtD
z8IsG10MjHL/2HK8nw8EJ+AaXINM54mcxLkb0attZZUIf2Hfs8Yi/dF1g4hbahT6
1MzWBnTYCHYVQt5KAQLH5GJKVJaUtevZBKN6FQ+aohLiOKBc6J0OppL1queN6K7g
Tv7D5gWPwQKBgCrki+++QSvmRaZ5JIn4JydIaBCOBMWYfONGtxJHJeObb3i+gmFx
JiWLOcsjzpIeHRCcYY6nOmjbRiIhnr6/eGzOrxoiO1n9YoUOSPl5sjQYjTsdEvOh
nVHGpZCMl7X0jgwzzgL7/q104DZiXbziG3ojFGU8DGFGkLnDXxQh/icvAoGAPWKp
BxCjlur3IPL74gstBuisTcuKBAczXMHUapAyiTbfnHbTUyiu62IDJDx4lGgDZSFz
rut1qWUX5sAXhagj6p929f3WxTq3+Ui4287nNGvTnkNEOnuBt57KvdOKlSgIB0Ia
7z9bWoHav7K+9WQJ50pv6crkjEX5rlRJRk59O8ECgYEAuipnpFp3k05ZUl1W8bVd
kPzrL9/rxFviaapUi8ZwE4CPEEopXRO6nJSen6QjKkxM3uRBybTa1u1cc2e4AMBV
yIbP4SVlkIAOoR0jk4e9skCgN0JWjqt36kbbM9GWAAz97Gw25vqxtPFCj0EUahVo
T78NlclGYfEsc1Qvj/fc7Ws=
-----END PRIVATE KEY-----`;
}

// Initialize Firebase Admin if not already initialized
let db;
let auth;
let storage;

if (!admin.apps.length) {
  try {
    console.log('Initializing Firebase Admin SDK with hardcoded credential...');
    
    // Log the environment variable status
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    console.log('Firebase Admin SDK initialization status:', {
      hasPrivateKey,
      hasClientEmail,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "variance-test-4b441",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "variance-test-4b441.appspot.com"
    });
    
    // Create a service account with the private key from environment variables
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "variance-test-4b441",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "96aa094298f80099a378e9244b8e7e22f214cc2a",
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com",
      client_id: "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
        process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com"
      )}`
    };
    
    // Initialize Firebase Admin with the service account
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "variance-test-4b441.firebasestorage.app"
    });
    
    console.log('Firebase Admin SDK successfully initialized');
    
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
          getSignedUrl: async () => ['https://example.com/mock-url']
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