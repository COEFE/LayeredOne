/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint in the build process
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // For GitHub Pages deployment, use static export; for Firebase, use standalone
  output: process.env.GITHUB_PAGES === 'true' ? 'export' : 'standalone',
  // Set the base path for GitHub Pages, but not for Firebase
  basePath: process.env.GITHUB_PAGES === 'true' ? '/LayeredOne' : '',
  images: {
    unoptimized: true,
  },
  // Fix routing issues - add trailing slash for better compatibility in production
  trailingSlash: true,
  // Force trailing slash to help with routing issues
  async redirects() {
    return [
      // Add redirects for dynamic routes
      {
        source: '/chat/:id',
        destination: '/chat/:id/',
        permanent: true,
      },
      {
        source: '/documents/:id',
        destination: '/documents/:id/',
        permanent: true,
      },
      {
        source: '/folders/:id',
        destination: '/folders/:id/',
        permanent: true,
      },
      {
        source: '/login',
        destination: '/login/',
        permanent: true,
      },
      {
        source: '/signup',
        destination: '/signup/',
        permanent: true,
      },
      {
        source: '/reset-password',
        destination: '/reset-password/',
        permanent: true,
      },
      {
        source: '/settings',
        destination: '/settings/',
        permanent: true,
      },
    ];
  },
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
  // Configure for App Router
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['firebase-admin'],
    // Disable CSS optimization to prevent critters issues
    // optimizeCss: true,
    // Reduce unnecessary preloads
    optimisticClientCache: true
  },
  // Improve resource loading
  poweredByHeader: false,
  // Optimize asset loading
  optimizeFonts: true,
};

module.exports = nextConfig;