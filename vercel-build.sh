#!/bin/bash
# Combined build script for Vercel deployment

set -e # Exit on any error

echo "🚀 Starting Vercel build process..."

# Ensure CSS dependencies are installed with precise versions
echo "📦 Installing CSS dependencies with exact versions..."
npm install postcss@8.4.27 autoprefixer@9.8.8 tailwindcss@3.3.0 --no-save
npm install postcss@8.4.27 autoprefixer@9.8.8 tailwindcss@3.3.0 --save-dev

# Create the necessary directories
mkdir -p node_modules/autoprefixer
mkdir -p node_modules/postcss

# Run autoprefixer fix script first (most critical)
echo "🔧 Running autoprefixer fixes..."
npm run fix-autoprefixer

# Run React Icons fix script 
echo "🔧 Running React Icons fixes..."
npm run fix-icons

# Run CSS fix scripts
echo "🔧 Running CSS fixes..."
npm run fix-css

# Run font fix script
echo "🔧 Running font fixes..."
npm run fix-font

# Run Firebase fix script
echo "🔧 Running Firebase fixes..."
npm run fix-firebase

# Run Vercel deploy script
echo "🔧 Running Vercel deploy script..."
node scripts/vercel-deploy.js

# Verify that autoprefixer is available
if [ ! -d "node_modules/autoprefixer" ]; then
  echo "🚨 Autoprefixer module not found, creating it manually..."
  mkdir -p node_modules/autoprefixer
  echo 'module.exports = function() { return { postcssPlugin: "autoprefixer" }; };' > node_modules/autoprefixer/index.js
  echo '{ "name": "autoprefixer", "version": "9.8.8" }' > node_modules/autoprefixer/package.json
fi

# Build the application
echo "🏗️ Building the application..."
SIMPLE_PDF=true next build --no-lint

echo "✅ Vercel build process completed!"