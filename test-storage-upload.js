/**
 * Test Script to Debug Firebase Storage Upload Issues
 * 
 * This script performs a direct upload to Firebase Storage to test
 * that the credentials and storage bucket are working correctly.
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

console.log('===== FIREBASE STORAGE UPLOAD TEST =====\n');

// Import admin SDK
let admin;
try {
  admin = require('firebase-admin');
  console.log('✅ Successfully imported firebase-admin');
} catch (error) {
  console.error('❌ Failed to import firebase-admin:', error.message);
  process.exit(1);
}

// Initialize Firebase Admin SDK if not already initialized
async function initializeFirebaseWithBase64() {
  if (admin.apps.length > 0) {
    console.log('Firebase Admin SDK is already initialized. Using existing app.');
    return admin.apps[0];
  }
  
  try {
    console.log('Initializing Firebase Admin SDK with FIREBASE_PRIVATE_KEY_BASE64...');
    
    const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
    if (!privateKeyBase64) {
      throw new Error('FIREBASE_PRIVATE_KEY_BASE64 is not set');
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
    });
    
    console.log('✅ Successfully initialized Firebase Admin SDK');
    return app;
  } catch (error) {
    console.error('❌ Failed to initialize with FIREBASE_PRIVATE_KEY_BASE64:', error.message);
    
    // Fall back to FIREBASE_PRIVATE_KEY
    try {
      console.log('\nTrying with FIREBASE_PRIVATE_KEY instead...');
      
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('FIREBASE_PRIVATE_KEY is not set');
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
      });
      
      console.log('✅ Successfully initialized with FIREBASE_PRIVATE_KEY');
      return app;
    } catch (fallbackError) {
      console.error('❌ Failed to initialize with FIREBASE_PRIVATE_KEY:', fallbackError.message);
      throw fallbackError;
    }
  }
}

// Create a test file if it doesn't exist
function createTestFile(content = 'Test file content') {
  const testFilePath = path.join(__dirname, 'test-files', 'test-file.txt');
  const testFileDir = path.dirname(testFilePath);
  
  if (!fs.existsSync(testFileDir)) {
    fs.mkdirSync(testFileDir, { recursive: true });
  }
  
  fs.writeFileSync(testFilePath, content);
  console.log(`Created test file at: ${testFilePath}`);
  
  return testFilePath;
}

// Test direct upload to Firebase Storage
async function testStorageUpload() {
  try {
    console.log('\nTesting direct upload to Firebase Storage...');
    
    // Create a test file
    const filePath = createTestFile();
    const fileBuffer = fs.readFileSync(filePath);
    
    // Generate a unique file path in storage
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const storagePath = `test-uploads/${timestamp}_${uniqueId}_test-file.txt`;
    
    console.log(`Uploading to path: ${storagePath}`);
    
    // Get storage bucket
    const storage = admin.storage();
    const bucket = storage.bucket();
    
    console.log(`Using bucket: ${bucket.name}`);
    
    // Upload the file
    const file = bucket.file(storagePath);
    
    await file.save(fileBuffer, {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          testId: uniqueId
        }
      }
    });
    
    console.log('✅ Successfully uploaded file to Firebase Storage');
    
    // Get a signed URL
    console.log('Generating signed URL...');
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    console.log(`✅ Generated signed URL: ${url}`);
    
    // Test file listing
    console.log('\nListing test files in storage...');
    
    const [files] = await bucket.getFiles({ prefix: 'test-uploads/' });
    
    console.log(`Found ${files.length} test files`);
    files.slice(0, 5).forEach(f => {
      console.log(`- ${f.name}`);
    });
    
    return {
      success: true,
      url,
      path: storagePath
    };
  } catch (error) {
    console.error('❌ Storage upload test failed:', error);
    
    // Check for common error types
    if (error.code === 'ENOENT') {
      console.error('This appears to be a file system error. The test file could not be created or read.');
    } else if (error.message && error.message.includes('credential')) {
      console.error('This appears to be a credential issue. Check your Firebase service account credentials.');
    } else if (error.message && error.message.includes('permission')) {
      console.error('This appears to be a permissions issue. Check your Firebase storage rules and service account permissions.');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
async function runTest() {
  try {
    await initializeFirebaseWithBase64();
    const result = await testStorageUpload();
    
    console.log('\n===== TEST RESULTS =====\n');
    
    if (result.success) {
      console.log('✅ Firebase Storage upload test PASSED!');
      console.log(`File URL: ${result.url}`);
      console.log(`Storage path: ${result.path}`);
      console.log('\nThis confirms that your Firebase credentials and storage access work correctly.');
      console.log('If you are still having issues with file uploads in your app:');
      console.log('1. Check your API route implementation');
      console.log('2. Ensure your frontend is calling the API correctly');
      console.log('3. Check the browser console and network tab for more detailed error information');
    } else {
      console.log('❌ Firebase Storage upload test FAILED');
      console.log(`Error: ${result.error}`);
      console.log('\nTry running the firebase-admin-init test to check your credentials.');
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
runTest();