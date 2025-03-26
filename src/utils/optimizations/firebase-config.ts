// Firebase configuration optimizations for Vercel deployment
import { getFirestore } from 'firebase-admin/firestore';
import { auth, db as originalDb, getApp } from '@/firebase/admin-config';

// Optimized Firestore settings to prevent timeouts
const db = originalDb || getFirestore(getApp());

// Make sure the settings are applied
try {
  db.settings({
    ignoreUndefinedProperties: true,
    timestampsInSnapshots: true
  });
} catch (error) {
  console.error('Error configuring Firestore settings:', error);
}

// Cache implementation for Firebase data
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000; // 1 minute cache TTL

// Function to get data with cache
async function getDataWithCache(collection: string, id: string, forceRefresh = false): Promise<any> {
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

export {
  db,
  auth,
  getDataWithCache
};