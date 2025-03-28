import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';

// Import type definitions directly for TypeScript
import type { 
  ReactGrid, 
  Column, 
  Row, 
  CellChange, 
  TextCell, 
  NumberCell, 
  HeaderCell 
} from '@silevis/reactgrid';

// Simpler dynamic import of ReactGrid component
const DynamicReactGrid = dynamic(
  () => import('@silevis/reactgrid').then(mod => mod.ReactGrid),
  { 
    ssr: false,
    loading: () => <div className="p-4 text-center">Loading spreadsheet viewer...</div>
  }
);

interface ReactGridSpreadsheetViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: 'excel' | 'csv';
}

// Define custom cell types to handle different Excel data
type SpreadsheetCellTypes = TextCell | NumberCell | HeaderCell | { 
  type: "header" | "excel-number" | "excel-date" | "excel-formula" 
};

interface SpreadsheetRow extends Row {
  cells: SpreadsheetCellTypes[];
}

const ReactGridSpreadsheetViewer: React.FC<ReactGridSpreadsheetViewerProps> = ({ 
  fileUrl, 
  fileName, 
  fileType 
}) => {
  const { getToken } = useAuth();
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<SpreadsheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingUrl, setRefreshingUrl] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  
  // Helper function to safely handle number cells
  const createNumberCell = (value: any): NumberCell => {
    // Ensure we have a valid number
    let numValue = 0;
    
    try {
      if (value !== undefined && value !== null) {
        numValue = Number(value);
        if (isNaN(numValue)) {
          numValue = 0;
        }
      }
    } catch (e) {
      console.warn('Error converting value to number:', value, e);
      numValue = 0;
    }
    
    // Return a valid NumberCell without format property
    return {
      type: 'number',
      value: numValue,
      nanToZero: true
    } as NumberCell;
  };

  // Helper function to cache working URLs
  const cacheWorkingUrl = (url: string, storageRef: string | null) => {
    if (!url || !storageRef) return;
    
    try {
      // Store URL and storageRef in localStorage with expiration time (6 days)
      const cacheEntry = {
        url,
        storageRef,
        expires: Date.now() + 6 * 24 * 60 * 60 * 1000 // 6 days
      };
      
      // Use the storageRef as the cache key for better persistence
      localStorage.setItem(`excel_url_cache_${storageRef}`, JSON.stringify(cacheEntry));
      console.log('Cached working URL for storageRef:', storageRef);
    } catch (error) {
      console.error('Error caching URL:', error);
    }
  };
  
  // Helper function to get cached URL
  const getCachedUrl = (storageRef: string | null): string | null => {
    if (!storageRef) return null;
    
    try {
      const cacheKey = `excel_url_cache_${storageRef}`;
      const cacheEntry = localStorage.getItem(cacheKey);
      
      if (cacheEntry) {
        const { url, expires } = JSON.parse(cacheEntry);
        
        // Check if URL is still valid
        if (expires > Date.now()) {
          console.log('Using cached URL for storageRef:', storageRef);
          return url;
        } else {
          // Clear expired cache entry
          localStorage.removeItem(cacheKey);
          console.log('Cached URL expired for storageRef:', storageRef);
        }
      }
    } catch (error) {
      console.error('Error retrieving cached URL:', error);
    }
    
    return null;
  };

  useEffect(() => {
    const loadExcelFile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (fileType !== 'excel' && fileType !== 'csv') {
          setError(`Unsupported file type: ${fileType}`);
          setLoading(false);
          return;
        }

        console.log('Loading Excel file:', fileName);
        
        // Dynamically import xlsx
        let xlsx;
        try {
          xlsx = await import('xlsx');
          console.log('Successfully imported xlsx library');
        } catch (importError) {
          console.error('Failed to import xlsx library:', importError);
          setError('Failed to load Excel viewer: Could not load required libraries');
          setLoading(false);
          return;
        }
        
        // Check for invalid URL scheme (mock://) or mock domain
        if (fileUrl.startsWith('mock://') || fileUrl.includes('storage.example.com')) {
          console.error('Mock URL detected:', fileUrl);
          throw new Error('This file was uploaded in mock mode and cannot be viewed. Please try uploading a real file.');
        }
        
        // Extract document ID for caching
        const docIdMatch = fileUrl.match(/documents\/([^/?]+)/);
        const extractedDocId = docIdMatch ? docIdMatch[1] : null;
        
        // Check for cached URL
        const storagePathMatch = fileUrl.match(/documents\/([^?]+)/);
        const potentialStorageRef = storagePathMatch ? `documents/${storagePathMatch[1]}` : null;
        const cachedUrl = potentialStorageRef ? getCachedUrl(potentialStorageRef) : null;
        
        // Track attempts for debugging
        let attempts = [];
        let arrayBuffer = null;
        
        // Try with cached URL first
        if (cachedUrl) {
          console.log('Trying cached URL:', cachedUrl);
          try {
            // Validate URL scheme before fetching
            if (!cachedUrl.startsWith('http://') && !cachedUrl.startsWith('https://')) {
              console.error('Invalid cached URL scheme:', cachedUrl);
              throw new Error('Invalid URL scheme in cached URL');
            }
          
            const response = await fetch(cachedUrl, {
              method: 'GET',
              mode: 'cors',
              credentials: 'same-origin',
              cache: 'no-cache'
            });
            
            if (response.ok) {
              console.log('Successfully fetched Excel file with cached URL');
              arrayBuffer = await response.arrayBuffer();
              attempts.push({ type: 'cached', success: true });
            } else {
              console.log('Cached URL failed with status:', response.status);
              attempts.push({ type: 'cached', success: false, status: response.status });
            }
          } catch (cachedError) {
            console.error('Error with cached URL:', cachedError);
            attempts.push({ type: 'cached', success: false, error: cachedError.message });
          }
        }
        
        // If cached URL failed, try original URL
        if (!arrayBuffer) {
          console.log('Fetching Excel file from original URL:', fileUrl);
          try {
            // Validate URL scheme before fetching
            if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
              console.error('Invalid original URL scheme:', fileUrl);
              throw new Error('Invalid URL scheme in original URL');
            }
            
            const response = await fetch(fileUrl, {
              method: 'GET',
              mode: 'cors',
              credentials: 'same-origin',
              cache: 'no-cache'
            });
            
            if (response.ok) {
              console.log('Successfully fetched Excel file with original URL');
              arrayBuffer = await response.arrayBuffer();
              attempts.push({ type: 'original', success: true });
            } else {
              console.log('Original URL failed with status:', response.status);
              attempts.push({ type: 'original', success: false, status: response.status });
              
              // If it's a 404 or 403, try to refresh the URL
              if (response.status === 404 || response.status === 403) {
                console.log('URL has expired. Attempting to refresh URL...');
                setRefreshingUrl(true);
                
                // Get token for authentication
                let token = await getToken(true);
                if (!token) {
                  token = localStorage.getItem('authToken');
                }
                
                if (!token) {
                  throw new Error('Authentication required. Please refresh the page.');
                }
                
                // Extract document ID for API call
                const urlParts = fileUrl.split('/');
                const queryIndex = urlParts[urlParts.length - 1]?.indexOf('?');
                const potentialDocId = queryIndex > -1 
                  ? urlParts[urlParts.length - 1]?.substring(0, queryIndex)
                  : urlParts[urlParts.length - 1];
                
                console.log('Requesting fresh URL for file...', {
                  documentId: extractedDocId || potentialDocId,
                  url: fileUrl
                });
                
                try {
                  // Call our API to refresh the URL
                  const refreshResponse = await fetch('/api/storage/download-url', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      documentId: extractedDocId || potentialDocId || null,
                      url: fileUrl
                    })
                  });
                  
                  if (!refreshResponse.ok) {
                    const errorText = await refreshResponse.text();
                    console.error('URL refresh failed with status:', refreshResponse.status, errorText);
                    attempts.push({ 
                      type: 'refresh-request', 
                      success: false, 
                      status: refreshResponse.status,
                      error: errorText
                    });
                    throw new Error(`URL refresh failed: ${refreshResponse.status}`);
                  }
                  
                  const data = await refreshResponse.json();
                  attempts.push({ type: 'refresh-request', success: true });
                  console.log('Received fresh URL from server:', data);
                  
                  // Cache the URL if the server indicated it should be cached
                  if (data.shouldCache && data.storageRef) {
                    cacheWorkingUrl(data.url, data.storageRef);
                  }
                  
                  // Try the new refreshed URL
                  console.log('Trying refreshed URL:', data.url);
                  const newResponse = await fetch(data.url, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'same-origin',
                    cache: 'no-cache'
                  });
                  
                  if (!newResponse.ok) {
                    console.error('Refreshed URL failed with status:', newResponse.status);
                    attempts.push({ 
                      type: 'refreshed-url', 
                      success: false, 
                      status: newResponse.status 
                    });
                    throw new Error(`Still failed to fetch Excel file after URL refresh: ${newResponse.status}`);
                  }
                  
                  console.log('Successfully fetched Excel file with refreshed URL');
                  attempts.push({ type: 'refreshed-url', success: true });
                  arrayBuffer = await newResponse.arrayBuffer();
                  setRefreshingUrl(false);
                } catch (refreshError) {
                  console.error('URL refresh attempt failed:', refreshError);
                  setRefreshingUrl(false);
                  throw new Error(`URL expired and refresh failed: ${refreshError.message}`);
                }
              }
            }
          } catch (originalUrlError) {
            console.error('Error with original URL:', originalUrlError);
            attempts.push({ 
              type: 'original', 
              success: false, 
              error: originalUrlError.message 
            });
            
            // If we still don't have the data, throw the error
            if (!arrayBuffer) {
              throw originalUrlError;
            }
          }
        }
        
        // If we reach here with no arrayBuffer, something went wrong
        if (!arrayBuffer) {
          console.error('Failed to fetch Excel file after all attempts:', attempts);
          throw new Error(`Failed to load Excel file after multiple attempts. Please try downloading the file instead.`);
        }
        
        // Store attempts and array buffer for debugging and sheet switching
        if (typeof window !== 'undefined') {
          (window as any).__excelLoadAttempts = attempts;
          (window as any).__excelArrayBuffer = arrayBuffer;
        }
        
        // Parse the Excel file with error handling
        console.log('Parsing Excel file with SheetJS');
        let workbook;
        try {
          workbook = xlsx.read(arrayBuffer, { 
            type: 'array',
            cellFormula: true,
            cellStyles: true,
            cellDates: true,  // Better date handling
            dateNF: 'yyyy-mm-dd', // Date number format
            WTF: false  // Don't throw on unexpected features
          });
        } catch (parseError) {
          console.error('Error parsing Excel file:', parseError);
          throw new Error(`Failed to parse the Excel file: ${parseError.message || 'Unknown parsing error'}`);
        }
        
        // Store sheet names
        setAvailableSheets(workbook.SheetNames);
        
        // Set the first sheet as active if available
        if (workbook.SheetNames.length > 0) {
          const firstSheet = workbook.SheetNames[0];
          setActiveSheet(firstSheet);
          
          // Process the first sheet with better error handling
          const worksheet = workbook.Sheets[firstSheet];
          if (!worksheet) {
            throw new Error(`Sheet "${firstSheet}" not found in the workbook`);
          }
          
          // Get the range of the sheet
          let range;
          try {
            // Default to a single cell A1 if no range is defined
            const ref = worksheet['!ref'] || 'A1';
            range = xlsx.utils.decode_range(ref);
            console.log(`Sheet "${firstSheet}" range: ${ref}`, range);
          } catch (rangeError) {
            console.error('Error decoding sheet range:', rangeError);
            // Provide a fallback range (just cell A1)
            range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
          }
          const numCols = range.e.c - range.s.c + 1;
          const numRows = range.e.r - range.s.r + 1;
          
          // Create columns
          const gridColumns: Column[] = [];
          // Add row header column
          gridColumns.push({ columnId: 'header', resizable: true, width: 50 });
          
          // Add data columns (A, B, C, etc.)
          for (let i = 0; i <= range.e.c; i++) {
            const columnLetter = xlsx.utils.encode_col(i);
            gridColumns.push({
              columnId: columnLetter,
              resizable: true,
              width: 120,
            });
          }
          
          // Create rows with header row
          const gridRows: SpreadsheetRow[] = [];
          
          // Create header row (A, B, C, etc.)
          const headerCells: SpreadsheetCellTypes[] = [
            { type: 'header', text: '' } as HeaderCell // Corner cell
          ];
          
          for (let i = 0; i <= range.e.c; i++) {
            const columnLetter = xlsx.utils.encode_col(i);
            headerCells.push({ 
              type: 'header', 
              text: columnLetter 
            } as HeaderCell);
          }
          
          gridRows.push({
            rowId: 'header',
            height: 35,
            cells: headerCells
          });
          
          // Create data rows
          for (let r = range.s.r; r <= range.e.r; r++) {
            const rowCells: SpreadsheetCellTypes[] = [
              { type: 'header', text: `${r + 1}` } as HeaderCell // Row header (1, 2, 3, etc.)
            ];
            
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cellAddress = xlsx.utils.encode_cell({ r, c });
              const cell = worksheet[cellAddress];
              
              if (!cell) {
                // Empty cell
                rowCells.push({ type: 'text', text: '' } as TextCell);
                continue;
              }
              
              // Get the value and handle different cell types
              let cellValue = '';
              if (cell.w !== undefined) {
                cellValue = cell.w; // Formatted value
              } else if (cell.v !== undefined) {
                cellValue = String(cell.v); // Raw value
              }
              
              if (cell.t === 'n') {
                // Number cell - use safe helper function
                rowCells.push(createNumberCell(cell.v));
              } else if (cell.t === 'd') {
                // Date cell
                rowCells.push({ 
                  type: 'text', 
                  text: cellValue 
                } as TextCell);
              } else if (cell.f) {
                // Formula cell
                rowCells.push({ 
                  type: 'text', 
                  text: cellValue,
                  className: 'formula-cell'
                } as TextCell);
              } else {
                // Default to text cell
                rowCells.push({ 
                  type: 'text', 
                  text: cellValue 
                } as TextCell);
              }
            }
            
            gridRows.push({
              rowId: `row-${r}`,
              height: 25,
              cells: rowCells
            });
          }
          
          setColumns(gridColumns);
          setRows(gridRows);
        }
        
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading Excel file:', error);
        setError(error.message || 'Failed to load Excel file');
        setLoading(false);
        
        // Make sure download button will be visible
        setDownloadError(`Could not display spreadsheet: ${error.message || 'Unknown error'}. Please try downloading instead.`);
      }
    };
    
    if (fileUrl) {
      loadExcelFile();
    }
  }, [fileUrl, fileType, fileName, getToken]);
  
  // Handle sheet switching
  const handleSheetChange = async (sheetName: string) => {
    try {
      setLoading(true);
      setActiveSheet(sheetName);
      
      // Re-import xlsx
      const xlsx = await import('xlsx');
      
      // Re-parse the workbook from the cached arrayBuffer if available
      const arrayBuffer = typeof window !== 'undefined' ? (window as any).__excelArrayBuffer : null;
      
      if (!arrayBuffer) {
        throw new Error('Cannot switch sheets: Excel data not available');
      }
      
      let workbook;
      try {
        workbook = xlsx.read(arrayBuffer, { 
          type: 'array',
          cellFormula: true,
          cellStyles: true,
          cellDates: true,  // Better date handling
          dateNF: 'yyyy-mm-dd', // Date number format
          WTF: false  // Don't throw on unexpected features
        });
      } catch (parseError) {
        console.error('Error parsing Excel file during sheet switch:', parseError);
        throw new Error(`Failed to parse the Excel file: ${parseError.message || 'Unknown parsing error'}`);
      }
      
      // Process the selected sheet with better error handling
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in the workbook`);
      }
      
      // Get the range of the sheet
      let range;
      try {
        // Default to a single cell A1 if no range is defined
        const ref = worksheet['!ref'] || 'A1';
        range = xlsx.utils.decode_range(ref);
        console.log(`Sheet "${sheetName}" range: ${ref}`, range);
      } catch (rangeError) {
        console.error('Error decoding sheet range:', rangeError);
        // Provide a fallback range (just cell A1)
        range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
      }
      
      // Create columns
      const gridColumns: Column[] = [];
      // Add row header column
      gridColumns.push({ columnId: 'header', resizable: true, width: 50 });
      
      // Add data columns (A, B, C, etc.)
      for (let i = 0; i <= range.e.c; i++) {
        const columnLetter = xlsx.utils.encode_col(i);
        gridColumns.push({
          columnId: columnLetter,
          resizable: true,
          width: 120,
        });
      }
      
      // Create rows with header row
      const gridRows: SpreadsheetRow[] = [];
      
      // Create header row (A, B, C, etc.)
      const headerCells: SpreadsheetCellTypes[] = [
        { type: 'header', text: '' } as HeaderCell // Corner cell
      ];
      
      for (let i = 0; i <= range.e.c; i++) {
        const columnLetter = xlsx.utils.encode_col(i);
        headerCells.push({ 
          type: 'header', 
          text: columnLetter 
        } as HeaderCell);
      }
      
      gridRows.push({
        rowId: 'header',
        height: 35,
        cells: headerCells
      });
      
      // Create data rows
      for (let r = range.s.r; r <= range.e.r; r++) {
        const rowCells: SpreadsheetCellTypes[] = [
          { type: 'header', text: `${r + 1}` } as HeaderCell // Row header
        ];
        
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddress = xlsx.utils.encode_cell({ r, c });
          const cell = worksheet[cellAddress];
          
          if (!cell) {
            // Empty cell
            rowCells.push({ type: 'text', text: '' } as TextCell);
            continue;
          }
          
          // Get the value and handle different cell types
          let cellValue = '';
          if (cell.w !== undefined) {
            cellValue = cell.w; // Formatted value
          } else if (cell.v !== undefined) {
            cellValue = String(cell.v); // Raw value
          }
          
          if (cell.t === 'n') {
            // Number cell - use safe helper function
            rowCells.push(createNumberCell(cell.v));
          } else if (cell.t === 'd') {
            // Date cell
            rowCells.push({ 
              type: 'text', 
              text: cellValue 
            } as TextCell);
          } else if (cell.f) {
            // Formula cell
            rowCells.push({ 
              type: 'text', 
              text: cellValue,
              className: 'formula-cell'
            } as TextCell);
          } else {
            // Default to text cell
            rowCells.push({ 
              type: 'text', 
              text: cellValue 
            } as TextCell);
          }
        }
        
        gridRows.push({
          rowId: `row-${r}`,
          height: 25,
          cells: rowCells
        });
      }
      
      setColumns(gridColumns);
      setRows(gridRows);
      setLoading(false);
    } catch (error: any) {
      console.error('Error switching sheets:', error);
      setError(`Failed to switch to sheet "${sheetName}": ${error.message}`);
      setLoading(false);
    }
  };

  // Handle download
  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    try {
      // First, check if this is a mock URL (which will always fail)
      if (fileUrl.startsWith('mock://') || fileUrl.includes('storage.example.com')) {
        e.preventDefault();
        setDownloadError('This file was uploaded in mock mode and cannot be downloaded. Please try uploading a real file.');
        return;
      }
      
      // Extract document ID for caching
      const docIdMatch = fileUrl.match(/documents\/([^/?]+)/);
      const extractedDocId = docIdMatch ? docIdMatch[1] : null;
      
      // Check for cached URL first
      const storagePathMatch = fileUrl.match(/documents\/([^?]+)/);
      const potentialStorageRef = storagePathMatch ? `documents/${storagePathMatch[1]}` : null;
      const cachedUrl = potentialStorageRef ? getCachedUrl(potentialStorageRef) : null;
      
      // If we have a cached URL, use that
      if (cachedUrl) {
        console.log('Using cached URL for download');
        e.preventDefault();
        window.location.href = cachedUrl;
        return;
      }
      
      // Test if the URL is valid
      const response = await fetch(fileUrl, { method: 'HEAD' });
      if (!response.ok) {
        e.preventDefault();
        setDownloadError('The download link has expired. Refreshing...');
        setRefreshingUrl(true);
        
        // Get token for authentication
        let token = await getToken(true);
        if (!token) {
          token = localStorage.getItem('authToken');
        }
        
        if (!token) {
          setDownloadError('Authentication required. Please refresh the page.');
          setRefreshingUrl(false);
          return;
        }
        
        // Extract document ID for API call
        const urlParts = fileUrl.split('/');
        const potentialDocId = urlParts[urlParts.length - 1]?.split('?')[0];
        
        // Call our API to refresh the URL
        const refreshResponse = await fetch('/api/storage/download-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            documentId: extractedDocId || potentialDocId || null,
            url: fileUrl
          })
        });
        
        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh download URL');
        }
        
        const data = await refreshResponse.json();
        
        // Cache the URL if indicated
        if (data.shouldCache && data.storageRef) {
          cacheWorkingUrl(data.url, data.storageRef);
        }
        
        window.location.href = data.url;
        setRefreshingUrl(false);
        setDownloadError(null);
      }
    } catch (err: any) {
      e.preventDefault();
      console.error('Download error:', err);
      setDownloadError(`Error accessing file: ${err.message}. Please try refreshing the page.`);
      setRefreshingUrl(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

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

  return (
    <div className="excel-viewer">
      {/* Inlined ReactGrid styles */}
      <style global jsx>{`
        @charset "UTF-8";
        .rg-celleditor-input, .rg-celleditor .rg-input {
          width: 100%;
          height: 100%;
          border: 0;
          padding: 0;
          margin: 0;
          background: transparent;
          font-size: 1em;
          outline: none;
        }

        .rg-celleditor {
          box-sizing: border-box;
          z-index: 5;
          background-color: #ffffff;
          box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.06);
          display: flex;
          border-style: solid;
          border-color: #3579f8;
          border-width: 2px;
          padding: 0 4px;
        }
        .rg-number-celleditor input {
          text-align: right;
        }

        .reactgrid-content .rg-pane .rg-cell.rg-number-cell,
        .reactgrid-content .rg-pane .rg-cell .rg-time-cell,
        .reactgrid-content .rg-pane .rg-cell .rg-date-cell {
          justify-content: flex-end;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-email-cell.rg-invalid {
          color: rgb(255, 0, 0);
        }
        .reactgrid-content .rg-pane .rg-cell.rg-text-cell.placeholder {
          color: #999;
          font-size: 0.8em;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell {
          align-items: center;
          justify-content: center;
          padding: 0;
          margin: 0;
          background: transparent;
          pointer-events: auto;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell input {
          width: 20px;
          height: 20px;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-chevron-cell .chevron {
          pointer-events: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: bold;
          margin-right: 0.1em;
          cursor: pointer;
          transition: 200ms all ease-in-out;
          height: 1em;
          width: 1em;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-chevron-cell .no-child {
          width: 0.5em;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-chevron-cell.expanded .chevron {
          transform: rotate(90deg);
        }
        .reactgrid-content .rg-pane .rg-cell.rg-chevron-cell.collapsed .chevron {
          transform: rotate(0deg);
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell {
          justify-content: center;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell label {
          position: relative;
          height: 18px;
          width: 18px;
          cursor: pointer;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          margin: 0;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell label input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          margin: 0;
          height: 18px;
          width: 18px;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell span {
          position: absolute;
          top: 0;
          left: 0;
          height: 18px;
          width: 18px;
          background-color: #eeeeee;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell label:hover input ~ span {
          background-color: #cccccc;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell label input:checked ~ span {
          background-color: #3579f8;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell span:after {
          content: "";
          position: absolute;
          display: none;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell label input:checked ~ span:after {
          display: block;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-checkbox-cell label span:after {
          left: 7px;
          top: 2px;
          width: 4px;
          height: 12px;
          border: solid #ffffff;
          border-width: 0 3px 3px 0;
          -webkit-transform: rotate(45deg);
          -ms-transform: rotate(45deg);
          transform: rotate(45deg);
        }
        .reactgrid-content .rg-pane .rg-cell.rg-dropdown-cell {
          padding: 0;
          overflow: visible;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-dropdown-cell .rg-dropdown-menu {
          top: 100%;
          background-color: #ffffff;
          border-radius: 4px;
          box-shadow: 0px 0px 7px rgba(0, 0, 0, 0.5);
          margin-bottom: 8px;
          margin-top: 2px;
          position: absolute;
          width: 100%;
          z-index: 1;
          box-sizing: border-box;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-dropdown-cell .rg-dropdown-option {
          padding: 0.3em 0.5em;
          min-height: 1.5em;
          display: flex;
          align-items: center;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-dropdown-cell .rg-dropdown-option.selected::before {
          content: "✓";
          padding-right: 0.2em;
        }
        .reactgrid-content .rg-pane .rg-cell.rg-dropdown-cell .rg-dropdown-option.focused {
          color: black;
          background-color: #f1f6ff;
        }

        .rg-copy-container[contenteditable] {
          -webkit-user-select: text;
          user-select: text;
        }

        .reactgrid-content {
          user-select: none;
          -moz-user-select: none;
          -webkit-user-select: none;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          align-items: flex-start;
          color: #000000;
        }
        .reactgrid-content .rg-pane.rg-pane-top, .reactgrid-content .rg-pane.rg-pane-bottom, .reactgrid-content .rg-pane.rg-pane-left, .reactgrid-content .rg-pane.rg-pane-right {
          position: sticky;
          position: -webkit-sticky;
          background-color: #ffffff;
        }
        .reactgrid-content .rg-pane.rg-pane-top {
          top: 0;
        }
        .reactgrid-content .rg-pane.rg-pane-bottom {
          bottom: 0;
        }
        .reactgrid-content .rg-pane.rg-pane-left {
          left: 0;
        }
        .reactgrid-content .rg-pane.rg-pane-right {
          right: 0;
        }
        .reactgrid-content .rg-pane .rg-cell {
          font-size: 1em;
          box-sizing: border-box;
          white-space: nowrap;
          position: absolute;
          display: flex;
          flex-direction: row;
          align-items: center;
          overflow: hidden;
          padding: 0 4px;
          outline: none;
          touch-action: auto;
          border-color: #e8e8e8;
          color: #000000;
        }
        .reactgrid-content .rg-pane .rg-cell .rg-touch-column-resize-handle {
          position: absolute;
          top: 0;
          right: 0;
          width: 11px;
          height: 100%;
          pointer-events: auto;
        }
        .reactgrid-content .rg-pane .rg-cell .rg-touch-column-resize-handle .rg-resize-handle {
          position: absolute;
          right: 0;
          width: 6px;
          height: 100%;
        }
        .reactgrid-content .rg-pane .rg-cell .rg-touch-column-resize-handle .rg-resize-handle:hover {
          cursor: col-resize;
          background-color: #3579f8;
        }
        .reactgrid-content .rg-pane .rg-cell .rg-touch-row-resize-handle {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 11px;
          width: 100%;
          pointer-events: auto;
        }
        .reactgrid-content .rg-pane .rg-cell .rg-touch-row-resize-handle .rg-resize-handle {
          position: absolute;
          bottom: 0;
          height: 6px;
          width: 100%;
        }
        .reactgrid-content .rg-pane .rg-cell .rg-touch-row-resize-handle .rg-resize-handle:hover {
          cursor: row-resize;
          background-color: #3579f8;
        }
        .reactgrid-content .rg-pane .rg-cell .rg-groupId {
          font-size: 0.8em;
          position: absolute;
          right: 4px;
          top: 4px;
        }
        .reactgrid-content .rg-pane .rg-cell-focus,
        .reactgrid-content .rg-pane .rg-cell-highlight {
          position: absolute;
          pointer-events: none;
          box-sizing: border-box;
          border-style: solid;
          border-width: 2px;
          border-color: #3579f8;
        }
        .reactgrid-content .rg-pane .rg-touch-fill-handle {
          position: absolute;
          width: 40px;
          height: 40px;
          background-color: rgba(255, 255, 255, 0.01);
          touch-action: none;
          pointer-events: auto;
        }
        .reactgrid-content .rg-pane .rg-touch-fill-handle .rg-fill-handle {
          position: absolute;
          cursor: crosshair;
          top: 50%;
          left: 50%;
          transform: translate(calc(-50% - (1px/ 2)), calc(-50% - (1px/ 2)));
          width: 6.5px;
          height: 6.5px;
          background-color: #3579f8;
          border-width: 1px;
          border-style: solid;
          border-color: #ffffff;
          background-clip: content-box;
        }
        .reactgrid-content .rg-pane .rg-partial-area {
          position: absolute;
          pointer-events: none;
          box-sizing: border-box;
        }
        .reactgrid-content .rg-pane .rg-partial-area.rg-partial-area-part {
          border-width: 1px;
          border-style: dashed;
          border-color: #000000;
        }
        .reactgrid-content .rg-pane .rg-partial-area.rg-partial-area-selected-range {
          border-width: 1px;
          border-style: solid;
          border-color: #3579f8;
          background-color: rgba(53, 121, 248, 0.35);
        }
        .reactgrid-content .rg-pane-shadow {
          position: sticky;
        }
        .reactgrid-content .rg-pane-shadow.shadow-top {
          pointer-events: none;
          top: 0;
          box-shadow: 2px 2px 3px 1px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-pane-shadow.shadow-left {
          pointer-events: none;
          left: 0;
          box-shadow: 5px 0 3px -2px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-pane-shadow.shadow-bottom {
          pointer-events: none;
          bottom: 0;
          box-shadow: 2px -1px 3px 1px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-pane-shadow.shadow-right {
          pointer-events: none;
          right: 0;
          box-shadow: -5px 0 3px -2px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-pane-shadow.shadow-top-left-corner {
          box-shadow: 2px 3px 3px 1px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-pane-shadow.shadow-top-right-corner {
          box-shadow: -2px 2px 3px 1px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-pane-shadow.shadow-bottom-left-corner {
          box-shadow: 2px -2px 3px 1px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-pane-shadow.shadow-bottom-right-corner {
          box-shadow: -2px -2px 3px 1px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-context-menu {
          position: fixed;
          z-index: 1000;
          background-color: #ffffff;
          font-size: 1em;
          box-shadow: 0px 0px 8px 2px rgba(0, 0, 0, 0.06);
        }
        .reactgrid-content .rg-context-menu .rg-context-menu-option {
          padding: 8px 20px 8px 15px;
          cursor: pointer;
        }
        .reactgrid-content .rg-context-menu .rg-context-menu-option:hover {
          background-color: #f2f2f2;
        }
        .reactgrid-content .rg-shadow {
          position: absolute;
          background-color: #000000;
          opacity: 0.1;
          z-index: 4;
        }
        .reactgrid-content .rg-column-resize-hint {
          background-color: #74b9ff;
          position: absolute;
          padding: 5px;
          border-radius: 0 5px 5px 0;
        }
        .reactgrid-content .rg-row-resize-hint {
          background-color: #74b9ff;
          position: absolute;
          padding: 5px;
          border-radius: 0 5px 5px 0;
        }
        .reactgrid-content .rg-line {
          position: absolute;
          background-color: #74b9ff;
          z-index: 4;
        }
        .reactgrid-content .rg-line-horizontal {
          left: 0;
          height: 2px;
        }
        .reactgrid-content .rg-line-vertical {
          top: 0;
          width: 2px;
        }
        .reactgrid-content .rg-hidden-element {
          border: 0;
          padding: 0;
          margin: 0;
          position: fixed;
          width: 1px;
          height: 1px;
          opacity: 0;
          top: 50%;
          left: 50%;
        }
        
        /* Custom styles */
        .formula-cell {
          font-style: italic;
          color: #4f46e5;
        }
        
        .header-cell {
          background-color: #f3f4f6;
          font-weight: bold;
          text-align: center;
        }
        
        .react-grid-Container {
          height: 600px;
          width: 100%;
          overflow: auto;
        }
        
        .rg-cell.rg-cell-selected {
          background-color: rgba(59, 130, 246, 0.2);
        }
      `}</style>

      <div className="mb-4 flex flex-wrap justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">{fileName}</h3>
        </div>
        <div className="flex space-x-2">
          <a 
            href={fileUrl} 
            download={fileName}
            onClick={handleDownload}
            className={`flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium ${refreshingUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {refreshingUrl ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download {fileType === 'csv' ? 'CSV' : 'Excel'}
              </>
            )}
          </a>
        </div>
      </div>
      
      {downloadError && (
        <div className="mb-3 bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md text-sm flex items-center">
          <svg className="w-5 h-5 mr-2 text-yellow-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {downloadError}
        </div>
      )}
      
      {/* Sheet selector */}
      {availableSheets.length > 1 && (
        <div className="mb-3 bg-white border border-gray-300 rounded-md overflow-hidden">
          <div className="flex overflow-x-auto">
            {availableSheets.map((sheetName) => (
              <button
                key={sheetName}
                onClick={() => handleSheetChange(sheetName)}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 focus:outline-none ${
                  activeSheet === sheetName
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
                title={`Switch to sheet: ${sheetName}`}
              >
                <svg 
                  className={`w-4 h-4 mr-1 inline-block ${activeSheet === sheetName ? 'text-blue-500' : 'text-gray-400'}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                {sheetName}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* The Excel Grid */}
      <div className="react-grid-Container border border-gray-300 rounded-lg overflow-hidden">
        <DynamicReactGrid
          rows={rows}
          columns={columns}
          enableRangeSelection
          enableColumnSelection
          enableRowSelection
          stickyTopRows={1}
          stickyLeftColumns={1}
          focusCellOnClick
        />
      </div>
    </div>
  );
};

export default ReactGridSpreadsheetViewer;