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
    const systemPrompt = `You are an advanced spreadsheet data analyst and editor. The user wants to work with a spreadsheet called "${documentName}".
      You CAN DIRECTLY EDIT this Excel file by including specific edit commands in your response.
      
      CRITICAL INSTRUCTIONS FOR EDITING EXCEL:
      
      1. Begin your response with a clear acknowledgment of what the user wants to do with their spreadsheet.
      
      2. YOU MUST INCLUDE THIS EXACT PATTERN IN YOUR RESPONSE FOR EACH EDIT:
         "I'll change cell [CELL_REFERENCE] to [NEW_VALUE]"
         
         For example: 
         - "I'll change cell A1 to 'Sales Report'"
         - "I'll change cell B5 to 100"
         - "I'll change cell C10 to 500"
      
      3. The automatic Excel editor REQUIRES this EXACT FORMAT to work:
         - Must start with "I'll change cell"
         - Followed by a cell reference (A1, B5, etc.)
         - Then "to" and the new value
         
      4. For text values, write: I'll change cell A1 to 'Sales Report'
         For numeric values, write: I'll change cell B5 to 100
         For formulas, write: I'll change cell C1 to '=SUM(A1:A10)'
      
      5. Put EACH edit statement ON ITS OWN LINE, not embedded in a paragraph.
      
      6. For multiple edits, list each one on a separate line using the exact format.
      
      7. ALWAYS perform the following types of analysis when appropriate:
         - Summarize key information from the spreadsheet
         - Extract entities (people, organizations, dates, etc.)
         - Identify trends, patterns, or relationships in the data
         - Generate insights based on the spreadsheet content
         - Provide recommendations based on data analysis
      
      WARNING: If you don't follow the exact format for cell edits, the automatic editor will fail and the spreadsheet won't be updated.
      
      The spreadsheet is of type: ${documentType}.
      
      EXAMPLE CORRECT RESPONSE:
      "I understand you want to update the sales figures for Q1 and add a formula for the total.
      
      Based on my analysis of your spreadsheet, I can see that column B contains quarterly sales data.
      
      I'll change cell B5 to 1000
      I'll change cell B6 to 1250
      I'll change cell B7 to '=SUM(B5:B6)'
      
      These changes will update the Q1 and Q2 sales figures and add a formula in B7 to calculate the total.
      
      Analysis of your data shows that these new figures represent a 15% increase over previous values,
      which aligns with the growth trends visible in columns C and D for other product categories.
      "`;
      
      // Add extra emphasis with Claude-3.7 specific details
      if (model?.includes('3.7') || model?.includes('claude-3-7')) {
        systemPrompt += `
        
        As Claude 3.7, you have enhanced capabilities that allow you to:
        
        1. Parse tabular data more effectively, understanding relationships between rows and columns
        2. Detect patterns and anomalies in numerical and categorical data
        3. Provide predictive insights based on historical data trends
        4. Recommend actions based on comprehensive data analysis
        5. Execute precise edits through the spreadsheet editing system
        
        When editing spreadsheets, always use THE EXACT PHRASE "I'll change cell X to Y" to ensure the automatic
        editor can properly process your instructions. You can include multiple edit statements, each on its own line.
        
        In addition to making edits, always provide analytical context about:
        - What the data represents
        - How your edits will impact calculations or insights
        - Key observations about the spreadsheet structure and content
        - Potential data quality issues or improvements`;
      }

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
        // First try to analyze the user's request directly
        let editPlan = analyzeEditRequest(message);
        
        // If that fails, try to extract edit instructions from Claude's response
        if (!editPlan) {
          console.log("Trying to extract edit instructions from Claude's response");
          
          // Log the full assistant response for debugging
          console.log("Full assistant response for pattern matching:", assistantResponse);
          
          // Find all potential edit instructions using multiple patterns
          // Use regular expressions with global flag to find ALL matches
          
          // The primary pattern we instruct Claude to use (highest priority)
          const primaryPatternRegex = /I'll\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+['"]?([^'"\n]+?)['"]?(?:\s|$)/gi;
          let primaryMatches = [...assistantResponse.matchAll(primaryPatternRegex)];
          
          console.log(`Found ${primaryMatches.length} matches with primary pattern`);
          
          // If we found primary pattern matches, use those
          if (primaryMatches.length > 0) {
            // Convert matches to the format we need
            const editInstructions = primaryMatches.map(match => ({
              cell: match[1].toUpperCase(),
              value: match[2].trim()
            }));
            
            console.log(`Extracted ${editInstructions.length} edit instructions:`, JSON.stringify(editInstructions));
            
            // Create a multi-edit plan
            if (editInstructions.length > 0) {
              editPlan = {
                description: `Update ${editInstructions.length} cell(s) based on user request`,
                edits: editInstructions.map(instr => ({
                  sheet: "Sheet1", // Default sheet name
                  cell: instr.cell,
                  value: instr.value
                }))
              };
              console.log("Created multi-edit plan:", JSON.stringify(editPlan));
            }
          } else {
            // Fallback to alternative patterns if primary pattern doesn't match
            console.log("No primary pattern matches, trying alternative patterns");
            
            // Try multiple patterns to extract edit instructions from Claude's response
            // Be as comprehensive as possible with pattern matching
            let patternMatches = [
              // Standard pattern: "change cell A1 to 100"
              assistantResponse.match(/(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i),
              
              // "I'll change/update pattern": "I'll change cell A1 to 100"
              assistantResponse.match(/I(?:'ll|\s+will)?\s+(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i),
              
              // Direct mention: "Cell A1 should be 100"
              assistantResponse.match(/(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:should|will|to)\s+(?:be|contain|have|equal)\s+["']?([^"'\n]+)["']?/i),
              
              // Value pattern: "Set the value in A1 to 100"
              assistantResponse.match(/(?:set|put|place)\s+(?:the\s+)?(?:value|data|content)\s+(?:in|of|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as)\s+["']?([^"'\n]+)["']?/i),
              
              // Simple cell pattern: "A1: 100" or "A1 → 100"
              assistantResponse.match(/(?:cell\s+)?([A-Za-z]+[0-9]+)(?:\s*(?::|→|->|=)\s*)["']?([^"'\n]+)["']?/i),
              
              // Literal recommendation: "I recommend changing cell A1 to 100"
              assistantResponse.match(/recommend\s+(?:changing|setting|updating|modifying)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i),
              
              // Manual edit pattern: "manually edit cell A1 to contain 100"
              assistantResponse.match(/(?:manually|should)\s+(?:edit|change|update|modify|set)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to|contain)\s+["']?([^"'\n]+)["']?/i),
              
              // Cell reference with equals: "cell A1 equals 100"
              assistantResponse.match(/(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:equals|is|becomes|gets set to)\s+["']?([^"'\n]+)["']?/i),
              
              // Add new row pattern
              assistantResponse.match(/add(?:\s+a)?\s+new\s+row\s+with\s+(?:values|data)?\s*[:;]?\s*(.*)/i),
              
              // Set formula pattern
              assistantResponse.match(/(?:set|add|create|use)\s+(?:a|the)?\s+formula\s+(?:in|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|:)\s+["']?=([^"'\n]+)["']?/i)
            ];
            
            // Log all matches for debugging
            patternMatches.forEach((match, index) => {
              if (match) {
                console.log(`Pattern ${index + 1} matched:`, match[0], `Cell: ${match[1]}, Value: ${match[2]}`);
              }
            });
            
            // Find the first successful match
            const firstMatch = patternMatches.find(match => match !== null);
            
            if (firstMatch) {
              console.log("Found edit instruction in Claude's response:", firstMatch[0]);
              const cell = firstMatch[1];
              const value = firstMatch[2];
              
              console.log(`Extracted cell: ${cell}, value: ${value}`);
              
              // Create an edit plan directly
              editPlan = {
                description: `Update cell ${cell} to value "${value}"`,
                edits: [{
                  sheet: "Sheet1", // Default sheet name
                  cell: cell,
                  value: value
                }]
              };
              
              console.log("Created edit plan:", JSON.stringify(editPlan));
            } else {
              console.log("No edit instructions found in Claude's response");
            }
          }
        }
        
        if (editPlan) {
          try {
            console.log("Auto-editing spreadsheet:", editPlan);
            
            // Prepare the edit plan for the API
            // Ensure the edit plan has the correct format
            if (!editPlan.edits || !Array.isArray(editPlan.edits) || editPlan.edits.length === 0) {
              console.log("Reconstructing edit plan with proper format");
              // Create a proper edit plan if it's missing the expected structure
              editPlan = {
                description: "Update cell based on user request",
                edits: [{
                  sheet: "Sheet1", // Default sheet name
                  cell: editPlan.cell || "A1",
                  value: editPlan.value || ""
                }]
              };
            }
            
            console.log("Sending edit plan to API:", JSON.stringify(editPlan));
            
            // Call our document edit API to apply the changes
            const editResponse = await fetch(new URL('/api/documents/edit', request.url).toString(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                documentId: documentId,
                editInstructions: JSON.stringify(editPlan)
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
              const errorText = await editResponse.text();
              console.log("Could not automatically edit spreadsheet:", errorText);
              assistantResponse += `\n\n(Note: I analyzed your edit request but couldn't automatically apply the changes. The instructions above explain how to make these changes manually. Technical error: ${errorText})`;
            }
          } catch (editError: any) {
            console.error("Error during automatic spreadsheet editing:", editError);
            assistantResponse += `\n\n(Note: I tried to automatically apply your changes but encountered an error: ${editError.message}. The instructions above explain how to make these changes manually.)`;
          }
        } else {
          // Could not parse the edit request
          assistantResponse += `\n\n(Note: I couldn't automatically determine the exact cell edits from your request. To help me edit Excel files, please include a very specific statement like "Change cell A1 to 'Sales Report'" or "Update cell B5 to 100" in exactly this format.)`;
          
          // Add debug information at the end for troubleshooting
          if (DEBUG) {
            console.log(`Claude couldn't parse edit request: "${message}"`);
            console.log(`Claude's response: "${assistantResponse}"`);
          }
        }
      } else {
        // Not a spreadsheet file
        assistantResponse += `\n\n(Note: Real-time editing is only available for Excel spreadsheets. The instructions above explain how to make these changes manually.)`;
      }
      
      // Add debug tracking info to help diagnose issues
      console.log({
        userId,
        documentId,
        chatId,
        isSpreadsheet,
        requestType: 'Excel Edit',
        messageLength: message.length,
        responseLength: assistantResponse.length,
        editPlanCreated: !!editPlan
      });

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