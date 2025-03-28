#!/bin/bash

echo "🚀 Starting Vercel build process..."

# Run the direct fix script to ensure Firebase keys are properly formatted
echo "🔧 Applying Firebase key fix..."
node direct-fix.js

# Set Vercel environment variables
export NEXT_PUBLIC_VERCEL_DEPLOYMENT=true
export NEXT_PUBLIC_USE_REAL_FIREBASE=true
export SIMPLE_PDF=true

# Run the build
echo "📦 Building for Vercel deployment..."
npx next build --no-lint

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "✅ Vercel build completed successfully!"
else
  echo "❌ Build failed. Please check the output above for errors."
  exit 1
fi