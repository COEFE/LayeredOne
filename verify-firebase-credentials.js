/**
 * Firebase Credentials Verification Script
 * 
 * This script verifies your Firebase credentials by attempting to:
 * 1. Load the Admin SDK
 * 2. Initialize Firebase Admin with your credentials
 * 3. Test authentication by generating a JWT token
 * 4. Test Storage by getting a signed URL
 * 
 * Run this script in your environment to diagnose credential issues.
 */

// Load environment variables if using dotenv
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, continuing with process.env');
}

// Utility function to check if a PEM key is valid
function isPemKeyValid(key) {
  if (!key) return false;
  return (
    key.includes('-----BEGIN PRIVATE KEY-----') &&
    key.includes('-----END PRIVATE KEY-----')
  );
}

// Process the private key, handling escaped newlines
function processPrivateKey(key) {
  if (!key) return null;
  
  // Remove any quotes
  key = key.replace(/^["']|["']$/g, '');
  
  // Replace escaped newlines with actual newlines
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  
  return key;
}

// Get the private key from environment variables
function getPrivateKey() {
  // Try standard private key first
  if (process.env.FIREBASE_PRIVATE_KEY) {
    const key = processPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    if (isPemKeyValid(key)) {
      console.log('Found valid FIREBASE_PRIVATE_KEY');
      return key;
    } else {
      console.warn('FIREBASE_PRIVATE_KEY found but format is invalid');
    }
  } else {
    console.warn('FIREBASE_PRIVATE_KEY not found');
  }
  
  // Try base64 encoded key
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      console.log('Decoding FIREBASE_PRIVATE_KEY_BASE64...');
      const decoded = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
      const key = processPrivateKey(decoded);
      
      if (isPemKeyValid(key)) {
        console.log('Found valid FIREBASE_PRIVATE_KEY_BASE64');
        return key;
      } else {
        console.warn('Decoded FIREBASE_PRIVATE_KEY_BASE64 has invalid format');
      }
    } catch (error) {
      console.error('Error decoding FIREBASE_PRIVATE_KEY_BASE64:', error.message);
    }
  } else {
    console.warn('FIREBASE_PRIVATE_KEY_BASE64 not found');
  }
  
  return null;
}

async function verifyCredentials() {
  console.log('======= Firebase Credentials Verification =======');
  
  // Check environment variables
  console.log('\nChecking environment variables:');
  const envVars = {
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Not set',
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Not set',
    FIREBASE_PRIVATE_KEY_BASE64: process.env.FIREBASE_PRIVATE_KEY_BASE64 ? '✅ Set' : '❌ Not set',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Not set',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Set' : '❌ Not set'
  };
  
  console.table(envVars);
  
  // Get private key
  console.log('\nVerifying private key:');
  const privateKey = getPrivateKey();
  
  if (!privateKey) {
    console.error('❌ Could not obtain a valid private key from environment variables');
    console.log('Please set either FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_BASE64 with a valid service account key');
    return;
  }
  
  console.log('✅ Successfully obtained valid private key');
  
  // Import Firebase Admin
  console.log('\nImporting Firebase Admin SDK:');
  let admin;
  try {
    admin = require('firebase-admin');
    console.log('✅ Firebase Admin SDK successfully imported');
  } catch (error) {
    console.error('❌ Error importing Firebase Admin SDK:', error.message);
    console.log('Please install Firebase Admin SDK: npm install firebase-admin');
    return;
  }
  
  // Create service account
  console.log('\nCreating service account credentials:');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441';
  
  if (!clientEmail) {
    console.error('❌ FIREBASE_CLIENT_EMAIL is not set');
    console.log('Please set FIREBASE_CLIENT_EMAIL to your service account email');
    return;
  }
  
  const serviceAccount = {
    type: 'service_account',
    project_id: projectId,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'key-id',
    private_key: privateKey,
    client_email: clientEmail,
    client_id: '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
  };
  
  console.log('✅ Service account credential object created');
  
  // Initialize Firebase Admin
  console.log('\nInitializing Firebase Admin:');
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  
  try {
    // Use a unique app name to avoid conflicts
    const verifyApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket
    }, 'verify-app');
    
    console.log('✅ Firebase Admin SDK successfully initialized');
    
    // Test Authentication
    console.log('\nTesting Authentication with JWT:');
    try {
      // Import JWT for custom token creation
      const jwt = require('jsonwebtoken');
      
      // Create a test JWT token
      const testToken = jwt.sign(
        { test: 'data', iat: Math.floor(Date.now() / 1000) },
        privateKey,
        { algorithm: 'RS256' }
      );
      
      console.log('✅ Successfully created JWT token with private key');
      
      // Create a custom token with the Admin SDK
      const customToken = await verifyApp.auth().createCustomToken('test-user');
      console.log('✅ Successfully created Firebase custom token');
    } catch (error) {
      console.error('❌ Error during authentication test:', error.message);
    }
    
    // Test Storage
    console.log('\nTesting Storage with signed URL generation:');
    try {
      const storage = verifyApp.storage();
      const bucket = storage.bucket();
      
      console.log(`Storage bucket: ${bucket.name}`);
      
      // Create a test file reference
      const testFile = bucket.file('verify-credentials-test.txt');
      
      // Try to generate a signed URL - this is where the invalid_grant error occurs
      const [signedUrl] = await testFile.getSignedUrl({
        action: 'write',
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
        contentType: 'text/plain',
      });
      
      console.log('✅ Successfully generated signed URL');
      console.log('This confirms your service account has proper permissions!');
    } catch (error) {
      console.error('❌ Error during storage test:', error.message);
      
      if (error.message.includes('invalid_grant')) {
        console.error('\nDETECTED INVALID_GRANT ERROR:');
        console.error('This typically occurs when your service account credentials are outdated or revoked.');
        console.error('Possible solutions:');
        console.error('1. Generate a new service account key in the Firebase console');
        console.error('2. Update your FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL environment variables');
        console.error('3. Ensure the service account has proper permissions for Storage');
      }
    }
    
    // Clean up
    try {
      await verifyApp.delete();
      console.log('\nSuccessfully cleaned up test Firebase app');
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError.message);
    }
    
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
  }
  
  console.log('\n======= Verification Complete =======');
}

// Run the verification
verifyCredentials().catch(error => {
  console.error('Unexpected error during verification:', error);
});