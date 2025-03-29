/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Simplified webpack config without PDF.js/react-pdf handling
  webpack: (config, { isServer }) => {
    // Handle only basic environment settings
    if (isServer) {
      // Add Firebase Admin as an external dependency to prevent bundling
      config.externals = [
        ...(config.externals || []),
        'firebase-admin',
        '@google-cloud/firestore',
        '@google-cloud/storage'
      ];
      
      // Don't try to resolve the path module in webpack - we'll handle it with our custom implementation
      if (config.resolve.alias) {
        delete config.resolve.alias['@google-cloud/firestore/build/src/path'];
      }
      
      // Fix modules that use Node.js-specific features
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false
      };
    }
    
    // Add environment variable to detect static export during build
    config.plugins = config.plugins || [];
    
    // Use webpack directly rather than from config
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.NEXT_STATIC_EXPORT': JSON.stringify(
          process.env.GITHUB_PAGES === 'true' || process.env.STATIC_EXPORT === 'true'
        ),
      })
    );
    
    // Fix for PostCSS issues
    config.resolve.alias = {
      ...config.resolve.alias,
      'autoprefixer': require.resolve('autoprefixer'),
      'postcss': require.resolve('postcss'),
    };
    
    return config;
  },
  
  // Disable ESLint in the build process
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // For GitHub Pages deployment, use static export; otherwise use standalone
  // output is also set below
  // Set the base path for GitHub Pages, but not for Firebase
  basePath: process.env.GITHUB_PAGES === 'true' ? '/LayeredOne' : '',
  
  images: {
    unoptimized: true,
  },
  
  // Fix routing issues - use clean URLs without trailing slashes
  trailingSlash: false,
  // Use clean URLs without redirects for dynamic routes
  // Handle asset prefixes properly
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
  
  // External packages for server components
  serverExternalPackages: [
    'xlsx',
    'firebase-admin',
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
    '@firebase/storage',
    '@anthropic-ai/sdk',
    'pdf-parse',
    'pdf-parse-debugging-disabled',
    '@google-cloud/firestore',
    '@google-cloud/storage',
    'is-set',
    'is-regexp'
  ],
  
  // Environment variables
  env: {
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_CLAUDE_KEY_CHECK: !!process.env.CLAUDE_API_KEY || !!process.env.ANTHROPIC_API_KEY ? "true" : "false",
    NEXT_PUBLIC_VERCEL_DEPLOYMENT: process.env.VERCEL ? "true" : "false",
    NEXT_PUBLIC_USE_REAL_FIREBASE: process.env.NODE_ENV === 'production' ? 'true' : process.env.NEXT_PUBLIC_USE_REAL_FIREBASE,
    FIREBASE_USE_PRODUCTION_CONFIG: 'true',
  },
  
  // Configure for App Router
  experimental: {
    // Reduce unnecessary preloads
    optimisticClientCache: true
  },
  
  // Use standalone output mode for all deployments to ensure API routes work
  output: 'standalone',
  distDir: '.next',
  
  // For GitHub Pages, we need to configure static parameters via the individual components
  // using generateStaticParams() in each dynamic route
  ...(process.env.GITHUB_PAGES === 'true' ? {
    // Ensure App Router static export works correctly
    // No exportPathMap here - it's not compatible with the App Router
  } : {}),
  
  // Make sure dynamic routes work in production
  generateBuildId: async () => {
    // Return a unique build ID based on timestamp to avoid stale builds
    return `build-${Date.now()}`;
  },
  
  // Improve resource loading
  poweredByHeader: false,
};

module.exports = nextConfig;