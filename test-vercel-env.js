#!/usr/bin/env node

/**
 * Vercel Environment Variables Test Script
 * 
 * This script checks if your Vercel environment variables are properly set up
 * for deployment and Firebase integration.
 */

// Load environment variables from .env.local file
require('dotenv').config({ path: '.env.local' });

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

// Function to check environment variables
function checkEnvironmentVariables() {
  console.log(`\n${colors.bright}===== Vercel Environment Variables Check =====\n${colors.reset}`);
  
  const requiredClientVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_VERCEL_DEPLOYMENT'
  ];
  
  const requiredServerVars = [
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_PRIVATE_KEY_ID',
    'ANTHROPIC_API_KEY'
  ];
  
  // Check if we're running in Vercel environment
  const isVercel = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true';
  console.log(`${colors.blue}Checking for Vercel environment:${colors.reset}`);
  console.log(`${isVercel ? colors.green + '✅' : colors.yellow + '⚠️'} NEXT_PUBLIC_VERCEL_DEPLOYMENT: ${process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT || 'not set'}`);
  console.log('');
  
  // Check client-side variables
  console.log(`${colors.bright}Checking client-side variables (needed in browser):${colors.reset}`);
  let clientVarsOk = true;
  for (const varName of requiredClientVars) {
    const value = process.env[varName];
    if (!value) {
      console.log(`${colors.red}❌ ${varName} is missing${colors.reset}`);
      clientVarsOk = false;
    } else {
      // Show a preview of the value (first few characters)
      const preview = value.length > 10 ? value.substring(0, 10) + '...' : value;
      console.log(`${colors.green}✅ ${varName} is set ${colors.cyan}(${preview})${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.bright}Checking server-side variables (needed for API routes):${colors.reset}`);
  let serverVarsOk = true;
  for (const varName of requiredServerVars) {
    const value = process.env[varName];
    if (!value) {
      console.log(`${colors.red}❌ ${varName} is missing${colors.reset}`);
      serverVarsOk = false;
    } else if (varName === 'FIREBASE_PRIVATE_KEY') {
      // Check if private key is properly formatted
      if (value.includes('BEGIN PRIVATE KEY') && value.includes('END PRIVATE KEY')) {
        console.log(`${colors.green}✅ ${varName} is set and appears to be valid${colors.reset}`);
        
        // Check if key has proper format for Firebase Admin SDK
        if (!value.includes('\\n') && !value.includes('\n')) {
          console.log(`${colors.yellow}⚠️  Warning: FIREBASE_PRIVATE_KEY doesn't contain newlines (\\n). This might cause issues.${colors.reset}`);
        }
      } else {
        console.log(`${colors.yellow}⚠️  ${varName} is set but may not be properly formatted${colors.reset}`);
        serverVarsOk = false;
      }
    } else {
      // Show a preview of the value (first few characters)
      const preview = value.length > 10 ? value.substring(0, 10) + '...' : value;
      console.log(`${colors.green}✅ ${varName} is set ${colors.cyan}(${preview})${colors.reset}`);
    }
  }
  
  // Check for optional but recommended variables
  console.log(`\n${colors.bright}Checking optional variables:${colors.reset}`);
  const optionalVars = [
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
    'SIMPLE_PDF',
    'NEXT_PUBLIC_USE_REAL_FIREBASE'
  ];
  
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (!value) {
      console.log(`${colors.yellow}⚠️  ${varName} is not set (optional)${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ ${varName} is set to ${colors.cyan}${value}${colors.reset}`);
    }
  }
  
  // Verify credential format for Firebase
  console.log(`\n${colors.bright}Checking Firebase credential format:${colors.reset}`);
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (privateKey && clientEmail) {
    try {
      // Test creating a service account object like the Admin SDK does
      const serviceAccount = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: clientEmail,
        private_key: privateKey
      };
      
      // Check if private_key has correct format
      if (serviceAccount.private_key && 
          typeof serviceAccount.private_key === 'string' &&
          serviceAccount.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) {
        console.log(`${colors.green}✅ Firebase service account format looks correct${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ Firebase private key format looks incorrect${colors.reset}`);
      }
    } catch (error) {
      console.error(`${colors.red}❌ Error checking service account format: ${error.message}${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}❌ Cannot verify Firebase credential format due to missing keys${colors.reset}`);
  }
  
  // Check for common Vercel deployment variables
  console.log(`\n${colors.bright}Checking Vercel deployment specific variables:${colors.reset}`);
  
  // These are often set automatically by Vercel
  const vercelVars = [
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
    'VERCEL_REGION'
  ];
  
  for (const varName of vercelVars) {
    const value = process.env[varName];
    if (!value) {
      console.log(`${colors.yellow}⚠️  ${varName} is not set (expected in actual Vercel environment)${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ ${varName} is set to ${colors.cyan}${value}${colors.reset}`);
    }
  }
  
  // Overall status
  console.log(`\n${colors.bright}Overall status:${colors.reset}`);
  if (clientVarsOk && serverVarsOk) {
    console.log(`${colors.green}✅ All required environment variables are set!${colors.reset}`);
    console.log(`\n${colors.bright}Your environment appears to be correctly configured for Vercel deployment.${colors.reset}`);
    
    // Special note about Vercel environment
    if (!isVercel) {
      console.log(`\n${colors.yellow}Note:${colors.reset} Your NEXT_PUBLIC_VERCEL_DEPLOYMENT is not set to 'true'.`);
      console.log(`     Set this to 'true' to enable Vercel-specific optimizations.`);
    }
  } else {
    console.log(`${colors.red}❌ Some required environment variables are missing or invalid${colors.reset}`);
    
    if (!clientVarsOk) {
      console.log(`\n${colors.yellow}Client-side variables are missing. These are needed for the browser to connect to Firebase.${colors.reset}`);
    }
    
    if (!serverVarsOk) {
      console.log(`\n${colors.yellow}Server-side variables are missing. These are needed for API routes to connect to Firebase Admin SDK.${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}Please check your Vercel project settings and ensure all environment variables are correctly set.${colors.reset}`);
  }
}

// Run the check function
try {
  checkEnvironmentVariables();
} catch (error) {
  console.error(`\n${colors.red}Error checking environment variables: ${error.message}${colors.reset}`);
  console.log(`\n${colors.yellow}Make sure you have a properly formatted .env.local file and the dotenv package installed.${colors.reset}`);
  console.log(`Run "npm install dotenv" if the package is missing.`);
}

// Additional test for Firebase Admin SDK initialization
try {
  console.log(`\n${colors.bright}===== Testing Firebase Admin SDK Initialization =====\n${colors.reset}`);
  
  // Check if we can import firebase-admin
  let admin;
  try {
    admin = require('firebase-admin');
    console.log(`${colors.green}✅ Successfully imported firebase-admin module${colors.reset}`);
  } catch (importError) {
    console.error(`${colors.red}❌ Failed to import firebase-admin: ${importError.message}${colors.reset}`);
    process.exit(1);
  }
  
  // Check if we have the key pieces we need
  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.log(`${colors.red}❌ Cannot test initialization: Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL${colors.reset}`);
    process.exit(1);
  }
  
  // Try to initialize the SDK
  if (admin.apps.length === 0) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      const serviceAccount = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: privateKey
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      
      console.log(`${colors.green}✅ Successfully initialized Firebase Admin SDK${colors.reset}`);
      
      // Try to access Firestore (minimal test)
      const db = admin.firestore();
      console.log(`${colors.green}✅ Successfully accessed Firestore${colors.reset}`);
      
      // Try to access Storage (minimal test)
      const storage = admin.storage();
      console.log(`${colors.green}✅ Successfully accessed Storage${colors.reset}`);
      
      console.log(`\n${colors.bright}${colors.green}Firebase Admin SDK initialization succeeded!${colors.reset}`);
      console.log(`${colors.bright}Your Firebase Admin credentials appear to be correctly formatted.${colors.reset}`);
      
    } catch (initError) {
      console.error(`${colors.red}❌ Failed to initialize Firebase Admin SDK: ${initError.message}${colors.reset}`);
      console.log(`\n${colors.yellow}This likely indicates an issue with your Firebase credentials format.${colors.reset}`);
      console.log(`Common issues include:`);
      console.log(`1. The FIREBASE_PRIVATE_KEY isn't properly escaped with \\n characters`);
      console.log(`2. The service account doesn't have the right permissions`);
      console.log(`3. The project ID doesn't match your Firebase project`);
    }
  } else {
    console.log(`${colors.yellow}⚠️  Firebase Admin SDK is already initialized${colors.reset}`);
  }
  
} catch (error) {
  console.error(`${colors.red}Error in Firebase Admin SDK test: ${error.message}${colors.reset}`);
}