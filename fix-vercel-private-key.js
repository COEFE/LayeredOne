#!/usr/bin/env node

/**
 * Firebase Private Key Formatter for Vercel
 * 
 * This script helps format a Firebase private key for use in Vercel environment variables.
 * It provides multiple format options to help resolve "Invalid PEM formatted message" errors.
 */

// Check if running with Node.js
if (typeof process === 'undefined') {
  console.error('This script must be run with Node.js');
  // Exit if not in Node.js environment
  return;
}

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Get the private key from the environment variable or command line
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (process.argv.length > 2) {
  privateKey = process.argv[2];
}

if (!privateKey) {
  console.error('No private key provided. Please set FIREBASE_PRIVATE_KEY in your .env.local file or provide it as an argument.');
  console.error('Usage: node fix-vercel-private-key.js "YOUR_PRIVATE_KEY"');
  process.exit(1);
}

// Remove any wrapping quotes if they exist
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.substring(1, privateKey.length - 1);
}

// Handle escaped newlines
if (privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

// Clean and normalize the key
let normalizedKey = privateKey;

// Remove any extra whitespace
normalizedKey = normalizedKey.trim();

// Ensure the key follows the proper PEM format
if (!normalizedKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
  normalizedKey = '-----BEGIN PRIVATE KEY-----\n' + normalizedKey;
}

if (!normalizedKey.endsWith('-----END PRIVATE KEY-----')) {
  normalizedKey = normalizedKey + '\n-----END PRIVATE KEY-----';
}

// Ensure there's a newline after BEGIN and before END
if (!normalizedKey.includes('-----BEGIN PRIVATE KEY-----\n')) {
  normalizedKey = normalizedKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
}

if (!normalizedKey.includes('\n-----END PRIVATE KEY-----')) {
  normalizedKey = normalizedKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
}

// Ensure the key ends with a newline
if (!normalizedKey.endsWith('\n')) {
  normalizedKey = normalizedKey + '\n';
}

// Extract the base64 portion
const base64Pattern = /-----BEGIN PRIVATE KEY-----\n([\s\S]+?)\n-----END PRIVATE KEY-----/;
const match = normalizedKey.match(base64Pattern);
let base64Content = '';

if (match && match[1]) {
  // Clean up the content (removing extra spaces and newlines)
  base64Content = match[1].replace(/[\s\n]/g, '');
  
  // Format with 64 characters per line
  const formattedBase64 = base64Content.match(/.{1,64}/g).join('\n');
  
  // Reconstruct the properly formatted key
  normalizedKey = `-----BEGIN PRIVATE KEY-----\n${formattedBase64}\n-----END PRIVATE KEY-----\n`;
}

// Generate different formats
const formatsToTry = {
  // 1. Standard format with escaped newlines (for .env.local and most env var systems)
  standardFormat: JSON.stringify(normalizedKey),
  
  // 2. Base64 encoded format (useful for problematic environment variables)
  base64Format: Buffer.from(normalizedKey).toString('base64'),
  
  // 3. Raw format with actual newlines (for direct input in some UI systems)
  rawFormat: normalizedKey,
  
  // 4. Single line format with explicit \n (for systems that don't support quotes)
  singleLineFormat: normalizedKey.replace(/\n/g, '\\n')
};

// Save the results to a file
const outputFile = path.join(__dirname, 'vercel-private-key-formats.txt');
let outputContent = '# Firebase Private Key Formats for Vercel\n\n';
outputContent += 'Different formats to try for your FIREBASE_PRIVATE_KEY environment variable in Vercel:\n\n';

outputContent += '## 1. Standard Format (best for .env.local and most environment variable systems)\n';
outputContent += 'This format uses escaped newlines and is wrapped in quotes:\n\n';
outputContent += '```\n';
outputContent += formatsToTry.standardFormat;
outputContent += '\n```\n\n';

outputContent += '## 2. Base64 Encoded Format\n';
outputContent += 'If you have issues with the private key format, you can use this base64 encoded version.\n';
outputContent += 'Set this as FIREBASE_PRIVATE_KEY_BASE64 and update your code to decode it:\n\n';
outputContent += '```\n';
outputContent += formatsToTry.base64Format;
outputContent += '\n```\n\n';
outputContent += 'Then in your code, decode it with:\n\n';
outputContent += '```javascript\n';
outputContent += 'const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;\n';
outputContent += 'const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8");\n';
outputContent += '```\n\n';

outputContent += '## 3. Raw Format with Actual Newlines\n';
outputContent += 'Some UI systems (like Vercel\'s UI) may accept raw input with actual newlines.\n';
outputContent += 'Copy and paste this directly into the Vercel environment variable field:\n\n';
outputContent += '```\n';
outputContent += formatsToTry.rawFormat;
outputContent += '```\n\n';

outputContent += '## 4. Single Line Format (without quotes)\n';
outputContent += 'For systems that don\'t support quotes in environment variables:\n\n';
outputContent += '```\n';
outputContent += formatsToTry.singleLineFormat;
outputContent += '\n```\n\n';

outputContent += '## Verifying Your Key\n';
outputContent += 'To verify your key is properly formatted, you can use the test-document-upload.js script:\n\n';
outputContent += '```bash\n';
outputContent += 'node test-document-upload.js\n';
outputContent += '```\n';

fs.writeFileSync(outputFile, outputContent);

console.log('===== Firebase Private Key Formatter for Vercel =====\n');
console.log(`Different format options have been saved to: ${outputFile}`);
console.log('Try these different formats if you encounter "Invalid PEM formatted message" errors in Vercel.\n');

// Test the key directly
try {
  // Try to parse the key to see if it's valid
  const crypto = require('crypto');
  crypto.createPrivateKey(normalizedKey);
  console.log('✅ Private key is valid! It can be properly parsed as a PEM formatted key.');
} catch (error) {
  console.error('❌ Private key validation failed:', error.message);
  console.error('Please check the format of your private key.');
}

console.log('\nFollow these steps to fix the issue in Vercel:');
console.log('1. Go to your Vercel project settings');
console.log('2. Navigate to the Environment Variables section');
console.log('3. Update your FIREBASE_PRIVATE_KEY with one of the formats from the file');
console.log('4. Redeploy your application')