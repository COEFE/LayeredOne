/**
 * Firebase Firestore and Storage path utility functions
 * 
 * This module provides a comprehensive set of utility functions for working with
 * Firebase Firestore paths and Firebase Storage paths, including extraction of paths
 * from URLs and conversion between different formats.
 */

/**
 * Convert a fully qualified resource name to a Firestore document path
 * @param resourceName The fully qualified resource name (e.g. 'projects/project-id/databases/(default)/documents/collection/doc')
 * @returns The document path (e.g. 'collection/doc')
 */
export function documentPathFromResourceName(resourceName: string): string {
  if (!resourceName) return '';
  // Split the resource name by '/' and extract collection/document components
  const parts = resourceName.split('/');
  
  // Find the index of 'documents' in the path
  const documentsIndex = parts.indexOf('documents');
  
  // If 'documents' is not found or is the last element, return empty string
  if (documentsIndex === -1 || documentsIndex === parts.length - 1) {
    return '';
  }
  
  // Return all path segments after 'documents'
  return parts.slice(documentsIndex + 1).join('/');
}

/**
 * Convert a document path to a fully qualified resource name
 * @param projectId The Firebase project ID
 * @param path The document or collection path (e.g. 'collection/doc')
 * @returns The fully qualified resource name
 */
export function relativeName(projectId: string, path: string): string {
  if (!projectId || !path) return '';
  return `projects/${projectId}/databases/(default)/documents/${path}`;
}

/**
 * Get the database root path for a project
 * @param projectId The Firebase project ID
 * @returns The database root path
 */
export function databaseRootPath(projectId: string): string {
  if (!projectId) return '';
  return `projects/${projectId}/databases/(default)`;
}

/**
 * Check if a path is a document path (even number of segments)
 * @param path The path to check
 * @returns True if the path is a document path
 */
export function isDocumentPath(path: string): boolean {
  if (!path) return false;
  return path.split('/').filter(segment => segment.length > 0).length % 2 === 0;
}

/**
 * Check if a path is a collection path (odd number of segments)
 * @param path The path to check
 * @returns True if the path is a collection path
 */
export function isCollectionPath(path: string): boolean {
  if (!path) return false;
  return path.split('/').filter(segment => segment.length > 0).length % 2 === 1;
}

/**
 * Get the parent path from a document or collection path
 * @param path The document or collection path
 * @returns The parent path
 */
export function parentPath(path: string): string {
  if (!path) return '';
  const segments = path.split('/').filter(segment => segment.length > 0);
  if (segments.length <= 1) return '';
  return segments.slice(0, -1).join('/');
}

/**
 * Firebase Storage URL utilities
 */

/**
 * Extract a Storage path from a Firebase Storage URL
 * @param url The Firebase Storage URL
 * @returns The Storage path or null if it cannot be extracted
 */
export function extractStoragePathFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    // Try parsing as URL first
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
    
    // Try alternative extraction patterns
    // URLs may also have format like: /documents/DOCUMENT_ID
    const documentMatch = pathname.match(/\/documents\/([^/?]+)/);
    if (documentMatch) {
      return `documents/${documentMatch[1]}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting storage path from URL:', error);
    return null;
  }
}

/**
 * Extract document ID from different path formats
 * @param path A path or URL that may contain a document ID
 * @returns The extracted document ID or null if not found
 */
export function extractDocumentId(path: string): string | null {
  if (!path) return null;
  
  // Try multiple extraction methods
  
  // Method 1: Extract from path like documents/USER_ID/DOCUMENT_ID
  const documentsMatch = path.match(/documents\/[^/]+\/([^/?]+)/);
  if (documentsMatch) {
    return documentsMatch[1];
  }
  
  // Method 2: Extract from direct documents/DOCUMENT_ID pattern 
  const directDocMatch = path.match(/documents\/([^/?]+)/);
  if (directDocMatch) {
    return directDocMatch[1];
  }
  
  // Method 3: Extract from filename pattern with timestamp like 1234567890_uniqueid_filename
  const timestampMatch = path.match(/_([a-f0-9]{8})_/);
  if (timestampMatch) {
    return timestampMatch[1];
  }
  
  // Method 4: Last path segment before query params
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    const withoutQuery = lastPart.split('?')[0];
    if (withoutQuery && withoutQuery.length >= 8) {
      return withoutQuery;
    }
  }
  
  return null;
}

/**
 * Generate potential storage paths for a document
 * @param documentId The document ID
 * @param userId The user ID who owns the document
 * @returns An array of possible storage paths to try
 */
export function getPotentialStoragePaths(documentId: string, userId: string): string[] {
  if (!documentId) return [];
  
  const potentialPaths = [
    // Direct documentId path
    `documents/${documentId}`,
    
    // User-scoped paths
    `documents/${userId}/${documentId}`,
    `documents/${userId}/${documentId}.xlsx`,
    `documents/${userId}/${documentId}.xls`,
    `documents/${userId}/${documentId}.pdf`,
    
    // Paths with timestamp pattern
    ...['xlsx', 'xls', 'pdf', 'docx', 'doc', 'txt', 'csv'].map(ext => 
      `documents/${userId}/*_*_*.${ext}`
    )
  ];
  
  return potentialPaths;
}

/**
 * Create a standard storage path for a new document
 * @param userId The user ID
 * @param documentId The document ID (UUID)
 * @param fileName The original file name
 * @param folderPath Optional folder path
 * @returns A consistent storage path for the document
 */
export function createStoragePath(
  userId: string, 
  documentId: string, 
  fileName: string,
  folderPath: string = ''
): string {
  // Extract file extension
  const fileExtension = fileName.includes('.') 
    ? '.' + fileName.split('.').pop() 
    : '';
  
  // Build path with or without folder
  return folderPath 
    ? `documents/${userId}/${folderPath}/${documentId}${fileExtension}`
    : `documents/${userId}/${documentId}${fileExtension}`;
}

/**
 * Export the full path utilities object
 */
export default {
  documentPathFromResourceName,
  relativeName,
  databaseRootPath,
  isDocumentPath,
  isCollectionPath,
  parentPath,
  extractStoragePathFromUrl,
  extractDocumentId,
  getPotentialStoragePaths,
  createStoragePath
};