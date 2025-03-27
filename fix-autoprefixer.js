#!/usr/bin/env node

/**
 * This script specifically fixes autoprefixer issues at the root level
 * by ensuring it's properly installed and accessible to webpack.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing autoprefixer module loading...');

// 1. Install autoprefixer and postcss globally and as direct dependencies
try {
  console.log('📦 Installing autoprefixer and postcss directly...');
  
  // First try to install with npm - using specific versions known to work
  execSync('npm install postcss@7.0.39 autoprefixer@9.8.8 tailwindcss@3.3.0 --no-save', { stdio: 'inherit' });
  
  // Then ensure they're in package.json
  execSync('npm install postcss@7.0.39 autoprefixer@9.8.8 tailwindcss@3.3.0 --save-exact', { stdio: 'inherit' });
  
  console.log('✅ Installed CSS dependencies directly');
} catch (error) {
  console.error('⚠️ Error installing packages:', error.message);
}

// 2. Verify the modules are installed properly
try {
  const nodeModulesDir = path.join(process.cwd(), 'node_modules');
  const autoprefixerDir = path.join(nodeModulesDir, 'autoprefixer');
  const postcssDir = path.join(nodeModulesDir, 'postcss');
  
  // Check if the modules exist
  if (!fs.existsSync(autoprefixerDir)) {
    console.warn('⚠️ Autoprefixer module not found in node_modules');
    console.log('🔄 Reinstalling autoprefixer manually...');
    execSync('npm install autoprefixer@9.8.8 --save-exact', { stdio: 'inherit' });
  } else {
    console.log('✅ Verified autoprefixer module exists');
  }
  
  if (!fs.existsSync(postcssDir)) {
    console.warn('⚠️ PostCSS module not found in node_modules');
    console.log('🔄 Reinstalling postcss manually...');
    execSync('npm install postcss@7.0.39 --save-exact', { stdio: 'inherit' });
  } else {
    console.log('✅ Verified postcss module exists');
  }

  // No longer creating fallback implementations - using the real modules instead
  console.log('✅ Using real PostCSS and Autoprefixer modules');
  
} catch (error) {
  console.error('⚠️ Error verifying modules:', error.message);
}

// 3. Create a simple postcss.config.js using string references
try {
  const configPath = path.join(process.cwd(), 'postcss.config.js');
  
  // Create a simple postcss.config.js using string references (not require())
  fs.writeFileSync(configPath, `
/**
 * Simple PostCSS configuration for Vercel build
 */

// Export a configuration with string references to plugins
module.exports = {
  plugins: [
    'tailwindcss',
    'autoprefixer'
  ]
};
`);
  
  console.log('✅ Created simplified postcss.config.js with string references');
} catch (error) {
  console.error('⚠️ Error creating postcss config:', error.message);
}

// 4. Verify CSS files
try {
  const globalsPath = path.join(process.cwd(), 'src', 'app', 'globals.css');
  if (fs.existsSync(globalsPath)) {
    // Create a backup if one doesn't exist
    if (!fs.existsSync(`${globalsPath}.bak`)) {
      fs.copyFileSync(globalsPath, `${globalsPath}.bak`);
      console.log('✅ Created backup of globals.css');
    }
    
    // Read the globals.css
    const cssContent = fs.readFileSync(globalsPath, 'utf8');
    
    // Check if it includes Tailwind directives
    if (cssContent.includes('@tailwind')) {
      console.log('✅ Verified globals.css contains Tailwind directives');
    } else {
      console.warn('⚠️ globals.css does not contain Tailwind directives');
    }
  } else {
    console.warn('⚠️ globals.css not found at expected path');
  }
} catch (error) {
  console.error('⚠️ Error verifying CSS files:', error.message);
}

console.log('🎉 Autoprefixer fixes completed!');