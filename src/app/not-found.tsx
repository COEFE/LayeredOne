'use client';

import React from 'react';

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-lg w-full p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-500">Page Not Found</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mb-6 text-left">
          <p className="font-medium mb-2 text-gray-700 dark:text-gray-200">You might want to:</p>
          <ul className="list-disc pl-8 space-y-1 text-gray-600 dark:text-gray-300">
            <li>Check the URL for typos</li>
            <li>Go back to the previous page</li>
            <li>Visit our homepage</li>
          </ul>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Go Back
          </button>
          <a 
            href="/" 
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "/";
            }}
          >
            Go Home
          </a>
        </div>
        <p className="mt-8 text-xs text-gray-500">
          Error ID: 404-PAGE-NOT-FOUND
        </p>
      </div>
    </div>
  );
}