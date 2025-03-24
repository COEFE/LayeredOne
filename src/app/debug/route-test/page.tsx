'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RouteDebugger() {
  const router = useRouter();
  const [routeInfo, setRouteInfo] = useState({
    pathname: '',
    fullUrl: '',
    userAgent: '',
    headers: {} as Record<string, string>,
    timings: [] as string[]
  });
  const [testRoutes, setTestRoutes] = useState<{path: string, result: string, time: number}[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [routerEvent, setRouterEvent] = useState<string>('');

  // Function to test a route by actually fetching it
  const testRoute = async (path: string) => {
    const startTime = performance.now();
    let result = 'Unknown';
    
    try {
      setIsLoading(true);
      const response = await fetch(path, {
        method: 'HEAD',
        redirect: 'manual' // Don't follow redirects automatically
      });
      
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        result = `${response.status} - Redirect to ${location}`;
      } else if (response.ok) {
        result = `${response.status} - OK`;
      } else {
        result = `${response.status} - ${response.statusText}`;
      }
    } catch (error) {
      result = `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      setIsLoading(false);
    }
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    setTestRoutes(prev => [
      { path, result, time: duration },
      ...prev.slice(0, 9) // Keep last 10 results
    ]);
  };

  // Function to fetch server environment info
  const fetchServerInfo = async () => {
    try {
      const response = await fetch('/api/debug/server-info');
      const data = await response.json();
      setServerInfo(data);
    } catch (error) {
      console.error('Failed to fetch server info', error);
    }
  };

  useEffect(() => {
    // Record router events
    const addRouterEvent = (event: string) => {
      setRouterEvent(`${new Date().toISOString().slice(11, 23)} - ${event}`);
    };

    // Setup basic info
    if (typeof window !== 'undefined') {
      const addTiming = (msg: string) => {
        setRouteInfo(prev => ({
          ...prev,
          timings: [...prev.timings, `${new Date().toISOString().slice(11, 23)} - ${msg}`]
        }));
      };

      addTiming('Page loaded');
      
      setRouteInfo({
        pathname: window.location.pathname,
        fullUrl: window.location.href,
        userAgent: window.navigator.userAgent,
        headers: {},
        timings: [`${new Date().toISOString().slice(11, 23)} - Page loaded`]
      });

      // Try to get request headers using Fetch API
      fetch('/api/debug/headers')
        .then(response => response.json())
        .then(data => {
          setRouteInfo(prev => ({
            ...prev,
            headers: data.headers
          }));
          addTiming('Headers fetched');
        })
        .catch(err => {
          console.error('Failed to fetch headers', err);
        });

      fetchServerInfo();
    }

    // Monitor navigation performance
    const originalPushState = window.history.pushState;
    window.history.pushState = function() {
      addRouterEvent(`pushState: ${arguments[2]}`);
      return originalPushState.apply(this, arguments as any);
    };
    
    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function() {
      addRouterEvent(`replaceState: ${arguments[2]}`);
      return originalReplaceState.apply(this, arguments as any);
    };

    // Cleanup
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Function to render headers in a readable format
  const renderHeaders = () => {
    return Object.entries(routeInfo.headers).map(([key, value]) => (
      <div key={key} className="flex py-1 border-b border-gray-200 dark:border-gray-700">
        <div className="font-mono text-xs w-1/3 font-medium text-gray-600 dark:text-gray-400">{key}</div>
        <div className="font-mono text-xs flex-1 truncate">{value}</div>
      </div>
    ));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Advanced Route Debugger</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Current Route Information</h2>
          
          <div className="mb-4">
            <div className="font-medium mb-1">Path:</div>
            <code className="block p-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm overflow-auto">
              {routeInfo.pathname}
            </code>
          </div>
          
          <div className="mb-4">
            <div className="font-medium mb-1">Full URL:</div>
            <code className="block p-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm overflow-auto">
              {routeInfo.fullUrl}
            </code>
          </div>
          
          <div className="mb-4">
            <div className="font-medium mb-1">User Agent:</div>
            <code className="block p-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm overflow-auto">
              {routeInfo.userAgent}
            </code>
          </div>
          
          <div className="mb-4">
            <div className="font-medium mb-1">Latest Router Event:</div>
            <code className="block p-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm overflow-auto">
              {routerEvent || 'No events yet'}
            </code>
          </div>
          
          <div className="mb-4">
            <div className="font-medium mb-1">Event Timeline:</div>
            <div className="max-h-40 overflow-y-auto p-2 bg-gray-100 dark:bg-gray-700 rounded">
              {routeInfo.timings.map((timing, i) => (
                <div key={i} className="font-mono text-xs mb-1">{timing}</div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Test Route</h2>
          
          <div className="mb-4">
            <label className="block mb-1 font-medium">Enter a path to test:</label>
            <div className="flex">
              <input 
                type="text" 
                value={testInput} 
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="/chat/abc123"
                className="flex-1 p-2 border rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button 
                onClick={() => testInput && testRoute(testInput)}
                disabled={isLoading || !testInput}
                className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Testing...' : 'Test'}
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-2">Quick Tests:</h3>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => testRoute(window.location.pathname)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Current Path
              </button>
              <button 
                onClick={() => testRoute(window.location.pathname + '/')}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Add /
              </button>
              <button 
                onClick={() => testRoute(window.location.pathname.endsWith('/') ? window.location.pathname.slice(0, -1) : window.location.pathname)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Remove /
              </button>
              <button 
                onClick={() => testRoute('/chat/test-id')}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                /chat/test-id
              </button>
              <button 
                onClick={() => testRoute('/chat/test-id/')}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                /chat/test-id/
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Results:</h3>
            <div className="max-h-60 overflow-y-auto">
              {testRoutes.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Path</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Result</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {testRoutes.map((test, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2 text-sm font-mono truncate max-w-[150px]">{test.path}</td>
                        <td className="px-2 py-2 text-sm font-mono">{test.result}</td>
                        <td className="px-2 py-2 text-sm">{test.time}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm italic">No tests run yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Request Headers</h2>
          <div className="max-h-80 overflow-y-auto">
            {Object.keys(routeInfo.headers).length > 0 ? (
              <div className="space-y-1">
                {renderHeaders()}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">Loading headers...</p>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Server Environment</h2>
          <div className="max-h-80 overflow-y-auto">
            {serverInfo ? (
              <pre className="text-xs font-mono p-3 bg-gray-100 dark:bg-gray-700 rounded overflow-auto">
                {JSON.stringify(serverInfo, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500 text-sm italic">Loading server information...</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Next.js Routing Cheatsheet</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Configuration Options</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><code>trailingSlash: true</code> - Urls like <code>/about</code> will redirect to <code>/about/</code></li>
              <li><code>trailingSlash: false</code> - Urls like <code>/about/</code> will redirect to <code>/about</code></li>
              <li><code>cleanUrls: true</code> - Removes file extensions (.html, .php)</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Common Issues</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Inconsistent use of trailing slashes between client navigation and direct URL access</li>
              <li>Middleware redirects conflicting with Next.js built-in redirects</li>
              <li>Clean URLs conflicts with static file routing</li>
              <li>Dynamic routes requiring special handling for trailing slashes</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4">
          <h3 className="font-medium mb-2">Debugging Steps</h3>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>Check your <code>next.config.js</code> and <code>vercel.json</code> for consistent configuration</li>
            <li>Use <code>HEAD</code> requests to check redirects without changing pages</li>
            <li>Test links with and without trailing slashes to identify inconsistencies</li>
            <li>Review middleware logic to ensure it works with your configuration</li>
            <li>Inspect <code>Link</code> components and <code>router.push()</code> calls for consistent URL formats</li>
          </ol>
        </div>
      </div>
    </div>
  );
}