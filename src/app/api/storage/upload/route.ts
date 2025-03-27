import { NextRequest, NextResponse } from 'next/server';
import { auth, storage, db } from '@/firebase/admin-config';
import { v4 as uuidv4 } from 'uuid';

// Instead of trying to import modules that might fail at build time,
// use the pre-initialized admin SDK objects exported from admin-config.ts

// Simplified implementation for serverTimestamp
const FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

// Configure maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Handles file uploads to Firebase Storage
 * This endpoint accepts multipart/form-data POST requests with a file field
 */
export async function POST(request: NextRequest) {
  console.log('Upload API route called');
  
  try {
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
    } catch (error) {
      console.error('Invalid auth token:', error);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string || file.name;
    const contentType = formData.get('contentType') as string || file.type;
    const folderId = formData.get('folderId') as string || null;
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      console.log('File too large:', file.size);
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      }, { status: 400 });
    }
    
    console.log('Processing file upload:', {
      filename,
      contentType,
      size: file.size,
      folderId: folderId || 'none'
    });
    
    // Create a unique filename to avoid collisions
    const safeFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const filePath = `documents/${userId}/${timestamp}_${uniqueId}_${safeFileName}`;
    
    // Get file buffer
    const buffer = await file.arrayBuffer();
    
    // Upload to Firebase Storage using Admin SDK
    const fileRef = storage.bucket().file(filePath);
    
    await fileRef.save(Buffer.from(buffer), {
      metadata: {
        contentType: contentType,
        metadata: {
          firebaseStorageDownloadTokens: uniqueId,
        }
      }
    });
    
    // Get the download URL
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    }/o/${encodeURIComponent(filePath)}?alt=media&token=${uniqueId}`;
    
    console.log('File uploaded successfully, URL:', downloadURL);
    
    // Save document metadata to Firestore
    const docRef = await db.collection('documents').add({
      userId: userId,
      name: filename,
      type: contentType,
      size: file.size,
      url: downloadURL,
      path: filePath,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processed: false,
      processing: false,
      folderId: folderId || null
    });
    
    console.log('Document metadata saved to Firestore, ID:', docRef.id);
    
    // Return success response with file URL and document ID
    return NextResponse.json({
      success: true,
      url: downloadURL,
      documentId: docRef.id,
      filename,
      contentType,
      size: file.size
    });
    
  } catch (error: any) {
    console.error('Error processing upload:', error);
    
    return NextResponse.json({ 
      error: `Failed to upload file: ${error.message}`,
      details: error.toString()
    }, { status: 500 });
  }
}