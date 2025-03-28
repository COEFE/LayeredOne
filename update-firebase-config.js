/**
 * Script to use the production Firebase configuration for builds
 * This resolves the "Invalid PEM formatted message" error
 */

const fs = require('fs');
const path = require('path');

console.log('Updating Firebase configuration for production build...');

// Directory with the Firebase configuration files
const firebaseDir = path.join(process.cwd(), 'src', 'firebase');

// Update paths
const adminConfigPath = path.join(firebaseDir, 'admin-config.ts');
const adminConfigProductionPath = path.join(firebaseDir, 'admin-config-production.ts');
const keyHelpersPath = path.join(firebaseDir, 'key-helpers.js');
const keyHelpersProductionPath = path.join(firebaseDir, 'key-helpers-production.js');

// Create backup of existing files
if (fs.existsSync(adminConfigPath)) {
  const adminConfigContent = fs.readFileSync(adminConfigPath, 'utf8');
  fs.writeFileSync(adminConfigPath + '.bak', adminConfigContent);
  console.log('Created backup of admin-config.ts');
}

if (fs.existsSync(keyHelpersPath)) {
  const keyHelpersContent = fs.readFileSync(keyHelpersPath, 'utf8');
  fs.writeFileSync(keyHelpersPath + '.bak', keyHelpersContent);
  console.log('Created backup of key-helpers.js');
}

// Copy production files to their active locations
if (fs.existsSync(adminConfigProductionPath) && fs.existsSync(keyHelpersProductionPath)) {
  // Copy production config files
  const adminConfigProductionContent = fs.readFileSync(adminConfigProductionPath, 'utf8');
  const keyHelpersProductionContent = fs.readFileSync(keyHelpersProductionPath, 'utf8');
  
  fs.writeFileSync(adminConfigPath, adminConfigProductionContent);
  fs.writeFileSync(keyHelpersPath, keyHelpersProductionContent);
  
  console.log('Successfully updated Firebase configuration files for production');
} else {
  console.error('Production configuration files not found');
  process.exit(1);
}

// Additional diagnostic checks
try {
  // Read environment variables to check for proper key format
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  
  console.log('\n==== Firebase Key Format Check ====');
  
  if (privateKey) {
    console.log('FIREBASE_PRIVATE_KEY is present with length:', privateKey.length);
    console.log('Has BEGIN marker:', privateKey.includes('BEGIN PRIVATE KEY'));
    console.log('Has END marker:', privateKey.includes('END PRIVATE KEY'));
    console.log('Has escaped newlines:', privateKey.includes('\\n'));
    console.log('Has literal newlines:', privateKey.includes('\n'));
  } else {
    console.log('WARNING: FIREBASE_PRIVATE_KEY is not set');
  }
  
  if (privateKeyBase64) {
    console.log('FIREBASE_PRIVATE_KEY_BASE64 is present with length:', privateKeyBase64.length);
    
    try {
      const decoded = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
      console.log('Successfully decoded Base64 key');
      console.log('Decoded key has BEGIN marker:', decoded.includes('BEGIN PRIVATE KEY'));
      console.log('Decoded key has END marker:', decoded.includes('END PRIVATE KEY'));
      console.log('Decoded key has newlines:', decoded.includes('\n'));
    } catch (error) {
      console.error('Error decoding Base64 key:', error.message);
    }
  } else {
    console.log('WARNING: FIREBASE_PRIVATE_KEY_BASE64 is not set');
  }
  
  console.log('==== End of Key Format Check ====\n');
} catch (error) {
  console.error('Error during key format check:', error.message);
}

console.log('Firebase configuration update completed');