'use client';

import { useAuth } from '@/context/AuthContext';
import ChatList from '@/components/ChatList';
import Link from 'next/link';
import { FiLogIn } from 'react-icons/fi';

export default function ChatPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to Chat</h1>
        <p className="mb-6">Log in to view your conversations and start chatting with AI.</p>
        <a 
          href="/login/" 
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/login/";
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <FiLogIn className="mr-2" />
          Log In
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <ChatList />
    </div>
  );
}