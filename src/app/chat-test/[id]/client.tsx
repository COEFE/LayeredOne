'use client';

import { useState, useEffect } from 'react';

export default function ChatTestClient({ id }: { id: string }) {
  const [clientPath, setClientPath] = useState('');
  const [trailingSlashState, setTrailingSlashState] = useState('checking');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setClientPath(window.location.pathname);
      
      // Check if the path has a trailing slash
      if (window.location.pathname.endsWith('/')) {
        setTrailingSlashState('has-trailing-slash');
      } else {
        setTrailingSlashState('no-trailing-slash');
      }
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Chat Test Page</h1>
      
      <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
        <h2 className="text-lg font-semibold mb-4">URL Information</h2>
        <div className="space-y-3">
          <div>
            <strong>ID from params:</strong> {id ? id : 'No ID found'}
          </div>
          <div>
            <strong>Type of ID:</strong> {typeof id}
          </div>
          <div>
            <strong>Client-side path:</strong> {clientPath || 'Not yet determined (server-side rendering)'}
          </div>
          <div>
            <strong>Trailing slash:</strong> 
            {trailingSlashState === 'checking' ? 'Checking...' : 
             trailingSlashState === 'has-trailing-slash' ? 'Yes ✓' : 'No ✗'}
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Navigation Tests</h2>
        <div className="space-y-3">
          <div>
            <h3 className="font-medium">Test With Trailing Slash:</h3>
            <button 
              onClick={() => window.location.href = `/chat-test/${id}/`}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Navigate to /chat-test/{id}/
            </button>
          </div>
          
          <div>
            <h3 className="font-medium">Test Without Trailing Slash:</h3>
            <button 
              onClick={() => window.location.href = `/chat-test/${id}`}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Navigate to /chat-test/{id}
            </button>
          </div>
          
          <div>
            <h3 className="font-medium">Test Regular Chat Page:</h3>
            <button 
              onClick={() => window.location.href = `/chat/${id}/`}
              className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Navigate to /chat/{id}/
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Information</h2>
        <p>This is a test page to diagnose routing issues with dynamic routes in Next.js App Router.</p>
        <p className="mt-2">If this page loads correctly but /chat/[id]/ doesn't, there may be an issue with the implementation of that specific route.</p>
        
        <div className="mt-4">
          <a 
            href="/debug/" 
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "/debug/";
            }}
            className="text-blue-500 hover:underline"
          >
            Go to Debug Page
          </a>
        </div>
      </div>
    </div>
  );
}