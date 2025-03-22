'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface DocumentEditorProps {
  documentId: string;
}

interface DocumentData {
  documentId: string;
  fileName: string;
  mimeType: string;
  data: any;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId }) => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [editableData, setEditableData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Fetch document data
  useEffect(() => {
    const fetchDocumentData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const token = await user.getIdToken();
        const response = await fetch(`/api/documents/edit?documentId=${documentId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch document data');
        }
        
        const data = await response.json();
        setDocumentData(data);
        
        // Initialize editable data based on document type
        if (data.mimeType.includes('excel') || data.mimeType.includes('spreadsheet')) {
          // For Excel, we get an object with sheet names as keys
          setEditableData(data.data);
        } else if (data.mimeType === 'text/csv') {
          // For CSV, we get a 2D array
          setEditableData(data.data);
        }
        
      } catch (error) {
        console.error('Error fetching document:', error);
        setError(error.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocumentData();
  }, [documentId, user]);
  
  // Handle cell value change for CSV
  const handleCsvCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!editableData) return;
    
    const newData = [...editableData];
    
    // Ensure the row exists
    if (!newData[rowIndex]) {
      newData[rowIndex] = [];
    }
    
    // Update the cell value
    newData[rowIndex][colIndex] = value;
    setEditableData(newData);
  };
  
  // Handle cell value change for Excel
  const handleExcelCellChange = (sheet: string, rowIndex: number, colIndex: number, value: string) => {
    if (!editableData || !editableData[sheet]) return;
    
    const newData = { ...editableData };
    
    // Ensure the row exists
    if (!newData[sheet][rowIndex]) {
      newData[sheet][rowIndex] = [];
    }
    
    // Update the cell value
    newData[sheet][rowIndex][colIndex] = value;
    setEditableData(newData);
  };
  
  // Save changes
  const saveChanges = async () => {
    if (!user || !documentData) return;
    
    try {
      setSaving(true);
      setSaved(false);
      setError(null);
      
      // Prepare edits based on document type
      let edits: any[] = [];
      
      if (documentData.mimeType.includes('excel') || documentData.mimeType.includes('spreadsheet')) {
        // Process Excel edits
        for (const sheetName in editableData) {
          const originalSheet = documentData.data[sheetName] || [];
          const editedSheet = editableData[sheetName] || [];
          
          // Compare and collect edits
          for (let row = 0; row < editedSheet.length; row++) {
            for (let col = 0; col < editedSheet[row].length; col++) {
              const originalValue = originalSheet[row]?.[col];
              const newValue = editedSheet[row][col];
              
              // Only include changed cells
              if (originalValue !== newValue && newValue !== undefined) {
                // Excel uses A1 notation for cells
                const colLetter = String.fromCharCode(65 + col); // A, B, C, etc.
                const cellRef = `${colLetter}${row + 1}`; // A1, B2, etc.
                
                edits.push({
                  sheet: sheetName,
                  cell: cellRef,
                  value: newValue
                });
              }
            }
          }
        }
      } else if (documentData.mimeType === 'text/csv') {
        // Process CSV edits
        const originalData = documentData.data || [];
        
        // Compare and collect edits
        for (let row = 0; row < editableData.length; row++) {
          for (let col = 0; col < editableData[row].length; col++) {
            const originalValue = originalData[row]?.[col];
            const newValue = editableData[row][col];
            
            // Only include changed cells
            if (originalValue !== newValue && newValue !== undefined) {
              edits.push({
                row,
                column: col,
                value: newValue
              });
            }
          }
        }
      }
      
      // If no edits, return early
      if (edits.length === 0) {
        setSaving(false);
        setSaved(true);
        return;
      }
      
      // Send edits to API
      const token = await user.getIdToken();
      const response = await fetch('/api/documents/edit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: documentData.documentId,
          mimeType: documentData.mimeType,
          edits
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }
      
      setSaved(true);
      
      // After successful save, refresh the document data
      setTimeout(() => {
        router.refresh();
      }, 1500);
      
    } catch (error) {
      console.error('Error saving changes:', error);
      setError(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 my-4">
        <h3 className="font-semibold">Error</h3>
        <p>{error}</p>
      </div>
    );
  }
  
  if (!documentData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-4 my-4">
        <p>No document data available</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-6">
      <h2 className="text-xl font-semibold mb-4">Editing: {documentData.fileName}</h2>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">
            {documentData.mimeType.includes('excel') ? 'Excel Spreadsheet' : 'CSV File'}
          </span>
          
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            
            <button
              onClick={saveChanges}
              disabled={saving}
              className={`px-3 py-1 text-sm text-white rounded-md ${
                saving ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
        
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-2 my-2 text-sm">
            Changes saved successfully!
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        {documentData.mimeType === 'text/csv' && editableData && (
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {editableData[0]?.map((_, colIndex) => (
                  <th key={colIndex} className="border border-gray-200 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Column {colIndex + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editableData.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="border border-gray-200 px-4 py-2">
                      <input
                        type="text"
                        value={cell || ''}
                        onChange={(e) => handleCsvCellChange(rowIndex, colIndex, e.target.value)}
                        className="w-full p-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {(documentData.mimeType.includes('excel') || documentData.mimeType.includes('spreadsheet')) && editableData && (
          <div className="mb-4">
            <div className="flex space-x-2 border-b">
              {Object.keys(editableData).map((sheetName) => (
                <div
                  key={sheetName}
                  className="px-4 py-2 cursor-pointer bg-gray-100 rounded-t-md"
                >
                  {sheetName}
                </div>
              ))}
            </div>
            
            {Object.entries(editableData).map(([sheetName, sheetData]) => (
              <div key={sheetName} className="mt-2">
                <h3 className="font-semibold mb-2">{sheetName}</h3>
                <table className="min-w-full border border-gray-200">
                  <tbody>
                    {(sheetData as any[][]).map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {row.map((cell, colIndex) => (
                          <td key={colIndex} className="border border-gray-200 px-4 py-2">
                            <input
                              type="text"
                              value={cell ?? ''}
                              onChange={(e) => handleExcelCellChange(sheetName, rowIndex, colIndex, e.target.value)}
                              className="w-full p-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentEditor;