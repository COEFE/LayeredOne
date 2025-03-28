import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin-config';

export const dynamic = 'force-static';

// Define FieldValue with serverTimestamp for compatibility
const FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

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

    // Get document data from Firestore using pre-initialized db from admin-config
    const documentRef = db.collection('documents').doc(documentId);
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
    // Get the base URL (origin) from the request
    const origin = request.headers.get('x-forwarded-host') || 
                  request.headers.get('host') || 
                  'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    
    // Construct a more reliable URL
    const baseUrl = `${protocol}://${origin}`;
    const processingUrl = `${baseUrl}/api/documents/process`;
    
    console.log(`Calling document processing API at: ${processingUrl}`);
    
    try {
      const processingResponse = await fetch(processingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documentId })
      });
      
      // Check if the response is OK before trying to parse JSON
      if (!processingResponse.ok) {
        console.error(`Processing API returned status ${processingResponse.status}`);
        // Try to get the response text for debugging
        const responseText = await processingResponse.text();
        console.error(`Response body: ${responseText.substring(0, 500)}...`);
        
        // Check if it looks like HTML (containing the < character)
        if (responseText.includes('<')) {
          return NextResponse.json({
            error: `Document processing failed with status ${processingResponse.status}. Server may have timed out.`
          }, { status: 500 });
        }
        
        // Try to parse as JSON if possible
        try {
          const errorData = JSON.parse(responseText);
          return NextResponse.json(errorData, { status: processingResponse.status });
        } catch {
          // If parsing fails, return a generic error
          return NextResponse.json({
            error: `Document processing failed with status ${processingResponse.status}`
          }, { status: processingResponse.status });
        }
      }
      
      // If response is OK, parse the JSON
      const result = await processingResponse.json();
      return NextResponse.json(result, { status: processingResponse.status });
    } catch (fetchError) {
      console.error('Fetch error in document processing:', fetchError);
      return NextResponse.json({
        error: `Error connecting to document processing API: ${fetchError.message}`
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Error reprocessing document:", error);
    return NextResponse.json(
      { error: `Error reprocessing document: ${error.message}` },
      { status: 500 }
    );
  }
}