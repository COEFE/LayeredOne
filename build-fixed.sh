#!/bin/bash
# Script to build the application with Firebase dependency fixes

echo "🚀 Starting fixed build process..."

# Run the Firebase dependency fix script first
./fix-firebase-deps.sh

# Export required environment variables
export NEXT_PUBLIC_USE_REAL_FIREBASE=true

# For GitHub Pages build
if [ "$1" == "github" ]; then
  echo "📦 Building for GitHub Pages with fixed dependencies..."
  GITHUB_PAGES=true next build --no-lint && touch out/.nojekyll && node scripts/github-pages-fix.js
  echo "✅ GitHub Pages build completed!"
# For Vercel deployment  
elif [ "$1" == "vercel" ]; then
  echo "📦 Building for Vercel with fixed dependencies..."
  node scripts/vercel-deploy.js && SIMPLE_PDF=true npm run build
  echo "✅ Vercel build completed!"
# Default build
else
  echo "📦 Running default build with fixed dependencies..."
  SIMPLE_PDF=true next build --no-lint
  echo "✅ Build completed!"
fi

# Check for build success
if [ $? -eq 0 ]; then
  echo "🎉 Build successful!"
else
  echo "❌ Build failed. Check the error messages above."
  exit 1
fi