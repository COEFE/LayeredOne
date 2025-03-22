'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import {
  collection, 
  query, 
  where,
  orderBy, 
  getDocs
} from 'firebase/firestore';
import { FiFile, FiLoader, FiAlertTriangle, FiChevronDown, FiFileText, FiImage, FiTable, FiPaperclip, FiInfo } from 'react-icons/fi';
import dynamic from 'next/dynamic';

// Dynamically import FileViewer with SSR disabled to prevent canvas errors
const FileViewer = dynamic(
  () => import('./FileViewer'),
  { ssr: false }
);

interface Document {
  id: string;
  name: string;
  contentType: string;
  extractedText?: string;
  summary?: string;
  aiAnalysis?: any;
}

interface FolderDocumentsListProps {
  folderId: string;
}

export default function FolderDocumentsList({ folderId }: FolderDocumentsListProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch documents
  useEffect(() => {
    async function fetchDocuments() {
      if (!user) return;
      
      try {
        // Fetch documents in this folder
        const documentsQuery = query(
          collection(db, 'documents'),
          where('userId', '==', user.uid),
          where('folderId', '==', folderId),
          orderBy('createdAt', 'desc')
        );
        
        const documentsSnap = await getDocs(documentsQuery);
        const loadedDocuments: Document[] = [];
        
        documentsSnap.forEach((docSnap) => {
          const docData = docSnap.data();
          loadedDocuments.push({
            id: docSnap.id,
            name: docData.name,
            contentType: docData.contentType || docData.type,
            extractedText: docData.extractedText,
            summary: docData.aiAnalysis?.summary,
            aiAnalysis: docData.aiAnalysis
          });
        });
        
        setDocuments(loadedDocuments);
        
        if (loadedDocuments.length === 0) {
          setError('This folder contains no documents');
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Error loading documents');
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocuments();
  }, [folderId, user]);

  // Function to fetch document URL
  const fetchDocumentUrl = async (documentId: string) => {
    if (!user) return;
    
    try {
      setLoadingFile(true);
      
      // Get a signed URL for the file
      const idToken = await user.getIdToken(true);
      const response = await fetch('/api/storage/download-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          documentId: documentId,
          _ts: Date.now() // Add timestamp to prevent caching
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFileUrl(data.url);
      } else {
        const errorText = await response.text();
        console.error('Error getting file URL:', errorText);
        setError(`Failed to get file URL: ${errorText}`);
      }
    } catch (err: any) {
      console.error('Error getting file URL:', err);
      setError(`Failed to get file URL: ${err.message}`);
    } finally {
      setLoadingFile(false);
    }
  };

  // Handle document selection
  const handleDocumentClick = async (document: Document) => {
    setSelectedDocument(document);
    setDropdownOpen(false);
    await fetchDocumentUrl(document.id);
  };

  // Get document icon based on content type
  const getDocumentIcon = (contentType: string) => {
    // PDFs
    if (contentType === 'application/pdf') {
      return <FiFileText className="text-red-500" />;
    }
    // Spreadsheets
    else if (
      contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      contentType === 'application/vnd.ms-excel' ||
      contentType === 'text/csv'
    ) {
      return <FiTable className="text-green-500" />;
    }
    // Images
    else if (contentType.startsWith('image/')) {
      return <FiImage className="text-purple-500" />;
    }
    // Documents (Word, text, etc.)
    else if (
      contentType === 'application/msword' ||
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      contentType === 'text/plain'
    ) {
      return <FiFile className="text-blue-500" />;
    }
    // Other
    return <FiPaperclip className="text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FiLoader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">Loading documents...</span>
      </div>
    );
  }

  if (error && !documents.length) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
        <div className="flex">
          <FiAlertTriangle className="h-5 w-5 text-red-500" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Document selector dropdown */}
      <div className="flex items-center mb-3">
        <label htmlFor="document-selector" className="mr-2 text-sm font-medium text-gray-700">
          Document:
        </label>
        <div className="relative flex-grow" ref={dropdownRef}>
          <button
            type="button"
            className="flex items-center justify-between w-full border rounded-md px-3 py-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            id="document-selector"
          >
            <div className="flex items-center truncate">
              {selectedDocument ? (
                <>
                  {getDocumentIcon(selectedDocument.contentType)}
                  <span className="ml-2 truncate font-medium text-gray-900">{selectedDocument.name}</span>
                </>
              ) : (
                <span className="text-gray-500">Select a document</span>
              )}
            </div>
            <FiChevronDown className={`ml-2 text-gray-400 transition-transform ${dropdownOpen ? 'transform rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
              {documents.length > 0 ? (
                documents.map(doc => (
                  <div
                    key={doc.id}
                    className={`px-3 py-2 cursor-pointer flex items-center hover:bg-gray-100 ${
                      selectedDocument?.id === doc.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleDocumentClick(doc)}
                    role="option"
                    aria-selected={selectedDocument?.id === doc.id}
                  >
                    {getDocumentIcon(doc.contentType)}
                    <span className="ml-2 truncate text-sm font-medium text-gray-800">{doc.name}</span>
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500 text-center">
                  No documents available
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document viewer area */}
      <div className="flex-grow overflow-auto bg-white border rounded-lg">
        {selectedDocument && fileUrl ? (
          loadingFile ? (
            <div className="flex justify-center items-center h-64">
              <FiLoader className="animate-spin h-8 w-8 text-blue-500" />
              <span className="ml-2">Loading document...</span>
            </div>
          ) : (
            <FileViewer
              fileUrl={fileUrl}
              mimeType={selectedDocument.contentType}
              fileName={selectedDocument.name}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 h-full">
            <FiInfo className="h-12 w-12 text-blue-200 mb-4" />
            <p className="font-medium">No document selected</p>
            <p className="text-sm text-gray-400 mt-1">Use the dropdown above to select a document</p>
          </div>
        )}
      </div>
    </div>
  );
}