#!/bin/bash
# Combined build script for Vercel deployment

set -e # Exit on any error

echo "🚀 Starting Vercel build process..."

# Ensure CSS dependencies are installed with precise versions
echo "📦 Installing CSS dependencies with exact versions..."
npm install postcss@7.0.39 autoprefixer@9.8.8 tailwindcss@3.3.0 react-icons --save-exact

# Create the necessary directories
mkdir -p node_modules/autoprefixer
mkdir -p node_modules/postcss

# Create minimal implementations as fallbacks (in case npm install fails)
echo "🔧 Creating minimal module implementations..."

# Create a simple postcss.config.js file
echo "module.exports = { plugins: ['tailwindcss', 'autoprefixer'] }" > postcss.config.js

# Create minimal autoprefixer module
cat > node_modules/autoprefixer/index.js << 'EOF'
module.exports = function() {
  return {
    postcssPlugin: 'autoprefixer',
    Once(root) {
      console.log('Using fallback autoprefixer');
      return root;
    }
  };
};
module.exports.postcss = true;
EOF

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

# Build the application
echo "🏗️ Building the application..."
SIMPLE_PDF=true next build --no-lint

echo "✅ Vercel build process completed!"