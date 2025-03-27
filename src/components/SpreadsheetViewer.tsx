'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

// This component is specifically for Excel/CSV viewing and will be dynamically imported
// to prevent any SSR issues

interface SpreadsheetViewerProps {
  spreadsheetData: any[][];
  fileName: string;
  fileUrl: string;
  fileType: 'excel' | 'csv';
  // Added for sheet support
  workbookSheets?: string[];
  sheetData?: {[key: string]: any[][]};
}

// Function to chunk data for pagination
const chunkArray = (array: any[][], size: number) => {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
};

const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({ 
  spreadsheetData, 
  fileName, 
  fileUrl, 
  fileType,
  workbookSheets = [], // Default to empty array if not provided
  sheetData = {}  // Default to empty object if not provided
}) => {
  const { getToken } = useAuth(); // Move useAuth inside component body
  
  // Constants
  const PAGE_SIZE = 100; // Number of rows per page
  
  // State for sheet handling
  const [activeSheet, setActiveSheet] = useState<string>(workbookSheets[0] || '');
  const [currentData, setCurrentData] = useState<any[][]>(spreadsheetData);
  
  // State for pagination and download handling
  const [currentPage, setCurrentPage] = useState(0);
  const [showFullData, setShowFullData] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [refreshingUrl, setRefreshingUrl] = useState(false);
  const [isRenderingLargeData, setIsRenderingLargeData] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{row: number, col: number}[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [cellStyles, setCellStyles] = useState<{[key: string]: {[key: string]: string}}>({});
  
  // Reference to the spreadsheet container for horizontal scroll with wheel
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Derived values based on current sheet
  const totalRows = currentData.length;
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);
  
  // Load spreadsheet data on client side to avoid SSR issues
  useEffect(() => {
    const loadSpreadsheetData = async () => {
      try {
        if (fileType === 'excel') {
          // Dynamically import xlsx only on client-side
          const xlsx = await import('xlsx');
          
          // Fetch and process Excel file
          const response = await fetch(fileUrl);
          const arrayBuffer = await response.arrayBuffer();
          const workbook = xlsx.read(arrayBuffer);
          
          // Store sheet names
          setWorkbookSheets(workbook.SheetNames);
          
          // Process each sheet in the workbook separately
          const sheetsObj: {[key: string]: any[][]} = {};
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to array of arrays
            const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
              header: 1,
              defval: '',  // Default value for empty cells
              blankrows: true,  // Include blank rows
              raw: false // Convert values to strings
            });
            
            // Get cell styles for this sheet
            const sheetStyles: {[key: string]: {[key: string]: string}} = {};
            
            // Process each cell to extract formatting information
            const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
            for (let r = range.s.r; r <= range.e.r; ++r) {
              for (let c = range.s.c; c <= range.e.c; ++c) {
                const cellAddress = xlsx.utils.encode_cell({r, c});
                const cell = worksheet[cellAddress];
                
                if (!cell) continue;
                
                // Initialize style object for this cell
                if (!sheetStyles[r]) sheetStyles[r] = {};
                
                // Handle number formatting
                if (cell.t === 'n') {
                  if (cell.z === '0.00%') {
                    sheetStyles[r][c] = 'percentage';
                  } else if (cell.z && (cell.z.includes('$') || cell.z.includes('€') || cell.z.includes('£'))) {
                    sheetStyles[r][c] = 'currency';
                  } else if (cell.z && cell.z.includes('/')) {
                    sheetStyles[r][c] = 'date';
                  } else {
                    sheetStyles[r][c] = 'number';
                  }
                }
                
                // Handle date cells
                if (cell.t === 'd') {
                  sheetStyles[r][c] = 'date';
                }
                
                // Handle bold text
                if (cell.s && cell.s.font && (cell.s.font.bold || cell.s.font.sz > 12)) {
                  sheetStyles[r][c] = (sheetStyles[r][c] || '') + ' bold';
                }
                
                // Handle text alignment
                if (cell.s && cell.s.alignment) {
                  if (cell.s.alignment.horizontal === 'center') {
                    sheetStyles[r][c] = (sheetStyles[r][c] || '') + ' centered';
                  } else if (cell.s.alignment.horizontal === 'right') {
                    sheetStyles[r][c] = (sheetStyles[r][c] || '') + ' right-aligned';
                  }
                }
              }
            }
            
            // Format for our custom table view
            const formattedData = jsonData.map((row: any, rowIndex: number) => 
              Array.isArray(row) 
                ? row.map((cell, colIndex) => {
                    // Get the raw value
                    const rawValue = cell?.toString() || '';
                    
                    // Get any style info for this cell
                    const style = sheetStyles[rowIndex] && sheetStyles[rowIndex][colIndex] 
                                  ? sheetStyles[rowIndex][colIndex] 
                                  : '';
                    
                    // Look for formulas in the original sheet
                    const cellAddress = xlsx.utils.encode_cell({r: rowIndex, c: colIndex});
                    const originalCell = worksheet[cellAddress];
                    const hasFormula = originalCell && originalCell.f;
                    
                    return { 
                      value: rawValue, 
                      style, 
                      hasFormula,
                      formula: hasFormula ? originalCell.f : undefined
                    };
                  })
                : [{ value: row?.toString() || '', style: '' }]
            );
            
            // Store styles for this sheet
            setCellStyles(prev => ({
              ...prev,
              [sheetName]: sheetStyles
            }));
            
            // Store this sheet's data
            sheetsObj[sheetName] = formattedData;
          });
          
          // Store all sheet data
          setSheetData(sheetsObj);
          
          // Set the first sheet as the default view if available
          if (workbook.SheetNames.length > 0) {
            const firstSheet = workbook.SheetNames[0];
            setActiveSheet(firstSheet);
            setCurrentData(sheetsObj[firstSheet] || []);
          } else {
            setCurrentData([]);
          }
        } else if (fileType === 'csv') {
          // Dynamically import papaparse only on client-side
          const Papa = (await import('papaparse')).default;
          
          // Fetch and process CSV file
          const response = await fetch(fileUrl);
          const text = await response.text();
          
          // Parse CSV
          const result = Papa.parse(text, {
            header: false,
            skipEmptyLines: false,  // Include empty rows for completeness
            delimitersToGuess: [',', '\t', '|', ';'] // Try to autodetect delimiter
          });
          
          // Format for our table view
          const formattedData = result.data.map((row: any) => 
            row.map((cell: any) => ({ value: cell || '' }))
          );
          
          setCurrentData(formattedData);
        }
      } catch (err) {
        console.error("Error loading spreadsheet data:", err);
      }
    };
    
    // Load data on client side
    if (typeof window !== 'undefined') {
      loadSpreadsheetData();
    }
  }, [fileUrl, fileType]);
  
  // Effect to update current data when active sheet changes
  useEffect(() => {
    if (workbookSheets.length > 0 && sheetData && Object.keys(sheetData).length > 0) {
      // If we have multiple sheets and the sheet exists
      if (activeSheet && sheetData[activeSheet]) {
        setCurrentData(sheetData[activeSheet]);
      }
    } else {
      // Otherwise just use the provided spreadsheet data
      setCurrentData(spreadsheetData);
    }
    // Reset pagination when sheet changes
    setCurrentPage(0);
  }, [activeSheet, spreadsheetData, sheetData, workbookSheets]);
  
  // Create pages of data
  const pages = chunkArray(currentData, PAGE_SIZE);
  const currentPageData = pages[currentPage] || [];
  
  // Handle page changes
  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };
  
  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };
  
  // Handle horizontal scrolling with mousewheel (Excel-like behavior)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      // If user is holding shift, don't override the natural horizontal scroll
      if (e.shiftKey) return;
      
      // If the vertical scroll is at the top or bottom edge, allow normal behavior
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
      
      // Only prevent default if we're not at the edges, to allow natural vertical scrolling
      if (!(isAtTop && e.deltaY < 0) && !(isAtBottom && e.deltaY > 0)) {
        // Convert vertical scroll to horizontal when holding Ctrl key (Excel behavior)
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      }
    };
    
    container.addEventListener('wheel', handleWheel);
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);
  
  // Set loading state when switching to full data view for large spreadsheets
  useEffect(() => {
    if (showFullData && totalRows > 500) {
      setIsRenderingLargeData(true);
      
      // Use a small delay to allow the UI to update with loading state
      const timer = setTimeout(() => {
        setIsRenderingLargeData(false);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [showFullData, totalRows]);
  
  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };
  
  // Export functions
  const exportToCSV = () => {
    try {
      // Create CSV content
      const csvContent = (showFullData ? currentData : pages[currentPage] || [])
        .map(row => 
          row.map(cell => {
            const value = typeof cell === 'object' && cell !== null ? (cell.value || '') : (cell || '');
            // Quote values containing commas or quotes
            if (value.toString().includes(',') || value.toString().includes('"')) {
              return `"${value.toString().replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
        .join('\n');
      
      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName.replace(/\.[^/.]+$/, '')}_${activeSheet}_export.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
    }
  };
  
  const exportToJSON = () => {
    try {
      // Create JSON content
      const jsonData = (showFullData ? currentData : pages[currentPage] || [])
        .map(row => 
          row.map(cell => 
            typeof cell === 'object' && cell !== null ? cell.value : cell
          )
        );
      
      // Create a blob and download link
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName.replace(/\.[^/.]+$/, '')}_${activeSheet}_export.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to JSON:', error);
    }
  };
  
  // Export to HTML table
  const exportToHTML = () => {
    try {
      const tableData = showFullData ? currentData : pages[currentPage] || [];
      
      // Create HTML content with basic styling
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName} - ${activeSheet}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background-color: #f2f2f2; font-weight: bold; text-align: left; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .numeric { text-align: right; }
          </style>
        </head>
        <body>
          <h1>${fileName} - ${activeSheet}</h1>
          <table>
            <thead>
              <tr>
                <th></th>
                ${Array.from({ length: tableData[0]?.length || 0 }).map((_, i) => 
                  `<th>${String.fromCharCode(65 + i)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableData.map((row, rowIndex) => `
                <tr>
                  <th>${rowIndex + 1}</th>
                  ${row.map(cell => {
                    const value = typeof cell === 'object' && cell !== null ? cell.value : cell;
                    const style = typeof cell === 'object' && cell !== null && cell.style ? cell.style : '';
                    
                    return `<td class="${style.includes('number') || style.includes('currency') ? 'numeric' : ''}">${value || ''}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p><small>Exported from ${window.location.origin} on ${new Date().toLocaleString()}</small></p>
        </body>
        </html>
      `;
      
      // Create a blob and download link
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName.replace(/\.[^/.]+$/, '')}_${activeSheet}_export.html`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to HTML:', error);
    }
  };
  
  // Search functionality
  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }
    
    setIsSearching(true);
    
    // Search the data for matches
    const results: {row: number, col: number}[] = [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    // Determine which data to search
    const dataToSearch = showFullData ? currentData : pages[currentPage] || [];
    
    dataToSearch.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellValue = typeof cell === 'object' && cell !== null 
                         ? cell.value?.toString().toLowerCase() || '' 
                         : (cell || '').toString().toLowerCase();
                         
        if (cellValue.includes(lowerSearchTerm)) {
          // For pagination mode, adjust the row index based on current page
          const actualRowIndex = showFullData ? rowIndex : (currentPage * PAGE_SIZE) + rowIndex;
          results.push({ row: actualRowIndex, col: colIndex });
        }
      });
    });
    
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    setIsSearching(false);
    
    // Scroll to the first result if found
    if (results.length > 0) {
      scrollToCell(results[0].row, results[0].col);
    }
  };
  
  // Navigate through search results
  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentSearchIndex(newIndex);
    scrollToCell(searchResults[newIndex].row, searchResults[newIndex].col);
  };
  
  // Helper function to scroll to a specific cell
  const scrollToCell = (rowIndex: number, colIndex: number) => {
    // If we're in pagination mode, make sure we're on the right page
    if (!showFullData) {
      const targetPage = Math.floor(rowIndex / PAGE_SIZE);
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
        // We need to delay the scrolling until after the page change renders
        setTimeout(() => {
          const cellElement = document.querySelector(
            `[data-row="${rowIndex}"][data-column="${colIndex}"]`
          );
          if (cellElement) {
            cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
    }
    
    // Scroll to the cell
    const cellElement = document.querySelector(
      `[data-row="${rowIndex}"][data-column="${colIndex}"]`
    );
    if (cellElement) {
      cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  // Format cell value based on style
  const formatCellValue = (cell: any) => {
    if (!cell || !cell.value) return '';
    
    const value = cell.value;
    const style = cell.style || '';
    
    // Show formula hint if present
    if (cell.hasFormula && cell.formula) {
      return (
        <div>
          <div>{value}</div>
          <div className="text-xs text-gray-500 italic truncate" title={cell.formula}>
            ={cell.formula}
          </div>
        </div>
      );
    }
    
    if (style.includes('percentage') && !isNaN(parseFloat(value))) {
      return `${(parseFloat(value) * 100).toFixed(2)}%`;
    }
    
    if (style.includes('currency') && !isNaN(parseFloat(value))) {
      return new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: 'USD' 
      }).format(parseFloat(value));
    }
    
    if (style.includes('date') && !isNaN(Date.parse(value))) {
      return new Date(value).toLocaleDateString();
    }
    
    if (style.includes('number') && !isNaN(parseFloat(value))) {
      return new Intl.NumberFormat().format(parseFloat(value));
    }
    
    return value;
  };
  
  // Get cell class based on style
  const getCellClass = (cell: any, isSelected: boolean = false) => {
    if (!cell || !cell.style) return 'cell';
    
    const style = cell.style;
    let classes = 'cell';
    
    if (style.includes('bold')) classes += ' font-bold';
    if (style.includes('centered')) classes += ' text-center';
    if (style.includes('right-aligned')) classes += ' text-right';
    if (style.includes('number') || style.includes('percentage') || style.includes('currency')) {
      classes += ' cell-numeric';
    }
    
    // Selected cell highlighting for search results
    if (isSelected) {
      classes += ' bg-yellow-200 border-yellow-400';
    }
    
    return classes;
  };
  
  // Create a simplified data table with frozen header row and first column
  const renderTableView = () => {
    return (
      <div className={`border border-gray-300 rounded-md overflow-hidden ${isFullscreen ? 'fullscreen-viewer' : ''}`} 
           style={{ 
             position: 'relative', 
             maxHeight: isFullscreen ? '100vh' : '600px', 
             maxWidth: '100%' 
           }}>
        {/* Custom CSS for frozen columns/rows */}
        <style jsx>{`
          .fullscreen-viewer {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 50;
            border-radius: 0;
            border: none;
            width: 100vw;
            height: 100vh;
            background-color: white;
          }
          
          .spreadsheet-container {
            position: relative;
            overflow: auto;
            max-height: ${isFullscreen ? 'calc(100vh - 10px)' : '600px'};
            width: 100%;
            border-radius: ${isFullscreen ? '0' : '0.375rem'};
          }
          
          /* Frozen header */
          .header-row {
            position: sticky;
            top: 0;
            z-index: 20;
            background-color: #e5e7eb; /* Darker background for better contrast */
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }
          
          /* Frozen corner cell */
          .corner-cell {
            position: sticky;
            top: 0;
            left: 0;
            z-index: 30;
            background-color: #d1d5db; /* Darker corner cell */
            box-shadow: 1px 1px 3px rgba(0,0,0,0.15);
            color: #000000; /* Black text for corner cell */
            font-weight: 700;
          }
          
          /* Frozen first column */
          .row-header {
            position: sticky;
            left: 0;
            z-index: 10;
            background-color: #e5e7eb; /* Match header row */
            box-shadow: 1px 0 3px rgba(0,0,0,0.15);
            color: #1f2937; /* Darker text for row headers */
            font-weight: 700;
          }
          
          .cell {
            padding: 0.5rem;
            border: 1px solid #d1d5db; /* Darker border for better grid visibility */
            min-width: 120px;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #111827; /* Much darker text color for better readability */
            font-size: 0.95rem; /* Slightly larger font */
          }
          
          .header-cell {
            font-weight: 700; /* Bolder headers */
            text-align: center;
            min-width: 60px;
            color: #1f2937; /* Dark gray for headers */
            background-color: #f3f4f6; /* Light gray background */
          }
          
          /* Alternating row colors with better contrast */
          .row-even {
            background-color: #ffffff; /* Pure white */
          }
          
          .row-odd {
            background-color: #f3f4f6; /* Slightly darker for better distinction */
          }
          
          /* Better grid lines */
          table {
            border: 1px solid #d1d5db; /* Darker outer border */
          }
          .cell:hover {
            background-color: rgba(59, 130, 246, 0.15); /* Increased hover visibility */
            border-color: #93c5fd; /* Blue border on hover */
          }
          
          /* Active cell styles */
          .cell.row-header:hover {
            background-color: #d1d5db; /* Darker background on hover */
            color: #000000; /* Black text on hover */
          }
          
          /* Row highlight on row header hover */
          tr:hover .cell:not(.header-cell) {
            background-color: rgba(59, 130, 246, 0.08); /* More visible row highlight */
          }
          
          /* Column highlight on column header hover */
          .header-cell:hover {
            background-color: #d1d5db;
            color: #000000;
          }
          
          /* Numeric cell alignment */
          .cell-numeric {
            text-align: right;
            font-variant-numeric: tabular-nums; /* Ensures numbers align properly */
            font-feature-settings: "tnum"; /* Better number alignment */
          }
          
          /* Cell text wrapping for long content */
          .cell-wrap {
            white-space: normal;
            word-break: break-word;
          }
          
          /* Loading overlay */
          .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: rgba(255, 255, 255, 0.8);
            z-index: 50;
          }
          
          .spinner {
            border: 3px solid #e5e7eb;
            border-radius: 50%;
            border-top: 3px solid #3b82f6;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        
        <div className="spreadsheet-container" ref={containerRef}>
          {isRenderingLargeData && (
            <div className="loading-overlay">
              <div className="spinner"></div>
            </div>
          )}
          
          <table className="border-collapse w-full">
            <thead>
              <tr className="header-row">
                {/* Corner cell (fixed both horizontally and vertically) */}
                <th className="cell header-cell corner-cell">#</th>
                
                {/* Column headers (fixed vertically) */}
                {currentData[0]?.map((_, index) => (
                  <th 
                    key={index} 
                    className="cell header-cell" 
                    title={`Column ${String.fromCharCode(65 + index)}`}
                    data-column={index}
                    style={{ fontSize: '1rem' }} /* Larger column letters */
                  >
                    <span style={{ fontWeight: 800 }}>
                      {String.fromCharCode(65 + index)} {/* A, B, C, etc. */}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(showFullData ? currentData : currentPageData).map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className={rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}
                  data-row={showFullData ? rowIndex : (currentPage * PAGE_SIZE) + rowIndex}
                >
                  {/* Row header (fixed horizontally) */}
                  <td 
                    className="cell header-cell row-header" 
                    title={`Row ${showFullData ? rowIndex + 1 : (currentPage * PAGE_SIZE) + rowIndex + 1}`}
                    style={{ fontSize: '0.95rem' }} /* Consistent size for row numbers */
                  >
                    <span style={{ fontWeight: 700 }}>
                      {showFullData ? rowIndex + 1 : (currentPage * PAGE_SIZE) + rowIndex + 1}
                    </span>
                  </td>
                  
                  {/* Data cells */}
                  {row.map((cell, cellIndex) => {
                    const actualRowIndex = showFullData ? rowIndex : (currentPage * PAGE_SIZE) + rowIndex;
                    const cellData = typeof cell === 'object' && cell !== null 
                      ? cell 
                      : { value: cell || '' };
                    
                    // Determine if this cell is a search match
                    const isSearchMatch = searchResults.some(
                      result => result.row === actualRowIndex && result.col === cellIndex
                    );
                    
                    // Determine if this is the current selected search result
                    const isCurrentSearchResult = currentSearchIndex !== -1 && 
                      searchResults[currentSearchIndex]?.row === actualRowIndex && 
                      searchResults[currentSearchIndex]?.col === cellIndex;
                    
                    // Get the formatted cell value
                    const displayValue = formatCellValue(cellData);
                    
                    // Get cell class based on its style
                    const cellClass = getCellClass(cellData, isCurrentSearchResult);
                    
                    // Determine if cell content is long and might need wrapping
                    const isLongContent = typeof displayValue === 'string' && displayValue.length > 30;
                    
                    return (
                      <td 
                        key={cellIndex} 
                        className={`${cellClass} ${isLongContent ? 'cell-wrap' : ''} ${isSearchMatch ? 'bg-yellow-100' : ''}`}
                        title={typeof displayValue === 'string' ? displayValue : (cellData.value?.toString() || '')}
                        data-column={cellIndex}
                        data-row={actualRowIndex}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  // Handle download with error handling for expired tokens
  
  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    try {
      // Test if the URL is valid by sending a HEAD request
      const response = await fetch(fileUrl, { method: 'HEAD' });
      if (!response.ok) {
        e.preventDefault();
        setDownloadError('The download link has expired. Refreshing...');
        setRefreshingUrl(true);
        
        // Get a fresh download URL using auth context
        let token = await getToken(true); // Force refresh the token
        
        // Fallback to localStorage if the context method fails
        if (!token) {
          token = localStorage.getItem('authToken');
        }
        
        if (!token) {
          setDownloadError('Authentication required. Please refresh the page.');
          setRefreshingUrl(false);
          return;
        }
        
        // Extract document ID from the fileUrl if possible
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
        setDownloadError(null);
      }
    } catch (error) {
      e.preventDefault();
      console.error('Download error:', error);
      setDownloadError('Error accessing file. Please try refreshing the page.');
    }
  };
  
  return (
    <div className={`spreadsheet-viewer ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      <style jsx>{`
        .fullscreen-mode {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 50;
          background: white;
          padding: 1rem;
          box-sizing: border-box;
          overflow: auto;
        }
        
        .fullscreen-exit-button {
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 60;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 5px 10px;
          display: flex;
          align-items: center;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
      `}</style>
      
      {isFullscreen && (
        <button 
          onClick={() => setIsFullscreen(false)}
          className="fullscreen-exit-button"
          title="Exit fullscreen view (Esc)"
        >
          <svg className="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Exit Fullscreen
        </button>
      )}
      
      <div className={`mb-3 flex flex-wrap justify-between items-center gap-2 ${isFullscreen ? 'pb-2 border-b border-gray-200' : ''}`}>
        <div>
          <h3 className="font-semibold text-lg text-gray-900">{fileName}</h3>
          <div className="text-sm text-gray-700 font-medium">
            <span className="inline-flex items-center">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
              Total rows: {totalRows}
            </span>
            <span className="ml-3 inline-flex items-center">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              {fileType === 'csv' ? 'CSV File' : 'Excel Spreadsheet'}
            </span>
            {workbookSheets.length > 1 && activeSheet && (
              <span className="ml-3 inline-flex items-center bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium text-blue-700">
                <svg className="w-3.5 h-3.5 mr-1 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                </svg>
                Active: {activeSheet}
              </span>
            )}
            {isFullscreen && (
              <span className="ml-3 inline-flex items-center bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium text-green-700">
                <svg className="w-3.5 h-3.5 mr-1 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Fullscreen Mode
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFullData(!showFullData)}
              className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-black rounded-md font-medium"
              disabled={isRenderingLargeData}
            >
              {isRenderingLargeData ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  {showFullData ? (
                    <>
                      <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      Show Paginated
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Show All Data
                    </>
                  )}
                </>
              )}
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-black rounded-md font-medium"
              title={isFullscreen ? "Exit fullscreen (Esc)" : "View in fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M4 4a1 1 0 011-1h3a1 1 0 010 2H6.414l3.293 3.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4a1 1 0 011-1zm12 0a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-3.293 3.293a1 1 0 11-1.414-1.414L13.586 5H12a1 1 0 110-2h4z" clipRule="evenodd" />
                  </svg>
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Fullscreen
                </>
              )}
            </button>
          </div>
          
          {/* Export dropdown menu */}
          <div className="relative group">
            <button
              className="flex items-center px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded-md font-medium"
            >
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export
              <svg className="w-4 h-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Dropdown menu */}
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg overflow-hidden z-20 border border-gray-200 hidden group-hover:block">
              <button
                onClick={exportToCSV}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
              >
                <svg className="w-4 h-4 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                </svg>
                Export to CSV
              </button>
              <button
                onClick={exportToJSON}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
              >
                <svg className="w-4 h-4 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Export to JSON
              </button>
              <button
                onClick={exportToHTML}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
              >
                <svg className="w-4 h-4 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Export to HTML
              </button>
            </div>
          </div>
          
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
      
      {/* Excel sheet selector */}
      {workbookSheets.length > 1 && (
        <div className="mb-3 bg-white border border-gray-300 rounded-md overflow-hidden">
          <div className="flex overflow-x-auto">
            {workbookSheets.map((sheetName) => (
              <button
                key={sheetName}
                onClick={() => setActiveSheet(sheetName)}
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
      
      {/* Excel tips */}
      {/* Search bar */}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <div className="flex-grow flex items-center min-w-[300px] border border-gray-300 rounded-md overflow-hidden">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search spreadsheet..."
            className="flex-grow py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-3 py-2 bg-blue-100 text-blue-800 hover:bg-blue-200 border-l border-gray-300 flex items-center"
          >
            {isSearching ? (
              <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            )}
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-yellow-100 px-2 py-1 rounded-md border border-yellow-200 text-yellow-800">
              {currentSearchIndex + 1} of {searchResults.length} matches
            </span>
            
            <button
              onClick={() => navigateSearch('prev')}
              className="p-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-700"
              title="Previous match"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <button
              onClick={() => navigateSearch('next')}
              className="p-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-700"
              title="Next match"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      <div className="mb-3 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-md text-xs flex items-center">
        <svg className="w-4 h-4 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span>
          <strong>Excel-like navigation:</strong> Hold Ctrl/Cmd + scroll to horizontally scroll. Headers will remain fixed while scrolling. 
          {isFullscreen && <strong> Press Esc key to exit fullscreen mode.</strong>}
        </span>
      </div>
      
      {/* Render the table view */}
      {renderTableView()}
      
      {/* Pagination controls */}
      {!showFullData && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            className="flex items-center px-3 py-1.5 bg-gray-200 text-black rounded-md disabled:opacity-50"
          >
            <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Previous
          </button>
          <div className="text-sm text-gray-900 font-medium px-3 py-1.5 bg-gray-100 rounded-md">
            Page {currentPage + 1} of {totalPages} 
            <span className="mx-1">•</span> 
            Rows {(currentPage * PAGE_SIZE) + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalRows)} of {totalRows}
          </div>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center px-3 py-1.5 bg-gray-200 text-black rounded-md disabled:opacity-50"
          >
            Next
            <svg className="w-4 h-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      <p className="mt-2 text-sm text-gray-500 flex items-center">
        {showFullData && totalRows > 500 ? (
          <>
            <svg className="w-4 h-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Showing all {totalRows} rows. Consider using pagination for better performance.
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Some advanced formatting and formulas may not be displayed correctly.
          </>
        )}
      </p>
    </div>
  );
};

export default SpreadsheetViewer;