'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  where,
  orderBy, 
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { FiSend, FiLoader, FiAlertTriangle, FiInfo, FiUser, FiCpu, FiFolder, FiMessageSquare, FiFile } from 'react-icons/fi';
import ModelSelector from './ModelSelector';
import FolderDocumentsList from './FolderDocumentsList';

interface FolderChatProps {
  folderId: string;
  layout?: 'split' | 'document' | 'chat';
  fullWidth?: boolean;
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

interface Folder {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

export default function FolderChat({ folderId, layout = 'split', fullWidth = false }: FolderChatProps) {
  const [folder, setFolder] = useState<Folder | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inputValue, setInputValue] = useState(''); // Separate state for input field
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-3.7');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Fetch folder and documents
  useEffect(() => {
    async function fetchFolderAndDocuments() {
      if (!user) return;
      
      try {
        // Fetch folder data
        const folderRef = doc(db, 'folders', folderId);
        const folderSnap = await getDoc(folderRef);
        
        if (!folderSnap.exists()) {
          setError('Folder not found');
          setLoading(false);
          return;
        }
        
        const folderData = folderSnap.data();
        
        // Check if folder belongs to the current user
        if (folderData.userId !== user.uid) {
          setError('You do not have permission to view this folder');
          setLoading(false);
          return;
        }
        
        setFolder({
          id: folderSnap.id,
          name: folderData.name,
          userId: folderData.userId,
          createdAt: folderData.createdAt
        });
        
        // Fetch documents in this folder
        const documentsQuery = query(
          collection(db, 'documents'),
          where('userId', '==', user.uid),
          where('folderId', '==', folderId),
          orderBy('createdAt', 'desc')
        );
        
        const documentsSnap = await getDocs(documentsQuery);
        const loadedDocuments: Document[] = [];
        
        documentsSnap.forEach((docSnap) => {
          const docData = docSnap.data();
          loadedDocuments.push({
            id: docSnap.id,
            name: docData.name,
            contentType: docData.contentType || docData.type,
            extractedText: docData.extractedText,
            summary: docData.aiAnalysis?.summary,
            aiAnalysis: docData.aiAnalysis
          });
        });
        
        setDocuments(loadedDocuments);
        
        if (loadedDocuments.length === 0) {
          setError('This folder contains no documents');
        } else {
          // Create a chat associated with this folder if it doesn't exist
          await ensureFolderChat();
        }
      } catch (err) {
        console.error('Error fetching folder and documents:', err);
        setError('Error loading folder data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchFolderAndDocuments();
  }, [folderId, user]);
  
  // Get or create a chat for this folder
  async function ensureFolderChat() {
    if (!user) return;
    
    try {
      // Create a unique chat ID for this folder and user
      const chatId = `folder_chat_${folderId}_${user.uid}`;
      const chatDocRef = doc(db, 'chats', chatId);
      const chatDocSnap = await getDoc(chatDocRef);
      
      // If chat doesn't exist, create it
      if (!chatDocSnap.exists()) {
        console.log('Creating new folder chat:', chatId);
        
        // Create chat document
        await setDoc(chatDocRef, {
          userId: user.uid,
          folderId: folderId,
          title: folder?.name ? `${folder.name} Folder Chat` : 'Folder Chat',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          model: selectedModel,
          isMultiDocument: true
        });
        
        // Add system message
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
          role: 'system',
          content: `This is a chat about the folder "${folder?.name}". You can ask questions about multiple documents in this folder.`,
          createdAt: serverTimestamp()
        });
      } else {
        console.log('Folder chat already exists:', chatId);
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
            createdAt: data.createdAt,
            isError: data.isError,
            isLoading: data.isLoading
          });
        });
        
        setMessages(messageList);
        scrollToBottom();
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error('Error ensuring folder chat:', err);
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
      
      // Use the same chat ID format as in ensureFolderChat
      const chatId = `folder_chat_${folderId}_${user.uid}`;
      
      // Clear the input - do this early so the user can start typing their next message
      const messageToSend = newMessage.trim();
      setNewMessage('');
      setInputValue('');
      
      // Get the token for authenticating API calls
      const idToken = await user.getIdToken();
      
      // Check if this is an edit request for Excel or CSV with more comprehensive patterns
      const editKeywords = ['edit', 'change', 'update', 'modify', 'replace', 'set', 'add', 'remove', 'delete', 
                          'cell', 'row', 'column', 'sheet', 'table', 'value', 'rename', 'insert'];
      
