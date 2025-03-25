import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin-config';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Import environment variables and utilities
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
import { analyzeEditRequest } from '@/utils/excelEditor';

// Debug flag to log detailed information
const DEBUG = process.env.NODE_ENV === 'development' || true;

export async function POST(request: NextRequest) {
  try {
    console.log("Document Edit API route called");

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
    const documentUrl = documentData.url || '';

    // Create system prompt specifically for spreadsheet editing
    const systemPrompt = `You are a spreadsheet editing assistant. The user wants to edit a spreadsheet called "${documentName}".
      You can help with editing spreadsheets by understanding the user's request and applying their requested changes.
      
      You now have the ability to DIRECTLY EDIT Excel files! The system will attempt to automatically apply 
      any cell changes that you analyze from the user's request. Be as specific as possible in your analysis.
      
      When responding to a spreadsheet edit request:
      1. Acknowledge the user's request
      2. Explain clearly what changes they want to make in terms of specific cells (e.g., "cell A1", "cell B5")
      3. Provide a specific analysis of the edit, such as "set cell A1 to value 100" or "change cell C5 to 'Total Sales'"
      4. Also explain how these changes would be made manually as a backup
      5. If the request is unclear or not possible, politely explain why
      
      The spreadsheet is of type: ${documentType}.
      
      Examples of edits the system can automatically apply:
      - "Change cell A1 to 'Sales Report'"
      - "Update B5 to 1000"
      - "Set cell C10 to the formula =SUM(C1:C9)"
      
      Try to identify specific cells that need to be modified based on the user's request.`;

    // Prepare the messages for Claude
    const messagesToSend = [
      { role: 'user', content: `Here is the current content of the spreadsheet:\n\n${documentContent}` },
      { role: 'user', content: message }
    ];

    // Check for API key
    if (!ANTHROPIC_API_KEY) {
      console.error("Anthropic API key not found");
      
      // Save error message to chat
      await messagesRef.add({
        role: 'assistant',
        content: "Sorry, I couldn't process your edit request because the AI service is not properly configured. Please contact the administrator.",
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
      console.log(`Calling Claude API with model: ${model || DEFAULT_MODEL}`);
      
      // Claude API call
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL,
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
          content: `Sorry, I encountered an error while processing your edit request: ${errorInfo}`,
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

      // Try to analyze the edit request to see if we can automatically apply the changes
      let editResult = null;
      const isSpreadsheet = 
        documentType.includes('spreadsheet') || 
        documentType.includes('excel') || 
        documentName.endsWith('.xlsx') || 
        documentName.endsWith('.xls');
      
      // Only attempt automatic edits for spreadsheet files
      if (isSpreadsheet) {
        // Analyze the user's request for edits
        const editPlan = analyzeEditRequest(message);
        
        if (editPlan) {
          try {
            console.log("Auto-editing spreadsheet:", editPlan);
            
            // Call our document edit API to apply the changes
            const editResponse = await fetch(new URL('/api/documents/edit', request.url).toString(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                documentId: documentId,
                editInstructions: message
              })
            });
            
            if (editResponse.ok) {
              const editResult = await editResponse.json();
              
              // Add information about the successful edit to the response
              assistantResponse = `${assistantResponse}\n\n✅ **I've applied your changes automatically!** A new version of the spreadsheet has been created with these edits.`;
              
              if (editResult.newDocumentUrl) {
                assistantResponse += `\n\nYou can [view the edited spreadsheet here](${editResult.newDocumentUrl}).`;
              }
            } else {
              console.log("Could not automatically edit spreadsheet:", await editResponse.text());
              assistantResponse += `\n\n(Note: I analyzed your edit request but couldn't automatically apply the changes. The instructions above explain how to make these changes manually.)`;
            }
          } catch (editError) {
            console.error("Error during automatic spreadsheet editing:", editError);
            assistantResponse += `\n\n(Note: I tried to automatically apply your changes but encountered an error. The instructions above explain how to make these changes manually.)`;
          }
        } else {
          // Could not parse the edit request
          assistantResponse += `\n\n(Note: I couldn't automatically determine the exact cell edits from your request. The instructions above explain how to make these changes manually.)`;
        }
      } else {
        // Not a spreadsheet file
        assistantResponse += `\n\n(Note: Real-time editing is only available for Excel spreadsheets. The instructions above explain how to make these changes manually.)`;
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
          content: `Sorry, I encountered an error with your edit request: ${err.message}`,
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
    console.error("Unhandled error in document edit API:", error);
    return NextResponse.json(
      { error: `Error processing edit request: ${error.message}` },
      { status: 500 }
    );
  }
}