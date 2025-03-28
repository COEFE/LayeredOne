import { NextRequest, NextResponse } from 'next/server';
import { auth, db, admin, firestorePath } from '@/firebase/admin-config';

export const dynamic = 'force-static';

// Create a safe FieldValue for Vercel compatibility
const isVercel = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true';

// Declare FieldValue type to be compatible with both real and mock implementations
let FieldValue: any = {
  serverTimestamp: () => new Date().toISOString()
};

// Function to get Firestore database instance
const getFirestore = () => {
  try {
    return db;
  } catch (error) {
    console.error('Error getting Firestore database:', error);
    return {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({ exists: false, data: () => null, id }),
          collection: () => ({ add: async () => ({ id: 'mock-id' }) }),
          update: async () => ({}),
          set: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' })
      })
    };
  }
};

// Function to get Storage instance
const getStorage = () => {
  try {
    return admin.storage();
  } catch (error) {
    console.error('Error getting Storage:', error);
    return {
      bucket: () => ({
        file: () => ({
          getSignedUrl: async () => ['https://example.com/mock-url'],
          exists: async () => [true],
          download: async () => [Buffer.from('mock file content')]
        })
      })
    };
  }
};

// Import environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
const PDF_MODEL = 'claude-3-7-sonnet-20250219'; // Force Claude 3.7 for PDFs

// Debug flag to log detailed information
const DEBUG = process.env.NODE_ENV === 'development' || true;

