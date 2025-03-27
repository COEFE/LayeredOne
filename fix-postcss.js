#!/usr/bin/env node

/**
 * This script specifically fixes PostCSS and Autoprefixer related issues
 * by ensuring all modules are properly installed and configured.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing PostCSS and Autoprefixer issues...');

// Force install the CSS processing dependencies
try {
  console.log('📦 Installing PostCSS and Autoprefixer globally and locally...');
  
  // Install directly to node_modules
  execSync('npm install postcss autoprefixer tailwindcss --no-save', { stdio: 'inherit' });
  
  // Also install them as regular dependencies
  execSync('npm install postcss autoprefixer tailwindcss --save', { stdio: 'inherit' });
  
  console.log('✅ Installed CSS processing dependencies');
} catch (error) {
  console.error('⚠️ Error installing packages:', error.message);
}

// Ensure PostCSS config exists and is properly set up
const postcssConfigPath = path.join(process.cwd(), 'postcss.config.js');
if (!fs.existsSync(postcssConfigPath)) {
  console.log('Creating postcss.config.js...');
  fs.writeFileSync(postcssConfigPath, `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`);
  console.log('✅ Created postcss.config.js');
} else {
  console.log('✅ postcss.config.js already exists');
}

// Create a minimal postcss.config.mjs as well (Next.js sometimes uses this)
const postcssConfigMjsPath = path.join(process.cwd(), 'postcss.config.mjs');
if (!fs.existsSync(postcssConfigMjsPath)) {
  console.log('Creating postcss.config.mjs...');
  fs.writeFileSync(postcssConfigMjsPath, `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`);
  console.log('✅ Created postcss.config.mjs');
}

// Create a direct symlink to autoprefixer in the node_modules
try {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  const autoprefixerPath = path.join(nodeModulesPath, 'autoprefixer');
  
  if (!fs.existsSync(autoprefixerPath)) {
    console.log('Creating symlink to global autoprefixer...');
    try {
      // Try to find autoprefixer in parent directories
      let found = false;
      let currentDir = path.resolve(process.cwd(), '..');
      
      for (let i = 0; i < 3; i++) { // Look up to 3 levels up
        const parentAutoprefixerPath = path.join(currentDir, 'node_modules', 'autoprefixer');
        if (fs.existsSync(parentAutoprefixerPath)) {
          if (!fs.existsSync(nodeModulesPath)) {
            fs.mkdirSync(nodeModulesPath, { recursive: true });
          }
          fs.symlinkSync(parentAutoprefixerPath, autoprefixerPath, 'junction');
          console.log(`✅ Created symlink to autoprefixer found at ${parentAutoprefixerPath}`);
          found = true;
          break;
        }
        currentDir = path.resolve(currentDir, '..');
      }
      
      if (!found) {
        console.log('⚠️ Could not find autoprefixer in parent directories');
      }
    } catch (error) {
      console.error('⚠️ Error creating symlink:', error.message);
    }
  }
} catch (error) {
  console.error('⚠️ Error with node_modules operations:', error.message);
}

// Add a direct path to autoprefixer in the CSS configuration
try {
  const nextConfigPath = path.join(process.cwd(), 'next.config.js');
  if (fs.existsSync(nextConfigPath)) {
    let nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
    
    // Check if we need to add the CSS configuration for autoprefixer
    if (!nextConfig.includes('cssLoaderOptions')) {
      console.log('Adding explicit paths to CSS configuration in next.config.js...');
      
      // Simple string replacement to add the configuration
      // This is a bit brittle but should work for most simple next.config.js files
      nextConfig = nextConfig.replace(
        'const nextConfig = {',
        `const nextConfig = {
  // Add explicit paths for CSS modules
  webpack: (config) => {
    const autoprefixerPath = require.resolve('autoprefixer');
    const postcssPath = require.resolve('postcss');
    const tailwindPath = require.resolve('tailwindcss');
    
    // Make sure these modules are available
    config.resolve.alias = {
      ...config.resolve.alias,
      'autoprefixer': autoprefixerPath,
      'postcss': postcssPath,
      'tailwindcss': tailwindPath,
    };
    
    return config;
  },`
      );
      
      fs.writeFileSync(nextConfigPath, nextConfig);
      console.log('✅ Updated next.config.js with explicit CSS module paths');
    }
  }
} catch (error) {
  console.error('⚠️ Error modifying next.config.js:', error.message);
}

console.log('🎉 PostCSS and Autoprefixer fixes completed!');