/** @type {import('next').NextConfig} */
const nextConfig = {
  // Handle problematic modules that use browser-only APIs
  webpack: (config, { isServer }) => {
    // Exclude certain modules from SSR/static build
    if (isServer || process.env.GITHUB_PAGES === 'true') {
      config.externals = [...(config.externals || []), {
        'canvas': 'canvas',
        // Add any other problematic modules here
        'react-pdf': 'react-pdf'
      }];
    }
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
  serverExternalPackages: ['xlsx'],
  // Environment variables
  env: {
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_CLAUDE_KEY_CHECK: !!process.env.CLAUDE_API_KEY || !!process.env.ANTHROPIC_API_KEY ? "true" : "false",
  },
  // Server packages configuration
  serverExternalPackages: [
    'firebase-admin',
    '@anthropic-ai/sdk',
    'pdf-parse',
    'pdf-parse-debugging-disabled'
  ],
  // Configure for App Router
  experimental: {
    // Reduce unnecessary preloads
    optimisticClientCache: true
  },
  // Set output based on deployment target
  output: process.env.GITHUB_PAGES === 'true' ? 'export' : 'standalone',
  distDir: process.env.GITHUB_PAGES === 'true' ? 'out' : '.next',
  
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