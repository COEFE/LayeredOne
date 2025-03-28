#!/usr/bin/env node

/**
 * Vercel Deployment Debug Tool
 * 
 * This script tests your Firebase configuration for Vercel deployment
 * and identifies common issues that might cause deployment failures.
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

console.log('===== Vercel Deployment Debug Tool =====\n');

// Check Firebase environment variables
console.log('Checking Firebase environment variables:');
const requiredVariables = [
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_PRIVATE_KEY_BASE64',
  'FIREBASE_PRIVATE_KEY_ID'
];

let missingVariables = [];
requiredVariables.forEach(varName => {
  if (!process.env[varName]) {
    if (varName === 'FIREBASE_PRIVATE_KEY_BASE64' && process.env.FIREBASE_PRIVATE_KEY) {
      console.log(`⚠️  ${varName} is missing, but FIREBASE_PRIVATE_KEY is set (acceptable)`);
    } else if (varName === 'FIREBASE_PRIVATE_KEY' && process.env.FIREBASE_PRIVATE_KEY_BASE64) {
      console.log(`⚠️  ${varName} is missing, but FIREBASE_PRIVATE_KEY_BASE64 is set (acceptable)`);
    } else {
      console.log(`❌ ${varName} is missing`);
      missingVariables.push(varName);
    }
  } else {
    console.log(`✅ ${varName} is set`);
  }
});

// Check vercel.json configuration
console.log('\nChecking vercel.json configuration:');
const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
if (!fs.existsSync(vercelJsonPath)) {
  console.log('❌ vercel.json is missing');
} else {
  console.log('✅ vercel.json exists');
  
  try {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    
    // Check for build command
    if (!vercelConfig.buildCommand && vercelConfig.buildCommand !== 'npm run build:simple') {
      console.log('⚠️  buildCommand is not set to "npm run build:simple"');
    } else {
      console.log('✅ buildCommand is set correctly');
    }
    
    // Check for environment variables
    if (!vercelConfig.env) {
      console.log('❌ env section is missing');
    } else {
      console.log('✅ env section exists');
      
      // Check for FIREBASE_PRIVATE_KEY_BASE64
      if (!vercelConfig.env.FIREBASE_PRIVATE_KEY_BASE64) {
        console.log('❌ FIREBASE_PRIVATE_KEY_BASE64 is missing from vercel.json env section');
      } else {
        console.log('✅ FIREBASE_PRIVATE_KEY_BASE64 is defined in vercel.json env section');
      }
    }
  } catch (error) {
    console.log(`❌ Error parsing vercel.json: ${error.message}`);
  }
}

// Check package.json scripts
console.log('\nChecking package.json scripts:');
try {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  
  // Check for build:simple script
  if (!packageJson.scripts || !packageJson.scripts['build:simple']) {
    console.log('❌ build:simple script is missing');
  } else {
    console.log(`✅ build:simple script exists: ${packageJson.scripts['build:simple']}`);
  }
  
  // Check dependencies
  console.log('\nChecking critical dependencies:');
  const criticalDeps = [
    'firebase-admin',
    '@google-cloud/firestore',
    '@google-cloud/storage',
    'dotenv',
    'is-set',
    'is-regexp'
  ];
  
  criticalDeps.forEach(dep => {
    if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
      console.log(`❌ ${dep} is missing from dependencies`);
    } else {
      console.log(`✅ ${dep} is installed: ${packageJson.dependencies[dep]}`);
    }
  });
} catch (error) {
  console.log(`❌ Error reading package.json: ${error.message}`);
}

// Test Firebase connection
console.log('\nTesting Firebase Admin SDK initialization:');
try {
  // Try to load the Firebase Admin SDK
  const admin = require('firebase-admin');
  
  if (admin.apps.length > 0) {
    console.log('⚠️  Firebase Admin SDK is already initialized. Skipping initialization test.');
  } else {
    // Check if we can get the private key from environment variables
    let privateKey = null;
    
    // Try base64 first
    const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
    if (privateKeyBase64) {
      try {
        privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
        console.log('✅ Successfully decoded FIREBASE_PRIVATE_KEY_BASE64');
      } catch (error) {
        console.log(`❌ Error decoding FIREBASE_PRIVATE_KEY_BASE64: ${error.message}`);
      }
    }
    
    // Fall back to standard key
    if (!privateKey && process.env.FIREBASE_PRIVATE_KEY) {
      // Clean up the key
      privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Remove quotes if present
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      
      // Replace escaped newlines
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      console.log('✅ Processed FIREBASE_PRIVATE_KEY');
    }
    
    if (!privateKey) {
      console.log('❌ Could not get private key from environment variables');
    } else {
      // Try to initialize Firebase Admin SDK
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        });
        
        console.log('✅ Successfully initialized Firebase Admin SDK');
        
        // Test Firestore and Storage
        try {
          const db = admin.firestore();
          console.log('✅ Successfully accessed Firestore');
          
          const storage = admin.storage();
          console.log('✅ Successfully accessed Storage');
        } catch (serviceError) {
          console.log(`❌ Error accessing Firebase services: ${serviceError.message}`);
        }
      } catch (initError) {
        console.log(`❌ Error initializing Firebase Admin SDK: ${initError.message}`);
      }
    }
  }
} catch (error) {
  console.log(`❌ Error loading Firebase Admin SDK: ${error.message}`);
}

// Check critical files for Firebase configuration
console.log('\nChecking for hardcoded file paths:');
const filesToCheck = [
  '/src/firebase/admin-config.ts',
  '/src/firebase/admin-config-production.ts',
  '/src/utils/optimizations/firebase-config.js'
];

filesToCheck.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for hardcoded file paths
    const filePathMatches = content.match(/['"](.*\.json)['"]/g);
    if (filePathMatches && filePathMatches.length > 0) {
      console.log(`⚠️  ${filePath} contains hardcoded file paths: ${filePathMatches.join(', ')}`);
    } else {
      console.log(`✅ ${filePath} doesn't contain hardcoded JSON file paths`);
    }
  } else {
    console.log(`⚠️  ${filePath} doesn't exist`);
  }
});

// Summary
console.log('\n===== Summary =====');
if (missingVariables.length > 0) {
  console.log(`❌ Missing required environment variables: ${missingVariables.join(', ')}`);
  console.log('1. Add these variables to your .env.local file');
  console.log('2. Add these variables to your Vercel environment variables');
} else {
  console.log('✅ All required environment variables are set');
}

console.log('\nRecommended fixes:');
console.log('1. Ensure FIREBASE_PRIVATE_KEY_BASE64 is properly set in Vercel environment variables');
console.log('2. Use the fix-vercel-private-key.js script to generate properly formatted keys');
console.log('3. Update vercel.json to include all necessary environment variables');
console.log('4. Redeploy with "vercel --prod" or use the deploy hook');