'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';

interface FileViewerProps {
  fileUrl: string;
  mimeType: string;
  fileName: string;
}

const FileViewer: React.FC<FileViewerProps> = ({ fileUrl, mimeType, fileName }) => {
  const { getToken } = useAuth(); // Move useAuth inside component body
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState<any[][]>([]);
  const [viewableData, setViewableData] = useState<any[] | null>(null);
  const [refreshingUrl, setRefreshingUrl] = useState(false);
  // Added for sheet handling
  const [workbookSheets, setWorkbookSheets] = useState<string[]>([]);
  const [sheetData, setSheetData] = useState<{[key: string]: any[][]}>({});

  // Function to check if file is an image
  const isImageFile = (type: string): boolean => {
    const imageTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif', 
      'image/svg+xml', 
      'image/webp', 
      'image/bmp', 
      'image/tiff'
    ];
    return imageTypes.includes(type);
  };

  useEffect(() => {
    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);

        if (mimeType === 'application/pdf') {
          // PDF files are handled by the react-pdf component
          return;
        } else if (isImageFile(mimeType)) {
          // Image files are handled by the ImageViewer component
          return;
        } else if (
          mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          mimeType === 'application/vnd.ms-excel' ||
          mimeType === 'application/x-excel' ||
          mimeType === 'application/x-msexcel' ||
          mimeType === 'text/csv'
        ) {
          // For Excel and CSV files, we'll load data client-side
          // Set a placeholder to trigger dynamic loading
          const exampleData = [
            [{ value: 'Loading spreadsheet data...' }]
          ];
          setSpreadsheetData(exampleData);
          setViewableData(exampleData);
          
          // The actual parsing will be done in the SpreadsheetViewer component
          // which is dynamically imported for client-side only
        } else if (!isImageFile(mimeType)) {
          setError(`Unsupported file type: ${mimeType}. Currently, PDF, Excel, CSV, and common image formats (JPG, PNG, GIF, SVG, etc.) are supported.`);
        }
      } catch (err: any) {
        console.error("Error loading file:", err);
        setError(`Failed to load file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (fileUrl) {
      loadFile();
    }
  }, [fileUrl, mimeType]);

  // No longer need PDF handling methods as they are in PDFViewer component

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Handle refreshing expired URLs
  
  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    try {
      // Test if the URL is valid by sending a HEAD request
      const response = await fetch(fileUrl, { method: 'HEAD' });
      if (!response.ok) {
        e.preventDefault();
        setError('The download link has expired. Refreshing...');
        setRefreshingUrl(true);
        
        // Get a fresh download URL using auth context
        let token = await getToken(true); // Force refresh the token
        
        // Fallback to localStorage if the context method fails
        if (!token) {
          token = localStorage.getItem('authToken');
        }
        
        if (!token) {
          setError('Authentication required. Please refresh the page.');
          setRefreshingUrl(false);
          return;
        }
        
        // Extract document ID from URL if possible
        const urlParts = fileUrl.split('/');
        const potentialDocId = urlParts[urlParts.length - 1]?.split('?')[0];
        
        // Call our API to get a fresh download URL
        const refreshResponse = await fetch('/api/storage/download-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            documentId: potentialDocId || null,
            url: fileUrl
          })
        });
        
        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh download URL');
        }
        
        const data = await refreshResponse.json();
        window.location.href = data.url;
        setRefreshingUrl(false);
        setError(null);
      }
    } catch (err: any) {
      e.preventDefault();
      console.error('Download error:', err);
      setError(`Error accessing file: ${err.message}. Please try refreshing the page.`);
      setRefreshingUrl(false);
    }
  };
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
        <h3 className="font-semibold text-red-800">Error</h3>
        <p className="text-red-700">{error}</p>
        <a 
          href={fileUrl} 
          download={fileName}
          onClick={handleDownload}
          className={`inline-block mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 ${refreshingUrl ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {refreshingUrl ? 'Refreshing URL...' : 'Download file instead'}
        </a>
      </div>
    );
  }

  // For PDF files, use our proxy component that loads the real viewer only on client-side
  if (mimeType === 'application/pdf') {
    // Import the PDFViewerProxy - this is a simple component with no problematic imports
    const PDFViewerProxy = dynamic(
      () => import('./PDFViewerProxy'),
      { 
        ssr: false,
        loading: () => (
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )
      }
    );
    
    return <PDFViewerProxy fileUrl={fileUrl} fileName={fileName} />;
  }

  // For image files, use a lazy-loaded dedicated viewer component
  if (isImageFile(mimeType)) {
    // Import the ImageViewer dynamically to handle SSR issues
    const ImageViewer = dynamic(
      () => import('./ImageViewer').catch(err => {
        console.error('Error loading Image Viewer:', err);
        // Return a fallback component if import fails
        return () => (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md my-2">
            <h3 className="font-semibold text-lg text-yellow-800 mb-2">Image Viewer Not Available</h3>
            <p className="text-yellow-700 mb-3">The image viewer couldn't be loaded in this environment.</p>
            <a 
              href={fileUrl} 
              download={fileName}
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Download Image Instead
            </a>
          </div>
        );
      }),
      { 
        ssr: false, 
        loading: () => (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )
      }
    );
    
    return <ImageViewer fileUrl={fileUrl} fileName={fileName} mimeType={mimeType} />;
  }
  
  // For Excel/CSV files, use a lazy-loaded dedicated viewer component
  if (viewableData && (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/x-excel' ||
    mimeType === 'application/x-msexcel' ||
    mimeType === 'text/csv'
  )) {
    // Import the SpreadsheetViewer dynamically to handle SSR issues
    const SpreadsheetViewer = dynamic(
      () => import('./SpreadsheetViewer').catch(err => {
        console.error('Error loading Spreadsheet Viewer:', err);
        // Return a fallback component if import fails
        return () => (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md my-2">
            <h3 className="font-semibold text-lg text-yellow-800 mb-2">Spreadsheet Viewer Not Available</h3>
            <p className="text-yellow-700 mb-3">The spreadsheet viewer couldn't be loaded in this environment.</p>
            <a 
              href={fileUrl} 
              download={fileName}
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Download Spreadsheet Instead
            </a>
          </div>
        );
      }),
      { 
        ssr: false, 
        loading: () => (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )
      }
    );
    
    return (
      <SpreadsheetViewer 
        spreadsheetData={spreadsheetData} 
        fileName={fileName}
        fileUrl={fileUrl}
        fileType={mimeType === 'text/csv' ? 'csv' : 'excel'}
        workbookSheets={workbookSheets}
        sheetData={sheetData}
      />
    );
  }

  // Fallback - should not reach here due to earlier error handling
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
      <p>No preview available for this file type.</p>
      <a 
        href={fileUrl} 
        download={fileName}
        onClick={handleDownload}
        className={`inline-block mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 ${refreshingUrl ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {refreshingUrl ? 'Refreshing URL...' : 'Download file'}
      </a>
    </div>
  );
};

export default FileViewer;