#!/bin/bash
echo "Current working directory: $(pwd)"
echo "Listing files in current directory:"
ls -la
echo "Installing dependencies..."

# Always use the vercel-package.json for Vercel deployments to ensure Next.js is detected
if [ -f "vercel-package.json" ]; then
  echo "Found vercel-package.json, copying to package.json"
  cp vercel-package.json package.json
else
  echo "Creating package.json with Next.js dependency"
  echo '{
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

# Make sure the original package.json has the contents we need
ORIG_PKG=$(cat package.json)
if ! echo "$ORIG_PKG" | grep -q '"next"'; then
  echo "Next.js not found in package.json, adding it"
  # Extract current version if possible
  NEXT_VERSION=$(cat src/package.json 2>/dev/null | grep -o '"next": "[^"]*"' | cut -d'"' -f4 || echo "15.2.1")
  # Add next dependency if needed
  echo "$ORIG_PKG" | jq '. + {"dependencies": (.dependencies // {}) + {"next": "'"$NEXT_VERSION"'"}}' > package.json.new
  mv package.json.new package.json
fi

echo "Final package.json:"
cat package.json

# Install dependencies
npm install --legacy-peer-deps