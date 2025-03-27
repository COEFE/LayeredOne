import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/admin-config';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

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
    const { filePath, documentId, url: fileUrl } = body;
    
    if (documentId) {
      // If we have a documentId, get the file info from Firestore
      try {
        console.log('Looking up document in Firestore:', documentId);
        const db = getFirestore();
        const docRef = db.collection('documents').doc(documentId);
        const docSnapshot = await docRef.get();
        
        if (!docSnapshot.exists) {
          return NextResponse.json({ error: 'Document not found in Firestore' }, { status: 404 });
        }
        
        const docData = docSnapshot.data();
        
        // Verify the user has access to this document
        if (docData?.userId !== userId) {
          return NextResponse.json({ error: 'Unauthorized - You do not have access to this document' }, { status: 403 });
        }
        
        // Most reliable: check if storageRef exists in document data
        if (docData?.storageRef) {
          console.log('Found storage reference in document:', docData.storageRef);
          const adminStorage = getStorage();
          const fileRef = adminStorage.bucket().file(docData.storageRef);
          
          // Generate a signed URL with a longer expiration (24 hours)
          const [downloadUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
          });
          
          return NextResponse.json({ url: downloadUrl });
        }
        
        // If no storageRef, try using the file name
        if (docData?.name) {
          console.log('Using document name as reference:', docData.name);
          const adminStorage = getStorage();
          // Construct a plausible path for the file
          const possiblePath = `documents/${documentId}`;
          console.log('Trying path:', possiblePath);
          
          const fileRef = adminStorage.bucket().file(possiblePath);
          
          try {
            // Check if file exists
            const [exists] = await fileRef.exists();
            if (!exists) {
              return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
            }
            
            // Generate a signed URL with a longer expiration
            const [downloadUrl] = await fileRef.getSignedUrl({
              action: 'read',
              expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
            });
            
            return NextResponse.json({ url: downloadUrl });
          } catch (storageError) {
            console.error('Error checking file existence:', storageError);
          }
        }
      } catch (firestoreError) {
        console.error('Error fetching document from Firestore:', firestoreError);
      }
    }
    
    // If we get here, we couldn't get the reference from Firestore
    // Fallback to provided filePath or try to extract from URL
    
    // Try to parse storage path from URL (most URLs contain /o/ followed by the path)
    let effectiveFilePath = filePath;
    
    if (!effectiveFilePath && fileUrl) {
      console.log('Attempting to extract file path from URL:', fileUrl);
      
      try {
        // Firebase Storage URLs often have a pattern like:
        // https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/ENCODED_FILE_PATH?alt=media&token=TOKEN
        const urlObj = new URL(fileUrl);
        const pathname = urlObj.pathname;
        
        // If the URL has /o/ in the path, extract the file path
        if (pathname.includes('/o/')) {
          const parts = pathname.split('/o/');
          if (parts.length > 1) {
            effectiveFilePath = decodeURIComponent(parts[1]);
            console.log('Extracted file path from URL:', effectiveFilePath);
          }
        }
      } catch (urlError) {
        console.error('Error parsing URL:', urlError);
      }
    }
    
    if (!effectiveFilePath) {
      return NextResponse.json({ error: 'Could not determine file path from provided information' }, { status: 400 });
    }
    
    console.log('Using file path:', effectiveFilePath);
    
    // Generate a download URL
    const adminStorage = getStorage();
    const fileRef = adminStorage.bucket().file(effectiveFilePath);
    
    // Check if file exists
    try {
      const [exists] = await fileRef.exists();
      if (!exists) {
        return NextResponse.json({ error: 'File not found in storage at path: ' + effectiveFilePath }, { status: 404 });
      }
      
      // Generate a signed URL with a longer expiration (24 hours)
      console.log('Generating signed URL for file:', effectiveFilePath);
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
      });
      
      console.log('Successfully generated signed URL');
      return NextResponse.json({ url });
    } catch (storageError) {
      console.error('Error accessing file in storage:', storageError);
      return NextResponse.json({ 
        error: `Failed to access file in storage: ${storageError.message}`
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error generating download URL:', error);
    
    return NextResponse.json({ 
      error: `Failed to generate download URL: ${error.message}`
    }, { status: 500 });
  }
}