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
  // Fix routing issues - remove trailing slash for better App Router compatibility
  trailingSlash: false,
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
    // Add optimized CSS settings to reduce preload warnings
    optimizeCss: true,
    // Reduce unnecessary preloads
    optimisticClientCache: true
  },
  // Improve resource loading
  poweredByHeader: false,
  // Optimize asset loading
  optimizeFonts: true,
};

module.exports = nextConfig;