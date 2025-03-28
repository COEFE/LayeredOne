/**
 * Script to properly format Firebase private key for production deployments
 * 
 * This script handles the most common causes of the "Invalid PEM formatted message" error:
 * 1. Incorrect line breaks in the private key
 * 2. Missing or malformed PEM header/footer
 * 3. Issues with quoted strings in environment variables
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Running Firebase private key production fix script...');

// Create the new .env.production file
let envContent = '';

// Function to properly format a PEM key
function formatPemKey(key) {
  if (!key) {
    console.error('❌ ERROR: No private key provided');
    return null;
  }
  
  // Remove any existing quotes
  key = key.replace(/^["']|["']$/g, '');
  
  // Check if the key already has proper format with headers
  const hasHeader = key.includes('-----BEGIN PRIVATE KEY-----');
  const hasFooter = key.includes('-----END PRIVATE KEY-----');
  
  if (!hasHeader || !hasFooter) {
    console.error('❌ ERROR: Private key is missing BEGIN/END markers');
    return null;
  }
  
  // Handle different newline formats
  if (key.includes('\\n')) {
    // Replace escaped newlines with actual newlines
    console.log('Converting escaped newlines to actual newlines...');
    key = key.replace(/\\n/g, '\n');
  }
  
  // Ensure proper formatting with newlines
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----\n')) {
    key = key.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
  }
  
  if (!key.includes('\n-----END PRIVATE KEY-----')) {
    key = key.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }
  
  // Ensure PEM blocks have proper line wrapping (64 characters)
  const header = '-----BEGIN PRIVATE KEY-----\n';
  const footer = '\n-----END PRIVATE KEY-----';

  // Extract the base64 content between header and footer
  let base64Content = key.replace(header, '').replace(footer, '');
  
  // Remove all existing newlines from the base64 content
  base64Content = base64Content.replace(/\n/g, '');
  
  // Wrap at 64 characters
  let wrappedContent = '';
  for (let i = 0; i < base64Content.length; i += 64) {
    wrappedContent += base64Content.substring(i, i + 64) + '\n';
  }
  
  // Reconstruct the key with proper formatting
  return header + wrappedContent + footer;
}

// Try to read existing environment variables
try {
  // Try to read existing private key from environment
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || 
    fs.readFileSync(path.join(process.cwd(), 'private-key.txt'), 'utf8').trim();
  
  console.log('Found private key, formatting for production...');
  
  // Format the key properly
  const formattedKey = formatPemKey(privateKey);
  
  if (!formattedKey) {
    throw new Error('Failed to format private key');
  }
  
  // Generate different formats of the key
  const escapedKey = formattedKey.replace(/\n/g, '\\n');
  const base64Key = Buffer.from(formattedKey).toString('base64');
  
  // Create environment variable content with all formats
  envContent = `
# Firebase configuration
NEXT_PUBLIC_FIREBASE_API_KEY=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAd0rRHvA4yeU52WYN4GGRWzKU4Ixa61V0'}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'variance-test-4b441.firebaseapp.com'}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441'}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app'}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '829344781917'}
NEXT_PUBLIC_FIREBASE_APP_ID=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:829344781917:web:8cbcc930bab2217d9d1c1f'}

# Firebase Admin SDK configuration 
FIREBASE_CLIENT_EMAIL=${process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com'}
FIREBASE_PRIVATE_KEY_ID=${process.env.FIREBASE_PRIVATE_KEY_ID || '96aa094298f80099a378e9244b8e7e22f214cc2a'}

# Firebase private key formats
# 1. Standard private key with literal newlines - DO NOT USE IN PRODUCTION
FIREBASE_PRIVATE_KEY_LITERAL=${formattedKey}

# 2. Escaped newlines version - USE THIS FOR MOST ENVIRONMENTS
FIREBASE_PRIVATE_KEY="${escapedKey}"

# 3. Base64 encoded version - MOST RELIABLE FOR PRODUCTION
FIREBASE_PRIVATE_KEY_BASE64=${base64Key}

# Production flags
NEXT_PUBLIC_VERCEL_DEPLOYMENT=true
NEXT_PUBLIC_USE_REAL_FIREBASE=true
  `.trim();
  
  // Write the formatted environment variables
  fs.writeFileSync(path.join(process.cwd(), '.env.production'), envContent);
  console.log('✅ Created .env.production with properly formatted Firebase keys');
  
  // Also create a properly formatted private key file
  fs.writeFileSync(path.join(process.cwd(), 'private-key-formatted.txt'), formattedKey);
  console.log('✅ Created private-key-formatted.txt with properly formatted PEM key');
  
  // Create a Base64 encoded version too
  fs.writeFileSync(path.join(process.cwd(), 'private-key-base64.txt'), base64Key);
  console.log('✅ Created private-key-base64.txt with Base64 encoded key');
  
  console.log('\n🔍 VERIFICATION:');
  console.log('- Standard key format has proper BEGIN/END markers:', 
              formattedKey.includes('-----BEGIN PRIVATE KEY-----') && 
              formattedKey.includes('-----END PRIVATE KEY-----'));
  console.log('- Standard key has proper newlines:', formattedKey.includes('\n'));
  console.log('- Escaped key has proper escaped newlines:', escapedKey.includes('\\n'));
  console.log('- Base64 key length:', base64Key.length);
  
  console.log('\n🚀 SUCCESS: Firebase private key has been properly formatted for production use');
  console.log('To use in production environment:');
  console.log('1. Copy the contents of `.env.production` to your production environment variables');
  console.log('2. Or copy the Base64 encoded key from `private-key-base64.txt` to your FIREBASE_PRIVATE_KEY_BASE64 environment variable');
  
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('Please provide a valid Firebase private key in the FIREBASE_PRIVATE_KEY environment variable');
  console.error('or create a private-key.txt file in the project root with your private key');
  
  // Create a template file anyway
  envContent = `
# Firebase configuration
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# Firebase Admin SDK configuration 
FIREBASE_CLIENT_EMAIL=YOUR_SERVICE_ACCOUNT_EMAIL
FIREBASE_PRIVATE_KEY_ID=YOUR_PRIVATE_KEY_ID

# IMPORTANT: For the private key, you must use one of these formats:
# 1. Base64 encoded (recommended):
FIREBASE_PRIVATE_KEY_BASE64=YOUR_BASE64_ENCODED_PRIVATE_KEY

# 2. With escaped newlines:
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY\\n-----END PRIVATE KEY-----"

# Production flags
NEXT_PUBLIC_VERCEL_DEPLOYMENT=true
NEXT_PUBLIC_USE_REAL_FIREBASE=true
  `.trim();
  
  fs.writeFileSync(path.join(process.cwd(), '.env.production.template'), envContent);
  console.log('✅ Created .env.production.template with instructions');
}