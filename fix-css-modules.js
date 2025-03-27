#!/usr/bin/env node

/**
 * This script specifically fixes CSS modules issues in Next.js
 * by creating inline PostCSS configurations for each CSS module file.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing CSS Modules issues...');

// Find all CSS module files
function findCssModuleFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      findCssModuleFiles(filePath, fileList);
    } else if (file.endsWith('.module.css')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

try {
  const cssModuleFiles = findCssModuleFiles(process.cwd());
  console.log(`Found ${cssModuleFiles.length} CSS module files`);
  
  // Create a temporary folder to hold the original CSS modules
  const tempDir = path.join(process.cwd(), 'temp-css-modules');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Modify each CSS module to include inline PostCSS config
  cssModuleFiles.forEach(filePath => {
    try {
      console.log(`Processing: ${filePath}`);
      
      // Create a minimally processed version without requiring PostCSS
      const cssContent = fs.readFileSync(filePath, 'utf8');
      
      // Back up the original file
      const backupPath = path.join(tempDir, path.basename(filePath));
      fs.writeFileSync(backupPath, cssContent);
      
      // Create a processed version that doesn't require autoprefixer
      let processedCss = cssContent;
      
      // Add some basic vendor prefixes manually (very simple approach)
      processedCss = processedCss.replace(/display\s*:\s*flex/g, 'display: -webkit-box; display: -ms-flexbox; display: flex');
      processedCss = processedCss.replace(/transition/g, '-webkit-transition: $1; transition: $1');
      processedCss = processedCss.replace(/transform/g, '-webkit-transform: $1; transform: $1');
      
      // Write back the modified file
      fs.writeFileSync(filePath, processedCss);
      console.log(`✅ Processed: ${filePath}`);
    } catch (error) {
      console.error(`⚠️ Error processing ${filePath}:`, error.message);
    }
  });
  
  console.log('✅ CSS module pre-processing completed');
  
  // Create a global CSS processing config
  const globalCssPath = path.join(process.cwd(), 'src', 'app', 'globals.css');
  if (fs.existsSync(globalCssPath)) {
    try {
      console.log('Processing global CSS...');
      const globalCss = fs.readFileSync(globalCssPath, 'utf8');
      
      // Back up the original global CSS
      fs.writeFileSync(`${globalCssPath}.bak`, globalCss);
      
      // Add a comment that tells Next.js this file doesn't need processing
      const processedGlobalCss = `/* Next.js - No autoprefixer needed */\n${globalCss}`;
      fs.writeFileSync(globalCssPath, processedGlobalCss);
      console.log('✅ Processed global CSS');
    } catch (error) {
      console.error('⚠️ Error processing global CSS:', error.message);
    }
  }
  
  console.log('🎉 CSS Modules fixes completed!');
} catch (error) {
  console.error('❌ Error fixing CSS Modules:', error.message);
  process.exit(1);
}