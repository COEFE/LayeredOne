# Setting Up Vercel Environment Variables

This guide will help you properly set up environment variables for your Vercel deployment, particularly for Firebase authentication and Excel document processing.

## Required Environment Variables

The following environment variables **MUST** be set in your Vercel project settings for the application to work correctly:

### 1. Firebase Client-Side Variables

These are used for the browser client to connect to Firebase:

- `NEXT_PUBLIC_FIREBASE_API_KEY` - Your Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Your Firebase auth domain (e.g., `your-project.firebaseapp.com`)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Your Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Your Firebase app ID
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` - Your Firebase measurement ID (optional)

### 2. Firebase Server-Side Variables

These are critical for server-side Firebase Admin SDK functionality, including Excel document processing:

- `FIREBASE_CLIENT_EMAIL` - The service account client email
- `FIREBASE_PRIVATE_KEY` - The service account private key (**must include** quotes and `\n` characters)
- `FIREBASE_PRIVATE_KEY_ID` - The service account private key ID

### 3. AI API Keys

For AI functionality:

- `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` - Your API key for Claude AI

### 4. Feature Flags and Configuration

- `NEXT_PUBLIC_VERCEL_DEPLOYMENT` - Set to `true`
- `NEXT_PUBLIC_USE_REAL_FIREBASE` - Set to `true`
- `SIMPLE_PDF` - Set to `true`

## How to Set Up Environment Variables in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click on "Settings" tab
4. Navigate to "Environment Variables" section
5. Add each environment variable with its value

### Important Notes for the Private Key

The `FIREBASE_PRIVATE_KEY` requires special formatting:

- Copy the key directly from your service account JSON file
- Make sure to include the quotes at the beginning and end: `"-----BEGIN PRIVATE KEY-----\n..."`
- Do not remove the `\n` characters - they're needed for proper line breaks
- Example format: `"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBA...\n-----END PRIVATE KEY-----\n"`

## Getting Firebase Credentials

### Firebase Web App Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on Project Settings (gear icon)
4. Under "Your apps", select your Web app
5. Find the Firebase SDK snippet (click "Config")
6. Copy the values from the configuration object

### Firebase Admin SDK Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on Project Settings (gear icon)
4. Go to the "Service accounts" tab
5. Click "Generate new private key"
6. Download the JSON file
7. Extract the required values from the JSON file

## Verifying Your Configuration

After setting up the environment variables:

1. Deploy your application to Vercel
2. Check the build logs for any environment-related errors
3. If the build succeeds, try these tests:
   - Log in to your application
   - Upload an Excel document
   - Try processing the document

## Troubleshooting

If you encounter issues with your Vercel deployment:

1. **Firebase Authentication Issues**:
   - Check that your Firebase project has the Vercel domain added to authorized domains
   - Verify that all client-side Firebase variables are correctly set

2. **Excel Document Processing Issues**:
   - Verify the server-side Firebase variables are set correctly
   - Check that the private key is properly formatted with quotes and `\n` characters
   - Look for error messages in the Vercel function logs

3. **Build Errors**:
   - Check that `NEXT_PUBLIC_VERCEL_DEPLOYMENT` and `SIMPLE_PDF` are set to `true`
   - Verify that the build command includes the Vercel deploy script

## Important: Security Best Practices

- Never commit your environment variables to your repository
- Use Vercel's environment variable system only
- Review access to your Vercel project regularly
- Rotate your API keys and Firebase credentials periodically