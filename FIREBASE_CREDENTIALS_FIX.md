# Firebase Credentials Fix

This document outlines the solution for the "invalid_grant: account not found" error that occurs during file uploads when using Firebase Storage.

## Problem

The application was encountering an `invalid_grant: account not found` error when attempting to:
1. Upload files to Firebase Storage
2. Generate signed URLs for accessing files

This error typically occurs when:
- The service account credentials are invalid or outdated
- The private key format is incorrect
- The service account does not have proper permissions

## Root Cause

After investigation, we discovered several issues:

1. The helper files (`key-helpers.js` and `key-helpers-production.js`) were using hardcoded outdated private keys as fallbacks, rather than relying on environment variables
2. The private key format wasn't being handled correctly in some cases (escaped newlines vs. actual newlines)
3. The environment variables in Vercel were incomplete or incorrect

## Solution

We implemented the following fixes:

1. **Removed hardcoded keys**: Updated all helper files to remove hardcoded fallback keys and properly prioritize environment variables
2. **Enhanced error reporting**: Added better validation and error messages for missing or invalid credentials
3. **Improved key format handling**: Updated the key handling code to properly process different private key formats (with escaped newlines or literal newlines)
4. **Created credential verification tools**: Added a diagnostic script (`verify-firebase-credentials.js`) to test and validate Firebase credentials

## How to Fix in Your Environment

1. **Update environment variables in Vercel**:
   - Go to your Vercel project settings
   - Add all required environment variables as specified in `.env.example`
   - Ensure you include both `FIREBASE_CLIENT_EMAIL` and either `FIREBASE_PRIVATE_KEY` or `FIREBASE_PRIVATE_KEY_BASE64`

2. **Verify key format**:
   - If using `FIREBASE_PRIVATE_KEY`, ensure newlines are properly escaped (`\\n`)
   - If using `FIREBASE_PRIVATE_KEY_BASE64`, encode your key with Base64 for reliable storage

3. **Run verification script**:
   ```bash
   node verify-firebase-credentials.js
   ```

4. **Check the debug endpoint**:
   Access `/api/debug/firebase-credentials` to see detailed diagnostics about your Firebase credentials

## Format of Private Key

The Firebase private key needs to be in one of two formats:

1. **Escaped newlines** (for environment variables):
   ```
   -----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w...\\n-----END PRIVATE KEY-----
   ```

2. **Actual newlines** (for code or local development):
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvgIBADANBgkqhkiG9w...
   -----END PRIVATE KEY-----
   ```

## Recommended Best Practice

1. Use the base64-encoded version of the private key (`FIREBASE_PRIVATE_KEY_BASE64`) as it's the most reliable across different environments
2. Generate it with: `cat your-service-account.json | jq -r '.private_key' | base64`
3. Keep your service account keys secure and rotate them periodically
4. Verify the credentials are working using the provided verification script