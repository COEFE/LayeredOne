#!/usr/bin/env node

/**
 * Generate Vercel Environment Variables
 * 
 * This script helps generate properly formatted environment variables
 * for Vercel deployment, especially focusing on the Firebase private key.
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

console.log('===== Generate Vercel Environment Variables =====\n');

// Check if we have access to the required environment variables
const requiredVars = [
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in your .env.local file first.');
  process.exit(1);
}

// Process the private key
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Remove wrapping quotes if present
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.substring(1, privateKey.length - 1);
}

// Replace escaped newlines with actual newlines
if (privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

// Convert to base64
const privateKeyBase64 = Buffer.from(privateKey).toString('base64');

// Generate the environment variables
const vercelEnv = {
  'FIREBASE_CLIENT_EMAIL': process.env.FIREBASE_CLIENT_EMAIL,
  'FIREBASE_PRIVATE_KEY': JSON.stringify(privateKey), // Properly escape newlines
  'FIREBASE_PRIVATE_KEY_BASE64': privateKeyBase64,
  'FIREBASE_PRIVATE_KEY_ID': process.env.FIREBASE_PRIVATE_KEY_ID || '',
  'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  'NEXT_PUBLIC_VERCEL_DEPLOYMENT': 'true',
  'NEXT_PUBLIC_USE_REAL_FIREBASE': 'true',
  'FIREBASE_USE_PRODUCTION_CONFIG': 'true',
  'SIMPLE_PDF': 'true'
};

// Save to file
const outputFile = 'vercel-environment-variables.txt';
let output = '# Vercel Environment Variables\n\n';
output += 'Add the following environment variables to your Vercel project:\n\n';

for (const [key, value] of Object.entries(vercelEnv)) {
  output += `## ${key}\n\`\`\`\n${value}\n\`\`\`\n\n`;
}

// Add usage instructions
output += '# How to add these variables to Vercel\n\n';
output += '1. Go to your Vercel project dashboard\n';
output += '2. Click on "Settings" tab\n';
output += '3. Click on "Environment Variables"\n';
output += '4. Add each variable with its corresponding value\n';
output += '5. Click "Save" and redeploy your project\n\n';
output += 'Alternatively, you can use the Vercel CLI to add these variables:\n\n';
output += '```bash\n';
for (const [key, value] of Object.entries(vercelEnv)) {
  output += `vercel env add ${key}\n`;
}
output += '```\n';

fs.writeFileSync(outputFile, output);

console.log(`✅ Environment variables written to ${outputFile}`);
console.log('⚠️  These include sensitive values - do not commit this file to git!');
console.log('⚠️  Add this file to your .gitignore if it\'s not already there.');
console.log('\nMost importantly, make sure to add FIREBASE_PRIVATE_KEY_BASE64 to your Vercel environment.');