export async function POST(request: NextRequest) {
  try {
    console.log("Document Chat API route called");

    // Verify authentication token
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      console.log('Missing auth token');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    
    let userId: string;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('Authenticated user:', userId);
    } catch (error: any) {
      console.error('Invalid auth token:', error);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { message, documentId, chatId, model } = body;

    if (!message || !documentId || !chatId) {
      return NextResponse.json({ 
        error: "Missing required parameters: message, documentId, and chatId are required" 
      }, { status: 400 });
    }

    // Get document data from Firestore
    const firestore = getFirestore();
    const documentRef = firestore.collection('documents').doc(documentId);
    const documentSnapshot = await documentRef.get();

    if (!documentSnapshot.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const documentData = documentSnapshot.data();

    // Check if the user has access to this document
    if (documentData?.userId !== userId) {
      return NextResponse.json({ error: "You don't have permission to access this document" }, { status: 403 });
    }

    // Store user message in Firestore
    const chatRef = firestore.collection('chats').doc(chatId);
    const chatSnapshot = await chatRef.get();

    if (!chatSnapshot.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Add user message to the chat
    const messagesRef = chatRef.collection('messages');
    await messagesRef.add({
      role: 'user',
      content: message,
      createdAt: FieldValue.serverTimestamp()
    });

    // Get document text content
    const documentContent = documentData.extractedText || 'No text content available for this document.';
    const documentName = documentData.name || 'document';
    const documentType = documentData.type || 'application/octet-stream';

    // Create system prompt
    const isPDF = documentType.includes('pdf') || documentName.toLowerCase().endsWith('.pdf');
    const isSpreadsheet = documentType.includes('spreadsheet') || 
        documentType.includes('excel') || 
        documentName.endsWith('.xlsx') || 
        documentName.endsWith('.xls') ||
        documentType.includes('sheet');
        
    let systemPrompt = `You are an AI assistant helping with document analysis. 
      You are analyzing a document titled "${documentName}" with file type "${documentType}". 
      Please provide helpful, accurate answers based on the document content.
      Only answer questions based on information from the document. If the answer cannot be determined from the document, say so clearly.`;
      
    // Add specific instructions for PDF documents
    if (isPDF) {
      systemPrompt += `
      
      This document is a PDF. The content has been extracted as text and page markers have been added.
      Be aware that the extracted text might not perfectly preserve the formatting of the original PDF.
      If there are tables or complex layouts in the PDF, they may appear as continuous text.
      
      When referring to specific sections, try to mention page numbers if available (e.g., "On page 5...").
      If you're asked about figures, charts, or images, explain that as an AI assistant, you can only access 
      the text content that was extracted from the PDF, not the visual elements.
      
      You have access to Brave Search to complement your PDF analysis and provide additional context.
      When the user asks a question that might benefit from more recent or external information related
      to the PDF content, you should perform a search to supplement your answer. When you do this,
      clearly indicate what information comes from the PDF versus from your search.`;
    }
    
    // Add specific instructions for spreadsheets - always use Claude 3.7 for spreadsheets
    else if (isSpreadsheet) {
      systemPrompt += `
      
      This document is a spreadsheet. The content has been extracted as text with cell references (A1 notation).
      Cell references like A1, B2, etc. indicate the position of data in the spreadsheet grid.
      If asked about specific cells or ranges, use these references in your answers.
      
      You can directly edit this spreadsheet by using the format "I'll change cell X to Y" for each edit.
      For example:
      I'll change cell A1 to 'Sales Report'
      I'll change cell B5 to 100
      I'll change cell C10 to '=SUM(C1:C9)'
      
      Put each edit command on its own line with this exact format, and they will be automatically applied.`;
    }

    // Prepare the messages for Claude
    const messagesToSend = [];
    
    // For PDFs, check if we should perform a web search first
    let webSearchResults = null;
    
    if (isPDF && BRAVE_API_KEY) {
      try {
        console.log('Performing Brave search for PDF-related query:', message);
        
        // Create search query by extracting key terms from the user message
        // and combining with document title for context
        const searchQuery = `${message} ${documentName} pdf`;
        
        // Create URL with search parameters
        const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
        searchUrl.searchParams.append('q', searchQuery);
        searchUrl.searchParams.append('count', '5');  // Limit to top 5 results
        searchUrl.searchParams.append('freshness', 'recent'); // Focus on recent results
        
        // Call Brave Search API
        const braveSearchResponse = await fetch(searchUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': BRAVE_API_KEY
          }
        });
        
        if (braveSearchResponse.ok) {
          const searchData = await braveSearchResponse.json();
          
          if (searchData && searchData.web && searchData.web.results) {
            // Format search results 
            webSearchResults = searchData.web.results.map((result: any) => {
              return {
                title: result.title,
                url: result.url,
                description: result.description || ''
              };
            });
            
            console.log(`Found ${webSearchResults.length} search results`);
          }
        } else {
          console.error('Error performing Brave search:', await braveSearchResponse.text());
        }
      } catch (error) {
        console.error('Error during Brave search:', error);
      }
    }
    
    // Add the document content message
    messagesToSend.push({ role: 'user', content: `Here is the document content:\n\n${documentContent}` });
    
    // Add search results if available
    if (webSearchResults && webSearchResults.length > 0) {
      const searchResultsMessage = `Here are some relevant web search results that might help answer questions about this PDF:
      
${webSearchResults.map((result: any, index: number) => {
  return `[${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
}).join('\n')}

Please use these search results to supplement your analysis of the PDF when appropriate.`;

      messagesToSend.push({ role: 'user', content: searchResultsMessage });
    }
    
    // Add the user's actual message
    messagesToSend.push({ role: 'user', content: message });

    // Check for API key
    if (!ANTHROPIC_API_KEY) {
      console.error("Anthropic API key not found");
      
      // Save error message to chat
      await messagesRef.add({
        role: 'assistant',
        content: "Sorry, I couldn't process your request because the AI service is not properly configured. Please contact the administrator.",
        createdAt: FieldValue.serverTimestamp(),
        isError: true
      });
      
      return NextResponse.json(
        { error: "Claude API key not configured. Please add ANTHROPIC_API_KEY to your environment variables." },
        { status: 500 }
      );
    }

    // Call Claude API
    try {
      // Force Claude 3.7 for PDFs and Excel/spreadsheets, otherwise use selected model
      const modelToUse = isPDF || isSpreadsheet ? PDF_MODEL : (model || DEFAULT_MODEL);
      console.log(`Calling Claude API with model: ${modelToUse} (isPDF: ${isPDF}, isSpreadsheet: ${isSpreadsheet})`);
      
      // Claude API call
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: messagesToSend,
          system: systemPrompt,
          max_tokens: 2000
        })
      });
      
      console.log(`API request sent with model: ${model || DEFAULT_MODEL}`);
      
      if (!response.ok) {
        let errorInfo = '';
        try {
          const errorData = await response.json();
          errorInfo = JSON.stringify(errorData);
          console.error("Claude API error (JSON):", errorData);
        } catch (e) {
          const errorText = await response.text();
          errorInfo = errorText;
          console.error("Claude API error (text):", errorText);
        }
        
        // Save error message to chat
        await messagesRef.add({
          role: 'assistant',
          content: `Sorry, I encountered an error while processing your request: ${errorInfo}`,
          createdAt: FieldValue.serverTimestamp(),
          isError: true
        });
        
        throw new Error(`Claude API error: ${response.status} - ${errorInfo}`);
      }

      const result = await response.json();
      
      console.log("Claude API response success");
      
      // Extract assistant's response
      let assistantResponse = '';
      if (result.content && Array.isArray(result.content)) {
        assistantResponse = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');
      } else if (typeof result.content === 'string') {
        assistantResponse = result.content;
      } else {
        assistantResponse = JSON.stringify(result);
      }

      // Save assistant's response to chat
      await messagesRef.add({
        role: 'assistant',
        content: assistantResponse,
        createdAt: FieldValue.serverTimestamp()
      });

      // Update the chat's updatedAt
      await chatRef.update({
        updatedAt: FieldValue.serverTimestamp()
      });

      return NextResponse.json({ success: true });
      
    } catch (err: any) {
      console.error("Error calling Claude API:", err);
      
      // Make sure we've saved an error message to the chat
      if (err.message && !err.message.includes('already saved')) {
        await messagesRef.add({
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.message}`,
          createdAt: FieldValue.serverTimestamp(),
          isError: true
        });
      }
      
      return NextResponse.json(
        { 
          error: `Error calling Claude API: ${err.message}`,
          errorDetail: err.toString() 
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Unhandled error in document chat API:", error);
    return NextResponse.json(
      { error: `Error processing request: ${error.message}` },
      { status: 500 }
    );
  }
}