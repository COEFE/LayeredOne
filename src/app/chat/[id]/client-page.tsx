'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import ChatInterface from '@/components/ChatInterface';
import Link from 'next/link';

export default function ClientChatPage({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const [chatExists, setChatExists] = useState<boolean | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDocumentChat, setIsDocumentChat] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const router = useRouter();
  const chatId = id;

  useEffect(() => {
    const checkChatExists = async () => {
      if (!user) return;
      
      if (chatId === 'new') {
        setChatExists(true);
        setIsAuthorized(true);
        setIsLoading(false);
        return;
      }
      
      try {
        // First check if this might be a document ID
        const docRef = doc(db, 'documents', chatId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().userId === user.uid) {
          // This is a document ID, so treat it as a document chat
          setChatExists(true);
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }
        
        // If not a document, then check for a chat with this ID
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        
        if (chatDoc.exists()) {
          setChatExists(true);
          
          // Check if the user is authorized to access this chat
          const chatData = chatDoc.data();
          if (chatData.userId === user.uid) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        } else {
          // Also try the document chat ID format
          const formattedChatId = `chat_${chatId}_${user.uid}`;
          const formattedChatDoc = await getDoc(doc(db, 'chats', formattedChatId));
          
          if (formattedChatDoc.exists()) {
            setChatExists(true);
            const chatData = formattedChatDoc.data();
            if (chatData.userId === user.uid) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
            }
          } else {
            setChatExists(false);
          }
        }
      } catch (error) {
        console.error('Error checking chat:', error);
        setChatExists(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (!loading) {
      checkChatExists();
    }
  }, [chatId, user, loading]);
  
  // Add document chat detection as a second effect
  useEffect(() => {
    const checkDocumentChat = async () => {
      if (!user || !chatId || loading || isLoading) return;
      
      try {
        // First, check if ID might be a document ID
        const docRef = doc(db, 'documents', chatId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().userId === user.uid) {
          setIsDocumentChat(true);
          setDocumentName(docSnap.data().name || "Document");
          
          // Redirect to document view
          if (chatExists && isAuthorized) {
            window.location.href = `/documents/${chatId}`;
          }
        } else {
          // Check if it's a document chat ID
          const chatRef = doc(db, 'chats', chatId);
          const chatSnap = await getDoc(chatRef);
          
          if (chatSnap.exists() && chatSnap.data().documentId) {
            setIsDocumentChat(true);
            const documentId = chatSnap.data().documentId;
            
            // Try to get the document name
            try {
              const documentRef = doc(db, 'documents', documentId);
              const documentSnap = await getDoc(documentRef);
              
              if (documentSnap.exists()) {
                setDocumentName(documentSnap.data().name || "Document");
              }
              
              // Redirect to document view
              if (chatExists && isAuthorized) {
                window.location.href = `/documents/${documentId}`;
              }
            } catch (error) {
              console.error("Error fetching document name:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error checking document chat:", error);
      }
    };
    
    checkDocumentChat();
  }, [chatId, user, loading, isLoading, chatExists, isAuthorized, router]);

  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Please Log In</h1>
        <p className="mb-6">You need to be logged in to view and create chats.</p>
        <a 
          href="/login" 
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/login";
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Log In
        </a>
      </div>
    );
  }

  if (chatExists === false) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Chat Not Found</h1>
        <p className="mb-6">The chat you're looking for does not exist or has been deleted.</p>
        <a 
          href="/chat" 
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/chat";
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Back to Chats
        </a>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
        <p className="mb-6">You do not have permission to access this chat.</p>
        <a 
          href="/chat" 
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/chat";
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Back to Chats
        </a>
      </div>
    );
  }

  
  return (
    <div className="container mx-auto max-w-5xl px-4 h-[80vh]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {chatId === 'new' ? 'New Chat' : isDocumentChat ? 'Document Chat' : 'Chat'}
          </h1>
          {isDocumentChat && documentName && (
            <p className="text-gray-600 text-sm">Discussing: {documentName}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isDocumentChat && (
            <a 
              href={`/documents/${chatId}`} 
              onClick={(e) => {
                e.preventDefault();
                window.location.href = `/documents/${chatId}`;
              }}
              className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              View Document
            </a>
          )}
          <a 
            href="/chat" 
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "/chat";
            }}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Back to Chats
          </a>
        </div>
      </div>
      
      <div className="h-[calc(100%-60px)]">
        <ChatInterface chatId={chatId === 'new' ? undefined : chatId} />
      </div>
    </div>
  );
}