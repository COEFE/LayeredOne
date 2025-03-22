# Firebase Deployment Guide

This guide provides comprehensive instructions for deploying the LLM Chat App to Firebase, ensuring full functionality including authentication, database, and storage.

## Prerequisites

1. Firebase account and project
2. Firebase CLI installed (`npm install -g firebase-tools`)
3. Logged in to Firebase CLI (`firebase login`)
4. Environment variables set up in `.env.local`

## One-Command Deployment

For a simple deployment, run:

```bash
npm run deploy:firebase
```

This will:
1. Build your Next.js application
2. Copy necessary files to the output directory
3. Deploy everything to Firebase

## Step-by-Step Deployment Process

If you prefer a more controlled deployment process:

### 1. Set Environment Variables

First, set your environment variables in Firebase:

```bash
npm run firebase:env
```

This will read your `.env.local` file and set those variables in Firebase Functions config.

### 2. Deploy Specific Services

Deploy only what you need:

```bash
# Deploy only hosting
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore

# Deploy only storage rules
firebase deploy --only storage

# Deploy only functions
firebase deploy --only functions

# Deploy everything
firebase deploy
```

## Firebase Configuration

The app is configured with the following Firebase services:

### Hosting

Configured to serve the Next.js app with server-side functionality:

```json
"hosting": {
  "public": ".next/standalone",
  "ignore": [
    "firebase.json",
    "**/.*",
    "**/node_modules/**"
  ],
  "rewrites": [
    {
      "source": "**",
      "destination": "/server.js"
    }
  ]
}
```

### Firestore

Database configuration:

```json
"firestore": {
  "rules": "firestore.rules",
  "indexes": "firestore.indexes.json"
}
```

### Storage

File storage configuration:

```json
"storage": {
  "rules": "storage.rules",
  "bucket": "your-project-id.appspot.com"
}
```

### Functions

Cloud Functions configuration:

```json
"functions": {
  "source": "functions",
  "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
}
```

## Environment Variables

For full functionality, you need these environment variables:

```
# Firebase config
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# API keys for LLMs
CLAUDE_API_KEY=your_claude_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Custom Domain Setup (Optional)

To use a custom domain with Firebase Hosting:

1. Go to the Firebase console
2. Select your project
3. Go to Hosting in the left sidebar
4. Click "Add custom domain"
5. Follow the steps to verify domain ownership and set up DNS

## Troubleshooting

### Next.js Build Issues

If your Next.js build fails:

```bash
# Clean the Next.js cache
rm -rf .next
# Try building again
npm run build
```

### Deployment Issues

If deployment fails:

1. Check Firebase CLI is logged in: `firebase login`
2. Check your Firebase project: `firebase projects:list`
3. Ensure you have the correct permissions
4. Try deploying specific services one at a time

### Function Deployment Issues

If function deployment fails:

1. Check your `functions/package.json` for dependencies
2. Ensure Node.js version matches in `functions/package.json` (engines field)
3. Try deploying only functions: `firebase deploy --only functions`

## Automated Deployments

For CI/CD, consider setting up GitHub Actions for automated deployments:

1. Create a Firebase token: `firebase login:ci`
2. Add the token as a secret in your GitHub repository
3. Use the GitHub Action workflow for Firebase in `.github/workflows/`

## Monitoring Your Deployed App

After deployment:

1. View your app: `firebase hosting:channel:open`
2. Check deployment status: `firebase deploy:list`
3. View detailed logs in the Firebase console

## Rolling Back Deployments

If needed, roll back to previous version:

```bash
firebase hosting:clone live previous
```

This will restore the previous deployment.