#!/bin/bash

echo "🚀 Starting GitHub Pages build process..."

# Run the direct fix script to ensure Firebase keys are properly formatted
echo "🔧 Applying Firebase key fix..."
node direct-fix.js

# Set GitHub Pages environment variables
export GITHUB_PAGES=true
export NEXT_PUBLIC_USE_REAL_FIREBASE=false
export SIMPLE_PDF=true

# Run the static export build
echo "📦 Building for GitHub Pages static export..."
npx next build --no-lint

# Prepare for GitHub Pages
echo "🌐 Preparing for GitHub Pages deployment..."
touch out/.nojekyll
cp -r public/* out/

# Check if build was successful
if [ -d "out" ]; then
  echo "✅ GitHub Pages build completed successfully!"
  echo "📂 Output is in the 'out' directory"
  echo "🌎 Deploy these files to GitHub Pages"
else
  echo "❌ Build failed. Please check the output above for errors."
  exit 1
fi