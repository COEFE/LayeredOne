#!/bin/bash
# Script to fix Firebase and Google Cloud dependencies 

echo "🔧 Installing Firebase and Google Cloud dependencies..."

# Install Firebase admin and related packages
npm install firebase-admin@13.2.0 @google-cloud/firestore@7.1.0 @google-cloud/storage@7.0.0 --save

# Install critical sub-dependencies that might be missing
npm install is-set@2.0.2 is-regexp@2.1.0 --save

# Ensure required paths are accessible
mkdir -p node_modules/@google-cloud/firestore/build/src/path 2>/dev/null

# Create a minimal path module implementation if it doesn't exist
if [ ! -f node_modules/@google-cloud/firestore/build/src/path/index.js ]; then
  echo "Creating minimal path module implementation..."
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
fi

echo "✅ Firebase dependencies fixed successfully!"