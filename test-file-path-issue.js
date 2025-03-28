/**
 * Test Script to Debug File Path Issues in Firebase Storage
 * 
 * This script checks for hard-coded file paths in your code that might
 * be causing errors in the Vercel environment.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

console.log('===== FIREBASE FILE PATH CHECK =====\n');

// 1. Look for common patterns of hardcoded file paths
const patterns = [
  '*.json',
  'serviceAccountKey',
  'firebase.*json',
  'credential.*json',
  'require\\(.+\\.json',
  'fs.readFileSync.*json',
  'path.join.*json',
  '\\.\\/'
];

// Format for grep
const grepPattern = patterns.join('\\|');

// Files to search
const filesToSearch = [
  'src/firebase/**/*.ts',
  'src/firebase/**/*.js',
  'src/app/api/**/*.ts',
  'src/app/api/**/*.js',
  'src/utils/**/*.ts',
  'src/utils/**/*.js'
];

console.log('Searching for potential hardcoded file paths in your code...\n');

// Execute grep for each file pattern
filesToSearch.forEach(filePattern => {
  try {
    console.log(`Checking in ${filePattern}:`);
    const result = execSync(`grep -n "${grepPattern}" ${filePattern} 2>/dev/null || true`, { encoding: 'utf-8' });
    
    if (result.trim()) {
      console.log('POTENTIAL ISSUES FOUND:');
      console.log(result);
    } else {
      console.log('No issues found in this pattern.\n');
    }
  } catch (error) {
    // Ignore errors from grep when no matches are found
  }
});

// 2. Check environment variables
console.log('\n===== ENVIRONMENT VARIABLE CHECK =====\n');

const requiredVars = [
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_PRIVATE_KEY_BASE64',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
];

let missingVars = [];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    missingVars.push(varName);
    console.log(`❌ ${varName} is missing`);
  } else {
    console.log(`✅ ${varName} is set [${value.substring(0, 10)}...]`);
    
    // Special checks for Firebase private key
    if (varName === 'FIREBASE_PRIVATE_KEY') {
      // Check for newlines
      if (!value.includes('\\n') && !value.includes('\n')) {
        console.log(`   ⚠️ Warning: FIREBASE_PRIVATE_KEY does not contain newlines (\\n or literal)`);
      }
      
      // Check for quotes
      if (!(value.startsWith('"') && value.endsWith('"'))) {
        console.log(`   ⚠️ Warning: FIREBASE_PRIVATE_KEY is not wrapped in double quotes`);
      }
    }
  }
});

if (missingVars.length > 0) {
  console.log('\n⚠️ Missing required environment variables. Please set them in .env.local');
} else {
  console.log('\n✅ All required environment variables are set.');
}

// 3. Check for Google Application Credentials path
console.log('\n===== GOOGLE APPLICATION CREDENTIALS CHECK =====\n');

const googleCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (googleCredPath) {
  console.log(`GOOGLE_APPLICATION_CREDENTIALS is set to: ${googleCredPath}`);
  
  // Check if the path exists locally
  if (fs.existsSync(googleCredPath)) {
    console.log(`✅ File exists locally at this path.`);
  } else {
    console.log(`❌ File does NOT exist locally at this path.`);
    console.log(`   This will cause issues in Vercel if the code relies on this file.`);
  }
} else {
  console.log('GOOGLE_APPLICATION_CREDENTIALS is not set.');
}

// Check other potential file path variables
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (serviceAccountPath) {
  console.log(`\nFIREBASE_SERVICE_ACCOUNT_PATH is set to: ${serviceAccountPath}`);
  
  // Check if the path exists locally
  if (fs.existsSync(serviceAccountPath)) {
    console.log(`✅ File exists locally at this path.`);
  } else {
    console.log(`❌ File does NOT exist locally at this path.`);
    console.log(`   This will cause issues in Vercel if the code relies on this file.`);
  }
}

// 4. Suggestions
console.log('\n===== RECOMMENDATIONS =====\n');

if (googleCredPath || serviceAccountPath) {
  console.log(`1. REMOVE any environment variables that point to local files. These won't work in Vercel.`);
  console.log(`   Instead, use FIREBASE_PRIVATE_KEY_BASE64 and other environment variables.`);
}

console.log('2. Check all API routes for hardcoded file paths.');
console.log('3. Make sure src/firebase/admin-config.ts is using environment variables, not file paths.');
console.log('4. Consider using the Base64 method to avoid PEM formatting issues:');
console.log('   - Use FIREBASE_PRIVATE_KEY_BASE64 instead of FIREBASE_PRIVATE_KEY');
console.log('   - Decode it in your code: Buffer.from(base64String, "base64").toString("utf8")');

console.log('\nRun this test after making changes to identify any remaining issues.');