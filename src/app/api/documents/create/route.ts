import { NextRequest, NextResponse } from 'next/server';
import { auth, storage, db } from '@/firebase/admin-config';
import { v4 as uuidv4 } from 'uuid';
import { createBlankExcel, createTemplateExcel } from '@/utils/excelCreator';
import { createStoragePath } from '@/utils/firebase-path-utils';

export const dynamic = 'force-static';

// Define FieldValue with serverTimestamp for compatibility
const FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

// Debug flag for detailed logging
const DEBUG = process.env.NODE_ENV === 'development' || true;

/**
 * Creates a new blank document (currently supports Excel)
 * Optimized for serverless environments to avoid FUNCTION_INVOCATION_TIMEOUT
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Document Create API route called");
    
    // Set response headers for better timing
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    
    // Verify authentication token
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      console.log('Missing auth token');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401, headers });
    }
    
    let userId: string;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('Authenticated user:', userId);
    } catch (error: any) {
      console.error('Invalid auth token:', error);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401, headers });
    }
    
    // Parse request body
    const body = await request.json();
    const { 
      documentType = 'excel', 
      documentName = `New Document ${new Date().toLocaleDateString()}`,
      folderPath = '',
      template = false,
      headers: columnHeaders = [],
    } = body;
    
    // Validate document type
    if (documentType !== 'excel') {
      return NextResponse.json({ 
        error: "Invalid document type. Currently only 'excel' is supported." 
      }, { status: 400, headers });
    }
    
    // Create a document ID
    const documentId = uuidv4();
    const fileExtension = documentType === 'excel' ? '.xlsx' : '';
    const safeFileName = documentName.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
    const fileName = `${safeFileName}${fileExtension}`;
    
    // Create storage path using our utility
    const storageRef = createStoragePath(userId, documentId, fileName, folderPath);
    
    console.log(`Creating document: ${documentType}, Path: ${storageRef}`);
    
    // Generate file content based on document type
    let fileBuffer: Buffer;
    
    try {
      console.log('Generating document content...');
      
      // Time the generation for debugging
      const startTime = Date.now();
      
      if (documentType === 'excel') {
        // Create Excel file with optimized approach
        if (template && Array.isArray(columnHeaders) && columnHeaders.length > 0) {
          // Create a template with headers
          fileBuffer = await createTemplateExcel(columnHeaders);
        } else {
          // Create a blank Excel file
          fileBuffer = await createBlankExcel();
        }
      } else {
        throw new Error(`Unsupported document type: ${documentType}`);
      }
      
      const endTime = Date.now();
      console.log(`Document content generated in ${endTime - startTime}ms`);
    } catch (error) {
      console.error('Error generating document content:', error);
      return NextResponse.json({ 
        error: `Failed to create document: ${error instanceof Error ? error.message : String(error)}` 
      }, { status: 500, headers });
    }
    
    // Upload to Firebase Storage with streaming approach to avoid timeout
    try {
      console.log(`Uploading document to storage: ${storageRef}`);
      const startUploadTime = Date.now();
      
      // Use the pre-initialized storage from admin-config
      const bucket = storage.bucket();
      const file = bucket.file(storageRef);
      
      // Set metadata
      const metadata = {
        contentType: documentType === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'application/octet-stream',
        metadata: {
          userId,
          documentId,
          originalName: fileName,
          createdAt: new Date().toISOString()
        }
      };
      
      // Upload file with metadata
      await file.save(fileBuffer, {
        metadata,
        resumable: false // Disable resumable uploads for serverless
      });
      
      // Get the download URL (with signed URL option for quicker response)
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      const endUploadTime = Date.now();
      console.log(`Document uploaded in ${endUploadTime - startUploadTime}ms`);
      
      // Create Firestore document entry using pre-initialized db from admin-config
      const documentRef = db.collection('documents').doc(documentId);
      
      await documentRef.set({
        id: documentId,
        name: documentName,
        fileName,
        type: documentType === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'application/octet-stream',
        contentType: documentType === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'application/octet-stream',
        url,
        storagePath: storageRef, // Keep for backward compatibility
        storageRef,              // Consistent field for storage reference
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        userId,
        folderPath: folderPath || null,
        size: fileBuffer.length,
        processed: true,
        processingComplete: true,
        empty: fileBuffer.length < 1000 // Consider small files as empty templates
      });
      
      // Return success with document info
      return NextResponse.json({
        success: true,
        documentId,
        name: documentName,
        url,
        type: documentType,
        storageRef
      }, { headers });
      
    } catch (storageError) {
      console.error('Error uploading document to storage:', storageError);
      return NextResponse.json({ 
        error: `Failed to upload document: ${storageError instanceof Error ? storageError.message : String(storageError)}` 
      }, { status: 500, headers });
    }
    
  } catch (error: any) {
    console.error("Unhandled error in document create API:", error);
    return NextResponse.json(
      { error: `Error creating document: ${error.message}` },
      { status: 500 }
    );
  }
}