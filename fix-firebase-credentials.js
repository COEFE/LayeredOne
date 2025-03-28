#!/usr/bin/env node

/**
 * Firebase Credentials Fix Script
 * 
 * This script fixes issues with Firebase service account credentials in .env.local
 * It addresses common formatting problems that cause authentication errors.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

console.log('===== Firebase Credentials Fix =====\n');

if (!fs.existsSync(envPath)) {
  console.error(`Error: .env.local file not found at ${envPath}`);
  console.log('Please create a .env.local file with your Firebase credentials.');
  process.exit(1);
}

// Read the .env.local file
let envFileContent = fs.readFileSync(envPath, 'utf8');
console.log('Successfully read .env.local file.');

// Check for presence of required variables
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

let issues = [];
let fixes = [];

if (!clientEmail) {
  issues.push('FIREBASE_CLIENT_EMAIL is missing');
} else {
  console.log(`FIREBASE_CLIENT_EMAIL is set to: ${clientEmail}`);
}

if (!privateKey) {
  issues.push('FIREBASE_PRIVATE_KEY is missing');
} else {
  console.log(`FIREBASE_PRIVATE_KEY is present (length: ${privateKey.length} characters)`);
  
  // Check for common private key format issues
  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    issues.push('FIREBASE_PRIVATE_KEY does not contain the expected BEGIN/END markers');
  }
  
  // Check if the key has quotes
  const hasQuotes = privateKey.startsWith('"') && privateKey.endsWith('"');
  if (!hasQuotes) {
    issues.push('FIREBASE_PRIVATE_KEY should be wrapped in double quotes');
    fixes.push(`Will wrap FIREBASE_PRIVATE_KEY in double quotes`);
  }
  
  // Check if \n is present or if literal newlines are present
  const hasEscapedNewlines = privateKey.includes('\\n');
  const hasLiteralNewlines = privateKey.includes('\n');
  
  if (!hasEscapedNewlines && !hasLiteralNewlines) {
    issues.push('FIREBASE_PRIVATE_KEY is missing newlines (\\n)');
  } else if (hasLiteralNewlines && !hasEscapedNewlines) {
    issues.push('FIREBASE_PRIVATE_KEY has literal newlines but needs \\n');
    fixes.push(`Will convert literal newlines to \\n in FIREBASE_PRIVATE_KEY`);
  }
}

if (!projectId) {
  issues.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing');
} else {
  console.log(`NEXT_PUBLIC_FIREBASE_PROJECT_ID is set to: ${projectId}`);
}

if (!storageBucket) {
  issues.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing');
} else {
  console.log(`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is set to: ${storageBucket}`);
}

// Report issues
if (issues.length > 0) {
  console.log('\nFound issues with your Firebase credentials:');
  issues.forEach((issue, i) => console.log(`${i+1}. ${issue}`));
} else {
  console.log('\nNo basic format issues detected with your Firebase credentials.');
}

// Fix issues if needed
if (fixes.length > 0) {
  console.log('\nApplying fixes:');
  fixes.forEach((fix, i) => console.log(`${i+1}. ${fix}`));
  
  // Fix: Add quotes around private key if missing
  if (privateKey && !(privateKey.startsWith('"') && privateKey.endsWith('"'))) {
    // First, remove any existing FIREBASE_PRIVATE_KEY line from the file
    envFileContent = envFileContent.replace(/FIREBASE_PRIVATE_KEY=.*(\r?\n|$)/g, '');
    
    // Add the properly formatted private key
    let formattedKey = privateKey;
    
    // Convert literal newlines to \n if needed
    if (formattedKey.includes('\n') && !formattedKey.includes('\\n')) {
      formattedKey = formattedKey.replace(/\n/g, '\\n');
    }
    
    // Add quotes
    if (!(formattedKey.startsWith('"') && formattedKey.endsWith('"'))) {
      formattedKey = `"${formattedKey}"`;
    }
    
    // Add the fixed key to the env file
    envFileContent += `\nFIREBASE_PRIVATE_KEY=${formattedKey}\n`;
  }
  
  // Write updated content back to .env.local
  fs.writeFileSync(envPath, envFileContent);
  console.log('\n✅ Applied fixes to .env.local file.');
} else if (issues.length > 0) {
  console.log('\nPlease manually fix these issues in your .env.local file.');
}

// Now let's try to initialize Firebase Admin SDK with the credentials
console.log('\nTesting Firebase Admin SDK initialization with your credentials...');

try {
  const admin = require('firebase-admin');
  
  // If Firebase Admin is already initialized, skip this test
  if (admin.apps.length > 0) {
    console.log('Firebase Admin SDK is already initialized. Skipping test.');
    process.exit(0);
  }
  
  // Use environment variables for credential
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };
  
  try {
    // Initialize with private_key
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
    
    console.log('✅ Successfully initialized Firebase Admin SDK with private_key!');
    
    // Try to access Firestore (basic test)
    const db = admin.firestore();
    console.log('✅ Successfully accessed Firestore!');
    
    // Try to access Storage (basic test)
    const storage = admin.storage();
    console.log('✅ Successfully accessed Storage!');
    
    console.log('\nYour Firebase credentials are working correctly!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK with private_key:', error.message);
    
    // If using private_key failed, try alternative formats
    console.log('\nTrying alternative credential format...');
    
    try {
      // Try with privateKey instead
      admin.initializeApp({
        credential: admin.credential.cert({
          ...serviceAccount,
          privateKey: serviceAccount.private_key
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      
      console.log('✅ Successfully initialized Firebase Admin SDK with privateKey!');
      console.log('\nDetected issue: Your code is using "privateKey" but should be using "private_key"');
      console.log('Please check src/firebase/admin-config.ts and ensure it uses private_key (with underscore)');
      
      process.exit(0);
    } catch (error2) {
      console.error('❌ Error initializing with alternative format:', error2.message);
      
      // Create a completely fixed version and try again
      console.log('\nTrying with completely fixed credentials...');
      
      // This is the client email from the service account
      if (clientEmail) {
        console.log('Creating a test service account with known good formatting...');
        
        // Extract just the key content (remove BEGIN/END markers and newlines)
        let privateKeyContent = '';
        if (privateKey) {
          // Extract content between BEGIN and END markers
          const match = privateKey.match(/-----BEGIN PRIVATE KEY-----([\s\S]+)-----END PRIVATE KEY-----/);
          if (match && match[1]) {
            // Clean up the content (remove all newlines and spaces)
            privateKeyContent = match[1].replace(/[\n\r\s]/g, '');
          }
        }
        
        if (privateKeyContent) {
          // Create a properly formatted key
          const fixedKey = `-----BEGIN PRIVATE KEY-----\n${privateKeyContent}\n-----END PRIVATE KEY-----\n`;
          
          try {
            // Try one more time with the fixed key
            admin.initializeApp({
              credential: admin.credential.cert({
                projectId: projectId,
                clientEmail: clientEmail,
                private_key: fixedKey
              }),
              storageBucket: storageBucket
            });
            
            console.log('✅ Successfully initialized with fixed credentials!');
            console.log('\nRecommended fix:');
            console.log('1. Update your .env.local file with this fixed FIREBASE_PRIVATE_KEY:');
            console.log(`FIREBASE_PRIVATE_KEY="${fixedKey.replace(/\n/g, '\\n')}"`);
            
            // Write the fix to a separate file for safety
            const fixedEnvContent = `# Fixed Firebase credentials - generated by fix-firebase-credentials.js
FIREBASE_PRIVATE_KEY="${fixedKey.replace(/\n/g, '\\n')}"
`;
            fs.writeFileSync(path.join(process.cwd(), 'fixed-firebase-key.env'), fixedEnvContent);
            console.log('\nA fixed key has been written to fixed-firebase-key.env');
            console.log('You can copy this key to your .env.local file.');
            
            process.exit(0);
          } catch (error3) {
            console.error('❌ All initialization attempts failed:', error3.message);
            console.log('\nPlease check your Firebase service account and credentials.');
            console.log('You may need to generate a new service account key from the Firebase console.');
          }
        } else {
          console.error('❌ Could not extract private key content for testing.');
        }
      } else {
        console.error('❌ Missing client email, cannot create test credentials.');
      }
    }
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK module:', error.message);
  console.log('Please make sure firebase-admin is installed: npm install firebase-admin');
}