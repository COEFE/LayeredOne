'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { FiZoomIn, FiZoomOut, FiMaximize, FiMinimize2 } from 'react-icons/fi';

interface ImageViewerProps {
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ fileUrl, fileName, mimeType }) => {
  const [fullScreen, setFullScreen] = useState(false);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Predefined zoom levels
  const zoomLevels = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];

  const handleImageError = () => {
    setError(true);
  };

  const toggleFullScreen = () => {
    setFullScreen(!fullScreen);
    // Reset zoom when toggling fullscreen
    setScale(1);
  };
  
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

  const getFileType = () => {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'JPEG';
    if (mimeType.includes('png')) return 'PNG';
    if (mimeType.includes('gif')) return 'GIF';
    if (mimeType.includes('svg')) return 'SVG';
    if (mimeType.includes('webp')) return 'WebP';
    if (mimeType.includes('bmp')) return 'BMP';
    if (mimeType.includes('tiff')) return 'TIFF';
    return mimeType.split('/')[1]?.toUpperCase() || 'Image';
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h3 className="font-semibold text-red-800">Error loading image</h3>
        <p className="text-red-700">The image could not be displayed.</p>
        <a 
          href={fileUrl} 
          download={fileName}
          className="inline-block mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Download image instead
        </a>
      </div>
    );
  }

  return (
    <div className="image-viewer">
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
          
          <button
            onClick={toggleFullScreen}
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md flex items-center border border-gray-300 shadow-sm"
            title={fullScreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {fullScreen ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize className="w-4 h-4" />}
          </button>
          
          <a 
            href={fileUrl} 
            download={fileName}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium"
          >
            Download {getFileType()}
          </a>
        </div>
      </div>

      <div 
        className={`border border-gray-300 rounded-md overflow-hidden ${fullScreen ? 'fixed inset-0 z-50 bg-black flex items-center justify-center p-4' : ''}`}
      >
        {fullScreen && (
          <button 
            onClick={toggleFullScreen}
            className="absolute top-4 right-4 bg-gray-800 text-white p-2 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* For SVG files, use an iframe for better rendering */}
        {mimeType === 'image/svg+xml' ? (
          <iframe 
            src={fileUrl} 
            className="w-full h-full border-none min-h-[400px]" 
            title={fileName}
          />
        ) : (
          /* For other image types */
          <div className={`relative ${fullScreen ? 'max-w-full max-h-full' : 'w-full h-full'} overflow-auto`}>
            {/* Using img tag instead of next/image since we're handling dynamic URLs */}
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.2s ease' }} 
                 className="flex justify-center items-center min-h-full">
              <img
                ref={imageRef}
                src={fileUrl}
                alt={fileName}
                onError={handleImageError}
                className={`${fullScreen ? 'max-h-[90vh]' : 'max-h-[600px]'} object-contain`}
              />
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-sm text-gray-500">
        {getFileType()} image • Use zoom controls to resize or click Full Screen to view in larger size
      </p>
    </div>
  );
};

export default ImageViewer;