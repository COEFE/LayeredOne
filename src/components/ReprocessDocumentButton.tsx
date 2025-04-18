'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FiRefreshCw, FiCheck, FiAlertTriangle } from 'react-icons/fi';

interface ReprocessDocumentButtonProps {
  documentId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function ReprocessDocumentButton({
  documentId,
  onSuccess,
  onError,
  className = ''
}: ReprocessDocumentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const reprocessDocument = async () => {
    if (!user || loading) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      // Get the auth token
      const token = await user.getIdToken();
      
      // Call the reprocess API
      const response = await fetch('/api/documents/reprocess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documentId })
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to reprocess document';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.log('Document reprocessing error details:', errorData);
        } catch (e) {
          // Handle the response without trying to read the body again
          // For 504 errors, it's definitely a timeout
          if (response.status === 504) {
            errorMessage = `Server timeout (504). Document processing is taking too long. Try again with a smaller file or wait a few minutes.`;
            console.error('Document processing timeout (504)');
          } else if (response.status === 502) {
            errorMessage = `Bad gateway (502). The server may be overloaded or restarting.`;
            console.error('Document processing bad gateway (502)');
          } else {
            // For other errors, use the status text
            errorMessage = `Error ${response.status}: ${response.statusText || 'Unknown error'}`;
            console.error(`Document processing error: ${response.status} ${response.statusText}`);
          }
        }
        throw new Error(errorMessage);
      }
      
      setSuccess(true);
      if (onSuccess) onSuccess();
      
      // Reset success status after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error reprocessing document:', errorMessage);
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`inline-block ${className}`}>
      <button
        onClick={reprocessDocument}
        disabled={loading}
        className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
          error 
            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
            : success
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
        title="Reprocess document to extract or update text content"
      >
        {loading ? (
          <>
            <FiRefreshCw className="animate-spin h-4 w-4" />
            <span>Processing...</span>
          </>
        ) : error ? (
          <>
            <FiAlertTriangle className="h-4 w-4" />
            <span>Failed</span>
          </>
        ) : success ? (
          <>
            <FiCheck className="h-4 w-4" />
            <span>Success!</span>
          </>
        ) : (
          <>
            <FiRefreshCw className="h-4 w-4" />
            <span>Process Document</span>
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-1 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}