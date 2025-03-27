#!/bin/bash
# Combined build script for Vercel deployment

set -e # Exit on any error

echo "🚀 Starting Vercel build process..."

# Install dependencies
echo "📦 Installing CSS dependencies..."
npm install postcss autoprefixer tailwindcss --save

# Run React Icons fix script first
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

# Build the application
echo "🏗️ Building the application..."
SIMPLE_PDF=true next build --no-lint

echo "✅ Vercel build process completed!"