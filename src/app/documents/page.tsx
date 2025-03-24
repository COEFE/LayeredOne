'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';
import styles from './documents.module.css';

export default function Documents() {
  const { user, loading } = useAuth();
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  
  const handleUploadComplete = useCallback(() => {
    // Close the upload panel after successful upload
    setShowUploadPanel(false);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-blue-800 font-medium">Loading documents...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-blue-900 mb-4">Please Log In</h1>
        <p className="mb-6 text-blue-700">You need to be logged in to view and upload documents.</p>
        <a 
          href="/login" 
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/login";
          }}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2 max-w-xs mx-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Log In to Continue
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-12">
      {/* Main content area with document list */}
      <DocumentList />
      
      {/* Floating upload button */}
      <button
        onClick={() => setShowUploadPanel(true)}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-10"
        aria-label="Upload document"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      
      {/* Upload panel - slide in from right when visible */}
      {showUploadPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 flex justify-end">
          <div className={`bg-white w-full max-w-md p-6 shadow-lg h-full overflow-y-auto ${styles.animateSlideIn}`}>
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pt-2 pb-4 border-b border-blue-100">
              <h2 className="text-xl font-bold text-blue-900">Upload Document</h2>
              <button
                onClick={() => setShowUploadPanel(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                aria-label="Close upload panel"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      )}
    </div>
  );
}