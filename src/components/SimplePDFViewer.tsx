'use client';

import { useState, useRef } from 'react';
import { FiDownload, FiExternalLink } from 'react-icons/fi';

// A simple PDF viewer that uses native browser capabilities
// No dependencies on external libraries like react-pdf or pdfjs-dist

interface SimplePDFViewerProps {
  fileUrl: string;
  fileName: string;
}

const SimplePDFViewer: React.FC<SimplePDFViewerProps> = ({ fileUrl, fileName }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('Unable to load PDF viewer. Your browser might not support PDF viewing.');
  };

  return (
    <div className="pdf-viewer">
      <div className="mb-3 flex justify-between items-center">
        <h3 className="font-semibold text-lg text-gray-900 mr-2">{fileName}</h3>
        
        <div className="flex items-center space-x-3">
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium flex items-center"
          >
            <FiExternalLink className="mr-1.5" />
            Open in New Tab
          </a>
          
          <a 
            href={fileUrl} 
            download={fileName}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium flex items-center"
          >
            <FiDownload className="mr-1.5" />
            Download PDF
          </a>
        </div>
      </div>

      <div className="border border-gray-300 rounded-md overflow-hidden bg-gray-50">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
            <p className="mt-2 text-sm text-red-600">
              Please try downloading the PDF or opening it in a new tab.
            </p>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-80 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
            
            <div className="relative w-full" style={{ height: '80vh' }}>
              {/* Use object tag as primary viewer */}
              <object
                data={fileUrl}
                type="application/pdf"
                width="100%"
                height="100%"
                className="w-full h-full"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              >
                {/* Fallback to iframe if object doesn't work */}
                <iframe
                  ref={iframeRef}
                  src={fileUrl}
                  width="100%"
                  height="100%"
                  className="w-full h-full border-0"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  title={fileName}
                  sandbox="allow-scripts allow-same-origin"
                >
                  <p>
                    Your browser doesn't support PDF viewing. 
                    <a href={fileUrl} download={fileName}>Download the PDF</a> instead.
                  </p>
                </iframe>
              </object>
            </div>
          </>
        )}
      </div>
      
      <p className="mt-2 text-sm text-gray-500">
        PDF document • If you have trouble viewing this PDF, please use the download button above
      </p>
    </div>
  );
};

export default SimplePDFViewer;