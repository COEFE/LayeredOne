# Firebase Fix for Vercel Deployment

This document explains how to fix Firebase Admin SDK issues when deploying to Vercel.

## Problem 1: Missing Firestore Path Module

When deploying to Vercel, you might encounter this error:

```
Error getting Firebase services, using mocks: Error: Cannot find module '@google-cloud/firestore'
[Error: Cannot find module '@google-cloud/firestore/build/src/path'
[Error: Cannot find module '@google-cloud/firestore/build/src/path'
> Build error occurred
[Error: Failed to collect page data for /api/documents/edit] {
  type: 'Error'
}
Error: Command "node scripts/vercel-deploy.js && SIMPLE_PDF=true npm run build" exited with 1
```

## Problem 2: Service Account JSON File Not Found

Another common error is:

```
The file at ./variance-test-4b441-firebase-adminsdk-fbsvc-6ef054c9fe.json does not exist, or it is not a file. 
ENOENT: no such file or directory, lstat '/var/task/variance-test-4b441-firebase-adminsdk-fbsvc-6ef054c9fe.json'
```

### Causes for Problem 1:

1. Next.js tries to statically analyze imports at build time, including Firebase Admin SDK
2. During static analysis, it cannot find internal modules like `@google-cloud/firestore/build/src/path`
3. Missing sub-dependencies cause the build to fail
4. Server-side code is incorrectly bundled for client-side

### Causes for Problem 2:

1. The Firebase Admin SDK is trying to load a service account JSON file directly from the filesystem
2. In a Vercel serverless function environment, you cannot reference local files that are not part of your deployment
3. The path `/var/task/` is Vercel's internal serverless function environment
4. Service account JSON files should not be committed to your repository for security reasons

## Solutions

### Solution for Problem 1: Missing Firestore Path Module

We've created a fix with multiple parts:

#### 1. Custom Path Module Implementation

We create the missing path module implementation directly in the node_modules directory:

```
node_modules/@google-cloud/firestore/build/src/path/index.js
```

#### 2. Updated webpack Configuration

The webpack configuration in next.config.js is updated to:
- Mark Firebase packages as external dependencies
- Provide fallbacks for Node.js modules
- Remove problematic aliases

#### 3. Environment Configuration

Special environment variables ensure:
- Real Firebase services are used (not mocks)
- Production configuration is loaded
- Vercel deployment is properly detected

#### 4. Fix Script

We've created a `fix-firebase-vercel.sh` script that:
- Installs all required Firebase dependencies
- Installs critical sub-dependencies (is-set, is-regexp, etc.)
- Creates the missing module implementations
- Sets up proper environment configuration
- Updates package.json if needed

#### 5. Vercel Configuration

The vercel.json file has been updated to:
- Run the fix script during the build process
- Set required environment variables
- Use proper installation commands

### Solution for Problem 2: Service Account JSON File Not Found

The solution is to use environment variables instead of local JSON files for Firebase credentials.

#### 1. Update Your Code

The `src/firebase/admin-config.ts` file has been updated to:

- Properly handle environment variable-based credentials
- Detect and warn about file path references
- Provide fallback options if the primary initialization fails
- Add more detailed logging for troubleshooting

#### 2. Set Up Required Environment Variables in Vercel

You must configure the following environment variables in your Vercel project settings:

- `FIREBASE_CLIENT_EMAIL` - The service account client email
- `FIREBASE_PRIVATE_KEY` - The service account private key (**must include** quotes and `\n` characters)
- `FIREBASE_PRIVATE_KEY_ID` - The service account private key ID
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket

#### 3. Special Handling for FIREBASE_PRIVATE_KEY

The `FIREBASE_PRIVATE_KEY` requires special formatting:

- Must be wrapped in double quotes
- Must use `\n` for newlines, not literal newlines
- Example format: `"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBA...\n-----END PRIVATE KEY-----\n"`

## How to Use

### For Problem 1: Missing Firestore Path Module

#### Option 1: Automatic Deployment

1. Push the updated code to your repository
2. Deploy to Vercel - the fix script will run automatically

#### Option 2: Manual Fix

If you want to run the fix manually:

```bash
./fix-firebase-vercel.sh
```

Then deploy to Vercel:

```bash
npx vercel
```

### For Problem 2: Service Account JSON File Not Found

#### Option 1: Fix Firebase Credentials

1. Run the Firebase credentials fix script:

```bash
node fix-firebase-credentials.js
```

2. Check the output for issues with your Firebase credentials
3. Verify that the environment variables are correctly formatted

#### Option 2: Testing Your Solution

After updating your code and setting the environment variables:

1. Test locally with proper environment variables
2. Deploy your application to Vercel
3. Check the function logs for errors
4. Try uploading a document

#### Common Issues and Solutions

1. **Error: "FIREBASE_PRIVATE_KEY is missing"**
   - Make sure you have added this environment variable in your Vercel project settings.

2. **Error: "Private key does not contain newlines"**
   - Your private key is not formatted correctly. Use the fix script to fix the format.

3. **Error: "credential implementation with an error"**
   - Verify that your `FIREBASE_CLIENT_EMAIL` matches the service account email.

## What the Fix Does

### For Problem 1: Missing Firestore Path Module

The fix ensures:

1. All required Firebase packages are properly installed
2. Missing path module is recreated with a compatible API
3. Next.js webpack configuration correctly handles Firebase modules
4. Environment variables are set to use real Firebase services
5. Build process works without errors

By implementing these fixes, Firebase Admin SDK functions properly in the Vercel environment without the "Cannot find module" errors.

### For Problem 2: Service Account JSON File Not Found

The fix ensures:

1. Firebase Admin SDK uses environment variables instead of local JSON files
2. The admin-config.ts file properly handles different credential formats
3. Detailed logging helps diagnose any remaining issues
4. Fallback mechanisms provide graceful degradation if initialization fails
5. The code is more resilient to different deployment environments

By implementing these fixes, the Firebase Admin SDK will properly authenticate in the Vercel serverless function environment without trying to access local files that don't exist.

## How to Get Firebase Service Account Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on Project Settings (gear icon)
4. Go to the "Service accounts" tab
5. Click "Generate new private key"
6. Download the JSON file
7. Extract the credentials from the downloaded JSON file
8. Format them properly for environment variables

## Verifying Your Configuration

You can verify your Firebase Admin SDK configuration using:

```
node test-firebase-env.js
```

This will attempt to initialize the Firebase Admin SDK and report any errors.