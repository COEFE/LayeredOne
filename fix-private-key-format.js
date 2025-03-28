#!/usr/bin/env node

/**
 * Fix Private Key Format for Vercel Deployment
 * 
 * This script generates a properly formatted private key for use in Vercel
 * environment variables, addressing the "Invalid PEM formatted message" error.
 */

require('dotenv').config({ path: '.env.local' });

function printUsage() {
  console.log(`
Usage: node fix-private-key-format.js [options]

Options:
  --test-current     Test the current private key format in .env.local
  --generate-base64  Generate a properly formatted Base64 key from the current key
  --from-file=FILE   Read private key from a file instead of environment variables
  --help             Show this help message
  
Examples:
  node fix-private-key-format.js --test-current
  node fix-private-key-format.js --generate-base64
  node fix-private-key-format.js --from-file=service-account.json
`);
}

/**
 * Fix PEM private key format ensuring it has proper structure
 * @param {string} privateKey - The private key to format
 * @returns {string} - A properly formatted PEM private key
 */
function fixPrivateKeyFormat(privateKey) {
  if (!privateKey) {
    throw new Error('No private key provided');
  }
  
  // Clean up the key
  let cleanKey = privateKey;
  
  // Remove any quotes if present
  if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
    cleanKey = cleanKey.substring(1, cleanKey.length - 1);
  }
  
  // Replace escaped newlines
  if (cleanKey.includes('\\n')) {
    cleanKey = cleanKey.replace(/\\n/g, '\n');
  }
  
  // Extract the base64 content between BEGIN and END markers
  const pemPattern = /-----BEGIN PRIVATE KEY-----\s*([\s\S]*?)\s*-----END PRIVATE KEY-----/;
  const match = cleanKey.match(pemPattern);
  
  if (match && match[1]) {
    // Got the base64 content
    const base64Content = match[1].replace(/[\s\n\r]/g, '');
    
    // Format with proper PEM structure
    // Base64 should be in lines of 64 characters
    const formattedContent = base64Content.match(/.{1,64}/g).join('\n');
    
    return `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----\n`;
  } else if (cleanKey.includes('PRIVATE KEY')) {
    // Contains the markers but couldn't extract properly
    // Try a more aggressive approach
    const strippedKey = cleanKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/[\s\n\r]/g, '');
      
    const formattedContent = strippedKey.match(/.{1,64}/g).join('\n');
    return `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----\n`;
  } else {
    // Doesn't look like a PEM key at all
    // Assume it's just base64 and try to format it
    const cleanContent = cleanKey.replace(/[\s\n\r]/g, '');
    if (cleanContent.length > 0) {
      const formattedContent = cleanContent.match(/.{1,64}/g).join('\n');
      return `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----\n`;
    } else {
      throw new Error('The key appears to be empty or invalid');
    }
  }
}

/**
 * Tests if a private key is valid by attempting to parse it
 * @param {string} privateKey - The private key to test
 * @returns {boolean} - Whether the key is valid
 */
function testPrivateKey(privateKey) {
  try {
    const crypto = require('crypto');
    // Try to create a private key object from the PEM string
    crypto.createPrivateKey(privateKey);
    return true;
  } catch (error) {
    console.error(`Key validation error: ${error.message}`);
    return false;
  }
}

/**
 * Extracts a private key from a service account JSON file
 * @param {string} filePath - Path to the service account JSON file
 * @returns {string} - The private key
 */
