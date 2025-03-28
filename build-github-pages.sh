#!/bin/bash

echo "Starting GitHub Pages build process..."

# Install dotenv if needed
if ! npm list dotenv > /dev/null 2>&1; then
  echo "Installing dotenv..."
  npm install dotenv --save-dev
fi

# Run key fixing script
echo "Setting up Firebase keys for GitHub Pages..."
node fix-github-pages-keys.js

# Copy the GitHub Pages env file to .env.local for the build
cp .env.github-pages .env.local

# Run the build with GitHub Pages flag
echo "Running build with GitHub Pages configuration..."
GITHUB_PAGES=true SIMPLE_PDF=true npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "Build completed successfully!"
  echo "The static site is ready to be deployed to GitHub Pages."
else
  echo "Build failed. Please check the output above for errors."
  exit 1
fi

echo "GitHub Pages build process completed successfully!"