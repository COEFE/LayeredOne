'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DebugPage() {
  const { user, getToken } = useAuth();
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState('');
  const [documentInfo, setDocumentInfo] = useState<any>(null);
  const [docLoading, setDocLoading] = useState(false);
  
  // Original route testing functionality
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [chatId, setChatId] = useState('');
  const [testRouteOptions, setTestRouteOptions] = useState({
    addTrailingSlash: false,
    useWindowLocation: true,
  });
  const [routingTests, setRoutingTests] = useState<{name: string, path: string, success?: boolean}[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
      setCurrentPath(window.location.pathname);
    }
    
    const loadServerInfo = async () => {
      try {
        const response = await fetch('/api/debug/server-info');
        const data = await response.json();
        setServerInfo(data);
      } catch (err: any) {
        setError(`Failed to load server info: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadServerInfo();
  }, []);

  const handleChatIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatId(e.target.value);
  };

  const handleCheckboxChange = (option: keyof typeof testRouteOptions) => {
    setTestRouteOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  const testRoute = () => {
    if (!chatId) return;
    
    // No trailing slash is the recommended format now
    const path = `/chat/${chatId}`;
    addRoutingTest(path);
    
    if (testRouteOptions.useWindowLocation) {
      window.location.href = path;
    } else {
      router.push(path);
    }
  };

  const addRoutingTest = (path: string) => {
    setRoutingTests((prev) => [
      ...prev,
      {
        name: `Test: ${path}`,
        path,
      }
    ]);
  };

  const checkDocument = async () => {
    if (!documentId.trim()) {
      setError('Please enter a document ID');
      return;
    }

    setDocLoading(true);
    setDocumentInfo(null);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        setError('Authentication required. Please refresh the page.');
        setDocLoading(false);
        return;
      }

      const response = await fetch('/api/debug/server-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId: documentId.trim()
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(`Error: ${data.error || response.statusText}`);
      } else {
        setDocumentInfo(data);
      }
    } catch (err: any) {
      setError(`Failed to check document: ${err.message}`);
      console.error(err);
    } finally {
      setDocLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Debug Tools</h1>
      
      {!user && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Authentication Required</p>
          <p>You need to be logged in to use these debug tools.</p>
          <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Server Information</h2>
          {loading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : (
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs h-48">{JSON.stringify(serverInfo, null, 2)}</pre>
          )}
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Check Document</h2>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="documentId">
              Document ID
            </label>
            <div className="flex">
              <input
                id="documentId"
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="flex-1 shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Enter document ID"
                disabled={!user || docLoading}
              />
              <button
                onClick={checkDocument}
                disabled={!user || docLoading}
                className={`ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                  (!user || docLoading) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {docLoading ? 'Checking...' : 'Check'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {documentInfo && (
            <div>
              <h3 className="font-semibold mb-2 mt-4">Document Info</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs h-48">{JSON.stringify(documentInfo, null, 2)}</pre>
              
              {documentInfo.storage?.paths?.filter((p: any) => p.exists)?.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Storage URLs (Click to Test)</h3>
                  <ul className="space-y-2">
                    {documentInfo.storage.paths
                      .filter((p: any) => p.exists && p.url)
                      .map((path: any, index: number) => (
                        <li key={index} className="bg-green-50 p-2 rounded">
                          <div className="font-mono text-xs mb-1 truncate">Path: {path.path}</div>
                          <a 
                            href={path.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Test URL (opens in new tab)
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Original route testing UI */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Dynamic Routes</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Enter a Chat ID to Test
          </label>
          <input
            type="text"
            value={chatId}
            onChange={handleChatIdChange}
            placeholder="e.g., eYDHflFj6R9KpN5qv1og"
            className="w-full p-2 border rounded-md"
          />
        </div>
        
        <div className="flex flex-col gap-3 mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={testRouteOptions.addTrailingSlash}
              onChange={() => handleCheckboxChange('addTrailingSlash')}
              className="mr-2"
            />
            Add trailing slash (e.g., /chat/123/)
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={testRouteOptions.useWindowLocation}
              onChange={() => handleCheckboxChange('useWindowLocation')}
              className="mr-2"
            />
            Use window.location.href (instead of router.push)
          </label>
        </div>
        
        <button
          onClick={testRoute}
          disabled={!chatId}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          Test Route
        </button>
        
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            Manual URL tests (click to test):
          </p>
          <div className="mt-2 space-y-2">
            {chatId && (
              <>
                <div>
                  <a 
                    href={`/chat/${chatId}`} 
                    className="text-blue-500 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      addRoutingTest(`/chat/${chatId}`);
                      window.location.href = `/chat/${chatId}`;
                    }}
                  >
                    Test without trailing slash (recommended): /chat/{chatId}
                  </a>
                </div>
                <div>
                  <a 
                    href={`/chat/${chatId}/`} 
                    className="text-blue-500 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      addRoutingTest(`/chat/${chatId}/`);
                      window.location.href = `/chat/${chatId}/`;
                    }}
                  >
                    Test with trailing slash (will be redirected): /chat/{chatId}/
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}