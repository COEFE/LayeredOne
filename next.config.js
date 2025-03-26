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
  
  // For GitHub Pages, we need to exclude API routes from the build
  ...(process.env.GITHUB_PAGES === 'true' ? {
    // This configuration excludes API routes from the build for GitHub Pages
    exportPathMap: async function() {
      const paths = {
        '/': { page: '/' },
        '/documents': { page: '/documents' },
        '/chat': { page: '/chat' },
        '/chat/new': { page: '/chat/new' },
        '/debug': { page: '/debug' },
        '/login': { page: '/login' },
        '/signup': { page: '/signup' },
      };
      
      // Add routes with static params
      for (const id of ['test-1', 'test-2', 'example', 'example-1', 'example-2']) {
        paths[`/chat-test/${id}`] = { page: '/chat-test/[id]', query: { id } };
      }
      
      for (const id of ['new', 'example-1', 'example-2', 'chat-test-1', 'chat-test-2']) {
        paths[`/chat/${id}`] = { page: '/chat/[id]', query: { id } };
      }
      
      for (const id of ['example-doc-1', 'example-doc-2', 'sample-document']) {
        paths[`/documents/${id}`] = { page: '/documents/[id]', query: { id } };
      }
      
      return paths;
    }
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