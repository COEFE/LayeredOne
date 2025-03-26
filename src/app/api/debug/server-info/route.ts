import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import process from 'process';

// Make route compatible with static export
export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  // Get environment information
  const serverInfo = {
    nextConfig: {
      // Add Next.js config information that's available
      version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'Unknown',
      environment: process.env.NODE_ENV || 'Unknown',
    },
    vercel: {
      environment: process.env.VERCEL_ENV || 'Not deployed on Vercel',
      region: process.env.VERCEL_REGION || 'Unknown',
      url: process.env.VERCEL_URL || 'Unknown',
    },
    system: {
      platform: os.platform(),
      release: os.release(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      memoryUsage: process.memoryUsage(),
    },
    routing: {
      requestPath: request.nextUrl.pathname,
      hasTrailingSlash: request.nextUrl.pathname.endsWith('/'),
      params: Object.fromEntries(request.nextUrl.searchParams.entries()),
    }
  };

  return NextResponse.json(serverInfo);
}