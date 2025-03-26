// Middleware to handle timeouts in API routes
export default function withTimeout(handler, timeoutMs = 8000) {
  return async (req, res) => {
    // Set a timeout for the API request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('API Route Timeout'));
      }, timeoutMs);
    });

    try {
      // Race between the actual handler and the timeout
      const result = await Promise.race([
        handler(req, res),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      // Only handle the case where our API hasn't responded yet
      if (!res.headersSent) {
        console.error('API route timeout:', error);
        res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'The request took too long to process. Please try again later.'
        });
      }
      
      // If headers are already sent, the error happened after response started
      return null;
    }
  };
}

// Helper to break large operations into smaller chunks to avoid timeouts
export async function processInChunks(items, chunkSize, processFn) {
  const results = [];
  
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
export function optimizeFirebaseQuery(query, pageSize = 20) {
  // Add pagination and limits to Firebase queries to prevent timeouts
  return query.limit(pageSize);
}