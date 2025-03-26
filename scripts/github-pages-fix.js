// This script creates static JSON files for API routes when building for GitHub Pages
const fs = require('fs');
const path = require('path');

console.log('Creating static API responses for GitHub Pages...');

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