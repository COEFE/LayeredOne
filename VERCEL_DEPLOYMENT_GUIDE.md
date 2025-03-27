# Vercel Deployment Troubleshooting Guide

## Setup and Deployment Options

There are several ways to deploy your project to Vercel:

### Option 1: Manual Deployment with Deploy Hooks

1. **Create a deploy hook:**
   - Go to your Vercel project dashboard
   - Navigate to Settings > Git Integration > Deploy Hooks
   - Create a hook named "Manual Deploy" for the main branch
   - Copy the URL provided

2. **Use curl directly to trigger a deployment:**
   ```bash
   curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_hvQYhKFscMGrBPfZVrX4EXTW5YQH/tufz0akd3u"
   ```

3. **Check deployment status:**
   - Go to Vercel dashboard > Your project > Deployments
   - Look for your latest deployment and check its status
   - If it failed, click on it to view build logs

### Option 2: GitHub Integration (Automatic Deployments)

1. **Verify repository connection:**
   - Go to your Vercel project settings > Git
   - Make sure your GitHub repository is properly connected
   - Check that production branch is set to "main"

2. **Check GitHub deploy settings:**
   - Go to your GitHub repository
   - Navigate to Settings > Webhooks
   - Verify that the Vercel webhook is present and active

3. **Monitor deployment status:**
   - After pushing to GitHub, check Vercel deployments
   - If deployments aren't being triggered, reconnect the repository

### Option 3: Direct Vercel CLI Deployment

1. **Install and configure Vercel CLI:**
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Deploy from your local machine:**
   ```bash
   cd /path/to/LayeredOne
   vercel --prod
   ```

## Environment Variables (CRITICAL)

Your deployment **will not work** without setting these environment variables in Vercel:

### Firebase Client Variables:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase Admin Variables:
- `FIREBASE_PRIVATE_KEY` - Copy from your service account JSON file, including quotes and `\n` characters

### API Keys:
- `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` - For Claude AI integration

### Deployment Variables:
- `NEXT_PUBLIC_VERCEL_DEPLOYMENT`: `true`
- `SIMPLE_PDF`: `true`

## Common Issues and Solutions

### Build is failing with dependency errors

This is likely related to PDF libraries or React icons. The `vercel-deploy.js` script should remove these problematic dependencies during build, but if you're still experiencing issues:

1. Check your Vercel build logs for specific error messages
2. Make sure your `buildCommand` in Vercel is set to: `node scripts/vercel-deploy.js && SIMPLE_PDF=true npm run build`
3. If issues persist, consider temporarily removing the dependencies from your package.json manually before deploying

### "Failed to compile" errors with PDF-related modules

The application is designed to use a minimal PDF viewer on Vercel that doesn't rely on problematic dependencies. Make sure:

1. `NEXT_PUBLIC_VERCEL_DEPLOYMENT` is set to `true` in your Vercel environment variables
2. `SIMPLE_PDF` is set to `true` in your Vercel environment variables

### Authentication issues after deployment

If Firebase authentication fails on your Vercel deployment:

1. Make sure your Firebase project has the Vercel domain added to authorized domains
2. Check that your Firebase environment variables are correctly set up
3. Verify that `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` matches your actual Firebase auth domain

## Getting Firebase Credentials

### Firebase Web Credentials
Find these in Firebase Console > Project Settings > General > Your Apps > Web app

### Firebase Admin Private Key
1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Download the JSON file and copy the `private_key` value (with quotes and `\n`)

## Last Resort Options

If all else fails:

1. **Create a new Vercel project**:
   - Go to Vercel dashboard > New Project
   - Import from the same GitHub repository
   - Configure all environment variables
   - Deploy

2. **Simplify your application**:
   - Create a branch without problematic dependencies
   - Deploy that branch as a proof of concept
   - Gradually add features back one by one