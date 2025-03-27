'use client';

import { useState } from 'react';
import { FiDownload } from 'react-icons/fi';

// This is a proxy component that loads the actual PDF viewer only on the client side
// to completely avoid any SSR issues with PDF.js

const PDFViewerProxy = ({ fileUrl, fileName }: { fileUrl: string, fileName: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Once we're on the client side, dynamically import the real PDFViewer
  const handleViewPDF = () => {
    // Set loading state
    setIsLoading(true);
    
    // Using a small timeout to ensure the UI updates
    setTimeout(() => {
      import('./PDFViewer').then(() => {
        // Successfully loaded the component
        setIsLoading(false);
      }).catch(err => {
        console.error('Error loading PDF viewer:', err);
        setError('Could not load PDF viewer. Please try downloading the PDF instead.');
        setIsLoading(false);
      });
    }, 100);
  };

  return (
    <div className="pdf-viewer-proxy">
      <div className="mb-3 flex justify-between items-center">
        <h3 className="font-semibold text-lg text-gray-900">{fileName}</h3>
        
        <a 
          href={fileUrl} 
          download={fileName}
          className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium flex items-center"
        >
          <FiDownload className="mr-1" />
          Download PDF
        </a>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center h-96 bg-gray-50 border border-gray-200 rounded-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading PDF viewer...</p>
          </div>
        </div>
      ) : (
        <div>PDF viewer loaded</div>
      )}

      <p className="mt-2 text-sm text-gray-500">
        PDF document • If you experience any issues viewing this PDF, please use the download button
      </p>
    </div>
  );
};

export default PDFViewerProxy;