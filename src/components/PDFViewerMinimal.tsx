'use client';
// Minimal PDF Viewer without any external dependencies
// Uses browser's built-in PDF viewing capabilities

import React from 'react';
import { FiDownload, FiExternalLink } from 'react-icons/fi';

interface PDFViewerMinimalProps {
  fileUrl: string;
  fileName: string;
}

const PDFViewerMinimal: React.FC<PDFViewerMinimalProps> = ({ fileUrl, fileName }) => {
  return (
    <div className="pdf-viewer-minimal w-full">
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
      
      <div className="relative w-full" style={{ height: '80vh' }}>
        <iframe
          src={fileUrl}
          className="w-full h-full border border-gray-300 rounded-md"
          title={`PDF Viewer: ${fileName}`}
        />
      </div>
      
      <p className="mt-2 text-sm text-gray-500">
        PDF document • If you have trouble viewing this PDF, please use the download button above
      </p>
    </div>
  );
};

export default PDFViewerMinimal;