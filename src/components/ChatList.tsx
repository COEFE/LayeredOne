'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import Link from 'next/link';
import { FiMessageSquare, FiFile, FiTrash2, FiSearch, FiPlus, FiCheck, FiX } from 'react-icons/fi';

type Chat = {
  id: string;
  title: string;
  model: string;
  createdAt: any;
  updatedAt: any;
  documentId?: string;
  lastMessage?: string;
};

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat => 
        chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredChats(filtered);
    }
  }, [searchTerm, chats]);
  
  // Exit selection mode if no chats are available
  useEffect(() => {
    if (filteredChats.length === 0 && selectionMode) {
      setSelectionMode(false);
      setSelectedChats(new Set());
    }
  }, [filteredChats, selectionMode]);

  const loadChats = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Simple query that matches the error URL index requirements
      const q = query(
        collection(db, 'chats'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const loadedChats: Chat[] = [];
      
      // First pass: collect all chats and document IDs that need lookup
      const documentIds = new Set<string>();
      querySnapshot.forEach((docSnap) => {
        const chatData = docSnap.data() as Omit<Chat, 'id'>;
        if (chatData.documentId) {
          documentIds.add(chatData.documentId);
        }
        
        loadedChats.push({
          id: docSnap.id,
          ...chatData
        });
      });
      
      // If we have document chats, fetch the document names
      if (documentIds.size > 0) {
        const documentData: Record<string, { name: string, type?: string }> = {};
        
        // Fetch documents in parallel using Promise.all
        await Promise.all(
          Array.from(documentIds).map(async (docId) => {
            try {
              const docRef = doc(db, 'documents', docId);
              const docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                const data = docSnap.data();
                documentData[docId] = {
                  name: data.name || 'Unnamed Document',
                  type: data.type || data.contentType
                };
              }
            } catch (err) {
              console.error(`Error fetching document ${docId}:`, err);
            }
          })
        );
        
        // Enhance chat titles with document names
        loadedChats.forEach(chat => {
          if (chat.documentId && documentData[chat.documentId]) {
            const docInfo = documentData[chat.documentId];
            // Only override generic document chat titles
            if (chat.title === 'Document Chat' || !chat.title || chat.title.startsWith('Chat with')) {
              chat.title = `${docInfo.name}`;
            }
          }
        });
      }
      
      setChats(loadedChats);
      setFilteredChats(loadedChats);
      setLoading(false);
    } catch (error) {
      console.error('Error loading chats:', error);
      setError('Failed to load chats. Please try again later.');
      setLoading(false);
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    
    if (confirm('Are you sure you want to delete this chat?')) {
      try {
        await deleteDoc(doc(db, 'chats', chatId));
        setChats((prevChats) => {
          const updated = prevChats.filter((chat) => chat.id !== chatId);
          setFilteredChats(updated);
          return updated;
        });
      } catch (error) {
        console.error('Error deleting chat:', error);
        setError('Failed to delete chat. Please try again later.');
      }
    }
  };

  const getModelIcon = (model: string, documentId?: string) => {
    if (documentId) {
      return <FiFile className="w-5 h-5 text-blue-500" />;
    } else if (model.includes('claude')) {
      return <FiMessageSquare className="w-5 h-5 text-purple-500" />;
    } else if (model.includes('chatgpt')) {
      return <FiMessageSquare className="w-5 h-5 text-green-500" />;
    } else {
      return <FiMessageSquare className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    
    let d;
    try {
      // Check if the date has a toDate function (Firestore Timestamp)
      if (typeof date.toDate === 'function') {
        d = date.toDate();
      } else {
        // Handle regular Date objects or timestamps
        d = new Date(date);
      }
      
      const now = new Date();
      
      // Today
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Within last 7 days
      const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < 7) {
        const options: Intl.DateTimeFormatOptions = { weekday: 'short' };
        return d.toLocaleDateString(undefined, options);
      }
      
      // Older chats
      return d.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  // Toggle selection of a chat
  const toggleChatSelection = (chatId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedChats(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(chatId)) {
        newSelected.delete(chatId);
      } else {
        newSelected.add(chatId);
      }
      return newSelected;
    });
  };
  
  // Toggle selection mode
  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      // Exiting selection mode, clear selections
      setSelectedChats(new Set());
    }
  };
  
  // Select or deselect all visible chats
  const selectAllChats = (select: boolean) => {
    if (select) {
      const allChatIds = new Set(filteredChats.map(chat => chat.id));
      setSelectedChats(allChatIds);
    } else {
      setSelectedChats(new Set());
    }
  };
  
  // Delete multiple chats
  const deleteSelectedChats = async () => {
    if (!user || selectedChats.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedChats.size} conversation${selectedChats.size > 1 ? 's' : ''}?`)) {
      try {
        setDeletingMultiple(true);
        
        // Use batched writes for efficiency (Firestore has a limit of 500 operations per batch)
        const batch = writeBatch(db);
        const batchSize = 250; // To be safe, use a smaller batch size
        let operationCount = 0;
        let currentBatch = batch;
        
        // Add delete operations to batch
        for (const chatId of selectedChats) {
          currentBatch.delete(doc(db, 'chats', chatId));
          operationCount++;
          
          // If we reach batch limit, commit and create a new batch
          if (operationCount === batchSize) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
          }
        }
        
        // Commit any remaining operations
        if (operationCount > 0) {
          await currentBatch.commit();
        }
        
        // Update local state
        setChats(prevChats => {
          const updated = prevChats.filter(chat => !selectedChats.has(chat.id));
          setFilteredChats(updated);
          return updated;
        });
        
        // Exit selection mode
        setSelectionMode(false);
        setSelectedChats(new Set());
      } catch (error) {
        console.error('Error deleting multiple chats:', error);
        setError('Failed to delete chats. Please try again later.');
      } finally {
        setDeletingMultiple(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 pt-4 pb-3">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Your Conversations</h2>
          {selectionMode ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => selectAllChats(selectedChats.size < filteredChats.length)}
                className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                disabled={filteredChats.length === 0}
              >
                {selectedChats.size < filteredChats.length ? 'Select All' : 'Deselect All'}
              </button>
              <button
                onClick={deleteSelectedChats}
                className="flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200 disabled:bg-red-300 disabled:cursor-not-allowed"
                disabled={selectedChats.size === 0 || deletingMultiple}
              >
                {deletingMultiple ? (
                  <>
                    <div className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <FiTrash2 className="mr-2" />
                    Delete ({selectedChats.size})
                  </>
                )}
              </button>
              <button
                onClick={toggleSelectionMode}
                className="flex items-center p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleSelectionMode}
                className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                disabled={filteredChats.length === 0}
              >
                <FiCheck className="mr-2" />
                Select
              </button>
              <a 
                href="/chat/new" 
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = "/chat/new";
                }}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <FiPlus className="mr-2" />
                New Chat
              </a>
            </div>
          )}
        </div>
        
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search conversations..."
            className="pl-10 pr-4 py-2 w-full border dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-md">
          {searchTerm ? (
            <p className="text-gray-500">No conversations match your search.</p>
          ) : (
            <p className="text-gray-500">You haven't started any conversations yet.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredChats.map((chat) => (
            <div key={chat.id} className="relative">
              {selectionMode && (
                <div 
                  className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                    selectedChats.has(chat.id) 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                  }`}
                  onClick={(e) => toggleChatSelection(chat.id, e)}
                >
                  {selectedChats.has(chat.id) && <FiCheck className="w-4 h-4" />}
                </div>
              )}
              
              <a 
                href={!selectionMode ? (chat.documentId ? `/documents/${chat.documentId}` : `/chat/${chat.id}`) : '#'}
                className={`block ${selectionMode ? 'pointer-events-none' : ''}`}
                onClick={(e) => {
                  if (selectionMode) {
                    e.preventDefault();
                  } else {
                    e.preventDefault();
                    if (chat.documentId) {
                      window.location.href = `/documents/${chat.documentId}`;
                    } else {
                      window.location.href = `/chat/${chat.id}`;
                    }
                  }
                }}
              >
                <div 
                  className={`flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg border ${
                    selectedChats.has(chat.id) && selectionMode
                      ? 'border-blue-500 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-700'
                  } ${
                    !selectionMode ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : ''
                  } transition-colors duration-150 ${
                    selectionMode ? 'pl-10' : ''
                  }`}
                  onClick={selectionMode ? (e) => toggleChatSelection(chat.id, e) : undefined}
                >
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700">
                    {getModelIcon(chat.model, chat.documentId)}
                  </div>
                  
                  <div className="flex-1 min-w-0 px-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px] md:max-w-xs">
                        {chat.title}
                      </h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {formatDate(chat.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-1">
                      {chat.documentId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          Document Chat
                        </span>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {chat.lastMessage || `${chat.model} conversation`}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {!selectionMode && (
                    <button 
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="flex-shrink-0 p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Delete chat"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}