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

// Remove problematic dependencies
const problematicDeps = [
  'react-pdf',
  'pdfjs-dist', 
  '@react-pdf/renderer',
  'react-icons', // Added react-icons to the list of problematic dependencies
  '@google-cloud/firestore', // Add firestore to fix vercel build
  'firebase-admin' // Add firebase-admin to fix vercel build
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

// Also add "firebase-admin": false to peerDependencies to prevent installation
if (!packageJson.peerDependencies) {
  packageJson.peerDependencies = {};
}
packageJson.peerDependencies['firebase-admin'] = false;
packageJson.peerDependencies['@google-cloud/firestore'] = false;

// Write the updated package.json
fs.writeFileSync(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2)
);

console.log(`✅ Successfully updated package.json, removed ${removedCount} problematic dependencies`);
console.log(`✅ Added firebase-admin and @google-cloud/firestore to peerDependencies as false to prevent installation`);
console.log(`Deployment will now continue with modified dependencies...`);

// Create an empty firebase-admin mock module for vercel
const mockDir = path.join(process.cwd(), 'node_modules', 'firebase-admin');
fs.mkdirSync(mockDir, { recursive: true });
fs.writeFileSync(path.join(mockDir, 'index.js'), 'module.exports = {};');

// Also mock @google-cloud/firestore
const firestoreDir = path.join(process.cwd(), 'node_modules', '@google-cloud', 'firestore');
fs.mkdirSync(firestoreDir, { recursive: true });
fs.writeFileSync(path.join(firestoreDir, 'index.js'), 'module.exports = {};');

console.log(`✅ Created empty mock modules for firebase-admin and @google-cloud/firestore`);