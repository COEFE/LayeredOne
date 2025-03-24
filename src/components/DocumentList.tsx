'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, addDoc, updateDoc, writeBatch, onSnapshot, getDoc } from 'firebase/firestore';

type Document = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: any;
  updatedAt?: any;
  processed: boolean;
  processing?: boolean;
  status?: string;
  aiAnalysis?: any;
  folderId?: string | null;
};

type Folder = {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
};

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [activeMoveMenu, setActiveMoveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { user } = useAuth();

  // Keep track of proxied URLs
  const [proxiedUrls, setProxiedUrls] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (user) {
      // Set up real-time listeners
      const folderUnsubscribe = setupFolderListener();
      const docUnsubscribe = setupDocumentListener();
      
      // Clean up the listeners when component unmounts or dependencies change
      return () => {
        folderUnsubscribe();
        docUnsubscribe();
      };
    }
  }, [user, activeFolder]);
  
  // Initialize filtered documents with all documents
  useEffect(() => {
    setFilteredDocuments(documents);
  }, [documents]);
  
  // Add click outside handler to close dropdown menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMoveMenu) {
        const activeMenuRef = menuRefs.current[activeMoveMenu];
        if (activeMenuRef && !activeMenuRef.contains(event.target as Node)) {
          setActiveMoveMenu(null);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMoveMenu]);
  
  // Debounce search query to avoid excessive filtering
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay
    
    return () => {
      clearTimeout(timerId);
    };
  }, [searchQuery]);
  
  // Filter documents based on debounced search query
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setFilteredDocuments(documents);
      return;
    }
    
    const query = debouncedSearchQuery.toLowerCase().trim();
    const filtered = documents.filter(doc => {
      // Search in document name
      if (doc.name.toLowerCase().includes(query)) return true;
      
      // Search in document type
      if (doc.type && formatFileType(doc.type).toLowerCase().includes(query)) return true;
      
      // Search in folder name if document is in a folder
      if (doc.folderId) {
        const folder = folders.find(f => f.id === doc.folderId);
        if (folder && folder.name.toLowerCase().includes(query)) return true;
      }
      
      return false;
    });
    
    setFilteredDocuments(filtered);
  }, [debouncedSearchQuery, documents, folders]);

  const setupFolderListener = () => {
    if (!user) return () => {};
    
    const foldersQuery = query(
      collection(db, 'folders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    // Set up real-time listener for folders
    const unsubscribe = onSnapshot(
      foldersQuery,
      (querySnapshot) => {
        const loadedFolders: Folder[] = [];
        
        querySnapshot.forEach((doc) => {
          loadedFolders.push({
            id: doc.id,
            ...doc.data() as Omit<Folder, 'id'>
          });
        });
        
        setFolders(loadedFolders);
      },
      (error) => {
        console.error('Error in real-time folders listener:', error);
        setError('Failed to load folders. Please try again later.');
      }
    );
    
    return unsubscribe;
  };
  
  // Keep the original function for non-listener operations
  const loadFolders = async () => {
    if (!user) return;
    
    try {
      const foldersQuery = query(
        collection(db, 'folders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const foldersSnapshot = await getDocs(foldersQuery);
      const loadedFolders: Folder[] = [];
      
      foldersSnapshot.forEach((doc) => {
        loadedFolders.push({
          id: doc.id,
          ...doc.data() as Omit<Folder, 'id'>
        });
      });
      
      setFolders(loadedFolders);
    } catch (error) {
      console.error('Error loading folders:', error);
      setError('Failed to load folders. Please try again later.');
    }
  };

  const setupDocumentListener = () => {
    if (!user) return () => {};
    
    setLoading(true);
    
    // Create the query based on active folder
    let q;
    if (activeFolder) {
      q = query(
        collection(db, 'documents'),
        where('userId', '==', user.uid),
        where('folderId', '==', activeFolder),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'documents'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const loadedDocuments: Document[] = [];
        const urlMap: Record<string, string> = {};
        
        // Process each document
        querySnapshot.forEach((doc) => {
          const docData = doc.data() as Omit<Document, 'id'>;
          
          // Store the original URL in our map
          if (docData.url && docData.url.includes('firebasestorage.googleapis.com')) {
            urlMap[doc.id] = docData.url;
          }
          
          loadedDocuments.push({
            id: doc.id,
            ...docData
          });
        });
        
        setDocuments(loadedDocuments);
        setLoading(false);
        
        // In development, proxy all Firebase Storage URLs
        if (process.env.NODE_ENV === 'development') {
          proxyStorageUrls(urlMap);
        }
      },
      (error) => {
        console.error('Error in real-time documents listener:', error);
        setError('Failed to load documents. Please try again later.');
        setLoading(false);
      }
    );
    
    return unsubscribe;
  };
  
  // Extract the URL proxying logic to a separate function
  const proxyStorageUrls = async (urlMap: Record<string, string>) => {
    if (!user) return;
    
    const newProxiedUrls: Record<string, string> = {};
    
    // For each document with a Firebase Storage URL
    for (const docId of Object.keys(urlMap)) {
      const originalUrl = urlMap[docId];
      try {
        // Get an authentication token
        const idToken = await user.getIdToken();
        
        // Call our proxy endpoint
        const response = await fetch('/api/storage/download-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ url: originalUrl })
        });
        
        if (response.ok) {
          const data = await response.json();
          newProxiedUrls[docId] = data.url;
        }
      } catch (err) {
        console.error('Error proxying URL for document', docId, err);
      }
    }
    
    // Update the proxied URLs state
    setProxiedUrls(newProxiedUrls);
  };
  
  // Keep the loadDocuments function for non-listener operations
  const loadDocuments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      let q;
      if (activeFolder) {
        q = query(
          collection(db, 'documents'),
          where('userId', '==', user.uid),
          where('folderId', '==', activeFolder),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'documents'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      const loadedDocuments: Document[] = [];
      const urlMap: Record<string, string> = {};
      
      // Process each document
      querySnapshot.forEach((doc) => {
        const docData = doc.data() as Omit<Document, 'id'>;
        
        // Store the original URL in our map
        if (docData.url && docData.url.includes('firebasestorage.googleapis.com')) {
          urlMap[doc.id] = docData.url;
        }
        
        loadedDocuments.push({
          id: doc.id,
          ...docData
        });
      });
      
      setDocuments(loadedDocuments);
      
      // In development, proxy all Firebase Storage URLs
      if (process.env.NODE_ENV === 'development') {
        await proxyStorageUrls(urlMap);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading documents:', error);
      setError('Failed to load documents. Please try again later.');
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!user) return;
    
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDoc(doc(db, 'documents', documentId));
        setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== documentId));
      } catch (error) {
        console.error('Error deleting document:', error);
        setError('Failed to delete document. Please try again later.');
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    
    try {
      const folderData = {
        name: newFolderName.trim(),
        userId: user.uid,
        createdAt: new Date()
      };
      
      const folderRef = await addDoc(collection(db, 'folders'), folderData);
      
      setFolders([...folders, { id: folderRef.id, ...folderData }]);
      setNewFolderName('');
      setShowNewFolderModal(false);
    } catch (error) {
      console.error('Error creating folder:', error);
      setError('Failed to create folder. Please try again later.');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!user) return;
    
    if (confirm('Are you sure you want to delete this folder? Documents in this folder will not be deleted.')) {
      try {
        // Delete the folder
        await deleteDoc(doc(db, 'folders', folderId));
        
        // Update any documents in this folder to have no folder
        const docsInFolder = query(
          collection(db, 'documents'),
          where('userId', '==', user.uid),
          where('folderId', '==', folderId)
        );
        
        const querySnapshot = await getDocs(docsInFolder);
        const batch = writeBatch(db);
        
        querySnapshot.forEach((document) => {
          batch.update(doc(db, 'documents', document.id), { folderId: null });
        });
        
        await batch.commit();
        
        setFolders((prevFolders) => prevFolders.filter((folder) => folder.id !== folderId));
        
        if (activeFolder === folderId) {
          setActiveFolder(null);
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
        setError('Failed to delete folder. Please try again later.');
      }
    }
  };

  const handleMoveToFolder = async (documentId: string, folderId: string | null) => {
    if (!user) return;
    
    // First, close the dropdown to provide immediate feedback
    setActiveMoveMenu(null);
    
    try {
      console.log('Moving document', documentId, 'to folder', folderId);
      
      // Create a reference to the document
      const docRef = doc(db, 'documents', documentId);
      
      // Verify that the document exists first
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        console.error('Document does not exist!', documentId);
        setError(`Document with ID ${documentId} does not exist.`);
        return;
      }
      
      // Check if we're trying to move to the same folder
      const currentData = docSnap.data();
      if (currentData?.folderId === folderId) {
        console.log('Document is already in this folder, no update needed');
        return;
      }
      
      // Prepare update data
      const updateData: Record<string, any> = { 
        updatedAt: new Date() // Add a timestamp to ensure the update is visible
      };
      
      // Only set folderId if it's not null (to properly handle removing from folders)
      if (folderId === null) {
        updateData.folderId = null;
      } else {
        updateData.folderId = folderId;
      }
      
      // Update the document with the new folderId
      await updateDoc(docRef, updateData);
      
      console.log('Document successfully moved!');
      
      // Update local state
      setDocuments((prevDocs) => {
        return prevDocs.map((document) => {
          if (document.id === documentId) {
            console.log('Updating local document state:', document.id);
            return { 
              ...document, 
              folderId,
              updatedAt: new Date()
            };
          }
          return document;
        });
      });
      
      // Show success message
      setError(null);
      const targetFolder = folders.find(f => f.id === folderId);
      const folderName = targetFolder ? targetFolder.name : 'root folder';
      setSuccessMessage(`Document successfully moved to ${folderName}!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error moving document:', error);
      setError('Failed to move document. Please try again later.');
    }
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) {
      return `${size} bytes`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  };
  
  const formatFileType = (type?: string) => {
    // Handle undefined or null type
    if (!type) return 'Unknown';
    
    const mimeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
      'application/msword': 'Word',
      'application/vnd.ms-excel': 'Excel',
      'application/vnd.ms-powerpoint': 'PowerPoint',
      'text/plain': 'Text',
      'text/html': 'HTML',
      'text/csv': 'CSV',
      'image/jpeg': 'JPEG',
      'image/png': 'PNG',
      'image/gif': 'GIF'
    };
    
    if (mimeMap[type]) {
      return mimeMap[type];
    }
    
    // If not in our map, make the subtype more readable
    const parts = type.split('/');
    if (parts.length === 2) {
      const subtype = parts[1]
        .replace('vnd.', '')
        .split('.')
        .pop() || parts[1];
      
      return subtype.charAt(0).toUpperCase() + subtype.slice(1);
    }
    
    return type;
  };

  const getFileIcon = (type?: string) => {
    // Handle undefined or null type
    if (!type) {
      return '📋'; // Default icon if type is missing
    }
    
    if (type.includes('pdf')) {
      return '📄';
    } else if (type.includes('word')) {
      return '📝';
    } else if (type.includes('text')) {
      return '📃';
    } else {
      return '📋';
    }
  };
  

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-blue-900">Your Documents</h2>
          {debouncedSearchQuery ? (
            <p className="text-blue-700 mt-1">
              {filteredDocuments.length} result{filteredDocuments.length !== 1 ? 's' : ''} found 
              {filteredDocuments.length > 0 ? ` for "${debouncedSearchQuery}"` : ''}
              {filteredDocuments.length === 0 && <button onClick={() => setSearchQuery('')} className="ml-2 text-blue-600 hover:underline">Clear search</button>}
            </p>
          ) : (
            <p className="text-blue-700 mt-1">{documents.length} document{documents.length !== 1 ? 's' : ''} available</p>
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search documents..." 
              className="pl-10 pr-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Folder
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg border border-red-200 flex items-center gap-3">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg border border-green-200 flex items-center gap-3">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}
      
      {/* Folder navigation */}
      <div className="mb-8 bg-white p-3 rounded-lg shadow-sm border border-blue-100">
        <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Folders
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveFolder(null)}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition font-medium ${
              !activeFolder 
                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            All Documents
          </button>
          
          {folders.map((folder) => (
            <div key={folder.id} className="relative group">
              <button
                onClick={() => setActiveFolder(folder.id)}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition font-medium ${
                  activeFolder === folder.id 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {folder.name}
              </button>
              
              {/* Folder action buttons (visible on hover) */}
              <div className="absolute -top-2 -right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Chat with folder button */}
                <a
                  href={`/folders/${folder.id}/chat`}
                  className="h-6 w-6 bg-green-600 rounded-full text-white flex items-center justify-center shadow-sm"
                  title="Chat with folder"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </a>
                
                {/* Delete folder button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                  className="h-6 w-6 bg-red-600 rounded-full text-white flex items-center justify-center shadow-sm"
                  title="Delete folder"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center p-12 bg-white rounded-lg shadow-sm border border-blue-100">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-blue-600"></div>
            <p className="text-blue-800 font-medium">Loading your documents...</p>
          </div>
        </div>
      ) : (debouncedSearchQuery && filteredDocuments.length === 0) ? (
        <div className="flex flex-col items-center justify-center gap-4 p-12 bg-white rounded-lg shadow-sm border border-blue-100 text-center">
          <svg className="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <h3 className="text-xl font-semibold text-blue-900 mb-1">No results found</h3>
            <p className="text-blue-700 max-w-md mx-auto">Try adjusting your search or browse all documents.</p>
          </div>
          <button 
            onClick={() => setSearchQuery('')}
            className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Show All Documents
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 p-12 bg-white rounded-lg shadow-sm border border-blue-100 text-center">
          <svg className="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <h3 className="text-xl font-semibold text-blue-900 mb-1">No documents yet</h3>
            <p className="text-blue-700 max-w-md mx-auto">You haven't uploaded any documents yet. Upload your first document to get started.</p>
          </div>
          <a 
            href="/documents" 
            onClick={(e) => {
              e.preventDefault();
              // Find the upload button in the parent document page and click it
              const uploadButton = document.querySelector('button[aria-label="Upload document"]');
              if (uploadButton) {
                (uploadButton as HTMLButtonElement).click();
              }
            }}
            className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Document
          </a>
        </div>
      ) : (
        <>
          <div className="bg-white p-4 mb-6 rounded-lg shadow-sm border border-blue-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-blue-900 font-medium">Sort by:</span>
              <select className="border border-blue-200 rounded-md py-1 px-2 text-blue-900 bg-blue-50">
                <option>Date (newest first)</option>
                <option>Date (oldest first)</option>
                <option>Name (A-Z)</option>
                <option>Name (Z-A)</option>
                <option>Size (largest first)</option>
                <option>Size (smallest first)</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setViewMode('list')} 
                className={`flex items-center gap-1 px-3 py-1.5 border rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'border-blue-200 bg-blue-50 text-blue-800 font-medium'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={viewMode === 'list'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List Explore
              </button>
              <button 
                onClick={() => setViewMode('grid')} 
                className={`flex items-center gap-1 px-3 py-1.5 border rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'border-blue-200 bg-blue-50 text-blue-800 font-medium'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={viewMode === 'grid'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid Explore
              </button>
            </div>
          </div>
          
          {viewMode === 'list' ? (
            /* List Explore */
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-x-auto max-h-[80vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-blue-100 table-auto">
                <thead className="bg-blue-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider min-w-[250px] w-[40%]">
                      Document
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider min-w-[100px] w-[15%]">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider min-w-[100px] w-[15%]">
                      Size
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider min-w-[120px] w-[15%]">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-blue-900 uppercase tracking-wider min-w-[200px] w-[15%]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-blue-50">
                  {(debouncedSearchQuery ? filteredDocuments : documents).map((doc) => (
                    <tr key={doc.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-900">
                            {getFileIcon(doc.type)}
                          </div>
                          <div className="ml-4 flex-grow">
                            <a 
                              href={`/documents/${doc.id}`}
                              className="text-sm font-medium text-blue-900 hover:text-blue-700 hover:underline max-w-xs truncate block"
                              title={`Explore "${doc.name}"`}
                            >
                              {doc.name}
                            </a>
                            {doc.folderId && (
                              <div className="text-xs text-blue-700 flex items-center gap-1 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="truncate max-w-[120px]" title={folders.find(f => f.id === doc.folderId)?.name || 'Unknown folder'}>
                                  {folders.find(f => f.id === doc.folderId)?.name || 'Unknown folder'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-blue-800">{formatFileType(doc.type)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-blue-800">{formatFileSize(doc.size)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-blue-800">{new Date(doc.createdAt?.toDate()).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Explore document button - Using Next.js client-side navigation */}
                          <a 
                            href={`/documents/${doc.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = `/documents/${doc.id}`;
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                            title="Explore document"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-xs font-medium">Explore</span>
                          </a>
                          
                          
                          {/* Download button */}
                          <button 
                            onClick={async () => {
                              if (!user) return;
                              try {
                                const idToken = await user.getIdToken(true);
                                
                                const response = await fetch('/api/storage/download-url', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${idToken}`
                                  },
                                  body: JSON.stringify({ 
                                    documentId: doc.id,
                                    _ts: Date.now() 
                                  })
                                });
                                
                                if (response.ok) {
                                  const data = await response.json();
                                  window.open(data.url, '_blank');
                                } else {
                                  const errorText = await response.text();
                                  console.error('Failed to get download URL:', errorText);
                                  
                                  let errorMessage = 'Could not download the file. Please try again.';
                                  try {
                                    const errorJson = JSON.parse(errorText);
                                    if (errorJson.error) {
                                      errorMessage = errorJson.error;
                                    }
                                  } catch (parseError) {
                                    errorMessage = errorText;
                                  }
                                  
                                  alert(`Download error: ${errorMessage}`);
                                }
                              } catch (err) {
                                console.error('Error downloading file:', err);
                                alert('An error occurred while downloading the file. Please try again.');
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200 transition-colors"
                            title="Download file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-xs font-medium">Download</span>
                          </button>
                          
                          {/* Move to folder button */}
                          <div className="relative inline-block" ref={(el: HTMLDivElement | null) => { menuRefs.current[doc.id] = el }}>
                            <button 
                              onClick={() => setActiveMoveMenu(activeMoveMenu === doc.id ? null : doc.id)}
                              className={`flex items-center gap-1 px-2 py-1 ${
                                activeMoveMenu === doc.id 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                              } rounded transition-colors`}
                              title="Move to folder"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                              </svg>
                              <span className="text-xs font-medium">Move</span>
                            </button>
                            {activeMoveMenu === doc.id && (
                              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border border-blue-100">
                                <div className="py-1 rounded-md">
                                  <div className="px-4 py-2 font-medium text-sm border-b border-blue-100 mb-1 text-blue-900">
                                    Move to folder
                                  </div>
                                  {doc.folderId && (
                                    <button
                                      onClick={() => {
                                        handleMoveToFolder(doc.id, null);
                                        setActiveMoveMenu(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
                                    >
                                      Remove from folder
                                    </button>
                                  )}
                                  
                                  {folders.length === 0 ? (
                                    <div className="px-4 py-2 text-sm text-gray-500 italic">
                                      No folders available. Create a folder first.
                                    </div>
                                  ) : (
                                    folders.map((folder) => (
                                      <button
                                        key={folder.id}
                                        onClick={() => {
                                          handleMoveToFolder(doc.id, folder.id);
                                          setActiveMoveMenu(null);
                                        }}
                                        className={`block w-full text-left px-4 py-2 text-sm ${
                                          doc.folderId === folder.id
                                            ? 'bg-blue-50 text-blue-800 font-medium'
                                            : 'text-blue-700 hover:bg-blue-50'
                                        }`}
                                        disabled={doc.folderId === folder.id}
                                      >
                                        {folder.name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Delete button */}
                          <button 
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                            title="Delete document"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="text-xs font-medium">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid Explore */
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-w-[700px]">
                {(debouncedSearchQuery ? filteredDocuments : documents).map((doc) => (
                  <div key={doc.id} className="border border-blue-100 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                    <div className="flex items-center mb-3">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-900 text-2xl">
                        {getFileIcon(doc.type)}
                      </div>
                      <div className="ml-3 flex-grow">
                        <a 
                          href={`/documents/${doc.id}`}
                          className="text-sm font-medium text-blue-900 hover:text-blue-700 hover:underline truncate max-w-[180px] block"
                          title={doc.name}
                        >
                          {doc.name}
                        </a>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <div className="text-xs inline-flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {formatFileType(doc.type)}
                      </div>
                      
                      <div className="text-xs inline-flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(doc.createdAt?.toDate()).toLocaleDateString()}
                      </div>
                      
                      <div className="text-xs inline-flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
                        </svg>
                        {formatFileSize(doc.size)}
                      </div>
                    </div>
                    
                    
                    {/* Folder info */}
                    {doc.folderId && (
                      <div className="text-xs text-blue-700 flex items-center gap-1 mb-3 mt-2">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span className="truncate max-w-[180px]" title={folders.find(f => f.id === doc.folderId)?.name || 'Unknown folder'}>
                          {folders.find(f => f.id === doc.folderId)?.name || 'Unknown folder'}
                        </span>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-1.5 mt-auto pt-3">
                      <a 
                        href={`/documents/${doc.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/documents/${doc.id}`;
                        }}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors text-xs font-medium"
                        title="Explore document"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Explore</span>
                      </a>
                      
                      
                      {/* Move button for grid view */}
                      <div className="relative" ref={(el: HTMLDivElement | null) => { menuRefs.current[doc.id] = el }}>
                        <button 
                          onClick={() => setActiveMoveMenu(activeMoveMenu === doc.id ? null : doc.id)}
                          className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 ${
                            activeMoveMenu === doc.id 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          } rounded transition-colors text-xs font-medium`}
                          title="Move to folder"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          <span>Move</span>
                        </button>
                        {activeMoveMenu === doc.id && (
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border border-blue-100">
                            <div className="py-1 rounded-md">
                              <div className="px-4 py-2 font-medium text-sm border-b border-blue-100 mb-1 text-blue-900">
                                Move to folder
                              </div>
                              {doc.folderId && (
                                <button
                                  onClick={() => {
                                    handleMoveToFolder(doc.id, null);
                                    setActiveMoveMenu(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
                                >
                                  Remove from folder
                                </button>
                              )}
                              
                              {folders.length === 0 ? (
                                <div className="px-4 py-2 text-sm text-gray-500 italic">
                                  No folders available. Create a folder first.
                                </div>
                              ) : (
                                folders.map((folder) => (
                                  <button
                                    key={folder.id}
                                    onClick={() => {
                                      handleMoveToFolder(doc.id, folder.id);
                                      setActiveMoveMenu(null);
                                    }}
                                    className={`block w-full text-left px-4 py-2 text-sm ${
                                      doc.folderId === folder.id
                                        ? 'bg-blue-50 text-blue-800 font-medium'
                                        : 'text-blue-700 hover:bg-blue-50'
                                    }`}
                                    disabled={doc.folderId === folder.id}
                                  >
                                    {folder.name}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-xs font-medium"
                        title="Delete document"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Create New Folder</h3>
            
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}