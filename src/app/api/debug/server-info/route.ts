import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import process from 'process';
import { auth } from '@/firebase/admin-config';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// For the basic server info GET request, keep it static
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

// Add a document debug endpoint - this needs to be dynamic
export const dynamicParams = true;

// Add a document debug endpoint
export async function POST(request: NextRequest) {
  try {
    // Verify authentication token
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    
    let userId: string;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (error) {
      console.error('Invalid auth token:', error);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();
    const { documentId } = body;
    
    if (!documentId) {
      return NextResponse.json({ error: 'No document ID provided' }, { status: 400 });
    }
    
    // Get document data from Firestore
    const db = getFirestore();
    const docRef = db.collection('documents').doc(documentId);
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    const docData = docSnapshot.data();
    
    // Verify the user has access to this document
    if (docData?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized - You do not have access to this document' }, { status: 403 });
    }
    
    // Add storage bucket info
    const storage = getStorage();
    const bucketName = storage.bucket().name;
    
    // Try different storage paths
    const possiblePaths = [
      `documents/${documentId}`,
      `${documentId}`,
      docData?.name ? `documents/${docData.name}` : null,
      docData?.storageRef || null
    ].filter(Boolean);
    
    // Check if any of these paths exist
    const pathResults = await Promise.all(
      possiblePaths.map(async (path) => {
        try {
          if (!path) return { path, exists: false, error: 'No path' };
          
          const fileRef = storage.bucket().file(path);
          const [exists] = await fileRef.exists();
          
          if (exists) {
            // Try to generate a signed URL
            try {
              const [url] = await fileRef.getSignedUrl({
                action: 'read',
                expires: Date.now() + 1000 * 60 * 60, // 1 hour
              });
              
              return { path, exists, url };
            } catch (urlError) {
              return { path, exists, error: urlError.message };
            }
          }
          
          return { path, exists };
        } catch (pathError) {
          return { path, error: pathError.message };
        }
      })
    );
    
    // Return document data and storage info
    return NextResponse.json({
      documentId,
      docData,
      storage: {
        bucketName,
        paths: pathResults
      }
    });
    
  } catch (error: any) {
    console.error('Error debugging document:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}