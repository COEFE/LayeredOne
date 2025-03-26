// Middleware to handle timeouts in API routes
import { NextRequest, NextResponse } from 'next/server';

type HandlerFunction = (req: NextRequest) => Promise<NextResponse>;

export default function withTimeout(handler: HandlerFunction, timeoutMs = 8000): HandlerFunction {
  return async (req: NextRequest) => {
    // Set a timeout for the API request
    const timeoutPromise = new Promise<NextResponse>((_, reject) => {
      setTimeout(() => {
        reject(new Error('API Route Timeout'));
      }, timeoutMs);
    });

    try {
      // Race between the actual handler and the timeout
      const result = await Promise.race([
        handler(req),
        timeoutPromise
      ]);
      
      return result;
    } catch (error: any) {
      console.error('API route timeout:', error);
      
      // Return a timeout response
      return NextResponse.json({ 
        error: 'Service Unavailable', 
        message: 'The request took too long to process. Please try again later.'
      }, { status: 503 });
    }
  };
}

// Helper to break large operations into smaller chunks to avoid timeouts
export async function processInChunks<T, R>(
  items: T[], 
  chunkSize: number, 
  processFn: (chunk: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  // Process the array in chunks to avoid long-running operations
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    
    // Process this chunk
    const chunkResults = await processFn(chunk);
    results.push(...chunkResults);
    
    // Small delay to allow event loop to process other requests
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return results;
}

// Helper to optimize Firebase queries
export function optimizeFirebaseQuery(query: any, pageSize = 20): any {
  // Add pagination and limits to Firebase queries to prevent timeouts
  return query.limit(pageSize);
}