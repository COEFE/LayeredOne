'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, storage, getProxiedDownloadURL } from '@/firebase/config';
import { ref, uploadString } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { isClientStaticExport, getClientAuthToken, markAPIFailureDetected, isStaticExport } from '@/utils/optimizations/static-export-middleware';

type DocumentUploadProps = {
  onUploadComplete?: () => void;
};

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Check if Firebase Storage is properly configured
  useEffect(() => {
    // Clear any flags that might trigger mock mode
    if (typeof window !== 'undefined') {
      // Clear API failure detection
      if (localStorage.getItem('API_FAILURE_DETECTED') === 'true') {
        console.log('Clearing API_FAILURE_DETECTED flag');
        localStorage.removeItem('API_FAILURE_DETECTED');
      }
      
      // Clear force static export
      if (localStorage.getItem('FORCE_STATIC_EXPORT') === 'true') {
        console.log('Clearing FORCE_STATIC_EXPORT flag');
        localStorage.removeItem('FORCE_STATIC_EXPORT');
      }
      
      // Remove any mock tokens
      if (localStorage.getItem('authToken') === 'static-export-mock-token') {
        console.log('Removing mock auth token');
        localStorage.removeItem('authToken');
      }
    }
    
    if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      setStorageAvailable(false);
      setError('Firebase Storage is not properly configured. Please check your environment variables.');
      return;
    }
    
    // Don't actively test the connection - it may trigger CORS errors
    // Instead, assume it's available and handle errors during actual upload
    setStorageAvailable(true);
    
    // Check if using emulators
    const usingEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
    
    // Log configuration for debugging
    console.log('DocumentUpload: Storage bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    console.log('DocumentUpload: Using Firebase emulators:', usingEmulators ? 'Yes' : 'No');
    
    // Check and log static export status - previously using undefined variable
    const staticExport = false; // Explicitly set to false to prevent UI issues
    console.log('DocumentUpload: Static export environment:', staticExport ? 'Yes' : 'No');
    
    // Additional debug info for troubleshooting the upload button
    console.log('DocumentUpload: storageAvailable =', storageAvailable);
    console.log('DocumentUpload: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS =', process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS);
    
    if (usingEmulators) {
      // Reset any previous errors if using emulators
      setError(null);
    }
  }, []);
  
  // Load folders
  useEffect(() => {
    if (user) {
      loadFolders();
    }
  }, [user]);
  
  const loadFolders = async () => {
    if (!user) return;
    
    try {
      const foldersQuery = query(
        collection(db, 'folders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const foldersSnapshot = await getDocs(foldersQuery);
      const loadedFolders: { id: string; name: string }[] = [];
      
      foldersSnapshot.forEach((doc) => {
        loadedFolders.push({
          id: doc.id,
          name: doc.data().name
        });
      });
      
      setFolders(loadedFolders);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(false);
    }
  };

  const mockUpload = async (file: File, user: any) => {
    // Simulate a successful upload process without actually using Firebase Storage
    return new Promise<{downloadURL: string, docRef: {id: string}}>(resolve => {
      // Simulate the time it takes to upload
      setTimeout(() => {
        // Use https scheme instead of mock:// to avoid URL scheme errors
        const mockUrl = `https://storage.example.com/documents/${user.uid}/${Date.now()}_${file.name}`;
        console.log('Mock upload successful (simulated URL):', mockUrl);
        
        // Add document metadata to Firestore
        addDoc(collection(db, 'documents'), {
          userId: user.uid,
          name: file.name,
          type: file.type,
          size: file.size,
          url: mockUrl,
          createdAt: serverTimestamp(),
          processed: false,
          processing: false,
          mockUpload: true
        }).then(docRef => {
          resolve({
            downloadURL: mockUrl,
            docRef
          });
        });
      }, 2000); // Simulate 2 second upload time
    });
  };
  
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    
    if (!user) {
      setError('You must be logged in to upload documents. Please sign in and try again.');
      return;
    }
    
    if (!user.getIdToken) {
      setError('Authentication state is invalid. Please sign out and sign in again.');
      return;
    }
    
    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'text/plain', 
      'text/markdown', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel
      'text/csv', // CSV
      'image/jpeg', // JPEG
      'image/png', // PNG
      'image/gif' // GIF
    ];
    if (!allowedTypes.includes(file.type)) {
      setError('File type not supported. Please upload PDF, TXT, MD, DOCX, Excel, CSV, or image files.');
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress(0);
      let interval: NodeJS.Timeout | undefined;
      let downloadURL: string;
      let docRef: any;
      
      // Always use the real cloud storage upload path
      // Mock mode is completely disabled
      
      // Sanitize the filename to avoid path traversal issues
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const timestamp = Date.now();
      const filePath = `documents/${user.uid}/${timestamp}_${safeFileName}`;
      console.log(`Uploading to path: ${filePath}`);
      
      // Use the server-side upload API route - this avoids all CORS issues
      console.log('Using server-side upload API');
      
      // Progress simulation interval
      interval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 5, 90));
      }, 100);
      
      try {
        // First try to get the token directly from the user object, which is most reliable
        let idToken = null;
        
        // Enhanced debugging information
        console.log("==== AUTH DEBUG ====");
        console.log("User object exists:", !!user);
        console.log("User ID:", user?.uid);
        console.log("User email:", user?.email);
        console.log("Is user anonymous:", user?.isAnonymous);
        
        if (user && user.getIdToken && typeof user.getIdToken === 'function') {
          try {
            console.log("Attempting to get ID token...");
            idToken = await user.getIdToken(true); // Force refresh the token
            console.log("Token retrieved successfully, length:", idToken?.length);
            console.log("Token first 10 chars:", idToken?.substring(0, 10));
            localStorage.setItem('authToken', idToken); // Store it for future use
            console.log('Got fresh authentication token directly from user object');
          } catch (tokenError) {
            console.error("TOKEN ERROR:", tokenError);
            console.error('Error getting token from user object:', tokenError);
          }
        }
        
        // If that fails, fall back to our helper
        if (!idToken) {
          idToken = await getClientAuthToken(user);
          console.log('Using fallback method to get authentication token');
        }
        
        if (!idToken) {
          console.error('Could not get authentication token by any method');
          throw new Error('Authentication error: Could not authenticate. Please sign out and sign in again.');
        }
        
        // Show some diagnostics, but mask most of the token for security
        const tokenPreview = idToken.substring(0, 10) + '...' + idToken.substring(idToken.length - 5);
        console.log(`Got authentication token for upload (length: ${idToken.length}, preview: ${tokenPreview})`);
        
        // Verify token isn't one of our mock tokens which will be rejected
        if (idToken === 'localhost-mock-token' || idToken === 'fallback-mock-token') {
          console.error('Cannot use mock token for actual upload');
          throw new Error('Authentication error: Invalid authentication token. Please sign out and sign in again.');
        }
        
        // Create form data for upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filename', file.name);
        formData.append('contentType', file.type);
        if (selectedFolder) {
          formData.append('folderId', selectedFolder);
        }
        
        // Upload through our API route
        console.log('Uploading through server-side API route');
        
        try {
          console.log('Sending upload request to API with authentication token');
          
          // For Vercel deployments, ensure we have a special handling for redirects
          const isVercelDeployment = typeof window !== 'undefined' && (
            window.location.hostname.includes('vercel.app') || 
            process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true'
          );
          
          if (isVercelDeployment) {
            console.log('==== VERCEL AUTH DEBUG ====');
            console.log('Vercel deployment detected - ensuring proper authentication for upload');
            // Force another token refresh attempt right before upload
            if (user && user.getIdToken) {
              console.log("User object exists in Vercel flow:", !!user);
              console.log("User ID for Vercel flow:", user?.uid);
              console.log("User email for Vercel flow:", user?.email);
              console.log("Is user anonymous in Vercel flow:", user?.isAnonymous);
              
              try {
                console.log("Attempting to get Vercel ID token...");
                const freshToken = await user.getIdToken(true);
                console.log("Vercel token retrieved successfully, length:", freshToken?.length);
                console.log("Vercel token first 10 chars:", freshToken?.substring(0, 10));
                
                if (freshToken !== idToken) {
                  console.log('Got fresher token for upload request');
                  idToken = freshToken;
                }
              } catch (refreshError) {
                console.error("VERCEL TOKEN ERROR:", refreshError);
                console.error("Error refreshing token before upload:", refreshError);
              }
            } else {
              console.error("VERCEL AUTH ERROR: User object or getIdToken not available");
            }
          }
          
          // Include multiple auth headers for maximum compatibility
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${idToken}`
          };
          
          // Log the exact headers being sent
          console.log("Headers being sent:", headers);
          console.log("Authorization header length:", headers.Authorization?.length);
          
          // Ensure we have the correct Authorization header format
          console.log("Starting fetch request to /api/storage/upload...");
          const uploadResponse = await fetch('/api/storage/upload', {
            method: 'POST',
            headers,
            body: formData,
            // Ensure credentials are included
            credentials: 'same-origin'
          });
          
          console.log("Response received, status:", uploadResponse.status);
          console.log("Response headers:", Object.fromEntries([...uploadResponse.headers]));
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => {
              return { error: uploadResponse.statusText || "Unknown error" };
            });
            
            console.error('Upload failed:', uploadResponse.status, errorData);
            
            if (uploadResponse.status === 401) {
              // Mark that we've detected an API failure due to authentication
              // Do NOT mark as API failure - this will trigger mock mode
              // markAPIFailureDetected();
              throw new Error(`Authentication error: ${errorData.error || 'Unauthorized - Please try signing out and back in'}`);
            } else {
              // For any other API failure, also mark it
              // Do NOT mark as API failure - this will trigger mock mode
              // if (uploadResponse.status >= 400) {
              //   markAPIFailureDetected();
              // }
              throw new Error(`Failed to upload file: ${errorData.error || `Status ${uploadResponse.status}`}`);
            }
          }
        } catch (fetchError) {
          console.error('Fetch error during upload:', fetchError);
          throw fetchError;
        }
        
        // Parse the response
        const responseData = await uploadResponse.json();
        console.log('Upload successful:', responseData);
        
        // Extract the document data
        downloadURL = responseData.url;
        docRef = { id: responseData.documentId };
        
        clearInterval(interval);
        setUploadProgress(95);
        
        console.log('Upload successful, URL:', downloadURL);
      } catch (error) {
        if (interval) clearInterval(interval);
        console.error('Upload error:', error);
        throw error;
      }
      
      // Finalize upload
      setUploadProgress(100);
      setSuccess(true);
      setFile(null);
      
      // Reset the form after a moment
      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
        
        // Call the onUploadComplete callback if provided
        if (onUploadComplete) {
          setTimeout(() => {
            onUploadComplete();
          }, 1500); // Give the user a moment to see the success message before closing
        }
      }, 1000);
      
      // Trigger document processing - note that with Cloud Functions, 
      // processing should start automatically when the file is uploaded to Storage
      // This API call is more of a fallback to ensure processing starts
      try {
        // Only proceed if we have a valid document ID
        if (docRef && docRef.id) {
          console.log("User before processing token retrieval:", user);
          console.log("User ID for processing flow:", user?.uid);
          let idToken;
          try {
            idToken = await user.getIdToken(true); // Force refresh
            console.log("Processing token retrieved successfully:", !!idToken);
          } catch (error) {
            console.error("Processing token retrieval error:", error);
            throw error;
          }
          
          fetch('/api/documents/process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              documentId: docRef.id
            })
          });
          
          // We're not awaiting this fetch to avoid blocking the UI
          console.log('Document processing triggered for document ID:', docRef.id);
        } else {
          console.log('Document processing skipped - no document ID available');
        }
      } catch (error) {
        console.error('Failed to trigger document processing:', error);
        // We don't show this error to the user as the upload was successful
      }
      
    } catch (error) {
      // Handle errors
      setUploadProgress(0);
      
      const firebaseError = error as FirebaseError;
      
      if (firebaseError.code === 'storage/unauthorized') {
        setError('You do not have permission to upload documents. Please sign in again.');
      } else if (firebaseError.code === 'storage/canceled') {
        setError('Upload was canceled. Please try again.');
      } else if (firebaseError.code === 'storage/unknown') {
        setError('CORS error or connection issue. Please check CORS configuration or try using Firebase emulators.');
      } else if (firebaseError.code === 'storage/quota-exceeded') {
        setError('Storage quota exceeded. Please contact support.');
      } else if (firebaseError.name === 'FirebaseError' && firebaseError.message.includes('CORS')) {
        setError('CORS policy error. Please configure Firebase Storage CORS settings.');
        console.error('This is a CORS error. See the cors-setup.md file for instructions on how to fix it.');
      } else {
        setError(`Upload error: ${firebaseError.message || 'Unknown error'}`);
      }
      
      console.error('Upload error:', error);
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg border border-red-200 flex items-center gap-3">
          <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg border border-green-200 flex items-center gap-3">
          <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-medium">Document uploaded successfully!</p>
            <p className="text-sm mt-1">Your document is now being processed and will be available shortly.</p>
          </div>
        </div>
      )}
      
      {/* Added debug info here to help troubleshoot the rendering path */}
      <div className="text-xs text-gray-500 mb-2">Debug: storageAvailable={storageAvailable ? 'true' : 'false'}, emulators={process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS || 'none'}</div>
      
      {!storageAvailable ? (
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-200 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="font-medium">Firebase Storage not available</p>
          </div>
          <p className="text-sm ml-9">
            The storage service is not properly configured. Document uploads are disabled. 
            Please check your Firebase configuration.
          </p>
        </div>
      ) : process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'mockmode' || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' ? (
        <div className={`p-4 ${process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'mockmode' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'} rounded-lg border mb-4`}>
          <div className="flex items-center gap-3 mb-2">
            <svg className={`w-6 h-6 ${process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'mockmode' ? 'text-green-600' : 'text-blue-600'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">
              {process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'mockmode' ? 'Mock Storage Mode Enabled' : 'Using Firebase Emulators'}
            </p>
          </div>
          <p className="text-sm ml-9">
            {process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'mockmode' 
              ? 'You are using mock storage for development. Files will be simulated without actually being uploaded to Firebase.'
              : 'You are using Firebase emulators for local development. Make sure the Firebase emulators are running.'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="border-2 border-dashed border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900 p-8 rounded-lg text-center relative transition-all duration-200 hover:bg-blue-100 hover:border-blue-400">
            {file ? (
              <div className="text-center">
                <div className="mb-3 w-full flex justify-center">
                  {file.type.startsWith('image/') ? (
                    <div className="w-32 h-32 bg-white rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="Preview" 
                        className="max-w-full max-h-full object-contain"
                        onLoad={() => URL.revokeObjectURL(URL.createObjectURL(file))}
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-blue-200 rounded-lg shadow-sm flex items-center justify-center text-blue-700 text-4xl">
                      {file.name.endsWith('.pdf') ? 'PDF' : 
                       file.name.endsWith('.docx') ? 'DOC' : 
                       file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'XLS' :
                       file.name.endsWith('.csv') ? 'CSV' : '?'}
                    </div>
                  )}
                </div>
                <p className="text-base font-medium text-blue-800 truncate max-w-full px-4">{file.name}</p>
                <p className="text-sm text-blue-600 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button 
                  type="button"
                  onClick={() => setFile(null)}
                  className="mt-3 px-3 py-1 text-xs text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-200 rounded-full inline-flex items-center"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Change file
                </button>
              </div>
            ) : (
              <div>
                <div className="mx-auto w-16 h-16 mb-4 text-blue-400">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="mb-2 text-base font-medium text-blue-800">
                  Drag and drop your document or click to browse
                </p>
                <p className="text-sm text-blue-600">
                  Maximum file size: 10MB
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">PDF</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">DOCX</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">TXT</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Excel</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">CSV</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Images</span>
                </div>
              </div>
            )}
            
            <input
              type="file"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading || !user}
              aria-label="Upload document"
            />
          </div>
          
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700">{uploadProgress < 100 ? 'Uploading...' : 'Processing...'}</span>
                <span className="text-sm font-medium text-blue-700">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Folder selection */}
          {folders.length > 0 && (
            <div>
              <label htmlFor="folder-select" className="block text-sm font-medium text-blue-900 mb-2">
                Add to folder (optional)
              </label>
              <div className="relative">
                <select
                  id="folder-select"
                  value={selectedFolder || ''}
                  onChange={(e) => setSelectedFolder(e.target.value || null)}
                  className="w-full p-2.5 border border-blue-200 text-blue-800 bg-white rounded-lg appearance-none pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={uploading}
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
            disabled={!file || uploading || !user}
          >
            {uploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {file ? 'Upload Document' : 'Select a file to upload'}
              </>
            )}
          </button>
          
          {!user && (
            <p className="text-center text-sm text-red-600 mt-2 flex items-center justify-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              You must be logged in to upload documents
            </p>
          )}
        </form>
      )}
      
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-5">
        <h3 className="text-blue-900 font-medium flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Supported Document Types
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div className="flex items-start gap-2">
            <span className="text-blue-800 font-medium">Documents:</span>
            <span className="text-blue-700">PDF, DOCX, TXT, MD</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-800 font-medium">Spreadsheets:</span>
            <span className="text-blue-700">Excel, CSV</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-800 font-medium">Images:</span>
            <span className="text-blue-700">JPEG, PNG, GIF</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-800 font-medium">Max Size:</span>
            <span className="text-blue-700">10MB per file</span>
          </div>
        </div>
        <div className="flex items-start gap-2 mt-4 pt-3 border-t border-blue-200">
          <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <p className="font-medium text-purple-800">Enhanced Document Analysis</p>
            <p className="text-sm text-purple-700 mt-1">PDFs and images are analyzed with advanced Claude AI vision capabilities, preserving tables, charts, and formatting.</p>
          </div>
        </div>
      </div>
    </div>
  );
}