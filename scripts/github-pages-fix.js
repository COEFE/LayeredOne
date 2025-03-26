// This script creates static JSON files for API routes and handles dynamic routes when building for GitHub Pages
const fs = require('fs');
const path = require('path');

console.log('Running GitHub Pages fixes...');
console.log('=== Creating static API responses ===');

// Directory where the static export will be
const outputDir = path.join(process.cwd(), 'out');

// Create API directory structure
const apiDir = path.join(outputDir, 'api');
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

// Create debug API directories
const debugDir = path.join(apiDir, 'debug');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

const headersDir = path.join(debugDir, 'headers');
if (!fs.existsSync(headersDir)) {
  fs.mkdirSync(headersDir, { recursive: true });
}

const serverInfoDir = path.join(debugDir, 'server-info');
if (!fs.existsSync(serverInfoDir)) {
  fs.mkdirSync(serverInfoDir, { recursive: true });
}

// Create sample response files
const headersResponse = {
  headers: {
    'x-github-pages': 'static-deployment',
    'content-type': 'application/json',
    'user-agent': 'GitHub Pages Static Deployment'
  }
};

fs.writeFileSync(
  path.join(headersDir, 'index.json'),
  JSON.stringify(headersResponse, null, 2)
);

const serverInfoResponse = {
  nextConfig: {
    version: 'GitHub Pages Static Build',
    environment: 'production'
  },
  vercel: {
    environment: 'Not deployed on Vercel',
    region: 'GitHub Pages',
    url: 'github-pages'
  },
  system: {
    platform: 'static',
    release: 'static',
    nodeVersion: 'N/A',
    uptime: 0,
    memoryUsage: {}
  },
  routing: {
    requestPath: '/api/debug/server-info',
    hasTrailingSlash: false,
    params: {}
  }
};

fs.writeFileSync(
  path.join(serverInfoDir, 'index.json'),
  JSON.stringify(serverInfoResponse, null, 2)
);

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