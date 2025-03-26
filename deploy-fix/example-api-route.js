// Example optimized API route using the timeout middleware
import withTimeout from './timeout-middleware';
import { getDataWithCache } from './firebase-config';

// Main handler with Firebase optimizations
async function handler(req, res) {
  try {
    // Use the cache-enabled Firebase access
    const data = await getDataWithCache('documents', req.query.id);
    
    if (!data) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Return the data
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in API route:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Export with timeout wrapper
export default withTimeout(handler, 5000); // 5-second timeout