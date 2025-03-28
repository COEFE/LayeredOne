/**
 * Helper for working with Firebase key formats
 */

// For decoding base64 encoded private keys
export function getPrivateKeyFromEnv() {
  console.log('===== Getting Firebase Private Key =====');
  
  // Try the base64 version first
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (privateKeyBase64) {
    console.log('FIREBASE_PRIVATE_KEY_BASE64 found, attempting to decode...');
    try {
      const decoded = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN PRIVATE KEY-----') && 
          decoded.includes('-----END PRIVATE KEY-----')) {
        console.log('Successfully decoded base64 private key with proper BEGIN/END markers');
        return decoded;
      } else {
        console.warn('Decoded base64 key is missing BEGIN/END markers, might be invalid');
        // Continue with attempt to use it anyway
        return decoded;
      }
    } catch (error) {
      console.error('Error decoding private key from base64:', error);
      console.log('Will try standard FIREBASE_PRIVATE_KEY instead');
    }
  } else {
    console.log('No FIREBASE_PRIVATE_KEY_BASE64 found, checking for standard key...');
  }
  
  // Fall back to regular key with processing
  const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKeyEnv) {
    console.error('FIREBASE_PRIVATE_KEY is not set in environment variables');
    return null;
  }
  
  console.log('FIREBASE_PRIVATE_KEY found, processing...');
  try {
    // Log private key characteristics (without exposing the key)
    console.log(`Key length: ${privateKeyEnv.length}`);
    console.log(`Contains BEGIN marker: ${privateKeyEnv.includes('BEGIN PRIVATE KEY')}`);
    console.log(`Contains END marker: ${privateKeyEnv.includes('END PRIVATE KEY')}`);
    console.log(`Contains escaped newlines (\\n): ${privateKeyEnv.includes('\\n')}`);
    console.log(`Contains literal newlines: ${privateKeyEnv.includes('\n')}`);
    console.log(`Starts with quotes: ${privateKeyEnv.startsWith('"')}`);
    console.log(`Ends with quotes: ${privateKeyEnv.endsWith('"')}`);
    
    // Check if the key is wrapped in quotes
    if (privateKeyEnv.startsWith('"') && privateKeyEnv.endsWith('"')) {
      console.log('Key is wrapped in quotes, removing them and processing newlines...');
      // Remove the quotes before processing
      const processed = privateKeyEnv.substring(1, privateKeyEnv.length - 1).replace(/\\n/g, '\n');
      console.log('Successfully processed quoted key with escaped newlines');
      return processed;
    }
    
    // Handle both escaped newlines and literal newlines
    if (privateKeyEnv.includes('\\n')) {
      console.log('Key contains escaped newlines, converting to literal newlines...');
      // Convert \n to actual newlines
      const processed = privateKeyEnv.replace(/\\n/g, '\n');
      console.log('Successfully converted escaped newlines');
      return processed;
    } else if (privateKeyEnv.includes('\n')) {
      console.log('Key already contains literal newlines, using as is...');
      // Already has literal newlines
      return privateKeyEnv;
    } else {
      // No newlines at all - likely malformed
      console.warn('Warning: Private key does not contain newlines (\\n or literal)');
      console.warn('This may cause Firebase authentication issues');
      return privateKeyEnv;
    }
  } catch (error) {
    console.error('Error processing private key:', error);
    return privateKeyEnv;
  }
}