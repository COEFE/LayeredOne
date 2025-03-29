/**
 * Enhanced Firebase key helper for production environments
 * Provides robust private key handling to prevent the "Invalid PEM formatted message" error
 */

// Function to validate a PEM formatted private key
function isValidPem(key) {
  if (!key) return false;
  
  // Must have both header and footer
  const hasHeader = key.includes('-----BEGIN PRIVATE KEY-----');
  const hasFooter = key.includes('-----END PRIVATE KEY-----');
  
  // Must have proper line breaks between header and footer
  const hasProperFormat = key.includes('-----BEGIN PRIVATE KEY-----') && 
                         key.includes('-----END PRIVATE KEY-----') &&
                         (key.includes('\n') || key.includes('\\n'));
                         
  return hasHeader && hasFooter && hasProperFormat;
}

// Function to fix common PEM format issues
function formatPemKey(key) {
  if (!key) return null;
  
  // Remove any surrounding quotes
  key = key.replace(/^["']|["']$/g, '');
  
  // Check if it already has headers
  const hasHeader = key.includes('-----BEGIN PRIVATE KEY-----');
  const hasFooter = key.includes('-----END PRIVATE KEY-----');
  
  if (!hasHeader || !hasFooter) {
    console.warn('Warning: Private key is missing BEGIN/END markers');
    
    // Try to add headers if it looks like a base64 string without headers
    if (/^[A-Za-z0-9+/=]+$/.test(key.trim())) {
      console.log('Adding PEM headers to what appears to be a raw base64 key');
      key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
    } else {
      return null; // Can't fix a key without proper markers
    }
  }
  
  // Handle escaped newlines (common in environment variables)
  if (key.includes('\\n')) {
    console.log('Converting escaped newlines to literal newlines');
    key = key.replace(/\\n/g, '\n');
  }
  
  // Ensure header and footer have proper spacing
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----\n')) {
    key = key.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
  }
  
  if (!key.includes('\n-----END PRIVATE KEY-----')) {
    key = key.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }
  
  return key;
}

// Enhanced function to get private key from environment
export function getPrivateKeyFromEnv() {
  console.log('===== Getting Firebase Private Key for Production =====');
  
  // Try the base64 version first (most reliable for production)
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (privateKeyBase64) {
    console.log('FIREBASE_PRIVATE_KEY_BASE64 found, decoding...');
    try {
      const decoded = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
      
      // Validate the decoded key
      if (isValidPem(decoded)) {
        console.log('Successfully decoded valid PEM key from Base64');
        return formatPemKey(decoded); // Format it anyway for extra safety
      } else {
        console.warn('Decoded Base64 key has invalid PEM format, attempting to fix...');
        const fixedKey = formatPemKey(decoded);
        
        if (isValidPem(fixedKey)) {
          console.log('Successfully fixed decoded Base64 key');
          return fixedKey;
        } else {
          console.error('Failed to fix decoded Base64 key, will try other formats');
        }
      }
    } catch (error) {
      console.error('Error decoding FIREBASE_PRIVATE_KEY_BASE64:', error.message);
    }
  } else {
    console.log('No FIREBASE_PRIVATE_KEY_BASE64 found, checking other formats...');
  }
  
  // Try direct key with processing
  const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKeyEnv) {
    console.log('FIREBASE_PRIVATE_KEY found, processing...');
    
    // Log private key characteristics for debugging (without exposing the key)
    console.log(`Key length: ${privateKeyEnv.length}`);
    console.log(`Contains BEGIN marker: ${privateKeyEnv.includes('BEGIN PRIVATE KEY')}`);
    console.log(`Contains END marker: ${privateKeyEnv.includes('END PRIVATE KEY')}`);
    console.log(`Contains escaped newlines (\\n): ${privateKeyEnv.includes('\\n')}`);
    console.log(`Contains literal newlines: ${privateKeyEnv.includes('\n')}`);
    console.log(`Starts with quotes: ${privateKeyEnv.startsWith('"') || privateKeyEnv.startsWith("'")}`);
    console.log(`Ends with quotes: ${privateKeyEnv.endsWith('"') || privateKeyEnv.endsWith("'")}`);
    
    // Format the key to ensure correct PEM format
    const formattedKey = formatPemKey(privateKeyEnv);
    
    if (formattedKey && isValidPem(formattedKey)) {
      console.log('Successfully formatted private key with valid PEM format');
      return formattedKey;
    } else {
      console.error('Failed to create a valid PEM key from FIREBASE_PRIVATE_KEY');
    }
  } else {
    console.log('No FIREBASE_PRIVATE_KEY found');
  }
  
  // No fallback - require valid credentials for production
  console.error('No valid private key found in environment variables for production');
  // Return null instead of a hardcoded key - this will cause proper error handling
  return null;
}