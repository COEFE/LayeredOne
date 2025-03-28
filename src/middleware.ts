import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the URL contains _rsc parameter which indicates a RSC request
  // and should be handled by Next.js internals
  const url = new URL(request.url);
  const isRSCRequest = url.searchParams.has('_rsc');
  
  // Skip middleware processing for RSC requests to avoid interference
  if (isRSCRequest) {
    return NextResponse.next();
  }
  
  // For auth-related pages, apply special handling if needed
  if (['/login', '/login/', '/signup', '/signup/', '/reset-password', '/reset-password/'].includes(pathname)) {
    // Log auth page navigation for debugging
    console.log(`Auth page navigation: ${pathname}`);
    
    // Don't redirect these pages, just continue to the requested page
    // Let Vercel.json handle any needed redirects for trailing slashes
    return NextResponse.next();
  }
  
  // Default behavior: continue to the requested page
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};