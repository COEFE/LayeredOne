const fs = require('fs');
const path = require('path');

// Path to package.json
const packageJsonPath = path.resolve(process.cwd(), 'package.json');

// Read current package.json
const packageJson = require(packageJsonPath);

// The problem is that PostCSS 7 is too old for the newer dependencies
// Let's downgrade the dependencies to versions compatible with PostCSS 7

// PostCSS 7 compatible versions
const versionFixes = {
  "is-regexp": "2.1.0", 
  "react-icons": "5.5.0",
  "tailwindcss": "3.3.0",
  // PostCSS 7 compatible versions
  "lilconfig": "1.0.6",          // older version compatible with PostCSS 7
  "postcss-import": "12.0.1",    // compatible with PostCSS 7
  "postcss-load-config": "2.1.2", // compatible with PostCSS 7
  "postcss-nested": "4.2.3",     // compatible with PostCSS 7
  "quick-lru": "5.1.1",
  "yaml": "1.10.2"
};

// Update dependencies
function updateDependencies(deps, fixes) {
  if (!deps) return;
  
  for (const [name, version] of Object.entries(fixes)) {
    if (deps[name]) {
      console.log(`Fixing ${name} to version ${version}`);
      deps[name] = version;
    } else if (!packageJson.dependencies[name] && !packageJson.devDependencies[name]) {
      // If the package isn't in either dependencies or devDependencies, add it to devDependencies
      console.log(`Adding missing ${name} with version ${version} to devDependencies`);
      if (!packageJson.devDependencies) {
        packageJson.devDependencies = {};
      }
      packageJson.devDependencies[name] = version;
    }
  }
}

// Update both dependencies and devDependencies
updateDependencies(packageJson.dependencies, versionFixes);
updateDependencies(packageJson.devDependencies, versionFixes);

// Add the missing dependencies specifically mentioned in the error with adjusted versions
const missingDeps = {
  "quick-lru": "5.1.1",
  "yaml": "1.10.2",
  "lilconfig": "1.0.6",          // older version compatible with PostCSS 7
  "postcss-import": "12.0.1",    // compatible with PostCSS 7
  "postcss-load-config": "2.1.2", // compatible with PostCSS 7
  "postcss-nested": "4.2.3"      // compatible with PostCSS 7
};

// Add missing dependencies to devDependencies
for (const [name, version] of Object.entries(missingDeps)) {
  if (!packageJson.dependencies[name] && !packageJson.devDependencies[name]) {
    console.log(`Adding missing ${name} with version ${version} to devDependencies`);
    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {};
    }
    packageJson.devDependencies[name] = version;
  }
}

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('package.json updated successfully');
console.log('Please run "rm -f package-lock.json && npm install --legacy-peer-deps" to regenerate the lock file');