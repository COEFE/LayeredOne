'use client';

import React from 'react';

export default function ChatNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-lg w-full p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-500">Chat Not Found</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          The chat you're looking for does not exist or has been deleted.
        </p>
        <p className="mb-6 text-gray-500 dark:text-gray-400 text-sm">
          This could be due to one of the following reasons:
          <ul className="list-disc text-left pl-8 mt-2 space-y-1">
            <li>The chat ID is invalid or misspelled</li>
            <li>The chat has been deleted</li>
            <li>You don't have permission to view this chat</li>
          </ul>
        </p>
        <a 
          href="/chat" 
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/chat";
          }}
        >
          Back to All Chats
        </a>
        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          Error ID: 404-CHAT-NOT-FOUND
        </p>
      </div>
    </div>
  );
}