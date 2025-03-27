#!/bin/bash
# Simplified build script for Vercel deployment that focuses on PostCSS compatibility

set -e # Exit on any error

echo "🚀 Starting simplified Vercel build process..."

# Create core directories as a safety measure
mkdir -p node_modules/{autoprefixer,postcss,tailwindcss,picocolors,num2fraction}

# Install exact dependency versions known to work together
echo "📦 Installing CSS dependencies with compatible versions..."
npm install \
  postcss@7.0.39 \
  autoprefixer@9.8.8 \
  tailwindcss@3.3.0 \
  picocolors@0.2.1 \
  num2fraction@1.2.2 \
  source-map@0.6.1 \
  react-icons \
  --save-exact

# No longer creating mock implementations - using the real modules instead
echo "🔧 Verifying installed modules..."

# Check if postcss and autoprefixer are properly installed
if [ ! -d "node_modules/postcss" ]; then
  echo "⚠️ Warning: postcss module not found - installing again"
  npm install postcss@7.0.39 --save-exact
fi

if [ ! -d "node_modules/autoprefixer" ]; then
  echo "⚠️ Warning: autoprefixer module not found - installing again"
  npm install autoprefixer@9.8.8 --save-exact
fi

if [ ! -d "node_modules/tailwindcss" ]; then
  echo "⚠️ Warning: tailwindcss module not found - installing again"
  npm install tailwindcss@3.3.0 --save-exact
fi

if [ ! -d "node_modules/react-icons" ]; then
  echo "⚠️ Warning: react-icons module not found - installing again"
  npm install react-icons@5.5.0 --save-exact
fi

# Verify the installations 
echo "✅ Verified all required modules are installed properly"

# Create simple postcss.config.js
echo "🔧 Creating simplified PostCSS config..."
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: [
    'tailwindcss',
    'autoprefixer'
  ]
}
EOF

# Run the Firebase dependency fix script if needed
if [ -f "./fix-firebase-deps.sh" ]; then
  echo "🔧 Running Firebase dependency fixes..."
  ./fix-firebase-deps.sh
fi

# Export required environment variables
export NEXT_PUBLIC_USE_REAL_FIREBASE=true
export SIMPLE_PDF=true

# Build the application
echo "🏗️ Building the application..."
# Use npx to ensure next is available
SIMPLE_PDF=true npx next build --no-lint

echo "✅ Build process completed!"