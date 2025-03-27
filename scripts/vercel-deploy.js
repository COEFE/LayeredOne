// This script modifies package.json for Vercel deployment
// to remove problematic dependencies like PDF libraries and UI components that cause issues
const fs = require('fs');
const path = require('path');

console.log('🔧 Running Vercel deployment preparation script');

// Path to package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');

// Read the current package.json
const packageJson = require(packageJsonPath);

// Create a temporary copy of package.json for backup
fs.writeFileSync(
  path.join(process.cwd(), 'package.json.bak'),
  JSON.stringify(packageJson, null, 2)
);

console.log('📦 Original package.json saved as package.json.bak');

// Remove problematic dependencies that cause issues with Vercel deployment
const problematicDeps = [
  'react-pdf',
  'pdfjs-dist', 
  '@react-pdf/renderer',
  'react-icons', // Added react-icons to the list of problematic dependencies
  // Do not remove Firebase admin packages anymore - we want to use the real implementation
  // '@google-cloud/firestore',
  // '@google-cloud/storage',
  // 'firebase-admin'
];

// Filter out the problematic dependencies
const filteredDeps = { ...packageJson.dependencies };
let removedCount = 0;

problematicDeps.forEach(dep => {
  if (filteredDeps[dep]) {
    delete filteredDeps[dep];
    removedCount++;
    console.log(`🗑️  Removed dependency: ${dep}`);
  }
});

// Update package.json with filtered dependencies
packageJson.dependencies = filteredDeps;

// We no longer need to add Firebase packages to peerDependencies as false
// since we want to use the real implementations
if (!packageJson.peerDependencies) {
  packageJson.peerDependencies = {};
}

// Make sure that firebase-admin and related packages are properly available
delete packageJson.peerDependencies['firebase-admin'];
delete packageJson.peerDependencies['@google-cloud/firestore'];
delete packageJson.peerDependencies['@google-cloud/storage'];

// Ensure firebase-admin is in dependencies if it was removed
if (!packageJson.dependencies['firebase-admin']) {
  packageJson.dependencies['firebase-admin'] = "^13.2.0";
  console.log(`➕ Added dependency: firebase-admin`);
}

// Write the updated package.json
fs.writeFileSync(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2)
);

console.log(`✅ Successfully updated package.json, removed ${removedCount} problematic dependencies`);
console.log(`✅ Updated dependencies for deployment`);
console.log(`Deployment will now continue with modified dependencies...`);

// Skip creating mock modules - we now want to rely on the actual Firebase Admin SDK
console.log(`✅ Using real Firebase Admin SDK for deployment`);

// Add an environment variable marker file to signal we're using real implementation
fs.writeFileSync(
  path.join(process.cwd(), '.env.local'),
  `# Added by vercel-deploy.js
# This file marks that we want to use the real Firebase Admin SDK
NEXT_PUBLIC_USE_REAL_FIREBASE=true
`
);

console.log(`✅ Done preparing for deployment with real Firebase services`);

// Add the packages to devDependencies to ensure they're installed but not bundled
if (!packageJson.devDependencies) {
  packageJson.devDependencies = {};
}

// Ensure Firebase packages are properly installed
if (!packageJson.devDependencies['firebase-admin']) {
  packageJson.devDependencies['firebase-admin'] = "^13.2.0";
}
if (!packageJson.devDependencies['@google-cloud/firestore']) {
  packageJson.devDependencies['@google-cloud/firestore'] = "^7.5.0";
}
if (!packageJson.devDependencies['@google-cloud/storage']) {
  packageJson.devDependencies['@google-cloud/storage'] = "^7.7.0";
}

// Write the updated package.json with devDependencies
fs.writeFileSync(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2)
);

console.log(`✅ Added Firebase packages to devDependencies to ensure they're available for server-side code`);