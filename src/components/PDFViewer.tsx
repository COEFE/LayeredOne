'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FiZoomIn, FiZoomOut, FiMinimize2 } from 'react-icons/fi';

// This component is specifically for PDF viewing and will be dynamically imported
// to prevent canvas-related errors during server-side rendering

const PDFViewer = ({ fileUrl, fileName }: { fileUrl: string, fileName: string }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [isPdfJsLoaded, setPdfJsLoaded] = useState(false);
  
  // Predefined zoom levels
  const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
  
  // Dynamically import pdfjs to avoid SSR issues
  const Document = dynamic(
    () => import('react-pdf').then(mod => {
      // Once the module is loaded, set up the worker
      import('react-pdf/dist/esm/pdfjs').then(pdfjs => {
        if (typeof window !== 'undefined') {
          // Use CDN-hosted worker to avoid bundling issues
          pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
          setPdfJsLoaded(true);
        }
      }).catch(err => {
        console.error('Error loading PDF.js:', err);
        setError('Error loading PDF viewer: ' + err.message);
      });
      return mod.Document;
    }).catch(err => {
      console.error('Error loading react-pdf:', err);
      setError('Error loading PDF viewer: ' + err.message);
      // Return a dummy component
      return () => <div>PDF viewer not available</div>;
    }),
    { 
      ssr: false,
      loading: () => (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )
    }
  );
  
  const Page = dynamic(
    () => import('react-pdf').then(mod => mod.Page).catch(err => {
      console.error('Error loading react-pdf Page:', err);
      return () => <div>PDF page not available</div>;
    }),
    { ssr: false }
  );

  // PDF document loaded successfully
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Handle page navigation for PDFs
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, numPages || 1));
  
  // Zoom functionality
  const zoomIn = () => {
    const currentIndex = zoomLevels.indexOf(scale);
    if (currentIndex < zoomLevels.length - 1) {
      setScale(zoomLevels[currentIndex + 1]);
    }
  };
  
  const zoomOut = () => {
    const currentIndex = zoomLevels.indexOf(scale);
    if (currentIndex > 0) {
      setScale(zoomLevels[currentIndex - 1]);
    }
  };
  
  const resetZoom = () => {
    setScale(1.0);
  };

  // If we couldn't load the PDF.js library, show an error
  if (error) {
    return (
      <div className="pdf-viewer">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-red-700">{error}</p>
          <a 
            href={fileUrl} 
            download={fileName}
            className="mt-3 inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Download PDF Instead
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      {/* Controls bar with zoom */}
      <div className="mb-3 flex justify-between items-center">
        <h3 className="font-semibold text-lg text-gray-900 mr-2">{fileName}</h3>
        
        <div className="flex items-center space-x-3">
          {/* Zoom controls */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Zoom:</span>
            <div className="flex border border-gray-300 rounded-md overflow-hidden shadow-sm">
              <button
                onClick={zoomOut}
                disabled={scale === zoomLevels[0]}
                className="p-2 bg-gray-50 hover:bg-gray-100 border-r border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom Out"
              >
                <FiZoomOut className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 bg-white hover:bg-gray-50 border-r border-gray-300 text-xs font-medium text-gray-700"
                title="Reset Zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={zoomIn}
                disabled={scale === zoomLevels[zoomLevels.length - 1]}
                className="p-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom In"
              >
                <FiZoomIn className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>
          
          <a 
            href={fileUrl} 
            download={fileName}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium"
          >
            Download PDF
          </a>
        </div>
      </div>

      <div className="border border-gray-300 rounded-md overflow-auto">
        {isPdfJsLoaded ? (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => setError(error.message)}
            className="flex justify-center"
            loading={
              <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            }
          >
            <Page 
              pageNumber={currentPage} 
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="pdf-page"
            />
          </Document>
        ) : (
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      
      {numPages && numPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="px-3 py-1 bg-gray-200 rounded-md disabled:opacity-50"
          >
            Previous
          </button>
          <p className="text-sm font-medium">
            Page {currentPage} of {numPages}
          </p>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= (numPages || 1)}
            className="px-3 py-1 bg-gray-200 rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
      
      <p className="mt-2 text-sm text-gray-500">
        PDF document • Use zoom controls to adjust the document size for better reading • Text can be selected and copied
      </p>
    </div>
  );
};

export default PDFViewer;