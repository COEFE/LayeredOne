# Vercel Environment Setup for Firebase

## Problem: Firebase Private Key Error in Vercel

When deploying to Vercel, you may encounter this error despite working correctly locally:

```
No valid private key found in environment variables
No valid Firebase private key available from environment variables
Please ensure FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_BASE64 is set correctly
Error initializing Firebase Admin SDK: Error: No valid private key available.
```

This happens because Vercel handles environment variables differently than your local environment.

## Solution: Properly Configure Firebase Private Key in Vercel

### 1. Format the Private Key Correctly for Vercel

Vercel handles newlines in environment variables differently from local development. For Vercel you need to:

1. Use **actual newlines** instead of escaped `\n` characters
2. Make sure to properly format the key with line breaks

### 2. Configure Environment Variables in Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add the following environment variables:

   - `FIREBASE_CLIENT_EMAIL`: Your Firebase service account email
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Your Firebase project ID
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket
   
4. For `FIREBASE_PRIVATE_KEY`:
   - Copy your Firebase private key from the service account JSON file
   - **Important:** Make sure it includes the BEGIN/END markers and actual newlines
   - Enter it like this (with actual line breaks):

   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCe/m4WApen/M1n
   oOwnO1ajvbdJ3mg4nOPtGFg0OUsnc3CrHDVXObIEaNeYHuxOUFgRLbOx8+xcrmRB
   GVoJL367YgIzcaXEVlvFCQ4WrVZDyESWHCjTOafFpAcjM2GgEEiCHRauDSiqwBXo
   iyzH/aMKG7zu6xJpRNm2HDlPF9lo6PPC+DGtfV5n4lDWmOQIpghAI4dDbabfLLmL
   ...rest of your key...
   -----END PRIVATE KEY-----
   ```

   **Do not** include quotes or escape newlines with `\n`

### 3. Alternative: Use Base64 Encoded Key

If you have issues with the line breaks, use a Base64 encoded version instead:

1. Generate a Base64 version of your private key:
   ```bash
   cat your-firebase-credentials.json | jq -r .private_key | base64
   ```

2. Add it as `FIREBASE_PRIVATE_KEY_BASE64` in Vercel environment variables
3. Our application will automatically detect and decode this format

### 4. Redeploy Your Application

After configuring the environment variables, redeploy your application to apply the changes.

## Troubleshooting

If you're still facing issues, try these troubleshooting steps:

1. **Verify Key Format**: Ensure the private key contains actual line breaks in Vercel, not escaped `\n` characters
2. **Check Logs**: In Vercel logs, look for messages from the Firebase initialization
3. **Debug Endpoint**: Try accessing `/api/debug/firebase-credentials` to verify credentials

## Script for Testing Environment Variables

Create a deploy script to automatically handle environment variables:

```javascript
// generate-vercel-env.js
const fs = require('fs');

// Read existing environment variables from .env.local
let envContent = '';
try {
  if (fs.existsSync('.env.local')) {
    envContent = fs.readFileSync('.env.local', 'utf8');
  }
} catch (err) {
  console.log('No .env.local file found');
}

// Extract values using regex
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}=["']?([^"'\n]+)["']?`));
  return match ? match[1] : '';
};

// Format for Vercel
const vercelConfig = {
  "env": {
    "FIREBASE_CLIENT_EMAIL": getEnvVar('FIREBASE_CLIENT_EMAIL'),
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID": getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
  },
  "build": {
    "env": {
      "FIREBASE_CLIENT_EMAIL": getEnvVar('FIREBASE_CLIENT_EMAIL'),
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID": getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
    }
  }
};

// Handle the private key correctly - it needs special handling
const privateKey = getEnvVar('FIREBASE_PRIVATE_KEY');
if (privateKey) {
  // Replace escaped newlines with actual newlines for Vercel
  const formattedKey = privateKey.replace(/\\n/g, '\n');
  vercelConfig.env.FIREBASE_PRIVATE_KEY = formattedKey;
  vercelConfig.build.env.FIREBASE_PRIVATE_KEY = formattedKey;
}

// Write to vercel.json
fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
console.log('Generated vercel.json with environment variables');
```

Run this script before deploying to Vercel to automatically format your environment variables correctly.

## Remember

Different environments handle environment variables differently:
- **Local**: Use escaped newlines (`\n`) in `.env.local`
- **Vercel**: Use actual newlines in environment variables
- **GitHub Actions**: Use Base64 encoded keys for easier handling

Always keep your Firebase credentials secure and never commit them to your repository.