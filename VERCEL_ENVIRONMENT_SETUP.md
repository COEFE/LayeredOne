# Setting Up Environment Variables in Vercel

This guide will walk you through setting up all required environment variables in your Vercel deployment. Properly configured environment variables are critical for Firebase authentication, storage operations, and AI functionality.

## Required Environment Variables

### Client-Side Variables (Public)
These variables are accessible in the browser and use the `NEXT_PUBLIC_` prefix:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_VERCEL_DEPLOYMENT` = `true`
- `NEXT_PUBLIC_USE_REAL_FIREBASE` = `true`

### Server-Side Variables (Private)
These variables are only accessible in API routes and server-side code:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_PRIVATE_KEY_ID`
- `ANTHROPIC_API_KEY`
- `SIMPLE_PDF` = `true`

## Setting Up in Vercel Dashboard

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click on "Settings" tab
4. Navigate to "Environment Variables" section
5. Add each variable one by one:
   - Add Name (e.g. `NEXT_PUBLIC_FIREBASE_API_KEY`)
   - Add Value (e.g. your Firebase API key)
   - Select which environments to apply to (typically Production, Preview, and Development)
   - Click "Add"
6. Repeat for all required variables

## Special Handling for FIREBASE_PRIVATE_KEY

The `FIREBASE_PRIVATE_KEY` requires special formatting:

1. Copy the private key from your Firebase service account JSON file
2. Include the quotes and newline characters exactly as they appear
3. Format example: `"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQ...\n-----END PRIVATE KEY-----\n"`

**⚠️ Important:** In Vercel, you should NOT escape the newlines. Enter the key exactly as it appears in your service account JSON file, including the quotes and `\n` characters.

## Verifying Your Configuration

After setting up all environment variables in Vercel:

1. Click on "Deployments" in your Vercel dashboard
2. Trigger a new deployment by clicking "Redeploy" on your latest deployment
3. Check the deployment logs for any environment variable related errors
4. Once deployed, test your application to verify all functionality works

## Testing Your Environment Variables Locally

Before deploying to Vercel, you can test your environment variables locally:

```bash
# Install the testing script dependencies
npm install dotenv

# Run the Vercel environment test
node test-vercel-env.js
```

This will check if all required environment variables are set in your `.env.local` file.

## Adding the Anthropic API Key

If you haven't set up the Anthropic API key yet:

```bash
# Run the helper script to add your Anthropic API key
node add-anthropic-key.js
```

This script will prompt you for your Anthropic API key and add it to your `.env.local` file.

## Troubleshooting

If you encounter issues with your Vercel environment variables:

1. **Deployment Errors**: Check the "Build Logs" in your Vercel deployment for any missing or invalid environment variables
2. **Firebase Authentication Errors**: Verify that your `FIREBASE_PRIVATE_KEY` is properly formatted with quotes and newlines
3. **Claude AI Errors**: Make sure your `ANTHROPIC_API_KEY` is set and valid (starts with `sk-ant-`)
4. **Storage Upload Errors**: Confirm that your Firebase service account has the necessary permissions for Storage operations

For any other issues, refer to the error messages in your application logs or Vercel build logs for specific guidance.