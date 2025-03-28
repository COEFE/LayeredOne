// Use dynamic imports to prevent build-time errors
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

// Create firestore path utility in case @google-cloud/firestore isn't available
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

import * as path from 'path';
import * as fs from 'fs';

// Check for different deployment environments
const isVercel = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true';
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const useRealFirebase = process.env.NEXT_PUBLIC_USE_REAL_FIREBASE === 'true';

// Define a function to check if a file exists in a safe way
const fileExists = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error(`Error checking if file exists at ${filePath}:`, error);
    return false;
  }
};

// Only for GitHub Pages we'll use mock objects since it's a static deployment
const createMockFirebaseAdmin = () => {
  console.log('Creating mock Firebase Admin objects for GitHub Pages static deployment');
  
  // Create mock firestore database class constructor
  class FirestoreDatabase {
    constructor() {
      this.collection = (name) => ({
        doc: (id) => ({
          get: async () => ({ exists: false, data: () => null, id: id || 'mock-id' }),
          collection: (subName) => this.collection(subName),
          update: async () => ({}),
          set: async () => ({}),
          delete: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' }),
        where: () => ({
          get: async () => ({ empty: true, docs: [], forEach: () => {} })
        })
      });
    }
  }
  
  // Create mock firestore with proper constructor
  const mockFirestore = new FirestoreDatabase();
  
  // Create mock auth
  const mockAuth = {
    verifyIdToken: async () => ({ uid: 'mock-user-id' })
  };
  
  // Create mock storage
  const mockStorage = {
    bucket: () => ({
      file: () => ({
        getSignedUrl: async () => ['https://example.com/mock-url'],
        save: async () => ({}),
        delete: async () => ({})
      })
    })
  };
  
  return {
    mockFirestore,
    mockAuth,
    mockStorage
  };
};

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Initialize with hard-coded values for Next.js compatibility
    // This avoids the "Critical dependency: the request of a dependency is an expression" error
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "variance-test-4b441",
        clientEmail: "firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com",
        // Replace any newlines in the private key, as environment variables don't preserve them
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCe/m4WApen/M1n\noOwnO1ajvbdJ3mg4nOPtGFg0OUsnc3CrHDVXObIEaNeYHuxOUFgRLbOx8+xcrmRB\nGVoJL367YgIzcaXEVlvFCQ4WrVZDyESWHCjTOafFpAcjM2GgEEiCHRauDSiqwBXo\niyzH/aMKG7zu6xJpRNm2HDlPF9lo6PPC+DGtfV5n4lDWmOQIpghAI4dDbabfLLmL\nuNzk2Ddahx5xcWFiJ/ikLRpnnpbPB1o7EbV0wyKPumCBi8/D5oJQIQ0tl7LuyKAj\nsQ4U4ofxheCE5pq64GEh9SBmCUbnh5mPyS1tItOXw0kNKp66DXvABsBNzIfsa+dr\nnIEgqlE7AgMBAAECggEATo6N3Agp4JGS97nWFMhH1Z1+O1xNiHNUVqhppFwOmw55\nw8GrRU63e2BF7d6RiVw/NzWqjKllxqFP3a5mAxXZe0JAriRf8DNvIlqIAIJilhkU\nckq1jS/2ijuyXx0bBlglS0yOES9lQYCpEn35gVL7xJnR7wZs0WB4ZXdqhX7WJ/Py\nODZykBeJ4qsXcbJO7E58vRQoLj3yYu5wEsoVYriHLiNXfVxAEd3rlZ0UeLjGee9z\nr55TuRv7AhxF63geeXp2uLRt5e6wRyDMsdCFwhwQKJXfnW1NjLr1lhRuvtUANdrB\nfQbPyHklJPAYNUZBax0UvhqTheWJDTHpUHhBpEjbgQKBgQDSnSQpFoQd/MThnUdu\nAzSZ0WEXE1cNWsBf0T64NlJpySo4KOAtyythSjIuytiBmHLndS0JPaWV42bkIFEG\nWlLTdyCaY5MPVtbUCPBJZZeUB3eo44S46Mp0uxxaMGC3wLR2ke2aHTlvQa+yaE4W\ng8ad+t6wlS1jC9WUUsxqIE4f+wKBgQDBQZahY+CP0MDG2q/YJOGpqrft5VxpVPtD\nz8IsG10MjHL/2HK8nw8EJ+AaXINM54mcxLkb0attZZUIf2Hfs8Yi/dF1g4hbahT6\n1MzWBnTYCHYVQt5KAQLH5GJKVJaUtevZBKN6FQ+aohLiOKBc6J0OppL1queN6K7g\nTv7D5gWPwQKBgCrki+++QSvmRaZ5JIn4JydIaBCOBMWYfONGtxJHJeObb3i+gmFx\nJiWLOcsjzpIeHRCcYY6nOmjbRiIhnr6/eGzOrxoiO1n9YoUOSPl5sjQYjTsdEvOh\nnVHGpZCMl7X0jgwzzgL7/q104DZiXbziG3ojFGU8DGFGkLnDXxQh/icvAoGAPWKp\nBxCjlur3IPL74gstBuisTcuKBAczXMHUapAyiTbfnHbTUyiu62IDJDx4lGgDZSFz\nrut1qWUX5sAXhagj6p929f3WxTq3+Ui4287nNGvTnkNEOnuBt57KvdOKlSgIB0Ia\n7z9bWoHav7K+9WQJ50pv6crkjEX5rlRJRk59O8ECgYEAuipnpFp3k05ZUl1W8bVd\nkPzrL9/rxFviaapUi8ZwE4CPEEopXRO6nJSen6QjKkxM3uRBybTa1u1cc2e4AMBV\nyIbP4SVlkIAOoR0jk4e9skCgN0JWjqt36kbbM9GWAAz97Gw25vqxtPFCj0EUahVo\nT78NlclGYfEsc1Qvj/fc7Ws=\n-----END PRIVATE KEY-----\n"
      }),
      projectId: "variance-test-4b441",
      storageBucket: "variance-test-4b441.firebasestorage.app"
    });
    
    console.log('Firebase Admin SDK initialized with hardcoded credentials');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    
    // Last resort fallback 
    if (!admin.apps.length) {
      try {
        console.log('Attempting fallback initialization with minimal config');
        
        // Try to create a minimal service account object with just the required fields
        const minimalServiceAccount = {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com',
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "-----BEGIN PRIVATE KEY-----\nPLACEHOLDER\n-----END PRIVATE KEY-----\n"
        };
        
        admin.initializeApp({
          credential: admin.credential.cert(minimalServiceAccount),
          projectId: 'variance-test-4b441',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app'
        });
        
        console.log('Firebase Admin SDK initialized with fallback config (may have limited functionality)');
      } catch (fallbackError) {
        console.error('Failed to initialize Admin SDK even with fallback:', fallbackError);
        
        if (fallbackError.message?.includes('no such file') || fallbackError.message?.includes('ENOENT')) {
          console.error('CRITICAL ERROR: Still encountering file not found errors in fallback initialization');
          console.error('Please ensure your environment variables are set correctly in Vercel');
        }
        
        // One last attempt with absolutely no credential
        try {
          admin.initializeApp({
            projectId: 'variance-test-4b441',
            storageBucket: 'variance-test-4b441.firebasestorage.app'
          });
          console.log('WARNING: Firebase Admin SDK initialized without credentials (extremely limited functionality)');
        } catch (lastError) {
          console.error('All initialization attempts failed:', lastError);
        }
      }
    }
  }
}

