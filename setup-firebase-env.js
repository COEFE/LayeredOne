#!/usr/bin/env node

/**
 * Firebase Environment Variables Setup Script
 * 
 * This script helps you set up environment variables for your Firebase project.
 * It creates a .env.local file with the necessary variables for local development.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for input
const prompt = (question) => new Promise(resolve => rl.question(question, resolve));

async function setupEnvironmentVariables() {
  console.log('\n===== Firebase Environment Variables Setup =====\n');
  console.log('This script will help you set up your Firebase environment variables.\n');
  console.log('You\'ll need information from your Firebase project settings and service account credentials.\n');
  
  // Check if .env.local already exists
  const envFilePath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envFilePath)) {
    const overwrite = await prompt('.env.local already exists. Overwrite it? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Exiting without changes.');
      rl.close();
      return;
    }
  }
  
  // Collect Firebase config information
  console.log('\n** Web App Configuration **');
  console.log('Get this from Firebase console > Project Settings > Your Apps > Web app > Firebase SDK snippet > Config\n');
  
  const config = {
    apiKey: await prompt('Firebase API Key: '),
    authDomain: await prompt('Firebase Auth Domain: '),
    projectId: await prompt('Firebase Project ID: '),
    storageBucket: await prompt('Firebase Storage Bucket: '),
    messagingSenderId: await prompt('Firebase Messaging Sender ID: '),
    appId: await prompt('Firebase App ID: '),
    measurementId: await prompt('Firebase Measurement ID (optional, press Enter to skip): ')
  };
  
  console.log('\n** Service Account Configuration **');
  console.log('Get this from Firebase console > Project Settings > Service accounts > Generate new private key\n');
  
  const serviceAccount = {
    clientEmail: await prompt('Firebase Client Email: '),
    privateKeyId: await prompt('Firebase Private Key ID: ')
  };
  
  console.log('\nNow paste your Private Key (it starts with "-----BEGIN PRIVATE KEY-----" and ends with "-----END PRIVATE KEY-----")');
  console.log('Press Enter, then paste the key, then press Enter again followed by Ctrl+D (Unix) or Ctrl+Z (Windows) to finish input:\n');
  
  let privateKey = '';
  const privateKeyInput = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ''
  });
  
  for await (const line of privateKeyInput) {
    privateKey += line + '\n';
  }
  
  // Format private key for .env file
  privateKey = privateKey.trim();
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    console.error('Error: Invalid private key format. Key should start with "-----BEGIN PRIVATE KEY-----"');
    rl.close();
    return;
  }
  
  // Replace literal newlines with \n for .env file
  const formattedPrivateKey = privateKey.replace(/\n/g, '\\n');
  
  // Generate .env.local content
  const envContent = `# Firebase Configuration - Generated on ${new Date().toISOString()}

# Client-side variables (prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=${config.apiKey}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${config.authDomain}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${config.projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${config.storageBucket}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId}
NEXT_PUBLIC_FIREBASE_APP_ID=${config.appId}
${config.measurementId ? `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${config.measurementId}` : '# NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID='}

# Server-side variables (no NEXT_PUBLIC_ prefix)
FIREBASE_CLIENT_EMAIL=${serviceAccount.clientEmail}
FIREBASE_PRIVATE_KEY="${formattedPrivateKey}"
FIREBASE_PRIVATE_KEY_ID=${serviceAccount.privateKeyId}

# Deployment configuration
NEXT_PUBLIC_VERCEL_DEPLOYMENT=false
NEXT_PUBLIC_USE_REAL_FIREBASE=true

# Feature flags
SIMPLE_PDF=true
`;
  
  // Write to .env.local file
  fs.writeFileSync(envFilePath, envContent);
  
  console.log('\n✅ Success! Environment variables have been saved to .env.local');
  console.log('\nNext steps:');
  console.log('  1. Restart your development server with: npm run dev');
  console.log('  2. Test your Firebase connection');
  console.log('  3. Try processing an Excel document again\n');
  
  rl.close();
}

setupEnvironmentVariables().catch(err => {
  console.error('Error setting up environment variables:', err);
  rl.close();
});