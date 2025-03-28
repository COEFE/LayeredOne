/**
 * Document Upload Test Script
 * 
 * This script tests the document upload functionality by:
 * 1. Testing Firebase configuration
 * 2. Uploading a small test file to Firebase Storage
 * 3. Creating a document reference in Firestore
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import the Firebase admin SDK
const admin = require('firebase-admin');

// Check if Firebase is already initialized
if (admin.apps.length === 0) {
  console.log('Initializing Firebase Admin SDK...');
  
  // Get private key with proper newline handling
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null;

  if (!privateKey) {
    console.error('❌ FIREBASE_PRIVATE_KEY environment variable is not set or is empty!');
    process.exit(1);
  }

  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    console.error('❌ FIREBASE_CLIENT_EMAIL environment variable is not set!');
    process.exit(1);
  }

  // Create credential
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: privateKey  // Note: using private_key with underscore
  };

  console.log('Service account:', {
    projectId: serviceAccount.projectId,
    clientEmail: serviceAccount.clientEmail,
    privateKeyLength: serviceAccount.private_key ? serviceAccount.private_key.length : 0,
  });

  // Initialize Firebase
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app'
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    process.exit(1);
  }
}

// Create a test file if it doesn't exist
const testFilePath = path.join(__dirname, 'test-files', 'test-upload.txt');
const testFileDir = path.dirname(testFilePath);

if (!fs.existsSync(testFileDir)) {
  fs.mkdirSync(testFileDir, { recursive: true });
  console.log(`Created directory: ${testFileDir}`);
}

if (!fs.existsSync(testFilePath)) {
  fs.writeFileSync(testFilePath, 'This is a test file for document upload.\\nCreated at: ' + new Date().toISOString());
  console.log(`Created test file: ${testFilePath}`);
}

// Test storage upload
async function testStorageUpload() {
  try {
    console.log('\nTesting Firebase Storage upload...');
    
    // Get the storage bucket
    const bucket = admin.storage().bucket();
    console.log(`Using storage bucket: ${bucket.name}`);
    
    // Create a unique filepath
    const userId = 'test-user-' + Date.now();
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const fileName = 'test-upload.txt';
    
    const filePath = `documents/${userId}/${timestamp}_${uniqueId}_${fileName}`;
    console.log(`Upload path: ${filePath}`);
    
    // Read the test file
    const fileBuffer = fs.readFileSync(testFilePath);
    console.log(`Read test file, size: ${fileBuffer.length} bytes`);
    
    // Upload to Firebase Storage
    console.log('Uploading to Firebase Storage...');
    const fileRef = bucket.file(filePath);
    
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          firebaseStorageDownloadTokens: uniqueId,
          documentId: uniqueId,
          userId: userId,
        }
      }
    });
    
    console.log('✅ Successfully uploaded file to Firebase Storage');
    
    // Get a signed URL
    console.log('Generating signed URL...');
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    console.log(`✅ Generated signed URL: ${url}`);
    
    // Create Firestore document
    console.log('\nCreating document record in Firestore...');
    const db = admin.firestore();
    const documentId = uuidv4();
    const docRef = db.collection('documents').doc(documentId);
    
    await docRef.set({
      id: documentId,
      userId: userId,
      name: fileName,
      type: 'text/plain',
      contentType: 'text/plain',
      size: fileBuffer.length,
      url: url,
      path: filePath,
      storageRef: filePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processed: false,
      processing: false,
      testUpload: true
    });
    
    console.log(`✅ Successfully created document record with ID: ${documentId}`);
    
    return {
      success: true,
      documentId,
      url,
      filePath
    };
  } catch (error) {
    console.error('❌ Storage upload test failed:', error);
    
    // Check if this is a credential-related error
    if (error.message && (
        error.message.includes('credential') || 
        error.message.includes('authentication') ||
        error.message.includes('auth') ||
        error.message.includes('permission') ||
        error.message.includes('not authorized'))) {
      console.error('\n⚠️ This appears to be a CREDENTIAL ISSUE:');
      console.error('1. Check that your FIREBASE_PRIVATE_KEY is correctly formatted with quotes and \\n');
      console.error('2. Verify that FIREBASE_CLIENT_EMAIL matches your service account');
      console.error('3. Ensure your service account has proper permissions for Storage and Firestore');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run upload test
async function runUploadTest() {
  console.log('===== DOCUMENT UPLOAD TEST =====\n');
  
  // Show environment variables (without private key)
  console.log('Environment variables:');
  console.log(`- Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not set'}`);
  console.log(`- Storage Bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'Not set'}`);
  console.log(`- Client Email: ${process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set'}`);
  console.log(`- Private Key: ${process.env.FIREBASE_PRIVATE_KEY ? 'Set (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ')' : 'Not set'}`);
  
  if (process.env.FIREBASE_PRIVATE_KEY) {
    // Check if private key is properly formatted
    const pk = process.env.FIREBASE_PRIVATE_KEY;
    if (!pk.includes('\\n') && !pk.includes('\n')) {
      console.error('⚠️ WARNING: Your private key does not contain newlines (\\n)');
      console.error('This will cause authentication issues. Use proper formatting.');
    }
    if (!(pk.startsWith('"') && pk.endsWith('"'))) {
      console.error('⚠️ WARNING: Your private key is not wrapped in double quotes');
      console.error('This may cause authentication issues. Add quotes in your .env.local file.');
    }
  }
  
  console.log('\nStarting upload test...');
  const result = await testStorageUpload();
  
  console.log('\n===== TEST RESULTS =====');
  if (result.success) {
    console.log('✅ Document upload test passed!');
    console.log(`Document ID: ${result.documentId}`);
    console.log(`Document URL: ${result.url}`);
    console.log(`Storage path: ${result.filePath}`);
    console.log('\nYour Firebase configuration is working correctly for document uploads.\n');
  } else {
    console.log('❌ Document upload test failed.');
    console.log(`Error: ${result.error}`);
    console.log('Please check your Firebase configuration and storage permissions.\n');
  }
}

// Run the test
runUploadTest().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});