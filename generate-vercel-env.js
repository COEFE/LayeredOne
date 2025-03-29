/**
 * Generate Vercel configuration with properly formatted environment variables
 * This script addresses the Firebase private key newline formatting issue
 */
const fs = require('fs');
const path = require('path');

console.log('Generating Vercel configuration with formatted environment variables...');

// Read existing environment variables from .env.local
let envContent = '';
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('Successfully read .env.local file');
  } else {
    console.log('No .env.local file found, using default values');
  }
} catch (err) {
  console.error('Error reading .env.local:', err);
}

// Extract environment variable value using regex
const getEnvVar = (name, defaultValue = '') => {
  const match = envContent.match(new RegExp(`${name}=["']?([^"'\n]+)["']?`));
  return match ? match[1] : defaultValue;
};

// Create Vercel configuration object
const vercelConfig = {
  "version": 2,
  "env": {
    "FIREBASE_CLIENT_EMAIL": getEnvVar('FIREBASE_CLIENT_EMAIL', 'firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com'),
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID": getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'variance-test-4b441'),
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'variance-test-4b441.firebasestorage.app')
  },
  "build": {
    "env": {
      "FIREBASE_CLIENT_EMAIL": getEnvVar('FIREBASE_CLIENT_EMAIL', 'firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com'),
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID": getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'variance-test-4b441'),
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'variance-test-4b441.firebasestorage.app')
    }
  },
  "buildCommand": "next build",
  "outputDirectory": ".next"
};

// Handle the Firebase private key with special formatting
try {
  // Try to get the private key (it might have escaped newlines in .env.local)
  let privateKey = '';
  
  // First try FIREBASE_PRIVATE_KEY environment variable
  const privateKeyMatch = envContent.match(/FIREBASE_PRIVATE_KEY=["']?(.*?)["']?$/m);
  if (privateKeyMatch && privateKeyMatch[1]) {
    privateKey = privateKeyMatch[1];
    console.log('Found FIREBASE_PRIVATE_KEY in .env.local');
    
    // Replace escaped newlines with actual newlines for Vercel
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      console.log('Converted escaped newlines to actual newlines for Vercel');
    }
    
    // Add to Vercel config
    vercelConfig.env.FIREBASE_PRIVATE_KEY = privateKey;
    vercelConfig.build.env.FIREBASE_PRIVATE_KEY = privateKey;
  } else {
    // Try Base64 encoded key as fallback
    const base64Match = envContent.match(/FIREBASE_PRIVATE_KEY_BASE64=["']?(.*?)["']?$/m);
    if (base64Match && base64Match[1]) {
      const base64Key = base64Match[1];
      console.log('Found FIREBASE_PRIVATE_KEY_BASE64 in .env.local');
      
      // Add to Vercel config
      vercelConfig.env.FIREBASE_PRIVATE_KEY_BASE64 = base64Key;
      vercelConfig.build.env.FIREBASE_PRIVATE_KEY_BASE64 = base64Key;
    } else {
      console.warn('Could not find Firebase private key in .env.local');
      console.warn('You will need to set FIREBASE_PRIVATE_KEY manually in Vercel dashboard');
    }
  }
} catch (err) {
  console.error('Error processing Firebase private key:', err);
}

// Write the configuration to vercel.json
try {
  fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
  console.log('Successfully generated vercel.json with formatted environment variables');
} catch (err) {
  console.error('Error writing vercel.json:', err);
}

console.log('\nNext steps:');
console.log('1. Verify vercel.json has been created correctly');
console.log('2. Deploy to Vercel with: vercel deploy');
console.log('3. If issues persist, set environment variables manually in Vercel dashboard');