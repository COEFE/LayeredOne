import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/admin-config';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

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
    const { filename, contentType } = body;
    
    if (!filename || !contentType) {
      return NextResponse.json({ 
        error: 'Missing required fields (filename, contentType)' 
      }, { status: 400 });
    }
    
    // Create a unique filename to avoid collisions
    const safeFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const filePath = `documents/${userId}/${timestamp}_${uniqueId}_${safeFileName}`;
    
    // Generate a signed URL for uploading
    const adminStorage = getStorage();
    const fileRef = adminStorage.bucket().file(filePath);
    
    // Generate a signed URL that expires in 10 minutes
    const [url] = await fileRef.getSignedUrl({
      action: 'write',
      expires: Date.now() + 1000 * 60 * 10, // 10 minutes
      contentType: contentType,
    });
    
    return NextResponse.json({ 
      url, 
      filePath,
      expiresAt: Date.now() + 1000 * 60 * 10
    });
    
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    
    return NextResponse.json({ 
      error: `Failed to generate signed URL: ${error.message}`
    }, { status: 500 });
  }
}