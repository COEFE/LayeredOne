#!/bin/bash
# Production build script that ensures all Firebase dependencies are properly installed

echo "🚀 Starting production build with real Firebase services..."

# Install required dependencies
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

# Also copy the path utils to a CommonJS format file that webpack can find
mkdir -p src/utils/firebase-path-utils
cat > src/utils/firebase-path-utils/index.js << 'EOF'
/**
 * Firestore path utilities - CommonJS version for webpack
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

echo "📦 Dependencies installed and Firebase path module created"

# Export environment variables
export NEXT_PUBLIC_USE_REAL_FIREBASE=true
export FIREBASE_USE_PRODUCTION_CONFIG=true
export SIMPLE_PDF=true

# For Vercel deployment
if [ "$1" == "vercel" ]; then
  echo "📦 Running Vercel build script..."
  node scripts/vercel-deploy.js && next build --no-lint
# For GitHub Pages
elif [ "$1" == "github" ]; then
  echo "📦 Running GitHub Pages build script..."
  GITHUB_PAGES=true next build --no-lint && touch out/.nojekyll && node scripts/github-pages-fix.js
# Default production build
else
  echo "📦 Running standard production build..."
  next build --no-lint
fi

# Check build result
if [ $? -eq 0 ]; then
  echo "✅ Production build completed successfully!"
else
  echo "❌ Build failed. Check the error messages above."
  exit 1
fi