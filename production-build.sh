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
  export $(grep -v '^#' .env.production | xargs)
fi

# Export environment variables for build
export NEXT_PUBLIC_VERCEL_DEPLOYMENT=true
export NEXT_PUBLIC_USE_REAL_FIREBASE=true
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-variance-test-4b441}
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-variance-test-4b441.firebasestorage.app}
export SIMPLE_PDF=true

echo "🏗️ Running production build..."
next build --no-lint

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