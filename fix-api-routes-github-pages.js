/**
 * This script modifies API routes for GitHub Pages compatibility.
 * 
 * GitHub Pages is a static host, so API routes need to be configured
 * to fail gracefully with 'dynamic: "error"' to prevent build errors.
 * 
 * For Vercel and other dynamic deployments, we want to use 'dynamic: "force-dynamic"'
 * to ensure API routes work properly.
 * 
 * We run this script before building to update the route configurations.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_ROUTES_DIR = path.join(__dirname, 'src', 'app', 'api');
const IS_GITHUB_PAGES = process.env.GITHUB_PAGES === 'true' || process.env.STATIC_EXPORT === 'true';

// Target dynamic value based on environment
const TARGET_DYNAMIC_VALUE = IS_GITHUB_PAGES ? 'error' : 'force-dynamic';

console.log(`Configuring API routes for ${IS_GITHUB_PAGES ? 'GitHub Pages' : 'dynamic deployment'}`);
console.log(`Setting dynamic value to: ${TARGET_DYNAMIC_VALUE}`);

// Function to recursively process a directory
function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      // Process subdirectories recursively
      processDirectory(fullPath);
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      // Process any API route files
      updateRouteFile(fullPath);
    }
  }
}

// Function to update a route file
function updateRouteFile(filePath) {
  console.log(`Processing API route: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the file contains dynamic export
    if (content.includes('export const dynamic')) {
      // Replace any dynamic export configuration with our target value
      content = content.replace(
        /export\s+const\s+dynamic\s*=\s*['"].*?['"]/g,
        `export const dynamic = '${TARGET_DYNAMIC_VALUE}'`
      );
      
      // Write the updated content back
      fs.writeFileSync(filePath, content);
      console.log(`  ✅ Updated dynamic export in ${filePath}`);
    } else {
      // If the file doesn't have dynamic export, add it
      const insert = `\n// API route configuration\nexport const dynamic = '${TARGET_DYNAMIC_VALUE}';\n`;
      
      // Find a good position to insert the configuration
      const importEndIndex = content.lastIndexOf('import');
      if (importEndIndex !== -1) {
        // Find the end of the import section
        const importSectionEnd = content.indexOf(';', importEndIndex) + 1;
        if (importSectionEnd > 0) {
          // Insert after the last import
          content = content.slice(0, importSectionEnd) + insert + content.slice(importSectionEnd);
        } else {
          // Insert at the beginning if we can't find the end of imports
          content = insert + content;
        }
      } else {
        // Insert at the beginning if there are no imports
        content = insert + content;
      }
      
      // Write the updated content back
      fs.writeFileSync(filePath, content);
      console.log(`  ✅ Added dynamic export to ${filePath}`);
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
  }
}

// Start processing API routes
console.log('Starting API route configuration...');
processDirectory(API_ROUTES_DIR);
console.log('API route configuration complete!');