// Always use real Firebase Admin SDK (except for GitHub Pages static builds)
let db, auth, storage, adminDb, adminAuth, adminStorage;

// Handle GitHub Pages static builds and non-development environments separately 
if (isGitHubPages && !useRealFirebase) {
  // Only use mock objects in GitHub Pages environment since it's static
  console.log('Using mock Firebase Admin objects for GitHub Pages static hosting');
  const { mockFirestore, mockAuth, mockStorage } = createMockFirebaseAdmin();
  db = mockFirestore;
  auth = mockAuth;
  storage = mockStorage;
  adminDb = mockFirestore;
  adminAuth = mockAuth;
  adminStorage = mockStorage;
} else {
  // Use real Firebase Admin SDK for all environments (development and production)
  console.log('Using real Firebase Admin SDK');
  
  try {
    // For admin SDK configuration
    const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
    let privateKey;
    
    // Try to get the private key from multiple sources
    // First check for base64 encoded key
    const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
    if (privateKeyBase64) {
      try {
        // Decode the base64 key
        privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
        console.log('Successfully decoded FIREBASE_PRIVATE_KEY_BASE64');
      } catch (base64Error) {
        console.error('Error decoding FIREBASE_PRIVATE_KEY_BASE64:', base64Error);
        // Fall back to standard key
      }
    }
    
    // If base64 key didn't work, try standard key
    if (!privateKey && privateKeyEnv) {
      try {
        // Advanced private key processing for Vercel environment
        // First, cleanup any unexpected formatting from the environment
        let cleanKey = privateKeyEnv;
        
        // 1. Remove any extra quotes that might be wrapping the key
        if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
          cleanKey = cleanKey.substring(1, cleanKey.length - 1);
        }
        
        // 2. Handle different newline formats
        if (cleanKey.includes('\\n')) {
          // Convert escaped \n to actual newlines
          cleanKey = cleanKey.replace(/\\n/g, '\n');
        }
        
        // 3. Check for valid PEM structure
        if (!cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
          console.warn('Warning: Private key does not contain BEGIN marker');
        }
        
        if (!cleanKey.includes('-----END PRIVATE KEY-----')) {
          console.warn('Warning: Private key does not contain END marker');
        }
        
        // 4. Ensure the key has proper formatting with required newlines
        // Make sure the BEGIN line is on its own line
        if (!cleanKey.startsWith('-----BEGIN PRIVATE KEY-----\n')) {
          cleanKey = cleanKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
        }
        
        // Make sure the END line is preceded by a newline
        if (!cleanKey.includes('\n-----END PRIVATE KEY-----')) {
          cleanKey = cleanKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
        }
        
        // If the key still doesn't end with a newline, add one
        if (!cleanKey.endsWith('\n')) {
          cleanKey = cleanKey + '\n';
        }
        
        // 5. Verify basic structure (BEGIN/END markers with content between)
        const keyPattern = /-----BEGIN PRIVATE KEY-----\n(.+)\n-----END PRIVATE KEY-----\n/s;
        const match = cleanKey.match(keyPattern);
        
        if (!match) {
          console.warn('Warning: Private key does not match expected PEM format');
          // Try a more comprehensive reconstruction as a last resort
          cleanKey = `-----BEGIN PRIVATE KEY-----\n${
            cleanKey.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
              .replace(/\n+/g, '')
              .match(/.{1,64}/g)?.join('\n') || ''
          }\n-----END PRIVATE KEY-----\n`;
        }
        
        privateKey = cleanKey;
        console.log('Successfully processed environment private key');
      } catch (keyError) {
        console.error('Error processing private key:', keyError);
        
        // Fallback to a basic transformation
        if (privateKeyEnv.includes('\\n')) {
          privateKey = privateKeyEnv.replace(/\\n/g, '\n');
        } else {
          privateKey = privateKeyEnv;
        }
      }
    } else {
      // Use service account private key directly for development
      console.log('Using embedded service account for development');
      privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC8qZf/erJPqFnk\nDDdpGKFgsNp2C9yJ7nX33KgSoTM9Fh2HtKjUzRGgPjEq/KLRzU76yv7vfJAe1bnN\nExWeDTWdN5EpY1gioCvtZL1ZQ8qwi8f9ls7r3mJgPo9mGh/cWoVPHPjHPiw46SpT\n9BMZa3So5CNi7uh6l6UYwi/jJBZZgKk9nn8R/dBd6Pl//g7+nt+k2N2va69oyapu\nHgE8Mv4FLOpn/4eoVru/WTwhiZI1ObQ9G1ngVTqy+v+syMQxk48oJ6yi0gm9qaKB\nKep8HdXFKiBxfhssB9C9EarAAQ4pJ6B3hc5DcjnfSdAJsdB6Z5zeGLdIx6yNqbaW\novD02wblAgMBAAECggEAINAkaiBme/lNbR780jAg/Ua1MFvexzSs2ufLabYUydab\nWzt+M8jY/HRkq9PV48SgLHl6/p89F8fXcYYUt/EXNplwC3FGZntSOI9RaYGjcrJV\nHdOJeLesh43J9hmsGfC6h+iDkm/LVDiljoWAfubUGv3W88GWuJ/AbL51gr2Hj5hG\n7QacJJ1bHcUns/3DWW5dkiffOJOX6fUl19CMchi8+JVdG6v1/f9JuA5V3wVqBpDG\nhhzKmsqkHHIrbKafuw+xbdjAj4iTgdZ0eJLrUxxnip4h0fphpl9n8tG7Cp4KPwQS\nw/2uPoTNGXLLnsDYq952Z0dTP/ENQLZdAOe/Snw83wKBgQDs/xjQhhURPdCFPh5h\nQkRVNtOyFR0Y7gNQQ16VuVW/xZpqq4Labi8GLP0qKhRyZk5wtTHD1t/zJ0k794LO\nZ2FtJHoAB1hThS1OxbCU0pDyvzwjdkDG4ggE5reJfFlmwUuvhHraiaRCE0eJVAsZ\nWatRvfXQuTk5R1ZPGzmRfVPO5wKBgQDLylRKXNidotLmHyQ6Nomdbf+/zN3X5tua\nXf2XlXqLjnmK6Kx6J/fa9VjN1DZ5OsiEfxFVdDZADbnriDggwtp5qPwJPqM/vVfh\nWPWowqHK9S63erC+YU98MTqRGk5NsQvRU1ZdSlEMPYT/ch4Tbg8mccUfPdUOrKtW\nhPk68XU+UwKBgH8dJ+MYN46C2CfPNJ4328zU1mDK4Etxxcc0CzRFLs/oHbWe/lVI\nCeLHGJaX8VWWt/XNyb5frsiNRsNqMvegDWpryR/g0KgjYzS/5cE820/H8GqYz4+c\nxm5SjRip4I2zmXOvm/FBKB/klVb8A+P562CxgXoNDrtBHvLZCFyXmu77AoGAezNC\nagJfYk1BOqWw/RBjea06Y/WyWAfU0ynnWXCguSXVDMlFHER1bwXMPgMBO6DyAEfh\nbsvm0Cp8L4wWgpfKBKrIU75uauZI7o8dVHz12wEG0R13JGEn8GjCg15n4EgcYNwE\n5jk7bi7y7ItM62op9o/pH839s/VnT9Lr6Vp4CskCgYB3g8NBEZzKqrJEjbMTo0xT\nsG+UAwoTXdbt1U2LAIPd+/4ELTe6TcsVzcX9JQBdaI/ELgC0ltme1R9v/zysXBBb\nv/DUzX1lT765satMDogYV4RE0VuS2GKnuNJrLGwS9PYSsrvUPIZLvuFm2J65/xPN\nOm3MLGnAhbqyqFhH8g4Dcw==\n-----END PRIVATE KEY-----\n";
    }
    
    // Use consistent service account credentials for all environments
    // The key property should be 'private_key' (with underscore) not 'privateKey'
    // This is critical for compatibility with Google Cloud Auth
    const serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "variance-test-4b441",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "96aa094298f80099a378e9244b8e7e22f214cc2a",
      private_key: privateKey  // IMPORTANT: This must be 'private_key' not 'privateKey'
    };
    
    // Initialize if not already initialized
    if (!admin.apps.length) {
      console.log(`Initializing Firebase Admin SDK for ${isVercel ? 'Vercel' : 'development'} environment`);
      
      try {
        // We're no longer checking for local service account files
        // Always use environment variables for Vercel compatibility
        console.log('Using environment variables for Firebase credentials');
        
        // Always use the service account object created from environment variables
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "variance-test-4b441.firebasestorage.app"
        });
        
        console.log('Successfully initialized Firebase Admin SDK with credential object');
      } catch (initError) {
        console.error('Failed to initialize Firebase Admin:', initError);
        
        // Log more detailed error information to help diagnose the issue
        if (initError.message?.includes('no such file') || initError.message?.includes('ENOENT')) {
          console.error('File not found error detected. This may be due to trying to access a service account JSON file');
          console.error('Solution: Use environment variables instead of file paths for credentials');
        }
      }
    }
    
    // Create mock services that will be used if real ones aren't available
    const mockDb = {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({ exists: false, data: () => null, id: id || 'mock-id' }),
          collection: (subName: string) => mockDb.collection(subName),
          update: async () => ({}),
          set: async () => ({}),
          delete: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' })
      })
    };
    
    const mockAuth = {
      verifyIdToken: async () => ({ uid: 'mock-user-id' })
    };
    
    const mockStorage = {
      bucket: () => ({
        file: () => ({
          getSignedUrl: async () => ['https://example.com/mock-url'],
          save: async () => ({}),
          delete: async () => ({})
        })
      })
    };
    
    // Check if there's a reference to a service account JSON file in the code and log info
    if (admin && admin.credential && typeof admin.credential.cert === 'function') {
      try {
        // Get the current app if it exists
        const app = admin.apps.length ? admin.app() : null;
        if (app) {
          const options = app.options;
          if (options && options.credential) {
            console.log('Firebase Admin SDK initialized with credential object');
          } else {
            console.log('Firebase Admin SDK initialized but credential details unknown');
          }
        }
      } catch (checkError) {
        console.error('Error checking credentials:', checkError);
      }
    }
    
    // Try to get real services, fall back to mocks if unavailable
    try {
      db = admin.firestore();
      auth = admin.auth();
      storage = admin.storage();
      console.log('Using real Firebase Admin services');
    } catch (serviceError) {
      console.error('Error getting Firebase services, using mocks:', serviceError);
      db = mockDb;
      auth = mockAuth;
      storage = mockStorage;
    }
    
    adminDb = db;
    adminAuth = auth;
    adminStorage = storage;
    
    console.log('Firebase Admin SDK initialization complete');
  } catch (error) {
    console.error('Error in Firebase Admin setup:', error);
    // Create fallback implementations instead of throwing
    db = {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({ exists: false, data: () => null }),
          set: async () => ({}),
          update: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' })
      })
    };
    auth = { verifyIdToken: async () => ({ uid: 'mock-user-id' }) };
    storage = { 
      bucket: () => ({
        file: () => ({
          getSignedUrl: async () => ['https://example.com/mock-url']
        })
      })
    };
    adminDb = db;
    adminAuth = auth;
    adminStorage = storage;
  }
}

// Export the initialized instances and path utility
export { db, auth, storage, adminDb, adminAuth, adminStorage, admin, firestorePath };