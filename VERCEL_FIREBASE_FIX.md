# Firebase Fix for Vercel Deployment

This document explains how to fix the Firebase Admin SDK and Firestore path module issues when deploying to Vercel.

## The Problem

When deploying to Vercel, the following error occurs:

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

This occurs because:

1. Next.js tries to statically analyze imports at build time, including Firebase Admin SDK
2. During static analysis, it cannot find internal modules like `@google-cloud/firestore/build/src/path`
3. Missing sub-dependencies cause the build to fail
4. Server-side code is incorrectly bundled for client-side

## The Solution

We've created a comprehensive fix with multiple parts:

### 1. Custom Path Module Implementation

We create the missing path module implementation directly in the node_modules directory:

```
node_modules/@google-cloud/firestore/build/src/path/index.js
```

### 2. Updated webpack Configuration

The webpack configuration in next.config.js is updated to:
- Mark Firebase packages as external dependencies
- Provide fallbacks for Node.js modules
- Remove problematic aliases

### 3. Environment Configuration

Special environment variables ensure:
- Real Firebase services are used (not mocks)
- Production configuration is loaded
- Vercel deployment is properly detected

### 4. Fix Script

We've created a `fix-firebase-vercel.sh` script that:
- Installs all required Firebase dependencies
- Installs critical sub-dependencies (is-set, is-regexp, etc.)
- Creates the missing module implementations
- Sets up proper environment configuration
- Updates package.json if needed

### 5. Vercel Configuration

The vercel.json file has been updated to:
- Run the fix script during the build process
- Set required environment variables
- Use proper installation commands

## How to Use

### Option 1: Automatic Deployment

1. Push the updated code to your repository
2. Deploy to Vercel - the fix script will run automatically

### Option 2: Manual Fix

If you want to run the fix manually:

```bash
./fix-firebase-vercel.sh
```

Then deploy to Vercel:

```bash
npx vercel
```

## What the Fix Does

The fix ensures:

1. All required Firebase packages are properly installed
2. Missing path module is recreated with a compatible API
3. Next.js webpack configuration correctly handles Firebase modules
4. Environment variables are set to use real Firebase services
5. Build process works without errors

By implementing these fixes, Firebase Admin SDK functions properly in the Vercel environment without the "Cannot find module" errors.