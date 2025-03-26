#!/bin/bash
echo "Current working directory: $(pwd)"
echo "Listing files in current directory:"
ls -la

# Don't create duplicate app/pages directories - instead modify next.config.js to point to the right location
echo "Setting up Next.js configuration..."

# Remove placeholder pages directory if it exists (to avoid conflicts)
if [ -d "pages" ] && [ -f "pages/index.js" ]; then
  grep -q "placeholder page" pages/index.js && rm -rf pages
fi

# Check if the src directory exists and is a proper Next.js project
if [ -d "src/app" ]; then
  echo "Found src/app directory, configuring Next.js to use it"

  # Create or update next.config.js to point to the src directory
  cat > next.config.js << EOL
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
  // This is the key configuration to make it work with src directory
  distDir: '.next',
  pageExtensions: ['js', 'jsx', 'ts', 'tsx']
};

module.exports = nextConfig;
EOL

elif [ -d "src/pages" ]; then
  echo "Found src/pages directory, configuring Next.js to use it"
  # Create or update next.config.js to point to the src directory
  cat > next.config.js << EOL
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
  // This is the key configuration to make it work with src directory
  distDir: '.next',
  pageExtensions: ['js', 'jsx', 'ts', 'tsx']
};

module.exports = nextConfig;
EOL

else
  echo "No src/app or src/pages directory found, checking for app or pages at root"
  if [ ! -d "app" ] && [ ! -d "pages" ]; then
    echo "No app or pages directory found at root either, creating a temporary pages directory"
    mkdir -p pages
    echo 'export default function Page() { return <div><h1>Temporary Page</h1><p>This is a placeholder page. Your actual application may be in a different directory structure.</p></div> }' > pages/index.js
  fi
fi

# Make sure package.json exists and has Next.js
if [ ! -f "package.json" ]; then
  echo "ERROR: package.json missing before build! Creating one."
  cp vercel-package.json package.json || echo '{
  "name": "layered-one",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.2.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}' > package.json
fi

# Verify Next.js is in dependencies
if ! grep -q '"next":' package.json; then
  echo "Next.js not found in package.json before build! Adding it."
  # Use jq if available, or a simple sed command otherwise
  if command -v jq &> /dev/null; then
    jq '.dependencies = (.dependencies // {}) + {"next": "15.2.1"}' package.json > package.json.new
    mv package.json.new package.json
  else
    # Simple but less robust fallback if jq isn't available
    sed -i.bak 's/"dependencies": {/"dependencies": {"next": "15.2.1",/' package.json || true
  fi
fi

echo "Content of package.json:"
cat package.json

# Ensure next.config.js exists
if [ ! -f "next.config.js" ] && [ -f "next.config.js.copy" ]; then
  echo "Copying next.config.js.copy to next.config.js"
  cp next.config.js.copy next.config.js
fi

echo "Building project..."
npm run build || next build

# Ensure output directory exists
mkdir -p .next/standalone