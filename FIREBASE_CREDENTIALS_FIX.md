# Firebase Credentials Fix Guide

## Problem: "No valid private key found in environment variables"

When encountering this error:

```
No valid private key found in environment variables
No valid Firebase private key available from environment variables
Please ensure FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_BASE64 is set correctly
Error initializing Firebase Admin SDK: Error: No valid private key available.
```

This occurs when the Firebase Admin SDK cannot properly initialize due to missing or malformed private key in the environment variables.

## Root Cause

1. The Firebase Admin SDK needs a valid private key in one of two environment variables:
   - `FIREBASE_PRIVATE_KEY` - The direct private key with proper newline formatting
   - `FIREBASE_PRIVATE_KEY_BASE64` - A Base64 encoded version of the key

2. Common issues:
   - Missing environment variables
   - Incorrectly formatted private keys (missing proper `\n` escaping in .env files)
   - Missing BEGIN/END markers in the private key

## Solution

1. Ensure your `.env.local` file has the correct Firebase credentials:
   ```
   # Firebase private key with escaped newlines
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...key contents...\n-----END PRIVATE KEY-----"
   
   # Firebase client email
   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
   
   # Firebase project ID
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
   
   # Firebase storage bucket
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
   ```

2. Run the `setup-firebase-env.js` script to automatically fix these issues:
   ```
   node setup-firebase-env.js
   ```

3. Rebuild your application:
   ```
   npm run build
   ```

## Technical Details

The application loads Firebase credentials in this order:

1. First, it tries to use `FIREBASE_PRIVATE_KEY` directly
2. If that's not available, it looks for `FIREBASE_PRIVATE_KEY_BASE64` and decodes it
3. If neither is found, the Firebase Admin SDK initialization fails

The `key-helpers.js` file contains the logic for retrieving the private key from environment variables:

```javascript
export function getPrivateKeyFromEnv() {
  // First, try to get from the regular environment variable
  if (process.env.FIREBASE_PRIVATE_KEY) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Handle the case where the key has escaped newlines
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Check if the key has the proper format
    if (privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
        privateKey.includes('-----END PRIVATE KEY-----')) {
      return privateKey;
    }
  }
  
  // Then, try base64-encoded key
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      const buffer = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64');
      const decodedKey = buffer.toString('utf8');
      
      if (decodedKey.includes('-----BEGIN PRIVATE KEY-----') && 
          decodedKey.includes('-----END PRIVATE KEY-----')) {
        return decodedKey;
      }
    } catch (error) {
      console.error('Error decoding base64 private key:', error);
    }
  }
  
  // If all else fails, return null
  return null;
}
```

## Deployment Considerations

1. **Local Development**: Use `.env.local` with escaped newlines in the private key
2. **Vercel Deployment**: In Vercel environment variables, use literal newlines (not escaped with `\n`)
3. **GitHub Pages**: For static exports, ensure the `setup-firebase-env.js` script is run during the build process

## Security Reminder

Never commit actual Firebase private keys to your repository. The key included in the setup script is for development use only and should be replaced with your own credentials in production environments.