import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKeyFromEnv } from '@/firebase/key-helpers';

/**
 * This API route provides diagnostic information about Firebase credentials
 * for debugging authentication issues.
 */
// Check if this is a static export (GitHub Pages)
const isStaticExport = process.env.GITHUB_PAGES === 'true' || 
                      process.env.STATIC_EXPORT === 'true';
                      
// Set the appropriate dynamic/static mode based on environment
export const dynamic = isStaticExport ? 'force-static' : 'force-dynamic';

// For static export, we need to set revalidate to false
export const revalidate = isStaticExport ? false : 0;

export async function GET(request: NextRequest) {
  // For static exports, return a mock response
  const isStaticExport = process.env.GITHUB_PAGES === 'true' || 
                         process.env.STATIC_EXPORT === 'true';
  
  if (isStaticExport) {
    console.log('Static export detected, returning mock response for Firebase credentials debug');
    return NextResponse.json({
      success: true,
      environment: 'static',
      isStaticExport: true,
      isVercel: false,
      serverInfo: {
        platform: 'static-export',
        nodeVersion: 'n/a'
      },
      envVars: {
        FIREBASE_CLIENT_EMAIL: 'Mock - Not available in static export',
        FIREBASE_PRIVATE_KEY: 'Mock - Not available in static export',
        FIREBASE_PRIVATE_KEY_BASE64: 'Mock - Not available in static export',
        FIREBASE_PRIVATE_KEY_ID: 'Mock - Not available in static export',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'Mock - Not available in static export',
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'Mock - Not available in static export',
        NEXT_PUBLIC_FIREBASE_APP_ID: 'Mock - Not available in static export'
      },
      message: 'This is a mock response for static exports. This API cannot run in static export environments like GitHub Pages.'
    });
  }
  
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
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'Set' : 'Not set'
    };

    // Try processing the private key
    let privateKeyInfo = {
      retrieved: false,
      hasBase64: !!process.env.FIREBASE_PRIVATE_KEY_BASE64,
      hasStandard: !!process.env.FIREBASE_PRIVATE_KEY,
      hasBeginMarker: false,
      hasEndMarker: false,
      containsEscapedNewlines: false,
      containsActualNewlines: false,
      length: 0,
      firstChars: '',
      lastChars: ''
    };

    try {
      // First check the raw env variable format
      if (process.env.FIREBASE_PRIVATE_KEY) {
        const rawKey = process.env.FIREBASE_PRIVATE_KEY;
        privateKeyInfo.hasBeginMarker = rawKey.includes('-----BEGIN PRIVATE KEY-----');
        privateKeyInfo.hasEndMarker = rawKey.includes('-----END PRIVATE KEY-----');
        privateKeyInfo.containsEscapedNewlines = rawKey.includes('\\n');
        privateKeyInfo.containsActualNewlines = rawKey.includes('\n');
        privateKeyInfo.length = rawKey.length;
        privateKeyInfo.firstChars = rawKey.substring(0, 20) + '...';
        privateKeyInfo.lastChars = '...' + rawKey.substring(rawKey.length - 20);
      }

      // Then try the helper function
      const privateKey = getPrivateKeyFromEnv();
      if (privateKey) {
        privateKeyInfo.retrieved = true;
      }
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        message: 'Error processing private key',
        error: error.message,
        envVars,
        privateKeyInfo
      });
    }

    // Test ability to sign and verify JWT tokens - this is what Firebase uses for authentication
    let tokenTestResult = {
      success: false,
      message: 'Not attempted',
      error: null
    };

    try {
      // Dynamic import JWT library for testing token signing
      const jwt = require('jsonwebtoken');
      const privateKey = getPrivateKeyFromEnv();
      
      if (privateKey) {
        // Try to sign a test token
        const testToken = jwt.sign(
          { test: 'data', iat: Math.floor(Date.now() / 1000) }, 
          privateKey, 
          { algorithm: 'RS256' }
        );
        
        // If we got here, signing worked
        tokenTestResult = {
          success: true,
          message: 'Successfully signed test JWT token',
          error: null
        };
      } else {
        tokenTestResult = {
          success: false,
          message: 'No private key available for JWT signing test',
          error: null
        };
      }
    } catch (error: any) {
      tokenTestResult = {
        success: false,
        message: 'Failed to sign JWT token',
        error: error.message
      };
    }

    // Try to initialize Firebase Admin - in admin-config we have a lot of fallbacks,
    // so let's try to initialize here separately to see if it works
    let firebaseInitResult = { 
      success: false, 
      message: 'Not attempted',
      error: null
    };

    // Test Storage specifically - this is where the invalid_grant error occurs
    let storageTestResult = {
      success: false,
      message: 'Not attempted',
      error: null,
      bucketName: null
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
            message: 'No private key available from environment variables',
            error: null
          };
        } else {
          const serviceAccount = {
            type: 'service_account',
            project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441',
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'missing',
            private_key: privateKey,
            client_email: process.env.FIREBASE_CLIENT_EMAIL || 'missing',
            client_id: "",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
              process.env.FIREBASE_CLIENT_EMAIL || "missing"
            )}`
          };
          
          // Initialize with explicit app name to avoid conflicts
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app',
          }, 'debug-app');
          
          firebaseInitResult = {
            success: true,
            message: 'Successfully initialized Firebase Admin SDK',
            error: null
          };
          
          // Now test Storage specifically
          try {
            const storage = admin.storage();
            const bucket = storage.bucket();
            storageTestResult.bucketName = bucket.name;
            
            // Try to create a test file reference
            const testFileRef = bucket.file('debug-test.txt');
            
            // Generate a signed URL - this is where the invalid_grant error happens
            const [signedUrl] = await testFileRef.getSignedUrl({
              action: 'write',
              expires: Date.now() + 5 * 60 * 1000, // 5 minutes
              contentType: 'text/plain',
            });
            
            storageTestResult = {
              success: true,
              message: 'Successfully generated signed URL',
              error: null,
              bucketName: bucket.name
            };
          } catch (storageError: any) {
            storageTestResult = {
              success: false,
              message: 'Failed to access storage or generate signed URL',
              error: storageError.message,
              bucketName: null
            };
          }
        }
      } else {
        firebaseInitResult = {
          success: true,
          message: 'Firebase Admin SDK already initialized',
          error: null
        };
        
        // Try to test storage with existing app
        try {
          const app = admin.apps.find((a: any) => a.name === 'debug-app') || admin.app();
          const storage = admin.storage(app);
          const bucket = storage.bucket();
          storageTestResult.bucketName = bucket.name;
          
          // Try to create a test file reference
          const testFileRef = bucket.file('debug-test.txt');
          
          // Generate a signed URL - this is where the invalid_grant error happens
          const [signedUrl] = await testFileRef.getSignedUrl({
            action: 'write',
            expires: Date.now() + 5 * 60 * 1000, // 5 minutes
            contentType: 'text/plain',
          });
          
          storageTestResult = {
            success: true,
            message: 'Successfully generated signed URL with existing app',
            error: null,
            bucketName: bucket.name
          };
        } catch (storageError: any) {
          storageTestResult = {
            success: false,
            message: 'Failed to access storage or generate signed URL with existing app',
            error: storageError.message,
            bucketName: null
          };
        }
      }
    } catch (error: any) {
      firebaseInitResult = {
        success: false,
        message: 'Failed to initialize Firebase Admin',
        error: error.message
      };
    }

    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV || 'unknown',
      isVercel: process.env.VERCEL === 'true',
      serverInfo: {
        platform: process.platform,
        nodeVersion: process.version
      },
      envVars,
      privateKeyInfo,
      tokenTestResult,
      firebaseInitResult,
      storageTestResult
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error in credentials debug endpoint',
      error: error.message
    }, { status: 500 });
  }
}