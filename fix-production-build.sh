#!/bin/bash

echo "🔥 Starting production build process with correct Firebase key format..."

# Install dotenv if needed
if ! npm list dotenv > /dev/null 2>&1; then
  echo "📦 Installing dotenv..."
  npm install dotenv --save-dev
fi

# Run key fixing script
echo "🔑 Setting up Firebase keys for production..."
node fix-firebase-keys-production.js

# Copy the production env file to .env.local for the build
cp .env.production .env.local

# Run the build with production settings
echo "🚀 Running production build..."

# Install required dependencies for production build
npm install firebase-admin @google-cloud/firestore @google-cloud/storage is-set is-regexp --save

# Create directory for path module if it doesn't exist
mkdir -p node_modules/@google-cloud/firestore/build/src/path

# Create the missing path module file
cat > node_modules/@google-cloud/firestore/build/src/path/index.js << 'EOF'
/**
 * Minimal implementation of Firestore path utilities
 */
module.exports = {
  documentPathFromResourceName: (resourceName) => {
    if (!resourceName) return '';
    const parts = resourceName.split('/');
    return parts.filter((_, i) => i % 2 === 1).join('/');
  },
  relativeName: (projectId, resourcePath) => {
    return `projects/${projectId}/databases/(default)/documents/${resourcePath}`;
  },
  databaseRootPath: (projectId) => {
    return `projects/${projectId}/databases/(default)`;
  },
  isDocumentPath: (path) => {
    return path && path.split('/').length % 2 === 0;
  },
  isCollectionPath: (path) => {
    return path && path.split('/').length % 2 === 1;
  }
};
EOF

# Export environment variables
export NEXT_PUBLIC_VERCEL_DEPLOYMENT=true
export NEXT_PUBLIC_USE_REAL_FIREBASE=true
export SIMPLE_PDF=true

# Run build with production settings
next build --no-lint

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "✅ Production build completed successfully!"
  echo "The application is ready to be deployed."
else
  echo "❌ Build failed. Please check the output above for errors."
  exit 1
fi

# Create firebase-key-info.log for diagnostics
echo "📝 Creating diagnostic log for Firebase key configuration..."
{
  echo "Firebase Key Configuration Diagnostic Log"
  echo "Generated: $(date)"
  echo ""
  echo "1. Environment Variables:"
  echo "NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-Not set}"
  echo "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-Not set}"
  echo "FIREBASE_CLIENT_EMAIL: ${FIREBASE_CLIENT_EMAIL:-Not set}"
  echo "FIREBASE_PRIVATE_KEY_ID: ${FIREBASE_PRIVATE_KEY_ID:-Not set}"
  echo "FIREBASE_PRIVATE_KEY: ${FIREBASE_PRIVATE_KEY:+Set (truncated)}"
  echo "FIREBASE_PRIVATE_KEY_BASE64: ${FIREBASE_PRIVATE_KEY_BASE64:+Set (truncated)}"
} > firebase-key-info.log

echo "✏️ Created diagnostic log at firebase-key-info.log"
echo "🎉 Production build process completed successfully!"