# Firebase Environment Variables Setup Guide

This guide explains how to set up the required Firebase environment variables for this project. These environment variables are essential for Excel document processing and other Firebase-related features to work correctly.

## 1. Install Required Dependencies

First, ensure you have the `dotenv` package installed for environment variable testing:

```bash
npm install dotenv
```

## 2. Create Firebase Environment Variables

You need to set up Firebase environment variables by creating a `.env.local` file in the project root. There are two ways to do this:

### Option A: Use the Setup Script (Recommended)

Run the setup script that will guide you through the process:

```bash
node setup-firebase-env.js
```

The script will ask for Firebase configuration details that you can find in your Firebase console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Project Settings > General > Your apps > Web app > Firebase SDK snippet > Config
4. Project Settings > Service accounts > Generate new private key

### Option B: Manual Setup

1. Copy the `.env.local.example` file to `.env.local`:

```bash
cp .env.local.example .env.local
```

2. Edit the `.env.local` file and fill in all the required values from your Firebase project.

## 3. Verify Your Environment Setup

After setting up your environment variables, verify they're correctly configured:

```bash
node test-firebase-env.js
```

This script checks if all required Firebase environment variables are properly set.

## 4. Troubleshooting Common Issues

### Private Key Format

The `FIREBASE_PRIVATE_KEY` must be properly formatted with `\n` for newlines:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

### Authentication Issues

If you encounter authentication issues:
- Ensure the service account has the proper permissions in Firebase
- Verify that your Firebase project has Authentication enabled
- Check that your app's domains are in the authorized domains list

### Storage Access Issues

If you cannot access Firebase Storage:
- Verify that your service account has Storage Admin permissions
- Check your storage rules in Firebase Console

## 5. Next Steps

After setting up environment variables:

1. Restart your development server:
```bash
npm run dev
```

2. Try processing an Excel document again

3. Check server logs for any remaining errors

If you still encounter issues, please check the console logs for specific error messages that can help diagnose the problem.