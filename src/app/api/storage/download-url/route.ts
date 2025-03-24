import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/admin-config';
import { getStorage } from 'firebase-admin/storage';

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
    const { filePath } = body;
    
    if (!filePath) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }
    
    // Generate a download URL
    const adminStorage = getStorage();
    const fileRef = adminStorage.bucket().file(filePath);
    
    // Generate a signed URL that expires in 1 hour
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60, // 1 hour
    });
    
    return NextResponse.json({ url });
    
  } catch (error: any) {
    console.error('Error generating download URL:', error);
    
    return NextResponse.json({ 
      error: `Failed to generate download URL: ${error.message}`
    }, { status: 500 });
  }
}