'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DebugPage() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [chatId, setChatId] = useState('');
  const [testRouteOptions, setTestRouteOptions] = useState({
    addTrailingSlash: false, // Changed default to no trailing slash
    useWindowLocation: true,
  });
  const [routingTests, setRoutingTests] = useState<{name: string, path: string, success?: boolean}[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
      setCurrentPath(window.location.pathname);
    }
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Route Debugging</h1>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Current URL Information</h2>
        <div className="space-y-2">
          <div>
            <span className="font-medium">Full URL:</span> 
            <code className="ml-2 p-1 bg-gray-100 dark:bg-gray-700 rounded">{currentUrl}</code>
          </div>
          <div>
            <span className="font-medium">Path:</span> 
            <code className="ml-2 p-1 bg-gray-100 dark:bg-gray-700 rounded">{currentPath}</code>
          </div>
        </div>
      </div>

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
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">URL Handling Reference</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Configuration</h3>
            <div className="pl-4 space-y-2 text-sm">
              <p><code>next.config.js</code>: <code>trailingSlash: false</code></p>
              <p><code>vercel.json</code>: <code>cleanUrls: true</code>, <code>trailingSlash: false</code></p>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Recommendations</h3>
            <ul className="pl-6 list-disc space-y-1 text-sm">
              <li>Use consistent URL patterns throughout the app</li>
              <li>For dynamic routes, we recommend NOT using trailing slashes: <code>/chat/123</code></li>
              <li>Use <code>window.location.href</code> for navigation</li>
              <li>If the page shows a 404 error, try removing any trailing slash</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}