function extractPrivateKeyFromFile(filePath) {
  const fs = require('fs');
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const serviceAccount = JSON.parse(content);
    
    if (serviceAccount.private_key) {
      console.log('Successfully extracted private_key from service account JSON');
      return serviceAccount.private_key;
    } else {
      throw new Error('No private_key found in the service account JSON file');
    }
  } catch (error) {
    throw new Error(`Failed to read service account JSON: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Handle help flag
  if (args.includes('--help')) {
    printUsage();
    return;
  }
  
  // Handle test-current flag
  if (args.includes('--test-current')) {
    console.log('\n===== Testing Current Private Key Format =====\n');
    
    let privateKey;
    
    if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
      console.log('Found FIREBASE_PRIVATE_KEY_BASE64, decoding...');
      try {
        privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
        console.log('Successfully decoded base64 key');
      } catch (error) {
        console.error(`Error decoding base64 key: ${error.message}`);
      }
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
      console.log('Using FIREBASE_PRIVATE_KEY...');
      privateKey = process.env.FIREBASE_PRIVATE_KEY;
    } else {
      console.error('No private key found in environment variables');
      process.exit(1);
    }
    
    if (privateKey) {
      // Check key characteristics without exposing the full key
      console.log(`\nKey length: ${privateKey.length} characters`);
      console.log(`Contains BEGIN marker: ${privateKey.includes('BEGIN PRIVATE KEY')}`);
      console.log(`Contains END marker: ${privateKey.includes('END PRIVATE KEY')}`);
      console.log(`Contains escaped newlines (\\n): ${privateKey.includes('\\n')}`);
      console.log(`Contains literal newlines: ${privateKey.includes('\n')}`);
      console.log(`Starts with quotes: ${privateKey.startsWith('"')}`);
      console.log(`Ends with quotes: ${privateKey.endsWith('"')}`);
      
      // Test if the key is valid
      console.log('\nValidating key format...');
      const isValid = testPrivateKey(privateKey);
      
      if (isValid) {
        console.log('✅ The key is valid! It has correct PEM format.');
      } else {
        console.log('❌ The key is NOT valid. It needs formatting fixes.');
        
        // Try to fix the key
        try {
          console.log('\nAttempting to fix the key format...');
          const fixedKey = fixPrivateKeyFormat(privateKey);
          
          console.log('Testing fixed key...');
          const isFixedKeyValid = testPrivateKey(fixedKey);
          
          if (isFixedKeyValid) {
            console.log('✅ Fixed key is valid! Use the --generate-base64 option to generate a properly formatted key.');
          } else {
            console.log('❌ Could not fix the key automatically. Please check your service account JSON.');
          }
        } catch (error) {
          console.error(`Error fixing key: ${error.message}`);
        }
      }
    }
    
    return;
  }
  
  // Handle from-file flag
  const fileArg = args.find(arg => arg.startsWith('--from-file='));
  if (fileArg) {
    const filePath = fileArg.split('=')[1];
    console.log(`\nReading private key from file: ${filePath}\n`);
    
    try {
      const privateKey = extractPrivateKeyFromFile(filePath);
      
      // Display key characteristics
      console.log(`\nKey length: ${privateKey.length} characters`);
      console.log(`Contains BEGIN marker: ${privateKey.includes('BEGIN PRIVATE KEY')}`);
      console.log(`Contains END marker: ${privateKey.includes('END PRIVATE KEY')}`);
      
      // Test if the key is valid
      console.log('\nValidating key format...');
      const isValid = testPrivateKey(privateKey);
      
      if (isValid) {
        console.log('✅ The key from file is valid!');
        
        // Generate base64
        console.log('\nGenerating Base64 encoded key...');
        const base64Key = Buffer.from(privateKey).toString('base64');
        
        console.log('\n===== BASE64 ENCODED KEY =====');
        console.log(base64Key);
        console.log('==============================\n');
        
        console.log('Add this key to your Vercel environment variables as FIREBASE_PRIVATE_KEY_BASE64');
      } else {
        console.log('❌ The key from file is NOT valid. Attempting to fix...');
        
        try {
          const fixedKey = fixPrivateKeyFormat(privateKey);
          const isFixedKeyValid = testPrivateKey(fixedKey);
          
          if (isFixedKeyValid) {
            console.log('✅ Fixed key is valid!');
            
            // Generate base64
            console.log('\nGenerating Base64 encoded key...');
            const base64Key = Buffer.from(fixedKey).toString('base64');
            
            console.log('\n===== BASE64 ENCODED KEY =====');
            console.log(base64Key);
            console.log('==============================\n');
            
            console.log('Add this key to your Vercel environment variables as FIREBASE_PRIVATE_KEY_BASE64');
          } else {
            console.log('❌ Could not fix the key from file.');
          }
        } catch (error) {
          console.error(`Error fixing key from file: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
    
    return;
  }
  
  // Handle generate-base64 flag
  if (args.includes('--generate-base64')) {
    console.log('\n===== Generating Base64 Encoded Key =====\n');
    
    let privateKey;
    let sourceDesc;
    
    if (process.env.FIREBASE_PRIVATE_KEY) {
      console.log('Using FIREBASE_PRIVATE_KEY from environment...');
      privateKey = process.env.FIREBASE_PRIVATE_KEY;
      sourceDesc = 'FIREBASE_PRIVATE_KEY';
    } else {
      console.error('No private key found in environment variables');
      process.exit(1);
    }
    
    try {
      // Try to fix the key format first
      console.log('Formatting private key to ensure correct PEM structure...');
      const formattedKey = fixPrivateKeyFormat(privateKey);
      
      // Validate the formatted key
      const isValid = testPrivateKey(formattedKey);
      if (!isValid) {
        console.error('Failed to create a valid PEM key. Please check your service account JSON.');
        process.exit(1);
      }
      
      // Convert to base64
      console.log('Converting to Base64...');
      const base64Key = Buffer.from(formattedKey).toString('base64');
      
      console.log('\n===== BASE64 ENCODED KEY =====');
      console.log(base64Key);
      console.log('==============================\n');
      
      console.log('Instructions:');
      console.log('1. Copy the Base64 string above');
      console.log('2. Add it to your Vercel environment variables as FIREBASE_PRIVATE_KEY_BASE64');
      console.log('3. Redeploy your application');
      
      // Write to a file for easy access
      const fs = require('fs');
      fs.writeFileSync('private-key-base64.txt', base64Key);
      console.log('\nThe Base64 key has also been saved to private-key-base64.txt');
      
    } catch (error) {
      console.error(`Error generating Base64 key: ${error.message}`);
    }
    
    return;
  }
  
  // If no recognized arguments, show usage
  console.log('No valid options provided.');
  printUsage();
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});