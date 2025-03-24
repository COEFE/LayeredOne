'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FiLoader } from 'react-icons/fi';

export default function NewChatPage() {
  const { user, loading: authLoading } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      createNewChat();
    } else if (!authLoading && !user) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
    }
  }, [user, authLoading]);

  const createNewChat = async () => {
    if (!user) return;
    
    try {
      setCreating(true);
      setError(null);
      
      // Create a new chat document
      const chatData = {
        userId: user.uid,
        title: 'New Conversation',
        model: 'claude-3-sonnet', // Default model
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messages: []
      };
      
      // Add the document to Firestore
      const docRef = await addDoc(collection(db, 'chats'), chatData);
      
      // Redirect to the new chat
      window.location.href = `/chat/${docRef.id}`;
    } catch (err) {
      console.error('Error creating new chat:', err);
      setError('Failed to create a new chat. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      {error ? (
        <div className="bg-red-100 p-4 rounded-md max-w-md">
          <p className="text-red-700 text-center">{error}</p>
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => createNewChat()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <FiLoader className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="text-lg">Creating new chat...</p>
        </div>
      )}
    </div>
  );
}