import { NextResponse } from 'next/server';

/**
 * Next.js root middleware with improved debugging
 * This helps with routing and resource handling in production
 * while providing detailed logging for debugging 404 errors
 */
export function middleware(request) {
  // Get the pathname from the URL
  const { pathname, search, origin } = request.nextUrl;
  
  // Log detailed request information (viewable in server logs)
  console.log(`[DEBUG] Request path: ${pathname}`);
  console.log(`[DEBUG] Search params: ${search}`);
  console.log(`[DEBUG] Full URL: ${origin}${pathname}${search}`);
  console.log(`[DEBUG] User-Agent: ${request.headers.get('user-agent')}`);
  
  // Check if the URL contains _rsc parameter which indicates a RSC request
  if (search && search.includes('_rsc=')) {
    console.log(`[DEBUG] React Server Component request detected: ${search}`);
    
    // For RSC requests, ensure they're properly handled
    const response = NextResponse.next();
    response.headers.set('x-middleware-handled', 'true');
    return response;
  }

  // For static files or API routes, skip additional processing
  if (
    pathname.startsWith('/_next/') || 
    pathname.startsWith('/api/') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css')
  ) {
    console.log(`[DEBUG] Static or API route detected: ${pathname}`);
    return NextResponse.next();
  }
  
  // Handle dynamic routes and ensure consistent trailing slashes
  if (
    pathname.match(/^\/chat\/[^\/]+\/?$/) || 
    pathname.match(/^\/documents\/[^\/]+\/?$/) || 
    pathname.match(/^\/folders\/[^\/]+\/?$/)
  ) {
    console.log(`[DEBUG] Dynamic route detected: ${pathname}`);
    
    // Check if this is a missing trailing slash issue
    if (!pathname.endsWith('/') && !pathname.includes('.')) {
      console.log(`[DEBUG] Adding missing trailing slash to: ${pathname}`);
      // Redirect to the version with trailing slash
      return NextResponse.redirect(new URL(`${pathname}/`, request.url), 308); // 308 = Permanent Redirect
    }
    
    // Don't redirect, just serve the page
    return NextResponse.next();
  }

  // For other routes, proceed normally but with a header for debugging
  console.log(`[DEBUG] Page route detected: ${pathname}`);
  const response = NextResponse.next();
  response.headers.set('x-middleware-redirect', 'false');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths
     * This is more inclusive for debugging purposes
     */
    '/:path*',
  ],
};