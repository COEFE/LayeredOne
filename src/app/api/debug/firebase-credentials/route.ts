import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKeyFromEnv } from '@/firebase/key-helpers';

/**
 * This API route provides diagnostic information about Firebase credentials
 * for debugging authentication issues.
 */
export const dynamic = 'force-static';
export async function GET(request: NextRequest) {
  try {
    // Check for environment variables
    const envVars = {
      // Check which Firebase environment variables are set (without showing values)
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set',
      FIREBASE_PRIVATE_KEY_BASE64: process.env.FIREBASE_PRIVATE_KEY_BASE64 ? 'Set' : 'Not set',
      FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID ? 'Set' : 'Not set',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Not set',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'Set' : 'Not set',
    };

    // Try processing the private key
    let privateKeyInfo = {
      retrieved: false,
      hasBase64: !!process.env.FIREBASE_PRIVATE_KEY_BASE64,
      hasStandard: !!process.env.FIREBASE_PRIVATE_KEY,
      hasBeginMarker: false,
      hasEndMarker: false,
      length: 0
    };

    try {
      const privateKey = getPrivateKeyFromEnv();
      if (privateKey) {
        privateKeyInfo.retrieved = true;
        privateKeyInfo.hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----');
        privateKeyInfo.hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----');
        privateKeyInfo.length = privateKey.length;
      }
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        message: 'Error processing private key',
        error: error.message,
        envVars
      });
    }

    // Try to initialize Firebase Admin - in admin-config we have a lot of fallbacks,
    // so let's try to initialize here separately to see if it works
    let firebaseInitResult = { 
      success: false, 
      message: 'Not attempted'
    };

    try {
      // Dynamic import to avoid build issues
      const admin = require('firebase-admin');
      
      // Only try to initialize if not already initialized
      if (admin.apps.length === 0) {
        const privateKey = getPrivateKeyFromEnv();
        if (!privateKey) {
          firebaseInitResult = {
            success: false,
            message: 'No private key available from environment variables'
          };
        } else {
          const serviceAccount = {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: privateKey
          };
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
          });
          
          // Test accessing Firebase services
          const bucket = admin.storage().bucket();
          const db = admin.firestore();
          
          firebaseInitResult = {
            success: true,
            message: 'Successfully initialized Firebase Admin SDK'
          };
        }
      } else {
        firebaseInitResult = {
          success: true,
          message: 'Firebase Admin SDK already initialized'
        };
      }
    } catch (error: any) {
      firebaseInitResult = {
        success: false,
        message: `Failed to initialize Firebase Admin: ${error.message}`
      };
    }

    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV || 'unknown',
      isVercel: process.env.VERCEL === 'true',
      envVars,
      privateKeyInfo,
      firebaseInitResult
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error in credentials debug endpoint',
      error: error.message
    }, { status: 500 });
  }
}