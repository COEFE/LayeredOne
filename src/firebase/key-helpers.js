/**
 * Helper for working with Firebase key formats
 */

// For retrieving the private key from environment variables
export function getPrivateKeyFromEnv() {
  console.log('===== Getting Firebase Private Key =====');
  
  // First, try to get from the regular environment variable
  if (process.env.FIREBASE_PRIVATE_KEY) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Handle the case where the key has escaped newlines
    if (privateKey.includes('\\n')) {
      console.log('Converting escaped newlines to actual newlines');
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Check if the key has the proper format
    if (privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
        privateKey.includes('-----END PRIVATE KEY-----')) {
      console.log('Using private key from FIREBASE_PRIVATE_KEY env variable');
      return privateKey;
    } else {
      console.warn('FIREBASE_PRIVATE_KEY env variable is set but has invalid format');
    }
  }
  
  // Then, try base64-encoded key (if available)
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      console.log('Decoding base64 private key');
      // Decode the base64 key
      const buffer = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64');
      const decodedKey = buffer.toString('utf8');
      
      // Check if the decoded key has the proper format
      if (decodedKey.includes('-----BEGIN PRIVATE KEY-----') && 
          decodedKey.includes('-----END PRIVATE KEY-----')) {
        console.log('Using private key from FIREBASE_PRIVATE_KEY_BASE64 env variable');
        return decodedKey;
      } else {
        console.warn('Decoded FIREBASE_PRIVATE_KEY_BASE64 has invalid format');
      }
    } catch (error) {
      console.error('Error decoding base64 private key:', error);
    }
  }
  
  // If all else fails, log an error and return null
  console.error('No valid private key found in environment variables');
  // Return null instead of a hardcoded key - this will cause proper error handling
  return null;
}