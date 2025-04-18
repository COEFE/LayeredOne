// Firebase configuration optimizations for Vercel deployment
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

let firebaseApp;

// Initialize Firebase only once
if (!admin.apps.length) {
  // Check if service account key is provided as a string in environment variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    } catch (error) {
      console.error('Error initializing Firebase from env variable:', error);
    }
  } 
  // Use environment variables directly for service account
  else {
    try {
      // Get service account from individual environment variables
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : null;

      if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
        // Create service account from environment variables
        const serviceAccount = {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "variance-test-4b441",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: privateKey
        };
        
        console.log('Initializing Firebase with service account from env variables');
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET
        });
      } else {
        // Last resort, try application default
        console.log('Falling back to application default credentials');
        firebaseApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });
      }
    } catch (error) {
      console.error('Error initializing Firebase with credentials:', error);
    }
  }
}

// Optimized Firestore settings to prevent timeouts
const db = getFirestore();
db.settings({
  ignoreUndefinedProperties: true,
  minimumCapacity: 1,
  timestampsInSnapshots: true
});

// Cache implementation for Firebase data
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute cache TTL

// Function to get data with cache
async function getDataWithCache(collection, id, forceRefresh = false) {
  const cacheKey = `${collection}:${id}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && !forceRefresh && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
    return cachedData.data;
  }
  
  try {
    const snapshot = await db.collection(collection).doc(id).get();
    const data = snapshot.exists ? snapshot.data() : null;
    
    // Store in cache
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${collection}/${id}:`, error);
    throw error;
  }
}

// Clear cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, CACHE_TTL);

module.exports = {
  db,
  admin,
  getDataWithCache,
  firebaseApp
};