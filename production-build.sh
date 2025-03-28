#!/bin/bash

echo "🚀 Starting production build with enhanced Firebase key handling..."

# Install required dependencies
echo "📦 Installing required dependencies..."
npm install firebase-admin @google-cloud/firestore @google-cloud/storage dotenv --save

# Create and format the private key
echo "🔑 Setting up Firebase keys for production..."
node fix-firebase-keys-production.js

# Update Firebase configuration to use the production version
echo "⚙️ Updating Firebase configuration for production..."
node update-firebase-config.js

# Ensure the keys are properly set in the environment
if [ -f .env.production ]; then
  echo "📝 Loading production environment variables..."
  # Load variables without trying to export multi-line values directly
  export NEXT_PUBLIC_FIREBASE_API_KEY=$(grep NEXT_PUBLIC_FIREBASE_API_KEY .env.production | cut -d '=' -f2)
  export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$(grep NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN .env.production | cut -d '=' -f2)
  export NEXT_PUBLIC_FIREBASE_PROJECT_ID=$(grep NEXT_PUBLIC_FIREBASE_PROJECT_ID .env.production | cut -d '=' -f2)
  export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$(grep NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET .env.production | cut -d '=' -f2)
  export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$(grep NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID .env.production | cut -d '=' -f2)
  export NEXT_PUBLIC_FIREBASE_APP_ID=$(grep NEXT_PUBLIC_FIREBASE_APP_ID .env.production | cut -d '=' -f2)
  export FIREBASE_CLIENT_EMAIL=$(grep FIREBASE_CLIENT_EMAIL .env.production | cut -d '=' -f2)
  export FIREBASE_PRIVATE_KEY_ID=$(grep FIREBASE_PRIVATE_KEY_ID .env.production | cut -d '=' -f2)
  
  # Use the Base64 version which is most reliable
  export FIREBASE_PRIVATE_KEY_BASE64=$(grep FIREBASE_PRIVATE_KEY_BASE64 .env.production | cut -d '=' -f2)
fi

# Export environment variables for build
export NEXT_PUBLIC_VERCEL_DEPLOYMENT=true
export NEXT_PUBLIC_USE_REAL_FIREBASE=true
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-variance-test-4b441}
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-variance-test-4b441.firebasestorage.app}
export SIMPLE_PDF=true

echo "🏗️ Running production build..."
npx next build --no-lint

# Check build result
if [ $? -eq 0 ]; then
  echo "✅ Production build completed successfully!"
else
  echo "❌ Build failed. Please check the error messages above."
  exit 1
fi

# If successful, restore the original Firebase configuration
if [ -f src/firebase/admin-config.ts.bak ] && [ -f src/firebase/key-helpers.js.bak ]; then
  echo "🔄 Restoring original Firebase configuration..."
  mv src/firebase/admin-config.ts.bak src/firebase/admin-config.ts
  mv src/firebase/key-helpers.js.bak src/firebase/key-helpers.js
fi

echo "🎉 Production build process completed successfully!"