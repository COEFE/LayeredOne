/**
 * Utility script to update document storage references
 * 
 * This script goes through existing documents in Firestore and
 * ensures they have proper storageRef fields pointing to their
 * files in Firebase Storage. It helps migrate older documents
 * to the new format which includes explicit storage references.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
    fs.readFileSync(path.join(__dirname, '../firebase-service-account.json'), 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * Extract storage path from a Firebase Storage URL
 * @param {string} url - The Firebase Storage URL
 * @returns {string|null} - The extracted storage path or null
 */
function extractStoragePathFromUrl(url) {
  if (!url) return null;
  
  try {
    // Parse the URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Firebase Storage URLs often have a pattern like:
    // https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/ENCODED_FILE_PATH?alt=media&token=TOKEN
    if (pathname.includes('/o/')) {
      const parts = pathname.split('/o/');
      if (parts.length > 1) {
        return decodeURIComponent(parts[1]);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting storage path from URL:', error);
    return null;
  }
}

/**
 * Check if a file exists in Firebase Storage
 * @param {string} storagePath - The path to check
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function fileExists(storagePath) {
  try {
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error(`Error checking if file exists at ${storagePath}:`, error);
    return false;
  }
}

/**
 * Update a document with a valid storage reference
 * @param {string} docId - The document ID
 * @param {Object} docData - The document data
 */
async function updateDocumentStorageRef(docId, docData) {
  try {
    // Skip documents that already have a valid storageRef
    if (docData.storageRef) {
      console.log(`Document ${docId} already has storageRef: ${docData.storageRef}`);
      return;
    }
    
    let storageRef = null;
    
    // Try using the path field if it exists
    if (docData.path) {
      const pathExists = await fileExists(docData.path);
      if (pathExists) {
        storageRef = docData.path;
        console.log(`Document ${docId}: Found file at path: ${docData.path}`);
      }
    }
    
    // Try extracting path from URL
    if (!storageRef && docData.url) {
      const extractedPath = extractStoragePathFromUrl(docData.url);
      if (extractedPath) {
        const pathExists = await fileExists(extractedPath);
        if (pathExists) {
          storageRef = extractedPath;
          console.log(`Document ${docId}: Extracted path from URL: ${extractedPath}`);
        }
      }
    }
    
    // Try using common patterns based on document ID and user ID
    if (!storageRef && docData.userId) {
      const possiblePaths = [
        `documents/${docId}`,
        `documents/${docData.userId}/${docId}`,
        `documents/${docData.userId}/${docId}.xlsx`,
        `documents/${docData.userId}/${docId}.xls`,
        `documents/${docData.userId}/${docId}.pdf`
      ];
      
      for (const path of possiblePaths) {
        const pathExists = await fileExists(path);
        if (pathExists) {
          storageRef = path;
          console.log(`Document ${docId}: Found file at potential path: ${path}`);
          break;
        }
      }
    }
    
    // Update the document if we found a valid storage reference
    if (storageRef) {
      await db.collection('documents').doc(docId).update({
        storageRef: storageRef,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Document ${docId}: Updated with storageRef: ${storageRef}`);
    } else {
      console.warn(`Document ${docId}: Could not find a valid storage reference`);
    }
  } catch (error) {
    console.error(`Error updating document ${docId}:`, error);
  }
}

/**
 * Process all documents in batches
 */
async function migrateDocuments() {
  try {
    console.log('Starting document migration...');
    
    // Get all documents
    const snapshot = await db.collection('documents').get();
    const totalDocuments = snapshot.size;
    let processedCount = 0;
    let updatedCount = 0;
    
    console.log(`Found ${totalDocuments} documents to process`);
    
    // Process each document
    for (const doc of snapshot.docs) {
      const docData = doc.data();
      
      // Skip documents that already have a valid storageRef
      if (docData.storageRef) {
        console.log(`Document ${doc.id} already has storageRef: ${docData.storageRef}`);
        processedCount++;
        continue;
      }
      
      await updateDocumentStorageRef(doc.id, docData);
      processedCount++;
      updatedCount++;
      
      // Log progress
      if (processedCount % 10 === 0 || processedCount === totalDocuments) {
        console.log(`Progress: ${processedCount}/${totalDocuments} documents processed (${Math.round(processedCount/totalDocuments*100)}%)`);
      }
    }
    
    console.log('Migration complete!');
    console.log(`Processed ${processedCount} documents`);
    console.log(`Updated ${updatedCount} documents with storage references`);
  } catch (error) {
    console.error('Error migrating documents:', error);
  }
}

// Run the migration
migrateDocuments().catch(console.error);