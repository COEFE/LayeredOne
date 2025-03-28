/**
 * Test Application Default Credentials for Firebase
 * 
 * This script attempts to initialize Firebase Admin SDK using
 * application default credentials.
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Import the Firebase admin SDK
const admin = require('firebase-admin');

console.log('===== Testing Firebase Application Default Credentials =====\n');

async function testApplicationDefaultCredentials() {
  try {
    console.log('Attempting to initialize Firebase Admin with application default credentials');
    
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin SDK is already initialized. Deleting existing app...');
      await admin.app().delete();
    }
    
    // Initialize Firebase with application default credentials
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
    
    console.log('✅ Successfully initialized Firebase Admin with application default credentials');
    
    // Test Storage access
    console.log('Testing Storage access...');
    const storage = admin.storage();
    const bucket = storage.bucket();
    const files = await bucket.getFiles({ maxResults: 1 });
    console.log(`✅ Successfully accessed Storage bucket (found ${files[0]?.length || 0} files)`);
    
    // Test Firestore access
    console.log('Testing Firestore access...');
    const db = admin.firestore();
    const testCollection = db.collection('_test_connection');
    const snapshot = await testCollection.limit(1).get();
    console.log(`✅ Successfully accessed Firestore (found ${snapshot.size} documents)`);
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetailed error information:');
    console.error(error);
    
    // Specific guidance based on error type
    if (error.message.includes('could not load the default credentials')) {
      console.log('\nGUIDANCE:');
      console.log('1. Verify that you have authenticated with Google Cloud SDK: gcloud auth application-default login');
      console.log('2. Check if GOOGLE_APPLICATION_CREDENTIALS environment variable is set correctly');
      console.log('3. Consider using explicit service account key instead of application default credentials for Vercel deployment');
    }
    
    return false;
  }
}

// Alternative solution using service account key
async function testServiceAccountKey() {
  try {
    console.log('\n===== Testing Service Account Key Alternative =====\n');
    
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    if (!privateKey || !clientEmail || !projectId) {
      console.log('❌ Missing required environment variables for service account key test');
      return false;
    }
    
    // Clean up the private key
    const cleanedPrivateKey = privateKey.replace(/\\n/g, '\n');
    
    // Try to create a credential with service account key
    const serviceAccount = {
      projectId: projectId,
      clientEmail: clientEmail,
      privateKey: cleanedPrivateKey
    };
    
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin SDK is already initialized. Deleting existing app...');
      await admin.app().delete();
    }
    
    // Initialize Firebase with service account key
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
    
    console.log('✅ Successfully initialized Firebase Admin with service account key');
    
    // Test Storage access
    console.log('Testing Storage access with service account key...');
    const storage = admin.storage();
    const bucket = storage.bucket();
    const files = await bucket.getFiles({ maxResults: 1 });
    console.log(`✅ Successfully accessed Storage bucket (found ${files[0]?.length || 0} files)`);
    
    return true;
  } catch (error) {
    console.error('❌ Error using service account key:', error.message);
    return false;
  }
}

// Run the tests
(async () => {
  const adcResult = await testApplicationDefaultCredentials();
  if (!adcResult) {
    await testServiceAccountKey();
  }
})();