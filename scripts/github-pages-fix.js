// This script creates static JSON files for API routes and handles dynamic routes when building for GitHub Pages
const fs = require('fs');
const path = require('path');

console.log('Running GitHub Pages fixes...');
console.log('API routes are not supported in static exports, creating client-friendly fallbacks...');
console.log('=== Creating API fallback JSON files ===');

// Directory where the static export will be
const outputDir = path.join(process.cwd(), 'out');

// Define all API routes we need to create fallbacks for
const apiRoutes = [
  // Debug APIs
  { path: 'api/debug/headers', response: { headers: { 'x-github-pages': 'static-deployment', 'content-type': 'application/json' } } },
  { path: 'api/debug/server-info', response: { environment: 'GitHub Pages Static', version: 'static' } },
  { path: 'api/debug/directchat', response: { error: 'API not available in static mode', status: 404 } },
  
  // Chat APIs
  { path: 'api/chat/document', response: { error: 'API not available in static mode', status: 404 } },
  { path: 'api/chat/document/edit', response: { error: 'API not available in static mode', status: 404 } },
  
  // Document APIs
  { path: 'api/documents/create', response: { error: 'API not available in static mode', status: 404 } },
  { path: 'api/documents/edit', response: { error: 'API not available in static mode', status: 404 } },
  { path: 'api/documents/process', response: { error: 'API not available in static mode', status: 404 } },
  { path: 'api/documents/reprocess', response: { error: 'API not available in static mode', status: 404 } },
  
  // Storage APIs
  { path: 'api/storage/download-url', response: { error: 'API not available in static mode', status: 404 } },
  { path: 'api/storage/signed-url', response: { error: 'API not available in static mode', status: 404 } },
  { path: 'api/storage/upload', response: { error: 'API not available in static mode', status: 404 } }
];

// Create API directory fallbacks
for (const route of apiRoutes) {
  try {
    // Create directory structure
    const dirPath = path.join(outputDir, ...route.path.split('/'));
    const fileExists = fs.existsSync(dirPath);
    
    // Check if the path exists and is a file (need to handle differently)
    const isFile = fileExists && fs.statSync(dirPath).isFile();
    
    // If it's a file, we'll use the parent directory
    const targetDir = isFile ? path.dirname(dirPath) : dirPath;
    
    if (!fileExists || isFile) {
      // Only create directories that don't already exist
      if (!isFile && !fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // If the path is a file, we'll use the file as is
      // Otherwise create index.json in the directory
      if (!isFile) {
        // Create index.json fallback
        fs.writeFileSync(
          path.join(targetDir, 'index.json'),
          JSON.stringify(route.response, null, 2)
        );
      
        // Create index.html fallback with CORS headers
        const htmlFallback = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>API Fallback</title>
  <meta name="robots" content="noindex">
  <script>
    // This allows client-side code to detect API is unavailable
    window.API_STATIC_FALLBACK = true;
  </script>
</head>
<body>
  <pre>${JSON.stringify(route.response, null, 2)}</pre>
</body>
</html>`;
      
        fs.writeFileSync(path.join(targetDir, 'index.html'), htmlFallback);
        console.log(`Created API fallback for ${route.path}`);
      } else {
        console.log(`Found existing file at ${dirPath}, skipping`);
      }
    } else {
      console.log(`API route ${route.path} already exists, skipping`);
    }
  } catch (err) {
    console.error(`Error creating fallback for ${route.path}:`, err.message);
  }
}

console.log('Static API responses created successfully!');

// Handle dynamic routes
console.log('\n=== Creating fallback files for dynamic routes ===');

// Create fallback HTML for dynamic routes that might not be generated
const dynamicRoutes = [
  { path: 'chat-test', ids: ['any-id', 'test-route', 'example-1', 'example-2'] },
  { path: 'chat', ids: ['any-id', 'example-chat', 'chat-1', 'chat-2'] },
  { path: 'documents', ids: ['any-document', 'example-1', 'example-2'] }
];

// Create the fallback files
dynamicRoutes.forEach(route => {
  route.ids.forEach(id => {
    const routePath = path.join(outputDir, route.path, id);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(routePath)) {
      fs.mkdirSync(routePath, { recursive: true });
    }
    
    // Create index.html with a client-side redirect
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0; URL=/">
  <meta name="robots" content="noindex">
</head>
<body>
  <p>Redirecting to home page...</p>
  <script>
    window.location.href = '/';
  </script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(routePath, 'index.html'), html);
    console.log(`Created fallback for /${route.path}/${id}/`);
  });
});

console.log('Fallback files for dynamic routes created successfully!');