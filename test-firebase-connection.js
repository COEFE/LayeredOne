/**
 * Firebase Connection Test Script
 * 
 * This script tests your Firebase configuration by attempting to:
 * 1. Initialize Firebase Admin SDK
 * 2. Connect to Firestore
 * 3. Connect to Storage
 * 4. Verify authentication capabilities
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Import the Firebase admin SDK
const admin = require('firebase-admin');

// Check if Firebase is already initialized
if (admin.apps.length === 0) {
  // Get private key with proper newline handling
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null;

  // Create credential
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
  };

  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

// Functions to test different Firebase services
async function testFirestore() {
  try {
    console.log('Testing Firestore connection...');
    const db = admin.firestore();
    
    // Check if we can access a collection
    const timestamp = Date.now();
    const testDocRef = db.collection('_test_connection').doc(`test-${timestamp}`);
    
    // Write a test document
    await testDocRef.set({
      timestamp,
      test: 'Firebase connection test',
      date: new Date()
    });
    console.log('✅ Successfully wrote to Firestore');
    
    // Read the test document
    const doc = await testDocRef.get();
    if (doc.exists) {
      console.log('✅ Successfully read from Firestore');
    } else {
      console.error('❌ Failed to read document from Firestore');
    }
    
    // Clean up
    await testDocRef.delete();
    console.log('✅ Successfully deleted test document from Firestore');
    
    return true;
  } catch (error) {
    console.error('❌ Firestore test failed:', error);
    return false;
  }
}

async function testStorage() {
  try {
    console.log('\nTesting Storage connection...');
    const bucket = admin.storage().bucket();
    
    // Create a test file
    const fileName = `test-file-${Date.now()}.txt`;
    const file = bucket.file(fileName);
    
    // Upload content
    await file.save('Test content for Firebase Storage');
    console.log('✅ Successfully uploaded file to Storage');
    
    // Check if file exists
    const [exists] = await file.exists();
    if (exists) {
      console.log('✅ Successfully verified file exists in Storage');
    } else {
      console.error('❌ Failed to verify file in Storage');
    }
    
    // Delete the file
    await file.delete();
    console.log('✅ Successfully deleted test file from Storage');
    
    return true;
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    return false;
  }
}

async function testAuth() {
  try {
    console.log('\nTesting Authentication...');
    const auth = admin.auth();
    
    // List users (limited to 1)
    const listUsersResult = await auth.listUsers(1);
    console.log(`✅ Successfully listed users. User count: ${listUsersResult.users.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Auth test failed:', error);
    return false;
  }
}

async function testExcelDocument(documentId) {
  if (!documentId) {
    console.log('\nSkipping Excel document test (no document ID provided)');
    return;
  }
  
  try {
    console.log(`\nTesting Excel document processing for document ID: ${documentId}`);
    
    // Get the document from Firestore
    const db = admin.firestore();
    const docRef = db.collection('documents').doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.error(`❌ Document with ID ${documentId} not found in Firestore`);
      return false;
    }
    
    const documentData = doc.data();
    console.log('Document data:', {
      name: documentData.name,
      type: documentData.type || documentData.contentType,
      processed: documentData.processed,
      processingComplete: documentData.processingComplete,
      processingError: documentData.processingError,
      url: documentData.url ? 'URL exists' : 'No URL',
      extractedText: documentData.extractedText ? 'Text exists' : 'No text'
    });
    
    // Check if it's an Excel file
    const isExcel = (documentData.type || documentData.contentType || '').includes('excel') || 
                   (documentData.name || '').endsWith('.xlsx') || 
                   (documentData.name || '').endsWith('.xls');
    
    if (!isExcel) {
      console.log('⚠️  This doesn\'t appear to be an Excel document');
    }
    
    // Check document processing status
    if (documentData.processed) {
      console.log('✅ Document has been processed');
    } else if (documentData.processingError) {
      console.error(`❌ Document processing failed with error: ${documentData.processingError}`);
    } else {
      console.log('⚠️  Document has not been processed yet');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Excel document test failed:', error);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('===== FIREBASE CONNECTION TESTS =====\n');
  
  // Show environment variables (without private key)
  console.log('Environment variables:');
  console.log(`- Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not set'}`);
  console.log(`- Storage Bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'Not set'}`);
  console.log(`- Client Email: ${process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set'}`);
  console.log(`- Private Key: ${process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set'}`);
  console.log();
  
  let allTestsPassed = true;
  
  // Test Firestore
  const firestoreSuccess = await testFirestore();
  allTestsPassed = allTestsPassed && firestoreSuccess;
  
  // Test Storage
  const storageSuccess = await testStorage();
  allTestsPassed = allTestsPassed && storageSuccess;
  
  // Test Auth
  const authSuccess = await testAuth();
  allTestsPassed = allTestsPassed && authSuccess;
  
  // Optional: Test Excel document
  if (process.argv.length > 2) {
    const documentId = process.argv[2];
    await testExcelDocument(documentId);
  }
  
  // Show overall result
  console.log('\n===== TEST RESULTS =====');
  if (allTestsPassed) {
    console.log('✅ All Firebase connection tests passed!');
    console.log('Your Firebase configuration is working correctly.\n');
  } else {
    console.log('❌ Some Firebase tests failed.');
    console.log('Please check your Firebase configuration in .env.local\n');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});