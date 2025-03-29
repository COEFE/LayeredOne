import { NextRequest, NextResponse } from 'next/server';
import { auth, storage, db } from '@/firebase/admin-config';
import { v4 as uuidv4 } from 'uuid';
import { createStoragePath } from '@/utils/firebase-path-utils';
import { handleStaticAuthForAPI } from '@/utils/optimizations/static-export-middleware';

// For API route configuration, we need to use a static value
// Set to error for GitHub Pages compatibility
export const dynamic = 'error';

// Instead of trying to import modules that might fail at build time,
// use the pre-initialized admin SDK objects exported from admin-config.ts

// Simplified implementation for serverTimestamp
const FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

// Configure maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// CORS headers to use in responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Handles OPTIONS requests for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  console.log('OPTIONS request received for CORS preflight');
  
  return new NextResponse(null, {
    status: 204, // No content
    headers: corsHeaders,
  });
}

/**
 * Handles file uploads to Firebase Storage
 * This endpoint accepts multipart/form-data POST requests with a file field
 */
export async function POST(request: NextRequest) {
  // Log detailed request information for debugging
  console.log('Upload API route called with method:', request.method);
  console.log('Request headers:', Object.fromEntries([...request.headers.entries()]));
  console.log('Origin:', request.headers.get('origin'));
  
  console.log('Upload API route called');
  
  try {
    // Use the authentication middleware
    const { token } = handleStaticAuthForAPI(request);
    
    // For normal operation, verify the auth token
    if (!token) {
      console.log('Missing auth token');
      // Return a more informative error message with debugging info
      return NextResponse.json({ 
        error: 'Unauthorized - Missing token',
        details: 'No authentication token was provided in the Authorization header',
        isVercelDeployment: process.env.VERCEL === 'true' || process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true',
        deploymentType: process.env.VERCEL ? 'Vercel' : 'Unknown',
        requestInfo: {
          method: request.method,
          url: request.url,
          hasAuth: !!request.headers.get('authorization'),
          contentType: request.headers.get('content-type')
        }
      }, { 
        status: 401,
        headers: corsHeaders
      });
    }
    
    // Reject mock tokens that are used only for development but won't work in production
    if (token === 'localhost-mock-token' || token === 'fallback-mock-token' || token === 'vercel-auth-missing-token') {
      console.log('Invalid token type detected:', token);
      return NextResponse.json({ 
        error: 'Unauthorized - Invalid token',
        details: 'Development/mock tokens cannot be used for authenticated operations in production',
        recommendation: 'Please sign in properly before attempting this operation'
      }, { 
        status: 401,
        headers: corsHeaders 
      });
    }
    
    let userId: string;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('Authenticated user:', userId);
    } catch (error) {
      console.error('Invalid auth token:', error);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { 
        status: 401,
        headers: corsHeaders
      });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string || file.name;
    const contentType = formData.get('contentType') as string || file.type;
    const folderId = formData.get('folderId') as string || null;
    const folderPath = formData.get('folderPath') as string || '';
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json({ error: 'No file provided' }, { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      console.log('File too large:', file.size);
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      }, { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    console.log('Processing file upload:', {
      filename,
      contentType,
      size: file.size,
      folderId: folderId || 'none',
      folderPath: folderPath || 'none'
    });
    
    // Generate a document ID
    const documentId = uuidv4();
    
    // Create a unique filename to avoid collisions
    const safeFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const uniqueId = documentId.substring(0, 8);
    
    // Create standard storage path using our utility
    const filePath = `documents/${userId}/${timestamp}_${uniqueId}_${safeFileName}`;
    
    // Keep consistent storage path reference
    const storageRef = filePath;
    
    // Get file buffer
    const buffer = await file.arrayBuffer();
    
    // Upload to Firebase Storage using Admin SDK with better error handling
    try {
      console.log(`Uploading file to Firebase Storage: ${filePath}`);
      console.log(`Firebase Storage bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app'}`);
      
      const fileRef = storage.bucket().file(filePath);
      
      await fileRef.save(Buffer.from(buffer), {
        metadata: {
          contentType: contentType,
          metadata: {
            firebaseStorageDownloadTokens: uniqueId,
            documentId, // Store document ID in metadata for easier lookup
            userId,      // Store user ID in metadata for security verification
          }
        }
      });
      
      console.log(`Successfully uploaded file to path: ${filePath}`);
    } catch (uploadError) {
      console.error('Error uploading to Firebase Storage:', uploadError);
      
      // Check for specific authentication errors
      if (uploadError.message?.includes('default credentials') || 
          uploadError.message?.includes('authentication')) {
        throw new Error(`Firebase authentication error: Please check that your service account credentials are correctly configured. ${uploadError.message}`);
      }
      
      throw uploadError;
    }
    
    // Declare fileRef outside the try block so it's accessible in the URL generation
    let fileRef;
    try {
      fileRef = storage.bucket().file(filePath);
    } catch (error) {
      console.error('Error accessing bucket:', error);
      throw new Error(`Failed to access storage bucket: ${error.message}`);
    }
    
    // Get a signed URL with longer expiration
    let downloadURL;
    try {
      console.log('Generating signed URL for file access...');
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      downloadURL = url;
      console.log('Generated signed URL successfully');
    } catch (urlError) {
      console.error('Error generating signed URL:', urlError);
      
      // If we can't get a signed URL, use a direct Firebase Storage URL as fallback
      // This is not ideal but better than failing completely
      downloadURL = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/${encodeURIComponent(filePath)}`;
      console.log('Using fallback direct storage URL');
      
      // If we detect a credentials issue, throw a more descriptive error
      if (urlError.message?.includes('default credentials') || 
          urlError.message?.includes('authentication')) {
        throw new Error(`Firebase authentication error: Unable to generate signed URL. Please check your service account credentials. ${urlError.message}`);
      }
    }
    
    console.log('File uploaded successfully, URL:', downloadURL);
    
    // Save document metadata to Firestore with document ID
    const docRef = db.collection('documents').doc(documentId);
    await docRef.set({
      id: documentId,
      userId: userId,
      name: filename,
      type: contentType,
      contentType: contentType, // Duplicate field for backward compatibility
      size: file.size,
      url: downloadURL,
      path: filePath,           // Keep for backward compatibility
      storageRef: storageRef,   // New field for direct storage reference
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processed: false,
      processing: false,
      folderId: folderId || null,
      folderPath: folderPath || null
    });
    
    console.log('Document metadata saved to Firestore, ID:', documentId);
    
    // Return success response with file URL and document ID, including CORS headers
    return NextResponse.json({
      success: true,
      url: downloadURL,
      documentId: documentId,
      filename,
      contentType,
      size: file.size,
      storageRef
    }, {
      headers: corsHeaders
    });
    
  } catch (error: any) {
    console.error('Error processing upload:', error);
    
    // Determine if this is a Firebase auth/credentials error
    const isCredentialsError = error.message?.includes('default credentials') || 
                              error.message?.includes('authentication') ||
                              error.message?.includes('Firebase') ||
                              error.message?.includes('service account');
    
    // Create a more user-friendly error message for credential issues
    let errorMessage;
    let errorDetails;
    
    if (isCredentialsError) {
      errorMessage = 'Firebase authentication error: Your Firebase service account credentials are not properly configured.';
      errorDetails = `Please check the .env.local file to ensure FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL are correctly set. Original error: ${error.message}`;
      
      // Log specific guidance
      console.error('Firebase Credentials Error Detected!');
      console.error('1. Check that .env.local contains the correct FIREBASE_PRIVATE_KEY');
      console.error('2. Ensure FIREBASE_CLIENT_EMAIL is properly set');
      console.error('3. Verify NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET points to a valid bucket');
    } else {
      errorMessage = `Failed to upload file: ${error.message}`;
      errorDetails = error.toString();
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails,
      isCredentialsError: isCredentialsError
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}