      // Keywords for creating new files
      const createKeywords = ['create', 'make', 'new', 'blank', 'empty', 'generate'];
      const excelKeywords = ['excel', 'spreadsheet', 'xlsx', 'xls', 'workbook', 'sheet'];
      
      let isEditRequest = false;
      let isCreateExcelRequest = false;
      
      // Check for edit keywords in the message
      for (const keyword of editKeywords) {
        if (messageToSend.toLowerCase().includes(keyword)) {
          isEditRequest = true;
          console.log(`Detected edit keyword: ${keyword} in message`);
          break;
        }
      }
      
      // Check if this is a request to create a new Excel file
      if (createKeywords.some(keyword => messageToSend.toLowerCase().includes(keyword)) &&
          excelKeywords.some(keyword => messageToSend.toLowerCase().includes(keyword))) {
        isCreateExcelRequest = true;
        console.log('Detected request to create a new Excel file');
      }
                           
      // Find the document ID if this is an edit request (not a create request)
      let targetDocumentId = null;
      let isSpreadsheetType = false;
      
      if (isEditRequest && !isCreateExcelRequest) {
        // First check if the message explicitly mentions a file by name
        for (const doc of documents) {
          const docName = doc.name.toLowerCase();
          if (messageToSend.toLowerCase().includes(docName)) {
            // Check if it's a supported spreadsheet type
            if (doc.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                doc.contentType === 'application/vnd.ms-excel' ||
                doc.contentType === 'text/csv') {
              targetDocumentId = doc.id;
              isSpreadsheetType = true;
              console.log(`Found matching document for edit: ${doc.name} (${doc.id})`);
              break;
            }
          }
        }
        
        // If no match by name but only one spreadsheet in the folder, use that
        if (!targetDocumentId && documents.length === 1) {
          const doc = documents[0];
          if (doc.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
              doc.contentType === 'application/vnd.ms-excel' ||
              doc.contentType === 'text/csv') {
            targetDocumentId = doc.id;
            isSpreadsheetType = true;
            console.log(`Using the only spreadsheet in folder: ${doc.name} (${doc.id})`);
          }
        }
      }
      
      // Call the appropriate API endpoint
      const apiEndpoint = (isEditRequest && isSpreadsheetType && targetDocumentId) || isCreateExcelRequest ? 
                         '/api/chat/folder/edit' : 
                         '/api/chat/folder';
      
      // Call the API to get the assistant's response with enhanced error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout
      
