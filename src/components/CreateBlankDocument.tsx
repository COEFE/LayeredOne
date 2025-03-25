'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FiFile, FiLoader, FiFileText, FiAlertCircle } from 'react-icons/fi';

interface CreateBlankDocumentProps {
  onSuccess?: (documentId: string) => void;
  className?: string;
  folderPath?: string;
}

export default function CreateBlankDocument({ 
  onSuccess, 
  className = '',
  folderPath = ''
}: CreateBlankDocumentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState('New Excel Document');
  const { user } = useAuth();
  const router = useRouter();

  const createBlankExcel = async () => {
    if (!user) {
      setError('You must be logged in to create documents');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get auth token
      const token = await user.getIdToken();

      // Call API to create blank Excel document
      const response = await fetch('/api/documents/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentType: 'excel',
          documentName,
          folderPath,
          template: false
        })
      });

      if (!response.ok) {
        let errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || 'Failed to create document');
        } catch (e) {
          throw new Error(errorText || 'Failed to create document');
        }
      }

      const data = await response.json();

      if (data.success && data.documentId) {
        // Navigate to the document or call onSuccess callback
        if (onSuccess) {
          onSuccess(data.documentId);
        } else {
          router.push(`/documents/${data.documentId}`);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Error creating document:', error);
      setError(error.message || 'An error occurred while creating the document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <label htmlFor="documentName" className="block text-sm font-medium text-gray-700 mb-1">
          Document Name
        </label>
        <input
          type="text"
          id="documentName"
          value={documentName}
          onChange={(e) => setDocumentName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter document name"
          disabled={loading}
        />
      </div>
      
      <button
        onClick={createBlankExcel}
        disabled={loading}
        className="flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
      >
        {loading ? (
          <>
            <FiLoader className="animate-spin mr-2" />
            Creating...
          </>
        ) : (
          <>
            <FiFile className="mr-2" />
            Create Blank Excel Document
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 flex items-center">
          <FiAlertCircle className="mr-1" />
          {error}
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-500">
        Creates an empty Excel spreadsheet that you can edit using Claude AI
      </div>
    </div>
  );
}