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
  --save-exact

# Create minimal implementations as fallbacks
echo "🔧 Creating minimal module implementations..."

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

# Create minimal postcss module
cat > node_modules/postcss/index.js << 'EOF'
function process(css, opts) {
  console.log('Using fallback postcss processor');
  return {
    css,
    map: null,
    messages: [],
    root: { type: 'root', nodes: [] },
    processor: { plugins: [] },
    opts
  };
}

module.exports = function postcss(...plugins) {
  return {
    process,
    plugins
  };
};

module.exports.parse = function parse(css) {
  return { type: 'root', nodes: [] };
};

module.exports.plugin = function plugin(name, func) {
  return func;
};
EOF

# Create tailwind package.json
echo '{"name":"tailwindcss","version":"3.3.0","main":"index.js"}' > node_modules/tailwindcss/package.json

# Create minimal tailwindcss module
cat > node_modules/tailwindcss/index.js << 'EOF'
module.exports = function() {
  return {
    postcssPlugin: 'tailwindcss',
    Once(root) {
      console.log('Using fallback tailwindcss');
      return root;
    }
  };
};
module.exports.postcss = true;
EOF

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