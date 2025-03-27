#!/usr/bin/env node

/**
 * This script ensures that react-icons is properly installed
 * and handles imports to prevent "Module not found" errors.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing react-icons issues...');

// Install react-icons if needed
try {
  console.log('📦 Installing react-icons...');
  execSync('npm install react-icons@^4.12.0 --save', { stdio: 'inherit' });
  console.log('✅ Installed react-icons');
} catch (error) {
  console.error('⚠️ Error installing react-icons:', error.message);
}

// Find files that import from react-icons/fi
function findFilesWithReactIcons(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
          findFilesWithReactIcons(filePath, fileList);
        } else if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js')) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('react-icons/fi') || content.includes('react-icons/ai') || 
              content.includes('react-icons/md') || content.includes('react-icons/fa') ||
              content.includes('react-icons/')) {
            fileList.push(filePath);
          }
        }
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return fileList;
}

// Find all files that import from react-icons
const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const reactIconsFiles = findFilesWithReactIcons(srcDir);

console.log(`Found ${reactIconsFiles.length} files with react-icons imports`);

// Create fallback icon components to handle missing icons
const fallbackIconsDir = path.join(srcDir, 'components', 'icons');
if (!fs.existsSync(fallbackIconsDir)) {
  fs.mkdirSync(fallbackIconsDir, { recursive: true });
}

// Create a fallback icon component
const fallbackIconPath = path.join(fallbackIconsDir, 'FallbackIcons.tsx');
fs.writeFileSync(fallbackIconPath, `
import React from 'react';

// Fallback icons to use when react-icons/fi is not available
export const FiEdit = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

export const FiTrash = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

export const FiPlus = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export const FiFile = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
  </svg>
);

export const FiUpload = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

export const FiLogOut = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

export const FiUser = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

// Export other common icons
export const FiSearch = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={props.className || ""} style={props.style || {}}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
`);

console.log('✅ Created fallback icon components');

// Process each file that imports react-icons
reactIconsFiles.forEach(filePath => {
  try {
    console.log(`Processing: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Back up the original file
    fs.writeFileSync(`${filePath}.bak`, content);
    
    // Check if it's importing from 'react-icons/fi'
    if (content.includes('react-icons/fi')) {
      console.log(`  - Found import from react-icons/fi in ${path.basename(filePath)}`);
      
      // Add a try-catch import for 'react-icons/fi'
      const fallbackImport = `
// Try to import from react-icons, with fallback to local icons
let FiEdit, FiTrash, FiPlus, FiFile, FiUpload, FiLogOut, FiUser, FiSearch;
try {
  // Try to import from react-icons/fi
  ({ FiEdit, FiTrash, FiPlus, FiFile, FiUpload, FiLogOut, FiUser, FiSearch } = require('react-icons/fi'));
} catch (error) {
  // Fall back to local icon components
  ({ FiEdit, FiTrash, FiPlus, FiFile, FiUpload, FiLogOut, FiUser, FiSearch } = require('@/components/icons/FallbackIcons'));
}
`;
      
      // Replace the import
      content = content.replace(
        /import\s+{([^}]*)}\s+from\s+['"]react-icons\/fi['"]/g,
        '// Original import replaced with try-catch for Vercel compatibility\n// import { $1 } from "react-icons/fi"'
      );
      
      // Add the fallback import at the top of the file, after the other imports
      const importEndIndex = content.lastIndexOf('import');
      if (importEndIndex >= 0) {
        // Find the end of the import section
        let i = importEndIndex;
        while (i < content.length && content[i] !== '\n') i++;
        if (i < content.length) i++;
        
        // Insert the fallback import
        content = content.slice(0, i) + fallbackImport + content.slice(i);
      } else {
        // If no imports found, just add at the top
        content = fallbackImport + content;
      }
      
      console.log(`  - Updated imports in ${path.basename(filePath)}`);
    }
    
    // Write the modified content back
    fs.writeFileSync(filePath, content);
    console.log(`✅ Processed: ${filePath}`);
  } catch (error) {
    console.error(`⚠️ Error processing ${filePath}:`, error.message);
  }
});

console.log('🎉 react-icons fixes completed!');