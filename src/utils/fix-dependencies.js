const fs = require('fs');
const path = require('path');

// Read package.json and package-lock.json
const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const packageLockPath = path.resolve(process.cwd(), 'package-lock.json');

const packageJson = require(packageJsonPath);
const packageLock = require(packageLockPath);

// Update dependencies to match package-lock.json
const missingDeps = {};
const invalidDeps = {};

// Helper function to get version from package-lock
function getVersionFromLock(name) {
  if (packageLock.packages && packageLock.packages[`node_modules/${name}`]) {
    return packageLock.packages[`node_modules/${name}`].version;
  }
  return null;
}

// Check dependencies and devDependencies
function checkDependencies(deps, type) {
  if (!deps) return;
  
  Object.keys(deps).forEach(depName => {
    const requestedVersion = deps[depName].replace(/^\^|~/, '');
    const lockVersion = getVersionFromLock(depName);
    
    if (!lockVersion) {
      console.log(`${type} missing in lock: ${depName}@${deps[depName]}`);
      // Add to missing
      missingDeps[depName] = deps[depName];
    } else if (lockVersion !== requestedVersion) {
      console.log(`${type} version mismatch: ${depName}@${deps[depName]} (lock has ${lockVersion})`);
      // Store for later fixing
      invalidDeps[depName] = lockVersion;
    }
  });
}

// Check if packages in lock file are missing from package.json
function checkForMissingFromPackageJson() {
  if (!packageLock.packages) return;
  
  Object.keys(packageLock.packages).forEach(pkgPath => {
    if (pkgPath.startsWith('node_modules/')) {
      const pkgName = pkgPath.replace('node_modules/', '');
      // Skip nested dependencies
      if (!pkgName.includes('/')) {
        const inDeps = packageJson.dependencies && packageJson.dependencies[pkgName];
        const inDevDeps = packageJson.devDependencies && packageJson.devDependencies[pkgName];
        
        if (!inDeps && !inDevDeps) {
          console.log(`Missing from package.json: ${pkgName}@${packageLock.packages[pkgPath].version}`);
        }
      }
    }
  });
}

// Update package.json with exact versions from package-lock.json
function updatePackageJson() {
  let updated = false;
  
  // Update invalid versions
  Object.keys(invalidDeps).forEach(depName => {
    if (packageJson.dependencies && packageJson.dependencies[depName]) {
      packageJson.dependencies[depName] = invalidDeps[depName];
      updated = true;
    }
    if (packageJson.devDependencies && packageJson.devDependencies[depName]) {
      packageJson.devDependencies[depName] = invalidDeps[depName];
      updated = true;
    }
  });
  
  // Add missing dependencies (not implemented as we don't know if they should be deps or devDeps)
  
  if (updated) {
    // Write updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('Updated package.json with versions from package-lock.json');
  } else {
    console.log('No updates needed for package.json');
  }
}

// Run the checks
console.log('Checking dependencies...');
checkDependencies(packageJson.dependencies, 'Dependency');
checkDependencies(packageJson.devDependencies, 'DevDependency');
checkForMissingFromPackageJson();

// Update package.json
console.log('\nUpdating package.json...');
updatePackageJson();

console.log('\nDone. You may need to run "npm install" to update package-lock.json.');