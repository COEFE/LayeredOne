import { NextRequest, NextResponse } from 'next/server';
import { auth, db, admin, firestorePath } from '@/firebase/admin-config';
import { extractTextFromExcel } from '@/utils/excelExtractor';
import { extractTextFromPDF } from '@/utils/pdfExtractor';
import withTimeout, { processInChunks } from '@/utils/optimizations/timeout-middleware';

// Create a safe FieldValue for Vercel compatibility
const isVercel = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true';

// Declare FieldValue type to be compatible with both real and mock implementations
let FieldValue: any = {
  serverTimestamp: () => new Date().toISOString()
};

// Define a safe getDataWithCache function
const getDataWithCache = async (collectionPath: string, docId: string) => {
  try {
    const doc = await db.collection(collectionPath).doc(docId).get();
    return doc.data();
  } catch (error) {
    console.error(`Error getting data for ${collectionPath}/${docId}:`, error);
    return null;
  }
};

// Function to get Storage instance with fallback
const getStorage = () => {
  try {
    return admin.storage();
  } catch (error) {
    console.error('Error getting Storage:', error);
    return {
      bucket: () => ({
        file: () => ({
          getSignedUrl: async () => ['https://example.com/mock-url'],
          exists: async () => [true],
          download: async () => [Buffer.from('mock file content')]
        })
      })
    };
  }
};

// Debug flag
const DEBUG = process.env.NODE_ENV === 'development' || true;

/**
 * Process a document that has been uploaded to Firebase Storage
 * Extracts text and metadata based on document type
 */
async function handler(request: NextRequest) {
  try {
    console.log("Document processing API route called");

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
    
    // Record the start time for performance tracking
    const startTime = Date.now();

    // Parse request body
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ 
        error: "Missing required parameter: documentId" 
      }, { status: 400 });
    }

    // Get document data from Firestore using cached version
    const documentData = await getDataWithCache('documents', documentId);

    if (!documentData) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if the user has access to this document
    if (documentData?.userId !== userId) {
      return NextResponse.json({ error: "You don't have permission to access this document" }, { status: 403 });
    }

    // Get document details
    const fileName = documentData.name || '';
    const contentType = documentData.type || documentData.contentType || 'application/octet-stream';
    const fileUrl = documentData.url || '';
    
    if (!fileUrl) {
      return NextResponse.json({ error: "Document URL not found" }, { status: 404 });
    }

    // Download the file from Firebase Storage
    const storage = getStorage();
    const bucket = storage.bucket();
    
    // Extract the file path from the URL
    const fileUrlObj = new URL(fileUrl);
    const filePath = decodeURIComponent(fileUrlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
    
    if (!filePath) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }

    console.log(`Downloading file from: ${filePath}`);
    const fileRef = bucket.file(filePath);
    const [fileExists] = await fileRef.exists();
    
    if (!fileExists) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    // Download the file
    const [fileBuffer] = await fileRef.download();
    console.log(`Downloaded file: ${fileName}, size: ${fileBuffer.length} bytes`);

    // Process the file based on its content type
    let extractedText = '';

    if (contentType.includes('spreadsheet') || 
        contentType.includes('excel') || 
        fileName.endsWith('.xlsx') || 
        fileName.endsWith('.xls') ||
        contentType.includes('sheet') ||
        contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        contentType === 'application/vnd.ms-excel' ||
        contentType === 'text/csv') {
      // Process Excel file with retry mechanism
      console.log('Processing Excel document...');
      
      // Try up to 3 times
      let attempts = 0;
      let lastError;
      
      while (attempts < 3) {
        try {
          console.log(`Excel processing attempt ${attempts + 1}/3...`);
          extractedText = await extractTextFromExcel(fileBuffer);
          
          // If we get here, the extraction succeeded
          console.log(`Excel extraction succeeded on attempt ${attempts + 1}`);
          break;
        } catch (err) {
          lastError = err;
          console.error(`Excel extraction attempt ${attempts + 1} failed:`, err);
          attempts++;
          
          // Wait a second before trying again
          if (attempts < 3) {
            console.log('Waiting 1s before retry...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // If all attempts failed, rethrow the last error
      if (!extractedText && lastError) {
        console.error('All Excel extraction attempts failed');
        throw lastError;
      }
    } 
    else if (contentType.includes('pdf') || 
             fileName.toLowerCase().endsWith('.pdf')) {
      // Process PDF file
      console.log('Processing PDF document...');
      extractedText = await extractTextFromPDF(fileBuffer);
    }
    else {
      // For other file types - return a message that we can't process this type yet
      return NextResponse.json({ 
        error: "Unsupported file type. Currently only Excel and PDF files are supported." 
      }, { status: 400 });
    }

    // Update the document with extracted text
    const documentRef = db.collection('documents').doc(documentId);
    await documentRef.update({
      extractedText: extractedText,
      processed: true,
      processingComplete: true,
      updatedAt: FieldValue.serverTimestamp(),
      processingError: null
    });

    // Calculate processing time
    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;
    
    console.log(`Document ${documentId} processed successfully in ${processingTimeMs}ms`);

    return NextResponse.json({ 
      success: true,
      documentId: documentId,
      contentType: contentType,
      extracted: !!extractedText,
      processingTimeMs
    });

  } catch (error: any) {
    console.error("Error processing document:", error);
    
    // Update the document with error information
    try {
      const documentRef = db.collection('documents').doc(documentId);
      await documentRef.update({
        processed: false,
        processingComplete: true,  // Mark as complete to prevent infinite retries
        updatedAt: FieldValue.serverTimestamp(),
        processingError: error.message || 'Unknown error'
      });
      console.log(`Updated document ${documentId} with error information`);
    } catch (updateError) {
      console.error('Failed to update document with error information:', updateError);
    }
    
    return NextResponse.json(
      { error: `Error processing document: ${error.message}` },
      { status: 500 }
    );
  }
}

// Export with timeout wrapper - 60 second timeout for document processing
// Excel files may need more time to process, especially larger ones
export const POST = withTimeout(handler, 60000);