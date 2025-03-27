'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, getProxiedDownloadURL } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { FiFileText, FiLoader, FiAlertTriangle, FiInfo } from 'react-icons/fi';

interface DocumentAnalysisProps {
  documentId: string;
}

interface AIAnalysis {
  summary: string;
  qa: string;
  entities: any;
  analyzedAt: any;
  analyzedLength: number;
  model: string;
}

interface Document {
  id: string;
  name: string;
  contentType: string;
  size: number;
  url: string;
  createdAt: any;
  processed: boolean;
  processing: boolean;
  status: string;
  error?: string;
  aiAnalysis?: AIAnalysis;
  aiAnalysisError?: string;
  extractedText?: string;
  chunkCount?: number;
}

export default function DocumentAnalysis({ documentId }: DocumentAnalysisProps) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('summary');
  const { user } = useAuth();

  useEffect(() => {
    async function fetchDocument() {
      if (!user) return;

      try {
        setLoading(true);
        const docRef = doc(db, 'documents', documentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const docData = docSnap.data();
          
          // Check if this document belongs to the current user
          if (docData.userId !== user.uid) {
            setError('You do not have permission to view this document');
            setLoading(false);
            return;
          }

          // Format document data
          const documentWithId = {
            id: docSnap.id,
            ...docData,
          } as Document;

          setDocument(documentWithId);
        } else {
          setError('Document not found');
        }
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Error loading document details');
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [documentId, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FiLoader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">Loading document analysis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
        <div className="flex">
          <FiAlertTriangle className="h-5 w-5 text-red-500" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
        <div className="flex">
          <FiInfo className="h-5 w-5 text-blue-500" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">No Document Found</h3>
            <div className="text-sm text-blue-700">The requested document could not be found.</div>
          </div>
        </div>
      </div>
    );
  }

  // Render based on document processing status
  const renderProcessingStatus = () => {
    if (document.processing) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
          <div className="flex items-center">
            <FiLoader className="animate-spin h-5 w-5 text-blue-500" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Processing Document</h3>
              <div className="text-sm text-blue-700">
                Status: {document.status || 'processing'}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (document.error || document.aiAnalysisError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
          <div className="flex">
            <FiAlertTriangle className="h-5 w-5 text-red-500" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Processing Error</h3>
              <div className="text-sm text-red-700">{document.error || document.aiAnalysisError}</div>
            </div>
          </div>
        </div>
      );
    }

    if (!document.aiAnalysis && document.processed) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-4">
          <div className="flex">
            <FiInfo className="h-5 w-5 text-yellow-500" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No AI Analysis Available</h3>
              <div className="text-sm text-yellow-700">
                Document was processed but AI analysis was not performed. This may be because the Claude API key was not configured.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Format entities for display
  const renderEntities = () => {
    if (!document.aiAnalysis?.entities) {
      return <p>No entities found</p>;
    }

    // Handle if entities is a string instead of an object
    if (typeof document.aiAnalysis.entities === 'string') {
      return <pre className="whitespace-pre-wrap">{document.aiAnalysis.entities}</pre>;
    }

    // Otherwise render as structured entity lists
    return (
      <div className="space-y-6">
        {Object.entries(document.aiAnalysis.entities).map(([category, entities]) => {
          if (category === 'raw') return null;
          
          return (
            <div key={category} className="border rounded-lg p-4">
              <h3 className="font-medium text-lg capitalize mb-2">{category}</h3>
              <ul className="list-disc pl-5 space-y-1">
                {Array.isArray(entities) ? 
                  entities.map((entity, index) => (
                    <li key={index} className="text-gray-700">{entity}</li>
                  )) : 
                  <li className="text-gray-700">Unable to display entities</li>
                }
              </ul>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Document header */}
      <div className="flex items-start mb-6">
        <div className="bg-blue-100 p-3 rounded-lg mr-4">
          <FiFileText className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{document.name}</h1>
          <p className="text-gray-500">
            {document.contentType} • {(document.size / 1024 / 1024).toFixed(2)} MB • 
            {document.createdAt && typeof document.createdAt.toDate === 'function' ? 
              ` Uploaded ${document.createdAt.toDate().toLocaleDateString()}` : 
              document.createdAt ? ` Uploaded ${new Date(document.createdAt).toLocaleDateString()}` : ' Recently uploaded'}
          </p>
        </div>
      </div>

      {/* Processing status */}
      {renderProcessingStatus()}

      {/* Analysis content - only show if we have analysis */}
      {document.aiAnalysis && (
        <div className="mt-6">
          {/* Analysis metadata */}
          <div className="bg-gray-50 p-3 rounded-md mb-4 text-sm text-gray-500">
            <p>Analyzed with {document.aiAnalysis.model} • 
              {document.aiAnalysis.analyzedAt && typeof document.aiAnalysis.analyzedAt.toDate === 'function' ? 
                ` ${document.aiAnalysis.analyzedAt.toDate().toLocaleString()}` : 
                document.aiAnalysis.analyzedAt ? ` ${new Date(document.aiAnalysis.analyzedAt).toLocaleString()}` : ' Recently'}
            </p>
            {document.aiAnalysis.analyzedLength && (
              <p>{document.aiAnalysis.analyzedLength < document.extractedText?.length ? 
                `Analyzed first ${document.aiAnalysis.analyzedLength} characters (${Math.round(document.aiAnalysis.analyzedLength / document.extractedText.length * 100)}% of document)` : 
                'Analyzed entire document'}
              </p>
            )}
          </div>

          {/* Analysis tabs */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-8" aria-label="Analysis tabs">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('qa')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'qa'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Q&A
              </button>
              <button
                onClick={() => setActiveTab('entities')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'entities'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Entities
              </button>
              {document.extractedText && (
                <button
                  onClick={() => setActiveTab('text')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'text'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Full Text
                </button>
              )}
            </nav>
          </div>

          {/* Tab content */}
          <div className="prose max-w-none">
            {activeTab === 'summary' && (
              <div className="whitespace-pre-wrap">
                <h2 className="text-xl font-bold mb-4">Document Summary</h2>
                {document.aiAnalysis.summary}
              </div>
            )}

            {activeTab === 'qa' && (
              <div className="whitespace-pre-wrap">
                <h2 className="text-xl font-bold mb-4">Questions & Answers</h2>
                {document.aiAnalysis.qa}
              </div>
            )}

            {activeTab === 'entities' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Key Entities</h2>
                {renderEntities()}
              </div>
            )}

            {activeTab === 'text' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Full Document Text</h2>
                <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md text-sm overflow-auto max-h-96">
                  {document.extractedText}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}