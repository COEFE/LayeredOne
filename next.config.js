/** @type {import('next').NextConfig} */
const nextConfig = {
  // For GitHub Pages deployment, use static export; for Firebase, use standalone
  output: process.env.GITHUB_PAGES === 'true' ? 'export' : 'standalone',
  // Set the base path for GitHub Pages, but not for Firebase
  basePath: process.env.GITHUB_PAGES === 'true' ? '/LayeredOne' : '',
  images: {
    unoptimized: true,
  },
  // This ensures proper routing
  trailingSlash: true,
  
  // For Next.js App Router
  experimental: {
    // App Router specific bodyParser config
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // External packages for server components
    serverComponentsExternalPackages: ['xlsx']
  },
  
  env: {
    // Explicitly pass along environment variables
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    // Flag to verify env passing is working
    NEXT_PUBLIC_CLAUDE_KEY_CHECK: !!process.env.CLAUDE_API_KEY || !!process.env.ANTHROPIC_API_KEY ? "true" : "false",
  },
  
  // Fix for the 'canvas' module issue with pdfjs-dist
  webpack: (config) => {
    // Fallback for Node.js modules that aren't needed in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
    };
    
    return config;
  },
};

module.exports = nextConfig;