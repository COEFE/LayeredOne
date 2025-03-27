import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/admin-config';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { 
  extractStoragePathFromUrl, 
  extractDocumentId, 
  getPotentialStoragePaths 
} from '@/utils/firebase-path-utils';

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
    const { filePath, documentId: providedDocId, url: fileUrl } = body;
    
    // Try to get document ID from provided ID or extract from URL 
    const documentId = providedDocId || (fileUrl ? extractDocumentId(fileUrl) : null);
    
    // Initialize required services
    const db = getFirestore();
    const adminStorage = getStorage();
    const bucket = adminStorage.bucket();
    
    // Keep track of attempted paths for logging
    const attemptedPaths: string[] = [];
    
    // Approach 1: If we have a document ID, get the file info from Firestore (most reliable)
    if (documentId) {
      try {
        console.log('Looking up document in Firestore:', documentId);
        const docRef = db.collection('documents').doc(documentId);
        const docSnapshot = await docRef.get();
        
        if (docSnapshot.exists) {
          const docData = docSnapshot.data();
          
          // Verify the user has access to this document
          if (docData?.userId !== userId) {
            return NextResponse.json({ 
              error: 'Unauthorized - You do not have access to this document' 
            }, { status: 403 });
          }
          
          // First option: Use storageRef field if available (most reliable)
          if (docData?.storageRef) {
            console.log('Using storageRef from document:', docData.storageRef);
            const fileRef = bucket.file(docData.storageRef);
            
            try {
              // Check if file exists
              const [exists] = await fileRef.exists();
              if (exists) {
                // Generate a signed URL with a longer expiration (7 days)
                const [downloadUrl] = await fileRef.getSignedUrl({
                  action: 'read',
                  expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                });
                
                // Cache the successful URL for telemetry
                console.log('URL refresh successful using document storageRef');
                
                // Store the URL in localStorage as a backup via the response
                return NextResponse.json({ 
                  url: downloadUrl, 
                  storageRef: docData.storageRef,
                  shouldCache: true
                });
              }
              
              // If file doesn't exist at the storageRef path, this is unusual
              console.warn('File not found at storageRef path:', docData.storageRef);
              attemptedPaths.push(docData.storageRef);
            } catch (storageError) {
              console.error('Error accessing file using storageRef:', storageError);
            }
          }
          
          // Second option: Use path field for backward compatibility
          if (docData?.path && docData.path !== docData.storageRef) {
            console.log('Using path from document:', docData.path);
            const fileRef = bucket.file(docData.path);
            
            try {
              // Check if file exists
              const [exists] = await fileRef.exists();
              if (exists) {
                // Generate a signed URL with a longer expiration
                const [downloadUrl] = await fileRef.getSignedUrl({
                  action: 'read',
                  expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                });
                
                // Update the document with the correct storageRef if it was missing
                if (!docData.storageRef) {
                  await docRef.update({
                    storageRef: docData.path
                  });
                  console.log('Updated document with storageRef field:', docData.path);
                }
                
                console.log('URL refresh successful using document path');
                return NextResponse.json({ 
                  url: downloadUrl, 
                  storageRef: docData.path,
                  shouldCache: true
                });
              }
              
              attemptedPaths.push(docData.path);
            } catch (pathError) {
              console.error('Error accessing file using path:', pathError);
            }
          }
          
          // Third option: Try potential storage paths based on document ID and user ID
          const potentialPaths = getPotentialStoragePaths(documentId, userId);
          console.log('Trying potential storage paths:', potentialPaths);
          
          for (const path of potentialPaths) {
            // Skip if we already tried this path
            if (attemptedPaths.includes(path)) continue;
            
            console.log('Checking potential path:', path);
            const fileRef = bucket.file(path);
            
            try {
              // For wildcard paths, we need to list files
              if (path.includes('*')) {
                const [files] = await bucket.getFiles({ 
                  prefix: path.split('*')[0],
                  maxResults: 5
                });
                
                if (files.length > 0) {
                  // Try each file that matches the pattern
                  for (const file of files) {
                    const [exists] = await file.exists();
                    if (exists) {
                      const [downloadUrl] = await file.getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                      });
                      
                      // Found a matching file, update the document with the correct storageRef
                      await docRef.update({
                        storageRef: file.name
                      });
                      console.log('Updated document with found storageRef:', file.name);
                      
                      console.log('URL refresh successful using matched file:', file.name);
                      return NextResponse.json({ 
                        url: downloadUrl, 
                        storageRef: file.name,
                        shouldCache: true
                      });
                    }
                  }
                }
              } else {
                // Check if the exact path exists
                const [exists] = await fileRef.exists();
                if (exists) {
                  // Generate a signed URL
                  const [downloadUrl] = await fileRef.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                  });
                  
                  // Update the document with the correct storageRef
                  await docRef.update({
                    storageRef: path
                  });
                  console.log('Updated document with found storageRef:', path);
                  
                  console.log('URL refresh successful using potential path:', path);
                  return NextResponse.json({ 
                    url: downloadUrl, 
                    storageRef: path,
                    shouldCache: true
                  });
                }
              }
              
              attemptedPaths.push(path);
            } catch (potentialPathError) {
              console.error(`Error checking potential path ${path}:`, potentialPathError);
            }
          }
        } else {
          console.log('Document not found in Firestore:', documentId);
        }
      } catch (firestoreError) {
        console.error('Error fetching document from Firestore:', firestoreError);
      }
    }
    
    // Approach 2: If we get here, we couldn't get a valid path from Firestore
    // Try the provided filePath or extract from URL
    
    let effectiveFilePath = filePath;
    
    // Extract storage path from URL if available and we don't have a direct path
    if (!effectiveFilePath && fileUrl) {
      console.log('Attempting to extract storage path from URL:', fileUrl);
      effectiveFilePath = extractStoragePathFromUrl(fileUrl);
      
      if (effectiveFilePath) {
        console.log('Extracted storage path from URL:', effectiveFilePath);
      }
    }
    
    // If we found a path to try, use it
    if (effectiveFilePath) {
      console.log('Using extracted file path:', effectiveFilePath);
      
      const fileRef = bucket.file(effectiveFilePath);
      
      try {
        // Check if file exists
        const [exists] = await fileRef.exists();
        if (exists) {
          // Generate a signed URL
          const [url] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          });
          
          // If we have a document ID, update it with this path
          if (documentId) {
            try {
              const docRef = db.collection('documents').doc(documentId);
              const docSnapshot = await docRef.get();
              
              if (docSnapshot.exists) {
                await docRef.update({
                  storageRef: effectiveFilePath
                });
                console.log('Updated document with found storageRef:', effectiveFilePath);
              }
            } catch (updateError) {
              console.error('Error updating document with storage path:', updateError);
            }
          }
          
          console.log('URL refresh successful using extracted path');
          return NextResponse.json({ 
            url, 
            storageRef: effectiveFilePath,
            shouldCache: true 
          });
        } else {
          console.log('File not found at extracted path:', effectiveFilePath);
        }
      } catch (storageError) {
        console.error('Error accessing file using extracted path:', storageError);
      }
    }
    
    // If we get here, all refresh methods failed
    console.error('All URL refresh methods failed. Attempted paths:', attemptedPaths);
    
    return NextResponse.json({ 
      error: 'Could not find the file in storage. Please try again or contact support.',
      attemptedPaths
    }, { status: 404 });
  } catch (error: any) {
    console.error('Error generating download URL:', error);
    
    return NextResponse.json({ 
      error: `Failed to generate download URL: ${error.message}`
    }, { status: 500 });
  }
}