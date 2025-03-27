import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface BasicSpreadsheetViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: 'excel' | 'csv';
}

const BasicSpreadsheetViewer: React.FC<BasicSpreadsheetViewerProps> = ({ 
  fileUrl, 
  fileName, 
  fileType 
}) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [refreshingUrl, setRefreshingUrl] = useState(false);

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

        console.log('Loading Excel file in basic viewer:', fileName);
        
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
        
        // Fetch the file
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Parse the Excel file
        const workbook = xlsx.read(arrayBuffer, { 
          type: 'array',
          cellFormula: false,
          cellStyles: false
        });
        
        // Store sheet names
        setSheetNames(workbook.SheetNames);
        
        // Set the first sheet as active if available
        if (workbook.SheetNames.length > 0) {
          const firstSheet = workbook.SheetNames[0];
          setActiveSheet(firstSheet);
          
          // Process the first sheet
          const worksheet = workbook.Sheets[firstSheet];
          const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
          setData(jsonData);
        }
        
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading Excel file:', error);
        setError(error.message || 'Failed to load Excel file');
        setLoading(false);
      }
    };
    
    if (fileUrl) {
      loadExcelFile();
    }
  }, [fileUrl, fileType, fileName]);
  
  // Handle sheet switching
  const handleSheetChange = async (sheetName: string) => {
    try {
      setLoading(true);
      setActiveSheet(sheetName);
      
      // Re-import xlsx
      const xlsx = await import('xlsx');
      
      // Fetch the file again
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Re-parse the workbook
      const workbook = xlsx.read(arrayBuffer, { 
        type: 'array',
        cellFormula: false,
        cellStyles: false
      });
      
      // Process the selected sheet
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      setData(jsonData);
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error switching sheets:', error);
      setError(`Failed to switch to sheet "${sheetName}": ${error.message}`);
      setLoading(false);
    }
  };

  // Handle download
  const handleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Just let the default link behavior work
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
          className="inline-block mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Download file instead
        </a>
      </div>
    );
  }

  return (
    <div className="excel-viewer">
      <div className="mb-4 flex flex-wrap justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">{fileName}</h3>
          <p className="text-sm text-gray-500">Basic spreadsheet viewer (limited functionality)</p>
        </div>
        <div className="flex space-x-2">
          <a 
            href={fileUrl} 
            download={fileName}
            className="flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download {fileType === 'csv' ? 'CSV' : 'Excel'}
          </a>
        </div>
      </div>
      
      {/* Sheet selector */}
      {sheetNames.length > 1 && (
        <div className="mb-3 bg-white border border-gray-300 rounded-md overflow-hidden">
          <div className="flex overflow-x-auto">
            {sheetNames.map((sheetName) => (
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
      
      {/* The Excel Table */}
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <tbody className="divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr 
                key={`row-${rowIndex}`}
                className={rowIndex === 0 ? 'bg-gray-100' : 'even:bg-gray-50'}
              >
                {Array.isArray(row) && row.map((cell, cellIndex) => {
                  const CellTag = rowIndex === 0 ? 'th' : 'td';
                  return (
                    <CellTag 
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className={`px-3 py-2 text-sm ${rowIndex === 0 ? 'font-semibold text-gray-900 text-left' : 'text-gray-900'}`}
                    >
                      {cell === null || cell === undefined ? '' : cell.toString()}
                    </CellTag>
                  );
                })}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No data available in this sheet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BasicSpreadsheetViewer;