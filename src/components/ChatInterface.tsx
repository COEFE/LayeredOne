'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase/config';
import { collection, serverTimestamp, query, where, orderBy, getDocs, doc, setDoc } from 'firebase/firestore';
import { addDocumentWithRetry, updateDocumentWithRetry, getDocumentWithRetry, retryOperation } from '@/utils/firebase-helpers';
import ModelSelector from './ModelSelector';

type Message = {
  id?: string;
  content: string; // We'll ensure this is always a string
  role: 'user' | 'assistant';
  timestamp?: any;
};

export default function ChatInterface({ chatId }: { chatId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-7-sonnet-20250219');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (chatId && user) {
      loadChatMessages();
    }
  }, [chatId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatMessages = async () => {
    if (!chatId || !user) return;
    
    try {
      // CASE 1: Check if the ID is a direct document ID
      let effectiveChatId = chatId; // This is the ID we'll actually use for the chat
      let isDocumentId = false;

      try {
        console.log('Checking if ID is a document:', chatId);
        const docSnap = await getDocumentWithRetry(`documents/${chatId}`);
        
        if (docSnap.exists() && docSnap.data().userId === user.uid) {
          console.log('This is a document ID');
          isDocumentId = true;
          
          // For document chats, we use a special format
          const formattedChatId = `chat_${chatId}_${user.uid}`;
          effectiveChatId = formattedChatId;
          
          console.log('Using formatted chat ID:', formattedChatId);
          
          // Check if a chat for this document already exists
          const chatDocSnap = await getDocumentWithRetry(`chats/${formattedChatId}`)
            .catch(err => {
              console.log('Chat does not exist yet, will create one');
              return { exists: () => false };
            });
          
          if (!chatDocSnap.exists()) {
            // Create a new chat for this document
            console.log('Creating new document chat');
            // Create the chat document at a specific document ID
            await setDoc(doc(db, 'chats', formattedChatId), {
              userId: user.uid,
              documentId: chatId,
              title: docSnap.data().name || 'Document Chat',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              model: selectedModel
            });
            
            // Add initial system message
            await addDocumentWithRetry(`chats/${formattedChatId}/messages`, {
              role: 'assistant',
              content: `This is a chat about the document "${docSnap.data().name}". You can ask questions about its contents.`,
              timestamp: serverTimestamp()
            });
            
            // Redirect to the new chat
            console.log('Redirecting to document chat');
            window.location.href = `/chat/${formattedChatId}`;
            return; // Stop execution since we're redirecting
          }
        }
      } catch (docError) {
        console.log('Not a document ID or error checking:', docError);
        // Not a document ID, continue with normal chat processing
      }
      
      // CASE 2: Check if it's a standard chat 
      if (!isDocumentId) {
        console.log('Checking if standard chat exists:', chatId);
        const chatDoc = await getDocumentWithRetry(`chats/${chatId}`);
        
        if (!chatDoc.exists()) {
          console.error('Chat not found');
          setMessages([{
            role: 'assistant',
            content: 'Chat not found. This chat may have been deleted or you may not have access to it.',
            timestamp: serverTimestamp()
          }]);
          return;
        }
        
        if (chatDoc.data().userId !== user.uid) {
          console.error('Unauthorized access to chat');
          setMessages([{
            role: 'assistant',
            content: 'You do not have permission to access this chat.',
            timestamp: serverTimestamp()
          }]);
          return;
        }
      }
      
      // Use the effective chat ID (either original or formatted for document chats)
      console.log('Loading messages for chat ID:', effectiveChatId);
      
      // Simple query with just timestamp ordering
      const q = query(
        collection(db, 'chats', effectiveChatId, 'messages'),
        orderBy('timestamp', 'asc')
      );
      
      // Use retry for this operation too
      const querySnapshot = await retryOperation(() => getDocs(q));
      const loadedMessages: Message[] = [];
      
      querySnapshot.forEach((doc) => {
        loadedMessages.push({
          id: doc.id,
          ...doc.data() as Omit<Message, 'id'>
        });
      });
      
      console.log(`Loaded ${loadedMessages.length} messages`);
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading chat messages:', error);
      // Show a helpful message in the UI
      setMessages([{
        role: 'assistant',
        content: 'There was an error loading chat messages. This could be due to network issues. Please try refreshing the page.',
        timestamp: serverTimestamp()
      }]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !user) return;
    
    const userMessage: Message = {
      content: input,
      role: 'user',
      timestamp: serverTimestamp()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Check if this is a document ID and format it properly
    let newChatId = chatId;
    
    // For document IDs, use the special format
    try {
      if (chatId) {
        const docSnap = await getDocumentWithRetry(`documents/${chatId}`);
        if (docSnap.exists() && docSnap.data().userId === user.uid) {
          newChatId = `chat_${chatId}_${user.uid}`;
          console.log('Using document chat ID format:', newChatId);
        }
      }
    } catch (error) {
      // Not a document ID, continue with normal chat ID
      console.log('Using normal chat ID');
    }
    
    try {
      // Save user message to Firestore with retry
      if (newChatId) {
        console.log('Adding message to chat:', newChatId);
        await addDocumentWithRetry(`chats/${newChatId}/messages`, userMessage);
      } else {
        // Create a new chat if we don't have any chatId
        console.log('Creating new chat');
        const chatData = {
          userId: user.uid,
          model: selectedModel,
          title: input.substring(0, 30) + (input.length > 30 ? '...' : ''),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const chatRef = await addDocumentWithRetry('chats', chatData);
        
        newChatId = chatRef.id;
        await addDocumentWithRetry(`chats/${newChatId}/messages`, userMessage);
        
        // Navigate to the new chat
        console.log('Navigating to new chat:', newChatId);
        window.location.href = `/chat/${newChatId}`;
      }
      
      // Get all messages for context
      const messageHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      messageHistory.push({
        role: 'user',
        content: input
      });
      
      // Force debug mode for direct API access (bypassing authentication)
      const forceDebugMode = true; // IMPORTANT: Set this to true to use the debug endpoint
      
      // In development mode, use the debug endpoint to avoid auth issues
      const isDevelopment = typeof window !== 'undefined' && 
                           (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      // Use debug endpoint if in development mode OR if force debug mode is enabled
      const apiEndpoint = (isDevelopment || forceDebugMode) ? '/api/debug/directchat' : '/api/chat';
      
      console.log(`Using API endpoint: ${apiEndpoint} (isDevelopment: ${isDevelopment}, forceDebugMode: ${forceDebugMode})`);
      console.log('Sending message with model:', selectedModel);
      
      // Only get token for production endpoint
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (!isDevelopment) {
        const idToken = await user.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      }
      
      // Call API to get the LLM response
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: messageHistory,
          model: selectedModel,
        }),
      });
      
      // Clone the response so we can read it multiple times
      const responseClone = response.clone();
      
      // Log the raw response for debugging
      console.log('API Response Status:', response.status);
      
      if (!response.ok) {
        console.error('Response not OK, status:', response.status);
        
        try {
          const errorData = await response.json();
          console.error('API Error Response:', errorData);
          
          // Extract detailed error information
          let errorMessage = 'Failed to get response from LLM';
          
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
          
          if (errorData && errorData.errorDetail) {
            console.error('Detailed error:', errorData.errorDetail);
          }
          
          throw new Error(errorMessage);
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          
          // Try to get the raw text if JSON parsing fails
          try {
            const rawText = await responseClone.text();
            console.error('Raw error response:', rawText);
            throw new Error('Failed to get response from LLM: ' + (rawText.substring(0, 100) || 'Empty response'));
          } catch (textError) {
            console.error('Failed to get response text:', textError);
            throw new Error('Failed to get response from LLM: Status ' + response.status);
          }
        }
      }
      
      // Parse the successful response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse success response:', parseError);
        throw new Error('Failed to parse LLM response');
      }
      
      // Handle various response content structures
      let responseContent = '';
      
      console.log("Response data:", JSON.stringify(data, null, 2));
      
      // Handle Claude 3.7 response format (and other versions)
      if (data.response && data.response.content) {
        // Check if content is an array (typical Claude format)
        if (Array.isArray(data.response.content)) {
          responseContent = data.response.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
        } 
        // Check if content is a string
        else if (typeof data.response.content === 'string') {
          responseContent = data.response.content;
        }
        // Check if content has text property
        else if (typeof data.response.content === 'object' && 'text' in data.response.content) {
          responseContent = data.response.content.text;
        }
        // Fallback - direct message property in Claude response
        else if (typeof data.response.message === 'string') {
          responseContent = data.response.message;
        }
        // Fallback - access content value directly if all else fails
        else {
          try {
            responseContent = JSON.stringify(data.response.content);
          } catch (e) {
            responseContent = "Error: Could not parse AI response content";
          }
        }
      } 
      // Direct access to the response for Claude 3.7 format
      else if (data.response) {
        if (data.response.text) {
          responseContent = data.response.text;
        } else {
          // Last resort - stringify the whole response object
          try {
            responseContent = JSON.stringify(data.response);
          } catch (e) {
            responseContent = "Error: Could not parse AI response";
          }
        }
      } 
      // Absolute fallback - take the entire data object
      else {
        try {
          responseContent = JSON.stringify(data);
        } catch (e) {
          responseContent = "Error: Could not parse AI response data";
        }
      }
      
      const aiResponse: Message = {
        content: responseContent,
        role: 'assistant',
        timestamp: serverTimestamp()
      };
      
      setMessages((prev) => [...prev, aiResponse]);
      
      // Save AI response to Firestore with retry
      if (newChatId) {
        await addDocumentWithRetry(`chats/${newChatId}/messages`, aiResponse);
        
        // Update the chat's updated timestamp with retry
        await updateDocumentWithRetry(`chats/${newChatId}`, {
          updatedAt: serverTimestamp()
        });
      }
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Show error message to user
      let errorContent = "Sorry, I couldn't process your request. Please try again later.";
      
      // If it's an API key error, suggest checking settings
      if (error.message && (
        error.message.includes('API key') || 
        error.message.includes('OpenAI') || 
        error.message.includes('Anthropic')
      )) {
        errorContent = `${error.message} Please check your API keys in the Settings page.`;
      }
      
      const errorMessage: Message = {
        content: errorContent,
        role: 'assistant',
        timestamp: serverTimestamp()
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      
      if (newChatId) {
        try {
          await addDocumentWithRetry(`chats/${newChatId}/messages`, errorMessage);
        } catch (saveError) {
          console.error('Error saving error message:', saveError);
          // We don't throw this error since we're already in an error handler
        }
      }
      
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleModelChange = (model: string) => {
    console.log('Model selected:', model);
    setSelectedModel(model);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="mb-4">
        <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />
      </div>
      
      <div className="flex-1 overflow-y-auto mb-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Start a conversation by sending a message
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-100 dark:bg-blue-900 ml-auto' 
                    : 'bg-gray-100 dark:bg-gray-800 mr-auto'
                } max-w-[80%]`}
              >
                {message.content}
              </div>
            ))}
            {isLoading && (
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 mr-auto max-w-[80%]">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-75"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-150"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      <form onSubmit={handleSendMessage} className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
}