      try {
        const requestBody: any = {
          message: messageToSend,
          folderId: folderId,
          chatId: chatId,
          model: selectedModel
        };
        
        // Add document ID if this is an edit request
        if (isEditRequest && isSpreadsheetType && targetDocumentId) {
          requestBody.documentId = targetDocumentId;
          console.log(`Sending edit request for document: ${targetDocumentId}`);
        }
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(requestBody),
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
        console.log('Message sent successfully, waiting for AI response...');
      } catch (err: any) {
        console.error('Error sending message:', err);
        
        // Show a more user-friendly error message
        let displayError = 'Failed to send message. Please try again.';
        
        // Handle specific error cases
        if (err.name === 'AbortError') {
          displayError = 'Request timed out. The server may be overloaded. Please try again.';
        } else if (err.message?.includes('API key not configured')) {
          displayError = 'AI API key is missing. Ask your administrator to configure it.';
        } else if (err.message?.includes('API error: 401')) {
          displayError = 'Authentication failed with AI provider. The API key may be invalid.';
        } else if (err.message?.includes('API error: 429')) {
          displayError = 'Rate limit exceeded. Please try again in a few moments.';
        } else if (err.message?.includes('API error: 529') || err.message?.includes('overloaded')) {
          displayError = 'Claude API is currently overloaded. Please wait a moment and try again.';
        } else if (err.message?.includes('network') || err.message?.includes('Network')) {
          displayError = 'Network error. Check your internet connection and try again.';
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
        <span className="ml-2">Loading folder chat...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
        <div className="flex">
          <FiAlertTriangle className="h-5 w-5 text-red-500" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!folder) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
        <div className="flex">
          <FiInfo className="h-5 w-5 text-blue-500" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">No Folder Found</h3>
            <div className="text-sm text-blue-700">The requested folder could not be found.</div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col h-full ${fullWidth ? 'p-0' : ''}`}>
      {/* Folder header - always visible */}
      {!fullWidth && (
        <div className="p-4 bg-white border rounded-md shadow-sm mb-4">
          <h2 className="text-lg font-medium flex items-center">
            <FiFolder className="mr-2 text-blue-500" /> 
            {folder?.name || 'Loading folder...'}
          </h2>
          <p className="text-sm text-gray-500">{documents.length} documents</p>
        </div>
      )}
      
      {/* Split view grid layout */}
      <div className={`grid gap-4 ${layout === 'split' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'} ${fullWidth ? 'h-full' : 'h-[calc(100vh-230px)]'}`}>
        {/* Document viewer panel - takes 2/3 of the split space */}
        {(layout === 'split' || layout === 'document') && (
          <div className={`bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col ${layout === 'split' ? 'md:col-span-2' : ''}`}>
            <div className="p-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center">
                <FiFile className="mr-2 text-blue-700" />
                <h2 className="font-medium text-blue-900">Documents</h2>
              </div>
            </div>
            <div className="flex-grow overflow-auto">
              <FolderDocumentsList folderId={folderId} />
            </div>
          </div>
        )}
        
        {/* Chat panel - takes 1/3 of the split space */}
        {(layout === 'split' || layout === 'chat') && (
          <div className={`bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col ${layout === 'split' ? 'md:col-span-1' : ''}`}>
            <div className="p-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center">
                <FiMessageSquare className="mr-2 text-blue-700" />
                <h2 className="font-medium text-blue-900">Chat with Documents</h2>
              </div>
              <ModelSelector
                selectedModel={selectedModel}
                onSelectModel={(model) => {
                  setSelectedModel(model);
                  // Clear any existing errors
                  setError(null);
                }}
              />
            </div>
            
            {/* Documents mini-list (only visible in chat-only mode) */}
            {layout === 'chat' && (
              <div className="p-3 bg-gray-50 border-b">
                <div className="text-sm font-medium text-gray-700 mb-2">Documents in this folder:</div>
                <div className="flex flex-wrap gap-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bg-white px-2 py-1 rounded border text-xs flex items-center">
                      {doc.name}
                      {(doc.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                        doc.contentType === 'application/vnd.ms-excel' ||
                        doc.contentType === 'text/csv') && (
                        <span className="ml-1 text-green-600" title="Editable with Claude">✓</span>
                      )}
                    </div>
                  ))}
                </div>
                {documents.some(doc => 
                  doc.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                  doc.contentType === 'application/vnd.ms-excel' ||
                  doc.contentType === 'text/csv'
                ) && (
                  <div className="mt-2 text-xs text-green-600">
                    ✓ You can ask Claude to edit spreadsheet files in this folder
                  </div>
                )}
              </div>
            )}
            
            {/* Messages container */}
            <div className="flex-1 p-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p>Start chatting about documents in this folder</p>
                  <p className="text-sm mt-2">Ask questions to compare or analyze multiple documents together</p>
                  <div className="mt-4 bg-green-50 border border-green-200 p-3 rounded text-sm text-green-700 max-w-md">
                    <p className="font-semibold mb-1">✓ You can also:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Ask Claude to edit existing spreadsheets</li>
                      <li>Create a new blank Excel file with "Create a new spreadsheet"</li>
                      <li>Generate data-filled Excel files with custom content</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role !== 'system' && (
                        <div 
                          className={`max-w-3/4 rounded-lg p-3 ${
                            message.role === 'user' 
                              ? 'bg-blue-100 text-blue-900' 
                              : message.isError 
                                ? 'bg-red-100 text-red-900'
                                : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <div className="flex items-start">
                            <div className="mr-2 mt-1">
                              {message.role === 'user' ? (
                                <FiUser className="h-4 w-4 text-blue-500" />
                              ) : message.isLoading ? (
                                <FiLoader className="animate-spin h-4 w-4 text-gray-500" />
                              ) : message.isError ? (
                                <FiAlertTriangle className="h-4 w-4 text-red-500" />
                              ) : (
                                <FiCpu className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {sending && !messages.some(m => m.isLoading) && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 rounded-lg p-3 flex items-center space-x-2">
                        <FiLoader className="animate-spin h-4 w-4 text-gray-500" />
                        <span>Analyzing documents...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
            
            {/* Input area */}
            <div className="border-t p-4">
              <form onSubmit={handleSubmit} className="flex">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Ask about documents in this folder..."
                  className="flex-1 border rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  className={`bg-blue-500 text-white rounded-r-md px-4 py-2 flex items-center ${
                    sending || !inputValue.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                  }`}
                  disabled={sending || !inputValue.trim()}
                >
                  {sending ? (
                    <FiLoader className="animate-spin h-5 w-5" />
                  ) : (
                    <FiSend className="h-5 w-5" />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}