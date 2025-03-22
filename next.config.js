/** @type {import('next').NextConfig} */
const nextConfig = {
  // For GitHub Pages deployment, we need static export
  output: process.env.GITHUB_PAGES === 'true' ? 'export' : 'standalone',
  // Set the base path for GitHub Pages (repo name)
  basePath: process.env.GITHUB_PAGES === 'true' ? '/LayeredOne' : '',
  images: {
    unoptimized: true,
  },
  // This ensures proper routing
  trailingSlash: true,
  
  // For Next.js App Router, we need to configure via experimental
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
    // App Router specific bodyParser config
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  
  // This is for increasing the API route body size limit (Pages Router)
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: '50mb',
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