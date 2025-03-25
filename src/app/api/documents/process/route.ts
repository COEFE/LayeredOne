import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin-config';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { extractTextFromExcel } from '@/utils/excelExtractor';
import { extractTextFromPDF } from '@/utils/pdfExtractor';

// Debug flag
const DEBUG = process.env.NODE_ENV === 'development' || true;

/**
 * Process a document that has been uploaded to Firebase Storage
 * Extracts text and metadata based on document type
 */
export async function POST(request: NextRequest) {
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
        contentType.includes('sheet')) {
      // Process Excel file
      console.log('Processing Excel document...');
      extractedText = await extractTextFromExcel(fileBuffer);
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
    await documentRef.update({
      extractedText: extractedText,
      processed: true,
      processingComplete: true,
      updatedAt: FieldValue.serverTimestamp(),
      processingError: null
    });

    console.log(`Document ${documentId} processed successfully`);

    return NextResponse.json({ 
      success: true,
      documentId: documentId,
      contentType: contentType,
      extracted: !!extractedText
    });

  } catch (error: any) {
    console.error("Error processing document:", error);
    return NextResponse.json(
      { error: `Error processing document: ${error.message}` },
      { status: 500 }
    );
  }
}