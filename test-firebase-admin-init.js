/**
 * Test Script to Debug Firebase Admin SDK Initialization
 * 
 * This script tests various ways of initializing the Firebase Admin SDK
 * to help identify which method works correctly.
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

console.log('===== FIREBASE ADMIN SDK INITIALIZATION TEST =====\n');

// Check environment variables
console.log('Checking environment variables:');
console.log(`- FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set'}`);
console.log(`- FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? 'Set (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ')' : 'Not set'}`);
console.log(`- FIREBASE_PRIVATE_KEY_BASE64: ${process.env.FIREBASE_PRIVATE_KEY_BASE64 ? 'Set (length: ' + process.env.FIREBASE_PRIVATE_KEY_BASE64.length + ')' : 'Not set'}`);
console.log(`- NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not set'}`);
console.log(`- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'Not set'}`);
console.log();

// Test multiple initialization methods
console.log('Testing different initialization methods:\n');

// Import admin
let admin;
try {
  admin = require('firebase-admin');
  console.log('✅ Successfully imported firebase-admin');
} catch (error) {
  console.error('❌ Failed to import firebase-admin:', error.message);
  process.exit(1);
}

// Test if already initialized
if (admin.apps.length > 0) {
  console.log('⚠️ Firebase Admin SDK is already initialized. Deleting all existing apps...');
  admin.apps.forEach((app) => {
    app.delete().then(() => console.log('App deleted'));
  });
}

// Array to store test results
const testResults = [];

// Test 1: Initialize with FIREBASE_PRIVATE_KEY
async function testWithPrivateKey() {
  try {
    console.log('TEST 1: Initialize with FIREBASE_PRIVATE_KEY');
    
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey) {
      console.log('❌ FIREBASE_PRIVATE_KEY is not set, skipping test');
      return { method: 'FIREBASE_PRIVATE_KEY', success: false, error: 'Environment variable not set' };
    }
    
    // Process the private key
    let processedKey = privateKey;
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      processedKey = privateKey.substring(1, privateKey.length - 1);
    }
    if (processedKey.includes('\\n')) {
      processedKey = processedKey.replace(/\\n/g, '\n');
    }
    
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: processedKey
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app'
    }, 'test-private-key');
    
    // Verify it works by accessing Firestore
    const db = app.firestore();
    console.log('✅ Successfully initialized with FIREBASE_PRIVATE_KEY');
    
    // Clean up
    await app.delete();
    return { method: 'FIREBASE_PRIVATE_KEY', success: true };
  } catch (error) {
    console.error('❌ Failed to initialize with FIREBASE_PRIVATE_KEY:', error.message);
    return { method: 'FIREBASE_PRIVATE_KEY', success: false, error: error.message };
  }
}

// Test 2: Initialize with FIREBASE_PRIVATE_KEY_BASE64
async function testWithPrivateKeyBase64() {
  try {
    console.log('\nTEST 2: Initialize with FIREBASE_PRIVATE_KEY_BASE64');
    
    const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
    if (!privateKeyBase64) {
      console.log('❌ FIREBASE_PRIVATE_KEY_BASE64 is not set, skipping test');
      return { method: 'FIREBASE_PRIVATE_KEY_BASE64', success: false, error: 'Environment variable not set' };
    }
    
    // Decode the base64 string
    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
    
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: privateKey
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app'
    }, 'test-private-key-base64');
    
    // Verify it works by accessing Firestore
    const db = app.firestore();
    console.log('✅ Successfully initialized with FIREBASE_PRIVATE_KEY_BASE64');
    
    // Clean up
    await app.delete();
    return { method: 'FIREBASE_PRIVATE_KEY_BASE64', success: true };
  } catch (error) {
    console.error('❌ Failed to initialize with FIREBASE_PRIVATE_KEY_BASE64:', error.message);
    return { method: 'FIREBASE_PRIVATE_KEY_BASE64', success: false, error: error.message };
  }
}

// Test 3: Try with application default credentials
async function testWithApplicationDefault() {
  try {
    console.log('\nTEST 3: Initialize with Application Default Credentials');
    
    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app'
    }, 'test-app-default');
    
    // Verify it works by accessing Firestore
    const db = app.firestore();
    console.log('✅ Successfully initialized with Application Default Credentials');
    
    // Clean up
    await app.delete();
    return { method: 'Application Default', success: true };
  } catch (error) {
    console.error('❌ Failed to initialize with Application Default Credentials:', error.message);
    return { method: 'Application Default', success: false, error: error.message };
  }
}

// Run all tests and print summary
async function runTests() {
  testResults.push(await testWithPrivateKey());
  testResults.push(await testWithPrivateKeyBase64());
  testResults.push(await testWithApplicationDefault());
  
  console.log('\n===== TEST RESULTS SUMMARY =====\n');
  
  let successfulMethods = [];
  
  testResults.forEach(result => {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`${status}: ${result.method}`);
    if (result.success) {
      successfulMethods.push(result.method);
    }
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n===== RECOMMENDATIONS =====\n');
  
  if (successfulMethods.length === 0) {
    console.log('❌ None of the initialization methods worked.');
    console.log('Try these solutions:');
    console.log('1. Check your service account credentials');
    console.log('2. Ensure Firebase Admin SDK is properly installed');
    console.log('3. Try generating a new service account key');
  } else {
    console.log(`✅ Working methods: ${successfulMethods.join(', ')}`);
    
    // Recommend the best approach
    if (successfulMethods.includes('FIREBASE_PRIVATE_KEY_BASE64')) {
      console.log('RECOMMENDED: Use the Base64 method for best compatibility in Vercel:');
      console.log('1. Set FIREBASE_PRIVATE_KEY_BASE64 environment variable');
      console.log('2. Decode it in your code: const privateKey = Buffer.from(base64String, "base64").toString("utf8")');
    } else if (successfulMethods.includes('FIREBASE_PRIVATE_KEY')) {
      console.log('RECOMMENDED: Use the FIREBASE_PRIVATE_KEY method:');
      console.log('1. Ensure proper formatting with quotes and \\n characters');
      console.log('2. Process the key properly in your code');
    }
  }
}

// Run the tests
runTests()
  .catch(error => {
    console.error('Error running tests:', error);
  });