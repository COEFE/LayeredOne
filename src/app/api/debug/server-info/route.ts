import { NextResponse } from 'next/server';
import os from 'os';
import process from 'process';

// Make route compatible with static export
export const dynamic = 'force-static';

export async function GET() {
  // Get static environment information
  const serverInfo = {
    nextConfig: {
      // Add Next.js config information that's available
      version: 'Static Export',
      environment: process.env.NODE_ENV || 'production',
    },
    vercel: {
      environment: 'GitHub Pages',
      region: 'GitHub Pages',
      url: 'github-pages',
    },
    system: {
      platform: os.platform(),
      release: os.release(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      memoryUsage: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0
      },
    },
    routing: {
      requestPath: '/api/debug/server-info',
      hasTrailingSlash: false,
      params: {}
    }
  };

  return NextResponse.json(serverInfo);
}