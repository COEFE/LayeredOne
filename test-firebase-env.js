#!/usr/bin/env node

/**
 * Firebase Environment Variables Test Script
 * 
 * This script checks if your Firebase environment variables are properly set up.
 */

// Load environment variables from .env.local file
require('dotenv').config({ path: '.env.local' });

// Function to check environment variables
function checkEnvironmentVariables() {
  console.log('\n===== Firebase Environment Variables Check =====\n');
  
  const requiredClientVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];
  
  const requiredServerVars = [
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_PRIVATE_KEY_ID'
  ];
  
  console.log('Checking client-side variables:');
  let clientVarsOk = true;
  for (const varName of requiredClientVars) {
    const value = process.env[varName];
    if (!value) {
      console.log(`❌ ${varName} is missing`);
      clientVarsOk = false;
    } else {
      // Show a preview of the value (first few characters)
      const preview = value.substring(0, 10) + '...';
      console.log(`✅ ${varName} is set (${preview})`);
    }
  }
  
  console.log('\nChecking server-side variables:');
  let serverVarsOk = true;
  for (const varName of requiredServerVars) {
    const value = process.env[varName];
    if (!value) {
      console.log(`❌ ${varName} is missing`);
      serverVarsOk = false;
    } else if (varName === 'FIREBASE_PRIVATE_KEY') {
      // Check if private key is properly formatted
      if (value.includes('BEGIN PRIVATE KEY') && value.includes('END PRIVATE KEY')) {
        console.log(`✅ ${varName} is set and appears to be valid`);
      } else {
        console.log(`⚠️ ${varName} is set but may not be properly formatted`);
        serverVarsOk = false;
      }
    } else {
      // Show a preview of the value (first few characters)
      const preview = value.substring(0, 10) + '...';
      console.log(`✅ ${varName} is set (${preview})`);
    }
  }
  
  console.log('\nOverall status:');
  if (clientVarsOk && serverVarsOk) {
    console.log('✅ All required environment variables are set');
    console.log('\nYour Firebase configuration appears to be correctly set up!');
  } else {
    console.log('❌ Some environment variables are missing or invalid');
    console.log('\nPlease run setup-firebase-env.js to set up your environment variables.');
  }
}

// Run the check
try {
  checkEnvironmentVariables();
} catch (error) {
  console.error('Error checking environment variables:', error);
  console.log('\nMake sure you have a properly formatted .env.local file and the dotenv package installed.');
  console.log('Run "npm install dotenv" if the package is missing.');
}