'use client';

import { useEffect, useState } from 'react';

export default function DebugPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [resourceInfo, setResourceInfo] = useState<any>(null);
  const [envInfo, setEnvInfo] = useState<any>(null);

  useEffect(() => {
    // Gather environment info
    setEnvInfo({
      userAgent: navigator.userAgent,
      url: window.location.href,
      pathname: window.location.pathname,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      nextPublic: Object.keys(process.env)
        .filter(key => key.startsWith('NEXT_PUBLIC_'))
        .reduce((obj, key) => {
          obj[key] = process.env[key];
          return obj;
        }, {} as Record<string, any>)
    });

    // Access any diagnostic data from our debug script
    if (typeof window !== 'undefined' && (window as any).__debug) {
      setResourceInfo((window as any).__debug);
    }

    // Create error logging
    const errors: any[] = [];
    const originalConsoleError = console.error;
    
    console.error = function(...args) {
      errors.push({
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '),
        timestamp: new Date().toISOString()
      });
      setLogs([...errors]);
      originalConsoleError.apply(console, args);
    };

    // Test resource loading
    const testResourceLoading = () => {
      // Check CSS
      const testCss = document.createElement('link');
      testCss.rel = 'stylesheet';
      testCss.href = '/_next/static/css/test.css';
      document.head.appendChild(testCss);
      
      // Check JS
      const testJs = document.createElement('script');
      testJs.src = '/_next/static/chunks/test.js';
      document.head.appendChild(testJs);
      
      // Check images
      const testImg = document.createElement('img');
      testImg.src = '/vercel.svg';
      testImg.style.display = 'none';
      document.body.appendChild(testImg);
    };
    
    // Run the tests
    setTimeout(testResourceLoading, 1000);
    
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <h1 className="text-2xl font-bold mb-6">Diagnostic Information</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Environment Info</h2>
        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto max-h-60">
          {JSON.stringify(envInfo, null, 2)}
        </pre>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Resource Info</h2>
        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto max-h-60">
          {resourceInfo ? JSON.stringify(resourceInfo, null, 2) : 'No resource info available'}
        </pre>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Error Logs ({logs.length})</h2>
        {logs.length > 0 ? (
          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto max-h-96">
            {logs.map((log, i) => (
              <div key={i} className="mb-2 pb-2 border-b border-gray-300 dark:border-gray-700">
                <div className="text-red-600 dark:text-red-400 font-mono text-sm">{log.timestamp}</div>
                <div className="text-gray-800 dark:text-gray-200 font-mono text-sm whitespace-pre-wrap">{log.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <p>No errors logged</p>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Network Tests</h2>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Tests
        </button>
      </div>
    </div>
  );
}
