/**
 * Helper for working with Firebase key formats
 */

// For decoding base64 encoded private keys
export function getPrivateKeyFromEnv() {
  // Try the base64 version first
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (privateKeyBase64) {
    try {
      return Buffer.from(privateKeyBase64, 'base64').toString('utf8');
    } catch (error) {
      console.error('Error decoding private key from base64:', error);
    }
  }
  
  // Fall back to regular key with processing
  const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKeyEnv) return null;
  
  try {
    // Check if the key is wrapped in quotes
    if (privateKeyEnv.startsWith('"') && privateKeyEnv.endsWith('"')) {
      // Remove the quotes before processing
      return privateKeyEnv.substring(1, privateKeyEnv.length - 1).replace(/\\n/g, '\n');
    }
    
    // Handle both escaped newlines and literal newlines
    if (privateKeyEnv.includes('\\n')) {
      // Convert \n to actual newlines
      return privateKeyEnv.replace(/\\n/g, '\n');
    } else if (privateKeyEnv.includes('\n')) {
      // Already has literal newlines
      return privateKeyEnv;
    } else {
      // No newlines at all - likely malformed
      console.warn('Warning: Private key does not contain newlines (\\n or literal)');
      return privateKeyEnv;
    }
  } catch (error) {
    console.error('Error processing private key:', error);
    return privateKeyEnv;
  }
}