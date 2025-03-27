'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import FileViewer from '@/components/FileViewer';
import DocumentChat from '@/components/DocumentChat';
import ReprocessDocumentButton from '@/components/ReprocessDocumentButton';
import Link from 'next/link';

export default function DocumentClientPage({ id }: { id: string }) {
  const { user } = useAuth();
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'view' | 'chat'>('view');
  const [splitView, setSplitView] = useState(true);

  useEffect(() => {
    const loadDocument = async () => {
      if (!user || !id) return;

      try {
        setLoading(true);
        const documentId = Array.isArray(id) ? id[0] : id;
        const documentRef = doc(db, 'documents', documentId);
        const documentSnap = await getDoc(documentRef);

        if (!documentSnap.exists()) {
          setError('Document not found');
          setLoading(false);
          return;
        }

        const documentData = documentSnap.data();
        
        // Verify that the user owns this document
        if (documentData.userId !== user.uid) {
          setError('You do not have permission to view this document');
          setLoading(false);
          return;
        }

        setDocument({ id: documentSnap.id, ...documentData });
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading document:', err);
        setError(`Failed to load document: ${err.message}`);
        setLoading(false);
      }
    };

    loadDocument();
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
          <Link 
            href="/documents" 
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ← Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 my-6">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Document Not Found</h2>
          <p className="text-yellow-700">This document could not be found or might have been deleted.</p>
          <Link 
            href="/documents" 
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ← Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-900">{document.name}</h1>
          <Link 
            href="/documents" 
            className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
          >
            ← Back to Documents
          </Link>
        </div>
        <div className="mt-2 flex justify-between items-center">
          <div className="text-sm text-blue-700">
            {document.createdAt && typeof document.createdAt.toDate === 'function' 
              ? new Date(document.createdAt.toDate()).toLocaleString() 
              : new Date(document.createdAt).toLocaleString()}
            <span className="mx-2">•</span>
            {(document.size / 1024 / 1024).toFixed(2)} MB
            {document.extractedText && (
              <>
                <span className="mx-2">•</span>
                <span className="text-green-600">Text extracted</span>
              </>
            )}
            {!document.extractedText && (
              <>
                <span className="mx-2">•</span>
                <span className="text-amber-600">No text extracted</span>
              </>
            )}
          </div>
          {(document.type?.includes('excel') || 
            document.type?.includes('spreadsheet') || 
            document.name?.endsWith('.xlsx') || 
            document.name?.endsWith('.xls')) && (
            <ReprocessDocumentButton 
              documentId={document.id}
              onSuccess={() => {
                // Refresh the document data after successful reprocessing
                window.location.reload();
              }}
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
        <div className="flex justify-between items-center border-b border-blue-100">
          <div className="flex">
            <button
              className={`px-6 py-3 font-medium text-sm ${
                !splitView && activeTab === 'view'
                  ? 'bg-blue-50 text-blue-800 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => {
                setSplitView(false);
                setActiveTab('view');
              }}
            >
              View Only
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm ${
                !splitView && activeTab === 'chat'
                  ? 'bg-blue-50 text-blue-800 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => {
                setSplitView(false);
                setActiveTab('chat');
              }}
            >
              Chat Only
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm ${
                splitView
                  ? 'bg-blue-50 text-blue-800 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setSplitView(true)}
            >
              Split View
            </button>
          </div>
          
          {!document.extractedText && (
            <div className="px-4 py-2">
              <div className="text-amber-600 text-xs flex items-center">
                <span className="mr-2">⚠️</span>
                <span>No text extracted. Chat may not work properly.</span>
              </div>
            </div>
          )}
        </div>

        {splitView ? (
          <div className="flex h-[calc(100vh-250px)]">
            {/* Document viewer - takes 2/3 of the space */}
            <div className="w-2/3 border-r border-gray-200 p-4 overflow-auto">
              <div className="h-full">
                <FileViewer 
                  fileUrl={document.url} 
                  mimeType={document.type} 
                  fileName={document.name} 
                />
              </div>
            </div>
            
            {/* Chat interface - takes 1/3 of the space */}
            <div className="w-1/3 h-full">
              <DocumentChat documentId={document.id} compactMode={true} />
            </div>
          </div>
        ) : (
          <div className="p-4">
            {activeTab === 'view' ? (
              <FileViewer 
                fileUrl={document.url} 
                mimeType={document.type} 
                fileName={document.name} 
              />
            ) : (
              <DocumentChat documentId={document.id} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}