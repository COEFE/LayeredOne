import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin-config';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Import environment variables and utilities
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
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

    // Create system prompt specifically for spreadsheet editing with Claude 3.7
    let systemPrompt = `You are an advanced spreadsheet data analyst and editor. The user wants to work with a spreadsheet called "${documentName}".
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
      
      The spreadsheet is of type: ${documentType}.`;
      
    // Force the use of Claude 3.7 model for Excel editing
    const editorModel = 'claude-3-7-sonnet-20250219';
      
    // Add Claude 3.7-specific capabilities
    systemPrompt += `
      
      As Claude 3.7, your enhanced capabilities for spreadsheet editing include:
      
      1. Advanced data analysis with statistical insights
      2. Pattern recognition in financial and numerical data
      3. Formula recommendations for complex calculations
      4. Data cleaning and validation suggestions
      5. Strategic insights from numerical trends
      6. Dimensional analysis for unit conversions
      7. Multi-step edit planning for comprehensive spreadsheet updates
      8. Auto-formatting recommendations for readability
      9. Precise cell value suggestions based on context
      10. Error detection in formulas and data
      
      ALWAYS follow these steps when editing spreadsheets:
      
      1. ANALYZE the data first to understand context
      2. PLAN your edits to ensure consistency
      3. EXPLAIN your reasoning for each change
      4. FORMAT your edit commands with THE EXACT PHRASE "I'll change cell X to Y"
      5. REVIEW the impact of your changes on calculations or insights
      
      For complex edits, I'll break down the process into multiple steps.
      For data analysis, I'll provide specific insights about patterns, anomalies, and trends.
      
      Remember: Always use THE EXACT PHRASE "I'll change cell X to Y" for each edit command.`;

    // Prepare the messages for Claude
    let messagesToSend = [
      { role: 'user', content: `Here is the current content of the spreadsheet:\n\n${documentContent}` },
      { role: 'user', content: message }
    ];

    // For spreadsheets, add web search context if Brave API key is available
    let webSearchResults = null;
    
    if (BRAVE_API_KEY) {
      try {
        console.log('Performing Brave search for additional context around the spreadsheet editing query');
        
        // Create search query using key terms from the message and document context
        const searchQuery = `${message} excel spreadsheet edit ${documentName.split('.')[0]}`;
        
        // Create URL with search parameters
        const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
        searchUrl.searchParams.append('q', searchQuery);
        searchUrl.searchParams.append('count', '3');  // Limit to top 3 results
        
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
            
            console.log(`Found ${webSearchResults.length} search results to enhance spreadsheet editing context`);
          }
        } else {
          console.error('Error performing Brave search:', await braveSearchResponse.text());
        }
      } catch (error) {
        console.error('Error during Brave search:', error);
      }
    }

    // Add search results to messages if available
    if (webSearchResults && webSearchResults.length > 0) {
      const searchResultsMessage = `Here are some relevant web search results that might help with this spreadsheet editing task:
      
${webSearchResults.map((result: any, index: number) => {
  return `[${index + 1}] ${result.title}
URL: ${result.url}
${result.description}
`;
}).join('\n')}

Use these search results to inform your spreadsheet editing approach when appropriate.`;

      messagesToSend.push({ role: 'user', content: searchResultsMessage });
    }

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
      console.log(`Calling Claude API with model: ${editorModel} for spreadsheet editing`);
      
      // Claude API call
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: editorModel, // Always use Claude 3.7 for spreadsheet editing
          messages: messagesToSend,
          system: systemPrompt,
          max_tokens: 2000
        })
      });
      
      console.log(`API request sent with model: ${editorModel}`);
      
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
      
      console.log("Claude 3.7 API response success for spreadsheet editing");
      
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
          console.log("Trying to extract edit instructions from Claude 3.7's response");
          
          // Log the full assistant response for debugging
          console.log("Full assistant response for pattern matching:", assistantResponse);
          
          // Find all potential edit instructions using primary pattern
          // Use regular expressions with global flag to find ALL matches
          
          // The primary pattern we instruct Claude to use
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
            
            console.log(`Extracted ${editInstructions.length} edit instructions from Claude 3.7's response:`, JSON.stringify(editInstructions));
            
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
              console.log("Created multi-edit plan from Claude 3.7's response:", JSON.stringify(editPlan));
            }
          } else {
            // Fallback to alternative patterns if primary pattern doesn't match
            console.log("No primary pattern matches, trying alternative patterns");
            
            // Comprehensive pattern matching for different edit instruction formats
            const patterns = [
              // Standard pattern: "change cell A1 to 100"
              /(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i,
              
              // "I'll change/update pattern": "I'll change cell A1 to 100"
              /I(?:'ll|\s+will)?\s+(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i,
              
              // Direct mention: "Cell A1 should be 100"
              /(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:should|will|to)\s+(?:be|contain|have|equal)\s+["']?([^"'\n]+)["']?/i,
              
              // Value pattern: "Set the value in A1 to 100"
              /(?:set|put|place)\s+(?:the\s+)?(?:value|data|content)\s+(?:in|of|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as)\s+["']?([^"'\n]+)["']?/i,
              
              // Simple cell pattern: "A1: 100" or "A1 → 100"
              /(?:cell\s+)?([A-Za-z]+[0-9]+)(?:\s*(?::|→|->|=)\s*)["']?([^"'\n]+)["']?/i,
              
              // Literal recommendation: "I recommend changing cell A1 to 100"
              /recommend\s+(?:changing|setting|updating|modifying)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i,
              
              // Manual edit pattern: "manually edit cell A1 to contain 100"
              /(?:manually|should)\s+(?:edit|change|update|modify|set)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to|contain)\s+["']?([^"'\n]+)["']?/i,
              
              // Cell reference with equals: "cell A1 equals 100"
              /(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:equals|is|becomes|gets set to)\s+["']?([^"'\n]+)["']?/i,
              
              // Add new row pattern
              /add(?:\s+a)?\s+new\s+row\s+with\s+(?:values|data)?\s*[:;]?\s*(.*)/i,
              
              // Set formula pattern
              /(?:set|add|create|use)\s+(?:a|the)?\s+formula\s+(?:in|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|:)\s+["']?=([^"'\n]+)["']?/i
            ];
            
            // Process all patterns to find matches
            let allMatches: Array<{pattern: number, match: RegExpMatchArray}> = [];
            
            patterns.forEach((pattern, index) => {
              // Find all matches using the global flag
              const regex = new RegExp(pattern.source, pattern.flags + 'g');
              const matches = [...assistantResponse.matchAll(regex)];
              
              matches.forEach(match => {
                if (match[1] && match[2]) {
                  allMatches.push({
                    pattern: index,
                    match: match as RegExpMatchArray
                  });
                }
              });
            });
            
            console.log(`Found ${allMatches.length} matches with alternative patterns`);
            
            // Extract all edit instructions from alternative pattern matches
            if (allMatches.length > 0) {
              const editInstructions = allMatches.map(({pattern, match}) => {
                return {
                  cell: match[1].toUpperCase(),
                  value: match[2].trim()
                };
              });
              
              console.log(`Extracted ${editInstructions.length} edit instructions from alternative patterns`);
              
              // Create a multi-edit plan
              editPlan = {
                description: `Update ${editInstructions.length} cell(s) based on user request`,
                edits: editInstructions.map(instr => ({
                  sheet: "Sheet1", // Default sheet name
                  cell: instr.cell,
                  value: instr.value
                }))
              };
              
              console.log("Created multi-edit plan from alternative patterns:", JSON.stringify(editPlan));
            }
          }
        }
        
        if (editPlan) {
          try {
            console.log("Auto-editing spreadsheet with Claude 3.7:", editPlan);
            
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
            
            console.log("Sending Claude 3.7 generated edit plan to API:", JSON.stringify(editPlan));
            
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
              console.log("Claude 3.7 could not automatically edit spreadsheet:", errorText);
              assistantResponse += `\n\n(Note: I analyzed your edit request but couldn't automatically apply the changes. The instructions above explain how to make these changes manually. Technical error: ${errorText})`;
            }
          } catch (editError: any) {
            console.error("Error during automatic spreadsheet editing with Claude 3.7:", editError);
            assistantResponse += `\n\n(Note: I tried to automatically apply your changes but encountered an error: ${editError.message}. The instructions above explain how to make these changes manually.)`;
          }
        } else {
          // Could not parse the edit request
          assistantResponse += `\n\n(Note: I couldn't automatically determine the exact cell edits from your request. To help me edit Excel files, please include a very specific statement like "Change cell A1 to 'Sales Report'" or "Update cell B5 to 100" in exactly this format.)`;
          
          // Add debug information at the end for troubleshooting
          if (DEBUG) {
            console.log(`Claude 3.7 couldn't parse edit request: "${message}"`);
            console.log(`Claude 3.7's response: "${assistantResponse}"`);
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
        requestType: 'Excel Edit with Claude 3.7',
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
      console.error("Error calling Claude 3.7 API for spreadsheet editing:", err);
      
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
          error: `Error calling Claude 3.7 API for spreadsheet editing: ${err.message}`,
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