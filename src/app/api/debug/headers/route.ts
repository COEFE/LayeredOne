import { NextRequest, NextResponse } from 'next/server';

// For static export, we need to provide static data
export const dynamic = 'force-static';

export async function GET() {
  // For static export, return a predefined response
  // instead of using request.headers which is dynamic
  const staticHeaders = {
    'user-agent': 'Static Export',
    'host': 'github-pages-deployment',
    'accept': 'application/json',
    'content-type': 'application/json',
  };

  // Return the static headers as JSON
  return NextResponse.json({ headers: staticHeaders });
}