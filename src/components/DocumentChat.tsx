'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/config';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot
} from 'firebase/firestore';
import { FiSend, FiLoader, FiAlertTriangle, FiInfo, FiUser, FiCpu } from 'react-icons/fi';
import ModelSelector from './ModelSelector';

interface DocumentChatProps {
  documentId: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: any;
  isError?: boolean;
  isLoading?: boolean;
}

interface Document {
  id: string;
  name: string;
  contentType: string;
  extractedText?: string;
  summary?: string;
  aiAnalysis?: any;
}

interface DocumentChatProps {
  documentId: string;
  compactMode?: boolean;
}

export default function DocumentChat({ documentId, compactMode = false }: DocumentChatProps) {
  const [document, setDocument] = useState<Document | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inputValue, setInputValue] = useState(''); // Separate state for input field
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('claude-3-7-sonnet-20250219');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Fetch document data
  useEffect(() => {
    async function fetchDocument() {
      if (!user) return;
      
      try {
        const docRef = doc(db, 'documents', documentId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const docData = docSnap.data();
          
          // Check if this document belongs to the current user
          if (docData.userId !== user.uid) {
            setError('You do not have permission to view this document');
            setLoading(false);
            return;
          }
          
          setDocument({
            id: docSnap.id,
            name: docData.name,
            contentType: docData.contentType,
            extractedText: docData.extractedText,
            aiAnalysis: docData.aiAnalysis
          });
          
          // Create a chat associated with this document if it doesn't exist
          await ensureDocumentChat();
        } else {
          setError('Document not found');
        }
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Error loading document');
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocument();
  }, [documentId, user]);
  
  // Get or create a chat for this document
  async function ensureDocumentChat() {
    if (!user) return;
    
    try {
      // Create a unique chat ID for this document and user
      const chatId = `chat_${documentId}_${user.uid}`;
      const chatDocRef = doc(db, 'chats', chatId);
      const chatDocSnap = await getDoc(chatDocRef);
      
      // If chat doesn't exist, create it
      if (!chatDocSnap.exists()) {
        console.log('Creating new document chat:', chatId);
        
        // Create chat document
        await setDoc(chatDocRef, {
          userId: user.uid,
          documentId: documentId,
          title: document?.name || 'Document Chat',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          model: selectedModel
        });
        
        // Add system message
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
          role: 'system',
          content: `This is a chat about the document "${document?.name}". You can ask questions about the content.`,
          createdAt: serverTimestamp()
        });
      } else {
        console.log('Chat already exists:', chatId);
      }
      
      // Subscribe to messages in this chat
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
      
      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messageList: Message[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messageList.push({
            id: doc.id,
            role: data.role,
            content: data.content,
            createdAt: data.createdAt
          });
        });
        
        setMessages(messageList);
        scrollToBottom();
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error('Error ensuring document chat:', err);
      setError('Error setting up chat');
    }
  }
  
  // Memoize the function to update newMessage from inputValue
  const updateNewMessage = useCallback((value: string) => {
    setNewMessage(value);
  }, []);
  
  // Send a new message
  const sendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return;
    
    try {
      setSending(true);
      
      // Use the same chat ID format as in ensureDocumentChat
      const chatId = `chat_${documentId}_${user.uid}`;
      
      // Clear the input - do this early so the user can start typing their next message
      const messageToSend = newMessage.trim();
      setNewMessage('');
      setInputValue('');
      
      // Get the token for authenticating API calls
      const idToken = await user.getIdToken();
      
      // Check if this is an edit request for Excel or CSV with more comprehensive patterns
      const editKeywords = ['edit', 'change', 'update', 'modify', 'replace', 'set', 'add', 'remove', 'delete', 
                          'cell', 'row', 'column', 'sheet', 'table', 'value', 'rename', 'insert'];
      
      let isEditRequest = false;
      
      // Check for edit keywords in the message
      for (const keyword of editKeywords) {
        if (messageToSend.toLowerCase().includes(keyword)) {
          isEditRequest = true;
          console.log(`Detected edit keyword: ${keyword} in message`);
          break;
        }
      }
      
      const isSpreadsheetType = document?.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                               document?.contentType === 'application/vnd.ms-excel' ||
                               document?.contentType === 'text/csv';
      
      // Log the content type and detection
      console.log(`Document content type: ${document?.contentType}`);
      console.log(`Is edit request: ${isEditRequest}, Is spreadsheet type: ${isSpreadsheetType}`);
      
      // Call the appropriate API endpoint
      const apiEndpoint = (isEditRequest && isSpreadsheetType) ? 
                         '/api/chat/document/edit' : 
                         '/api/chat/document';
      
      console.log(`Using API endpoint: ${apiEndpoint}`);
      
      // Call the API to get the assistant's response with enhanced error handling
      // The API handles adding messages to Firestore
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            message: messageToSend,
            documentId: documentId,
            chatId: chatId,
            model: selectedModel
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Error getting response from AI';
          
          try {
            // Try to parse the error as JSON
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch (e) {
            // If not JSON, use the text as is
            errorMessage = errorText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }
        
        // API response is actually handled by the Firestore listener in useEffect
        // which will update the messages state when the new messages are added
        console.log('Message sent successfully, waiting for AI response...');
      } catch (err: any) {
        console.error('Error sending message:', err);
        
        // Show a more user-friendly error message
        let displayError = 'Failed to send message. Please try again.';
        
        // Handle specific error cases
        if (err.name === 'AbortError') {
          displayError = 'Request timed out. The server may be overloaded or experiencing issues. Please try again.';
        } else if (err.message?.includes('API key not configured')) {
          displayError = 'AI API key is missing. Ask your administrator to configure it in the .env.local file.';
        } else if (err.message?.includes('API error: 401')) {
          displayError = 'Authentication failed with AI provider. The API key may be invalid or expired.';
        } else if (err.message?.includes('API error: 429')) {
          displayError = 'Rate limit exceeded. Please try again in a few moments.';
        } else if (err.message?.includes('API error: 529') || err.message?.includes('overloaded')) {
          displayError = 'Claude API is currently overloaded. Please wait a moment and try again.';
        } else if (err.message?.includes('file')) {
          displayError = 'Error accessing document file. The file may be missing or inaccessible.';
        } else if (err.message?.includes('network') || err.message?.includes('Network') || err.message?.includes('Failed to fetch')) {
          displayError = 'Network error. Check your internet connection and try again.';
        } else if (err.message?.includes('too large') || err.message?.includes('exceeds 5 MB maximum')) {
          displayError = 'This image is too large for Claude to process. The system attempted to automatically resize it but it\'s still too large. Try using a smaller image.';  
        }
        
        setError(displayError);
      } finally {
        setSending(false);
      }
    } catch (err) {
      console.error('Outer error:', err);
      setError('An unexpected error occurred');
      setSending(false);
    }
  };
  
  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Handle input submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Make sure newMessage is updated with the latest inputValue
    updateNewMessage(inputValue);
    // Use setTimeout to ensure the state update happens before sending
    setTimeout(sendMessage, 0);
  };
  
  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Debounce updating the newMessage state to reduce re-renders
    const debounceTimeout = setTimeout(() => {
      updateNewMessage(value);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(debounceTimeout);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FiLoader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">Loading document chat...</span>
      </div>
    );
  }
  
  if (error && !document) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md shadow-sm">
          <div className="flex">
            <FiAlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Document</h3>
              <div className="text-sm text-red-700 mt-1">{error}</div>
              <button 
                onClick={() => setError(null)}
                className="mt-2 text-xs bg-white border border-red-300 text-red-700 px-3 py-1 rounded-md hover:bg-red-50"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!document) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
        <div className="flex">
          <FiInfo className="h-5 w-5 text-blue-500" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">No Document Found</h3>
            <div className="text-sm text-blue-700">The requested document could not be found.</div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Model selector in compact form */}
      <div className={`${compactMode ? 'px-2 py-1' : 'px-3 py-2'} border-b flex justify-between items-center bg-gray-50`}>
        <div className="flex-shrink-0">
          {(document.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            document.contentType === 'application/vnd.ms-excel' ||
            document.contentType === 'text/csv') && (
            <div className="text-xs text-green-600 flex items-center">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1"></span>
              {compactMode ? 'Excel edits' : 'Spreadsheet editing enabled'}
            </div>
          )}
        </div>
        <ModelSelector
          selectedModel={selectedModel}
          onSelectModel={(model) => {
            setSelectedModel(model);
            // Clear any existing errors
            setError(null);
            
            // Check if switching to OpenAI models
            if (model.startsWith('chatgpt') || model.startsWith('gpt')) {
              setError('Note: OpenAI models require a valid API key. If you encounter errors, try using a Claude model.');
            }
          }}
          compact={true}
        />
      </div>
      
      {/* Messages container */}
      <div className={`flex-1 ${compactMode ? 'p-2' : 'p-4'} overflow-y-auto`}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
            <p className={compactMode ? 'text-sm' : ''}>Start chatting about this document</p>
            
            {!compactMode && (
              <p className="text-sm mt-2">Ask questions about the content, request summaries, or explore details</p>
            )}
            
            {(document.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
              document.contentType === 'application/vnd.ms-excel' ||
              document.contentType === 'text/csv') && !compactMode && (
              <div className="mt-4 bg-green-50 border border-green-200 p-3 rounded text-sm text-green-700 max-w-md">
                <p className="font-semibold mb-1">✓ Editing Tip:</p>
                <p className="mb-2">You can edit this spreadsheet directly by asking Claude. For example:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Change the value in cell A1 to "Sales Report"</li>
                  <li>Update row 3, column B to 450</li>
                  <li>Add a new row with values: John, 32, Engineer</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className={compactMode ? 'space-y-2' : 'space-y-4'}>
            {messages.map((message, index) => (
              <div 
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role !== 'system' && (
                  <div 
                    className={`${compactMode ? 'max-w-[95%]' : 'max-w-[85%]'} ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                        : message.isError 
                          ? 'bg-red-100 text-red-900 rounded-2xl rounded-tl-sm border border-red-200'
                          : 'bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm border border-gray-200'
                    } ${compactMode ? 'py-1.5 px-2' : 'py-2 px-3'} shadow-sm`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`flex-shrink-0 ${message.role === 'user' ? 'text-blue-200' : 'text-gray-400'} mt-1`}>
                        {message.role === 'user' ? (
                          <FiUser className="h-3.5 w-3.5" />
                        ) : message.isLoading ? (
                          <FiLoader className="animate-spin h-3.5 w-3.5" />
                        ) : message.isError ? (
                          <FiAlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <FiCpu className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className={`whitespace-pre-wrap ${compactMode ? 'text-xs' : 'text-sm'}`}>
                        {message.content}
                      </div>
                    </div>
                    {message.createdAt && !compactMode && (
                      <div className={`text-right text-xs mt-1 ${message.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                        {message.createdAt.toDate ? 
                          new Date(message.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                          ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {sending && !messages.some(m => m.isLoading) && (
              <div className="flex justify-start">
                <div className={`bg-gray-50 text-gray-600 rounded-2xl rounded-tl-sm border border-gray-200 ${compactMode ? 'py-1 px-2' : 'py-2 px-3'} shadow-sm flex items-center space-x-2`}>
                  <FiLoader className={`animate-spin ${compactMode ? 'h-3 w-3' : 'h-4 w-4'} text-gray-500`} />
                  <span className={compactMode ? 'text-xs' : 'text-sm'}>Claude is thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className={`border-t ${compactMode ? 'p-2' : 'p-3'}`}>
        <form onSubmit={handleSubmit} className="flex items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Ask about this document..."
              className={`w-full ${compactMode ? 'pl-3 pr-8 py-1.5 text-xs' : 'pl-4 pr-10 py-2.5 text-sm'} border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              disabled={sending}
            />
            {error && (
              <div className="absolute -top-12 left-0 right-0 bg-red-50 text-red-800 text-xs p-2 rounded border border-red-200">
                {error}
              </div>
            )}
          </div>
          <button
            type="submit"
            className={`ml-2 ${compactMode ? 'p-1.5' : 'p-2.5'} rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm ${
              sending || !inputValue.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
            disabled={sending || !inputValue.trim()}
          >
            {sending ? (
              <FiLoader className={`animate-spin ${compactMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
            ) : (
              <FiSend className={compactMode ? 'h-4 w-4' : 'h-5 w-5'} />
            )}
          </button>
        </form>
        
        {/* Document editing hint for spreadsheets */}
        {(document.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          document.contentType === 'application/vnd.ms-excel' ||
          document.contentType === 'text/csv') && messages.length > 0 && !compactMode && (
          <div className="mt-2 text-xs text-gray-500 px-2 flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1"></span>
            <span>Tip: Try saying "Add a new row" or "Update cell A1 to Sales"</span>
          </div>
        )}
      </div>
    </div>
  );
}