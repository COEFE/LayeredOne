import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/admin-config';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * API endpoint to trigger reprocessing of an existing document
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Document reprocessing API route called");

    // Verify authentication token
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      console.log('Missing auth token');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    
    let userId: string;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('Authenticated user:', userId);
    } catch (error: any) {
      console.error('Invalid auth token:', error);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ 
        error: "Missing required parameter: documentId" 
      }, { status: 400 });
    }

    // Get document data from Firestore
    const firestore = getFirestore();
    const documentRef = firestore.collection('documents').doc(documentId);
    const documentSnapshot = await documentRef.get();

    if (!documentSnapshot.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const documentData = documentSnapshot.data();

    // Check if the user has access to this document
    if (documentData?.userId !== userId) {
      return NextResponse.json({ error: "You don't have permission to access this document" }, { status: 403 });
    }

    // Make the actual processing request
    const processingUrl = new URL('/api/documents/process', request.url);
    const processingResponse = await fetch(processingUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ documentId })
    });
    
    // Return the processing result
    const result = await processingResponse.json();
    return NextResponse.json(result, { status: processingResponse.status });

  } catch (error: any) {
    console.error("Error reprocessing document:", error);
    return NextResponse.json(
      { error: `Error reprocessing document: ${error.message}` },
      { status: 500 }
    );
  }
}