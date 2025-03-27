import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Check for different deployment environments
const isVercel = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true';
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

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

// Initialize Firebase Admin SDK only if not in Vercel/GitHub Pages and not already initialized
if (!admin.apps.length && !isVercel && !isGitHubPages) {
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
        console.log('Attempting fallback initialization');
        
        admin.initializeApp({
          projectId: 'variance-test-4b441',
          storageBucket: 'variance-test-4b441.firebasestorage.app'
        });
        
        console.log('Firebase Admin SDK initialized with fallback config (limited functionality)');
      } catch (fallbackError) {
        console.error('Failed to initialize Admin SDK even with fallback:', fallbackError);
        // Just continue - we'll handle errors at the point of use
      }
    }
  }
}

// Create mock objects only for GitHub Pages, use real Firebase Admin for all other environments
let db, auth, storage, adminDb, adminAuth, adminStorage;

if (isGitHubPages) {
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
  // Use real Firebase Admin SDK for all other environments including Vercel
  console.log('Using real Firebase Admin SDK');
  
  try {
    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
      // For Vercel, we need to initialize with credentials here
      if (isVercel) {
        console.log('Initializing Firebase Admin SDK for Vercel environment');
        
        // Check for required env vars
        if (!process.env.FIREBASE_PRIVATE_KEY) {
          console.error('FIREBASE_PRIVATE_KEY environment variable is missing');
        }
        
        // The private key can come in different formats (raw or escaped newlines)
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        // If the key exists, ensure proper formatting with newlines
        if (privateKey) {
          // Replace escaped newlines with actual newlines if they exist
          privateKey = privateKey.replace(/\\n/g, '\n');
        } else {
          // Use a fallback private key for development/testing
          console.log('WARNING: Using fallback private key. This should only be used for development.');
          privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC8qZf/erJPqFnk\nDDdpGKFgsNp2C9yJ7nX33KgSoTM9Fh2HtKjUzRGgPjEq/KLRzU76yv7vfJAe1bnN\nExWeDTWdN5EpY1gioCvtZL1ZQ8qwi8f9ls7r3mJgPo9mGh/cWoVPHPjHPiw46SpT\n9BMZa3So5CNi7uh6l6UYwi/jJBZZgKk9nn8R/dBd6Pl//g7+nt+k2N2va69oyapu\nHgE8Mv4FLOpn/4eoVru/WTwhiZI1ObQ9G1ngVTqy+v+syMQxk48oJ6yi0gm9qaKB\nKep8HdXFKiBxfhssB9C9EarAAQ4pJ6B3hc5DcjnfSdAJsdB6Z5zeGLdIx6yNqbaW\novD02wblAgMBAAECggEAINAkaiBme/lNbR780jAg/Ua1MFvexzSs2ufLabYUydab\nWzt+M8jY/HRkq9PV48SgLHl6/p89F8fXcYYUt/EXNplwC3FGZntSOI9RaYGjcrJV\nHdOJeLesh43J9hmsGfC6h+iDkm/LVDiljoWAfubUGv3W88GWuJ/AbL51gr2Hj5hG\n7QacJJ1bHcUns/3DWW5dkiffOJOX6fUl19CMchi8+JVdG6v1/f9JuA5V3wVqBpDG\nhhzKmsqkHHIrbKafuw+xbdjAj4iTgdZ0eJLrUxxnip4h0fphpl9n8tG7Cp4KPwQS\nw/2uPoTNGXLLnsDYq952Z0dTP/ENQLZdAOe/Snw83wKBgQDs/xjQhhURPdCFPh5h\nQkRVNtOyFR0Y7gNQQ16VuVW/xZpqq4Labi8GLP0qKhRyZk5wtTHD1t/zJ0k794LO\nZ2FtJHoAB1hThS1OxbCU0pDyvzwjdkDG4ggE5reJfFlmwUuvhHraiaRCE0eJVAsZ\nWatRvfXQuTk5R1ZPGzmRfVPO5wKBgQDLylRKXNidotLmHyQ6Nomdbf+/zN3X5tua\nXf2XlXqLjnmK6Kx6J/fa9VjN1DZ5OsiEfxFVdDZADbnriDggwtp5qPwJPqM/vVfh\nWPWowqHK9S63erC+YU98MTqRGk5NsQvRU1ZdSlEMPYT/ch4Tbg8mccUfPdUOrKtW\nhPk68XU+UwKBgH8dJ+MYN46C2CfPNJ4328zU1mDK4Etxxcc0CzRFLs/oHbWe/lVI\nCeLHGJaX8VWWt/XNyb5frsiNRsNqMvegDWpryR/g0KgjYzS/5cE820/H8GqYz4+c\nxm5SjRip4I2zmXOvm/FBKB/klVb8A+P562CxgXoNDrtBHvLZCFyXmu77AoGAezNC\nagJfYk1BOqWw/RBjea06Y/WyWAfU0ynnWXCguSXVDMlFHER1bwXMPgMBO6DyAEfh\nbsvm0Cp8L4wWgpfKBKrIU75uauZI7o8dVHz12wEG0R13JGEn8GjCg15n4EgcYNwE\n5jk7bi7y7ItM62op9o/pH839s/VnT9Lr6Vp4CskCgYB3g8NBEZzKqrJEjbMTo0xT\nsG+UAwoTXdbt1U2LAIPd+/4ELTe6TcsVzcX9JQBdaI/ELgC0ltme1R9v/zysXBBb\nv/DUzX1lT765satMDogYV4RE0VuS2GKnuNJrLGwS9PYSsrvUPIZLvuFm2J65/xPN\nOm3MLGnAhbqyqFhH8g4Dcw==\n-----END PRIVATE KEY-----\n";
        }
        
        // Log some diagnostics (hiding most of private key)
        if (privateKey) {
          const keyStart = privateKey.slice(0, 40);
          const keyEnd = privateKey.slice(-20);
          console.log(`Private key format check: Starts with "${keyStart}..." and ends with "...${keyEnd}"`);
          console.log(`Private key length: ${privateKey.length} characters`);
          
          // Validate key has BEGIN and END markers
          if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
            console.error("INVALID PRIVATE KEY FORMAT: Missing BEGIN/END markers");
          }
        }
        
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "variance-test-4b441",
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com",
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "96aa094298f80099a378e9244b8e7e22f214cc2a",
            privateKey: privateKey
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "variance-test-4b441.firebasestorage.app"
        });
      }
    }
    
    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
    adminDb = db;
    adminAuth = auth;
    adminStorage = storage;
  } catch (error) {
    console.error('Error initializing Firebase Admin services:', error);
    throw error; // Re-throw to make sure the error is visible
  }
}

// Export the initialized instances
export { db, auth, storage, adminDb, adminAuth, adminStorage, admin };