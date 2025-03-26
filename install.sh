#!/bin/bash
echo "Current working directory: $(pwd)"
echo "Listing files in current directory:"
ls -la
echo "Installing dependencies..."
if [ -f "package.json" ]; then
  echo "Found package.json, installing dependencies"
  npm install --legacy-peer-deps
else
  echo "ERROR: package.json not found in $(pwd)"
  # Create a minimal package.json if it doesn't exist
  if [ -f "vercel-package.json" ]; then
    echo "Found vercel-package.json, copying to package.json"
    cp vercel-package.json package.json
    npm install --legacy-peer-deps
  else
    echo "Creating minimal package.json"
    echo '{
  "name": "layered-one",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}' > package.json
    npm install --legacy-peer-deps
  fi
fi