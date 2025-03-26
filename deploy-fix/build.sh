#!/bin/bash
echo "Current working directory: $(pwd)"
echo "Listing files in current directory:"
ls -la

# Provide debugging info
echo "Checking for app directory in src..."
if [ -d "src/app" ]; then
  echo "src/app exists"
  ls -la src/app
else 
  echo "src/app does not exist"
fi

# Add symlinks to point to the correct directories
if [ -d "src/app" ]; then
  echo "Creating app directory at root by symlinking to src/app"
  ln -sf src/app app
fi

# Set up the package.json to include the correct dependencies
echo "Content of src/app/page.tsx:"
cat src/app/page.tsx 2>/dev/null || echo "File not found"

# Ensure pages directory has a correct file if using the pages directory
if [ -d "pages" ]; then
  echo "pages directory exists - replacing placeholder with redirect to src/app"
  cat > pages/index.js << 'EOL'
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Index() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the main app
    router.replace('/');
  }, []);
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, sans-serif',
    }}>
      <h1>Loading application...</h1>
      <p>If you are not redirected automatically, please <a href="/">click here</a>.</p>
    </div>
  );
}
EOL
fi

# Setup proper next.config.js
echo "Creating next.config.js to support src directory..."

# Check if we're building for GitHub Pages
if [ "$GITHUB_PAGES" = "true" ]; then
  echo "Building for GitHub Pages: API routes will be excluded from the build"
fi
cat > next.config.js << 'EOL'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@anthropic-ai/sdk',
      'pdf-parse',
      'pdf-parse-debugging-disabled'
    ],
  },
  distDir: '.next',
};

module.exports = nextConfig;
EOL

echo "Build completed. Next.js configured to use src directory."