const fs = require('fs');

// Remove package-lock.json first
try {
  fs.unlinkSync('package-lock.json');
  console.log('Removed package-lock.json');
} catch (err) {
  console.log('package-lock.json not found, continuing...');
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Fix exact versions for the problematic packages
packageJson.dependencies = packageJson.dependencies || {};
packageJson.devDependencies = packageJson.devDependencies || {};

// These are the versions that the CI is complaining about
const exactVersions = {
  // The error mentioned missing or incompatible packages
  "is-regexp": "2.1.0",
  "react-icons": "5.5.0",
  "tailwindcss": "3.3.0",
  "lilconfig": "2.0.4", // Old enough to be compatible with PostCSS 7
  "postcss-import": "12.0.1", // PostCSS 7 compatible
  "postcss-load-config": "2.1.2", // PostCSS 7 compatible
  "postcss-nested": "4.2.3", // PostCSS 7 compatible
  "quick-lru": "5.1.1",
  "yaml": "1.10.2"
};

// Update/add the dependencies
Object.entries(exactVersions).forEach(([pkg, version]) => {
  if (packageJson.dependencies[pkg]) {
    packageJson.dependencies[pkg] = version;
    console.log(`Updated dependencies.${pkg} to ${version}`);
  } else if (packageJson.devDependencies[pkg]) {
    packageJson.devDependencies[pkg] = version;
    console.log(`Updated devDependencies.${pkg} to ${version}`);
  } else {
    packageJson.devDependencies[pkg] = version;
    console.log(`Added ${pkg}@${version} to devDependencies`);
  }
});

// Write the updated package.json back
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
console.log('Updated package.json successfully');
console.log('Now run: npm install --legacy-peer-deps');