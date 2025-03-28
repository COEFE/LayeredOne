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
  
  // For production fallback (embedded key)
  console.log('Using embedded service account key as last resort...');
  return `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCe/m4WApen/M1n
oOwnO1ajvbdJ3mg4nOPtGFg0OUsnc3CrHDVXObIEaNeYHuxOUFgRLbOx8+xcrmRB
GVoJL367YgIzcaXEVlvFCQ4WrVZDyESWHCjTOafFpAcjM2GgEEiCHRauDSiqwBXo
iyzH/aMKG7zu6xJpRNm2HDlPF9lo6PPC+DGtfV5n4lDWmOQIpghAI4dDbabfLLmL
uNzk2Ddahx5xcWFiJ/ikLRpnnpbPB1o7EbV0wyKPumCBi8/D5oJQIQ0tl7LuyKAj
sQ4U4ofxheCE5pq64GEh9SBmCUbnh5mPyS1tItOXw0kNKp66DXvABsBNzIfsa+dr
nIEgqlE7AgMBAAECggEATo6N3Agp4JGS97nWFMhH1Z1+O1xNiHNUVqhppFwOmw55
w8GrRU63e2BF7d6RiVw/NzWqjKllxqFP3a5mAxXZe0JAriRf8DNvIlqIAIJilhkU
ckq1jS/2ijuyXx0bBlglS0yOES9lQYCpEn35gVL7xJnR7wZs0WB4ZXdqhX7WJ/Py
ODZykBeJ4qsXcbJO7E58vRQoLj3yYu5wEsoVYriHLiNXfVxAEd3rlZ0UeLjGee9z
r55TuRv7AhxF63geeXp2uLRt5e6wRyDMsdCFwhwQKJXfnW1NjLr1lhRuvtUANdrB
fQbPyHklJPAYNUZBax0UvhqTheWJDTHpUHhBpEjbgQKBgQDSnSQpFoQd/MThnUdu
AzSZ0WEXE1cNWsBf0T64NlJpySo4KOAtyythSjIuytiBmHLndS0JPaWV42bkIFEG
WlLTdyCaY5MPVtbUCPBJZZeUB3eo44S46Mp0uxxaMGC3wLR2ke2aHTlvQa+yaE4W
g8ad+t6wlS1jC9WUUsxqIE4f+wKBgQDBQZahY+CP0MDG2q/YJOGpqrft5VxpVPtD
z8IsG10MjHL/2HK8nw8EJ+AaXINM54mcxLkb0attZZUIf2Hfs8Yi/dF1g4hbahT6
1MzWBnTYCHYVQt5KAQLH5GJKVJaUtevZBKN6FQ+aohLiOKBc6J0OppL1queN6K7g
Tv7D5gWPwQKBgCrki+++QSvmRaZ5JIn4JydIaBCOBMWYfONGtxJHJeObb3i+gmFx
JiWLOcsjzpIeHRCcYY6nOmjbRiIhnr6/eGzOrxoiO1n9YoUOSPl5sjQYjTsdEvOh
nVHGpZCMl7X0jgwzzgL7/q104DZiXbziG3ojFGU8DGFGkLnDXxQh/icvAoGAPWKp
BxCjlur3IPL74gstBuisTcuKBAczXMHUapAyiTbfnHbTUyiu62IDJDx4lGgDZSFz
rut1qWUX5sAXhagj6p929f3WxTq3+Ui4287nNGvTnkNEOnuBt57KvdOKlSgIB0Ia
7z9bWoHav7K+9WQJ50pv6crkjEX5rlRJRk59O8ECgYEAuipnpFp3k05ZUl1W8bVd
kPzrL9/rxFviaapUi8ZwE4CPEEopXRO6nJSen6QjKkxM3uRBybTa1u1cc2e4AMBV
yIbP4SVlkIAOoR0jk4e9skCgN0JWjqt36kbbM9GWAAz97Gw25vqxtPFCj0EUahVo
T78NlclGYfEsc1Qvj/fc7Ws=
-----END PRIVATE KEY-----`;
}