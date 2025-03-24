'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DebugPage() {
  const router = useRouter();
  const [selectedRoute, setSelectedRoute] = useState('/chat/new/');
  const [routeParams, setRouteParams] = useState('');
  const [customRoute, setCustomRoute] = useState('');

  function navigateToRoute() {
    if (selectedRoute === '/custom/') {
      window.location.href = customRoute;
    } else if (routeParams) {
      window.location.href = selectedRoute.replace(':id', routeParams);
    } else {
      window.location.href = selectedRoute;
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Route Debugging Tool</h1>
      
      <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Current Environment Info</h2>
        <ul className="space-y-2">
          <li><strong>Window Location:</strong> {typeof window !== 'undefined' ? window.location.href : 'Server-side rendering'}</li>
          <li><strong>Hostname:</strong> {typeof window !== 'undefined' ? window.location.hostname : 'Server-side rendering'}</li>
          <li><strong>Path:</strong> {typeof window !== 'undefined' ? window.location.pathname : 'Server-side rendering'}</li>
          <li><strong>Search Params:</strong> {typeof window !== 'undefined' ? window.location.search : 'Server-side rendering'}</li>
          <li><strong>User Agent:</strong> {typeof window !== 'undefined' ? window.navigator.userAgent : 'Server-side rendering'}</li>
        </ul>
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Test Navigation</h2>
        <div className="space-y-4">
          <div>
            <label className="block mb-2">Select Route:</label>
            <select 
              value={selectedRoute} 
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="/chat/new/">New Chat</option>
              <option value="/chat/:id/">Chat ID</option>
              <option value="/documents/">Documents</option>
              <option value="/documents/:id/">Document ID</option>
              <option value="/login/">Login</option>
              <option value="/signup/">Signup</option>
              <option value="/reset-password/">Reset Password</option>
              <option value="/custom/">Custom Route</option>
            </select>
          </div>
          
          {selectedRoute === '/chat/:id/' || selectedRoute === '/documents/:id/' ? (
            <div>
              <label className="block mb-2">ID Parameter:</label>
              <input 
                type="text" 
                value={routeParams} 
                onChange={(e) => setRouteParams(e.target.value)}
                placeholder="Enter ID"
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          ) : null}
          
          {selectedRoute === '/custom/' && (
            <div>
              <label className="block mb-2">Custom Route:</label>
              <input 
                type="text" 
                value={customRoute} 
                onChange={(e) => setCustomRoute(e.target.value)}
                placeholder="Enter custom route (e.g., /some/path/)"
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}
          
          <button 
            onClick={navigateToRoute}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Navigate
          </button>
        </div>
      </div>
      
      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
        <h2 className="text-lg font-semibold mb-2">App Routes</h2>
        <ul className="space-y-2">
          <li><strong>/</strong> - Home page</li>
          <li><strong>/chat/</strong> - Chat list</li>
          <li><strong>/chat/new/</strong> - New chat</li>
          <li><strong>/chat/[id]/</strong> - Chat by ID</li>
          <li><strong>/documents/</strong> - Documents list</li>
          <li><strong>/documents/[id]/</strong> - Document by ID</li>
          <li><strong>/login/</strong> - Login page</li>
          <li><strong>/signup/</strong> - Signup page</li>
          <li><strong>/reset-password/</strong> - Reset password</li>
        </ul>
      </div>
    </div>
  );
}