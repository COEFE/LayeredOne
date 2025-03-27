/**
 * Firebase Firestore path utility functions
 * 
 * This module provides a fallback implementation of the path utility functions 
 * from @google-cloud/firestore/build/src/path that are needed for Firestore operations.
 * This is used when the original module can't be loaded during build time.
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
 * Export the full path utilities object
 */
export default {
  documentPathFromResourceName,
  relativeName,
  databaseRootPath,
  isDocumentPath,
  isCollectionPath,
  parentPath
};