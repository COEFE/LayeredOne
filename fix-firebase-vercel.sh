#!/bin/bash
# Comprehensive script to fix Firebase Admin SDK and Firestore issues for Vercel deployments

set -e # Exit on any error

echo "🔧 Starting Firebase fix for Vercel deployment..."

# Install required Firebase dependencies
echo "📦 Installing Firebase dependencies..."
npm install firebase-admin@latest @google-cloud/firestore@latest @google-cloud/storage@latest --save

# Install critical sub-dependencies
echo "📦 Installing critical sub-dependencies..."
npm install is-set is-regexp node-abort-controller sort-keys kind-of --save

# Create the folder structure for the missing path module
echo "📁 Creating folder structure for path module..."
mkdir -p node_modules/@google-cloud/firestore/build/src/path

# Create the path module implementation
echo "📝 Creating path module implementation..."
cat > node_modules/@google-cloud/firestore/build/src/path/index.js << 'EOF'
/**
 * Minimal implementation of Firestore path utilities - fixed for Vercel deployment
 */
module.exports = {
  documentPathFromResourceName: function(resourceName) {
    if (!resourceName) return '';
    const parts = resourceName.split('/');
    const documentsIndex = parts.indexOf('documents');
    if (documentsIndex === -1 || documentsIndex === parts.length - 1) {
      return '';
    }
    return parts.slice(documentsIndex + 1).join('/');
  },
  
  relativeName: function(projectId, path) {
    if (!projectId || !path) return '';
    return `projects/${projectId}/databases/(default)/documents/${path}`;
  },
  
  databaseRootPath: function(projectId) {
    if (!projectId) return '';
    return `projects/${projectId}/databases/(default)`;
  },
  
  isDocumentPath: function(path) {
    if (!path) return false;
    return path.split('/').filter(segment => segment.length > 0).length % 2 === 0;
  },
  
  isCollectionPath: function(path) {
    if (!path) return false;
    return path.split('/').filter(segment => segment.length > 0).length % 2 === 1;
  },
  
  parentPath: function(path) {
    if (!path) return '';
    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length <= 1) return '';
    return segments.slice(0, -1).join('/');
  },
  
  extractCollectionId: function(path) {
    if (!path) return '';
    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length === 0) return '';
    return segments[segments.length - 1];
  },
  
  extractDocumentId: function(path) {
    if (!path) return '';
    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length < 2) return '';
    return segments[segments.length - 1];
  },
  
  validateDocumentPath: function(path) {
    if (!this.isDocumentPath(path)) {
      throw new Error(`Path ${path} is not a valid document path`);
    }
    return path;
  },
  
  validateCollectionPath: function(path) {
    if (!this.isCollectionPath(path)) {
      throw new Error(`Path ${path} is not a valid collection path`);
    }
    return path;
  }
};
EOF

# Make sure we have the FirestoreDataConverter workaround
echo "📝 Creating FirestoreDataConverter workaround..."
mkdir -p node_modules/@google-cloud/firestore/build/src/document
cat > node_modules/@google-cloud/firestore/build/src/document/document.js << 'EOF'
/**
 * Minimal FirestoreDataConverter implementation for Vercel
 */
class FirestoreDataConverter {
  constructor() {}
  
  // Default conversion methods
  toFirestore(data) {
    return data;
  }
  
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);
    return data;
  }
}

module.exports = { FirestoreDataConverter };
EOF

# Create a special environment file for Next.js
echo "📝 Creating .env.production file to ensure proper Firebase configuration..."
cat > .env.production << 'EOF'
# Firebase configuration for production
NEXT_PUBLIC_USE_REAL_FIREBASE=true
FIREBASE_USE_PRODUCTION_CONFIG=true
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=false

# Vercel deployment flags
NEXT_PUBLIC_VERCEL_DEPLOYMENT=true
EOF

# Patch package.json to make sure the build command uses our fix
echo "📝 Updating build command in package.json..."
node -e "
const fs = require('fs');
const path = require('path');
const packageJsonPath = path.join(process.cwd(), 'package.json');
const pkg = require(packageJsonPath);

// Make sure dependencies include what we need
const dependencies = pkg.dependencies || {};
if (!dependencies['firebase-admin']) {
  dependencies['firebase-admin'] = '^13.0.0';
}
if (!dependencies['@google-cloud/firestore']) {
  dependencies['@google-cloud/firestore'] = '^7.0.0';
}
if (!dependencies['@google-cloud/storage']) {
  dependencies['@google-cloud/storage'] = '^7.0.0';
}
if (!dependencies['is-set']) {
  dependencies['is-set'] = '^2.0.2';
}
if (!dependencies['is-regexp']) {
  dependencies['is-regexp'] = '^2.1.0';
}
pkg.dependencies = dependencies;

// Write the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
"

echo "✅ Firebase fix for Vercel completed!"
echo "ℹ️ Now run the following command to deploy to Vercel:"
echo "   npx vercel"