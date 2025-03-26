#!/bin/bash
echo "Current working directory: $(pwd)"
echo "Listing files in current directory:"
ls -la

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