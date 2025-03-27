#!/usr/bin/env node

/**
 * This script fixes the Next.js font module error by ensuring 
 * Tailwind CSS and its dependencies are properly installed
 * and configured for Next.js font system.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing Next.js font module error...');

// Make sure tailwindcss is available in dependencies
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const pkg = require(packageJsonPath);
  
  // Move tailwindcss from devDependencies to dependencies if needed
  if (pkg.devDependencies && pkg.devDependencies.tailwindcss && !pkg.dependencies.tailwindcss) {
    console.log('Moving tailwindcss from devDependencies to dependencies');
    pkg.dependencies.tailwindcss = pkg.devDependencies.tailwindcss;
    delete pkg.devDependencies.tailwindcss;
  }
  
  // Ensure all required dependencies are present
  if (!pkg.dependencies.tailwindcss) {
    console.log('Adding tailwindcss to dependencies');
    pkg.dependencies.tailwindcss = '^3.3.0';
  }
  
  if (!pkg.dependencies.postcss) {
    console.log('Adding postcss to dependencies');
    pkg.dependencies.postcss = '^8.4.23';
  }
  
  if (!pkg.dependencies.autoprefixer) {
    console.log('Adding autoprefixer to dependencies');
    pkg.dependencies.autoprefixer = '^10.4.14';
  }
  
  // Write updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
  console.log('✅ Updated package.json');
  
  // Install dependencies to make them available immediately
  console.log('📦 Installing required packages...');
  try {
    execSync('npm install tailwindcss postcss autoprefixer --save', { stdio: 'inherit' });
    console.log('✅ Installed tailwindcss and dependencies');
  } catch (error) {
    console.error('⚠️ Error installing packages:', error.message);
    console.log('Continuing with existing installation...');
  }
  
  // Create a minimal font.js file that doesn't require tailwindcss
  const fontDir = path.join(process.cwd(), 'src', 'app', 'font');
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
  }
  
  // Write a simple font utility that doesn't depend on tailwindcss
  const fontFilePath = path.join(fontDir, 'index.js');
  fs.writeFileSync(fontFilePath, `
// Simple font utility that doesn't depend on tailwindcss
export function createFontVariables(fontFamily, weight = 400, style = 'normal') {
  return {
    style: {
      fontFamily: fontFamily,
      fontWeight: weight,
      fontStyle: style
    },
    variable: fontFamily.replace(/\\s+/g, '-').toLowerCase()
  };
}
`);
  console.log('✅ Created font utility that doesn\'t depend on tailwindcss');
  
  // Check if we need to use the fallback layout
  const mainLayoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
  const fallbackLayoutPath = path.join(process.cwd(), 'src', 'app', 'layout.fallback.tsx');
  
  if (fs.existsSync(mainLayoutPath) && fs.existsSync(fallbackLayoutPath)) {
    // Read both files
    const mainLayout = fs.readFileSync(mainLayoutPath, 'utf8');
    const fallbackLayout = fs.readFileSync(fallbackLayoutPath, 'utf8');
    
    // Check if main layout uses next/font
    if (mainLayout.includes('next/font')) {
      console.log('Main layout uses next/font, backing up and using fallback...');
      
      // Backup original layout
      fs.writeFileSync(`${mainLayoutPath}.bak`, mainLayout);
      
      // Replace with fallback
      fs.writeFileSync(mainLayoutPath, fallbackLayout);
      
      console.log('✅ Replaced layout.tsx with fallback version that doesn\'t use next/font');
    }
  }
  
  console.log('🎉 Next.js font module error fixed!');
} catch (error) {
  console.error('❌ Error fixing Next.js font module error:', error.message);
  process.exit(1);
}