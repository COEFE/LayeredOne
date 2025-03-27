# Excel File Viewing and Firebase Storage Improvements

This document explains the improvements made to the way Excel files are loaded and displayed in the application, focusing on solving issues with the document viewer.

## Problems

Excel files uploaded or created in the application were experiencing several issues:

1. URL expiration issues: 404 errors when trying to view files after signed URLs expired
2. CORS issues: Cross-origin resource sharing problems preventing browser file access
3. Inconsistent URL refresh: Difficulties refreshing URLs when they expired
4. Unreliable document-to-storage mapping: No consistent way to map Firestore documents to Storage files
5. Browser compatibility issues: Different behavior across browsers
6. Lack of error telemetry: No detailed logging of file loading attempts

## Solution

We've implemented a comprehensive solution that addresses all these issues:

1. **Document-Storage Link**: Adding explicit `storageRef` fields to all documents
2. **CORS Configuration**: Setting up proper CORS headers for Firebase Storage
3. **Enhanced Excel Loading**: Improved Excel file loading with better error handling
4. **Client-Side Caching**: Implementing localStorage caching of working URLs
5. **Multiple Fallback Mechanisms**: Creating a robust system for finding files in Storage
6. **Detailed Telemetry**: Tracking and logging URL refresh attempts

### Key Improvements

#### 1. Firebase Path Utilities

Extended the utility functions in `src/utils/firebase-path-utils.ts` to include:

- `extractStoragePathFromUrl`: Extracts a Storage path from a Firebase Storage URL
- `extractDocumentId`: Extracts document ID from different path formats
- `getPotentialStoragePaths`: Generates potential storage paths for a document
- `createStoragePath`: Creates a standard storage path for a new document

#### 2. Document Creation/Upload

Updated both document creation and upload processes to:

- Store a consistent `storageRef` field in each document
- Use standardized path naming conventions
- Store additional metadata in Storage files

#### 3. URL Refresh Mechanism

Completely redesigned the URL refresh mechanism in `/api/storage/download-url/route.ts`:

- Now uses document IDs to lookup files in Firestore first
- Uses the `storageRef` field as the primary path identifier
- Falls back to legacy path formats when needed
- Includes multiple backup strategies
- When successful, updates documents with correct `storageRef` fields

#### 4. Client-Side Improvements

Added client-side caching to components:

- Both `FileViewer` and `SpreadsheetViewer` now cache working URLs
- Uses localStorage with expiration to avoid repeated refresh calls
- Shares cache between components for consistency
- Implements proper error handling with user feedback

#### 5. Migration Tool

Added a migration script (`src/utils/fix-storage-refs.js`) that:

- Goes through all existing documents
- Uses multiple strategies to find their files in Storage
- Updates documents with proper `storageRef` fields
- Provides detailed logging and progress tracking

## Using the Tools

### 1. Configure CORS for Firebase Storage

The most important fix is to properly configure CORS for your Firebase Storage bucket:

```bash
# Run the configuration script
./configure-cors.sh [your-bucket-name]
```

If you don't provide a bucket name, the script will attempt to extract it from your Firebase configuration. This step is crucial for allowing browsers to access Excel files stored in Firebase Storage.

### 2. Update Existing Documents

To update all existing documents with proper storage references:

```bash
./migrate-storage-refs.sh [project-id]
```

This will scan all documents in Firestore and ensure they have proper `storageRef` fields.

## Technical Details

### Storage Path Formats

The application now standardizes on these path formats:

- Uploaded files: `documents/${userId}/${timestamp}_${uniqueId}_${safeFileName}`
- Created documents: `documents/${userId}/${folderPath}/${documentId}${fileExtension}`

### Cache Format

URLs are cached in localStorage with this structure:

```json
{
  "url": "https://firebasestorage.googleapis.com/...",
  "storageRef": "documents/userId/documentId.xlsx",
  "expires": 1679000000000
}
```

### URL Refresh Process

1. Check if document exists in Firestore using document ID
2. Verify user has access to the document
3. Try to get the file using document's `storageRef` field (most reliable)
4. Fall back to legacy `path` field if needed
5. Try potential paths based on document ID and user ID
6. Extract path from URL as last resort
7. If successful, update document with correct `storageRef`
8. Return new URL with caching instructions

## Future Improvements

- Consider implementing automatic URL refresh before expiry
- Add more detailed telemetry on URL refresh success/failure rates
- Implement prefetching for frequently accessed documents
- Consider server-side caching for additional performance

## Conclusion

These changes establish a direct and reliable link between Firestore documents and their corresponding files in Firebase Storage, solving the Excel file viewing issues by ensuring consistent access to files even after URL expiration.