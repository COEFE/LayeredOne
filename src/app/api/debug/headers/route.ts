import { NextRequest, NextResponse } from 'next/server';

// Make route compatible with static export
export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  // Extract headers from the request
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Return the headers as JSON
  return NextResponse.json({ headers });
}