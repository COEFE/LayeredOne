import { NextRequest, NextResponse } from 'next/server';
import { auth, db, admin, firestorePath } from '@/firebase/admin-config';

// Create a safe FieldValue for Vercel compatibility
const isVercel = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true';

// Declare FieldValue type to be compatible with both real and mock implementations
let FieldValue: any = {
  serverTimestamp: () => new Date().toISOString()
};

// Function to get Firestore database instance
const firestore = {
  collection: (name: string) => {
    try {
      return db.collection(name);
    } catch (error) {
      console.error(`Error accessing collection ${name}:`, error);
      return {
        doc: (id: string) => ({
          get: async () => ({ exists: false, data: () => null, id }),
          collection: (subName: string) => firestore.collection(subName),
          update: async () => ({}),
          set: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' })
      };
    }
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

// Import environment variables and utilities
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
import { analyzeEditRequest } from '@/utils/excelEditor';

// Debug flag to log detailed information
const DEBUG = process.env.NODE_ENV === 'development' || true;

export const maxDuration = 60; // Set max duration to 60 seconds for Vercel Edge functions

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
    // Use db directly instead of getFirestore() for Vercel compatibility
    const documentRef = db.collection('documents').doc(documentId);
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
    let systemPrompt = `You are Claude 3.7, an advanced spreadsheet data analyst, editor, and financial data expert. The user is working with a spreadsheet document called "${documentName}".
      You have the DIRECT ABILITY TO EDIT this Excel file by including specific edit commands in your response.
      
      # CRITICAL INSTRUCTIONS FOR EXCEL EDITING
      
      I need you to EXACTLY follow this format for ALL cell edits:
      
      ✅ I'll change cell [CELL_REFERENCE] to [NEW_VALUE]
      
      EXAMPLES (EXACTLY as they should appear):
      I'll change cell A1 to 'Sales Report'
      I'll change cell B5 to 100
      I'll change cell C10 to 500
      I'll change cell D1 to '=SUM(D2:D10)'
      
      ### ⚠️ EXTREMELY IMPORTANT ⚠️ 
      
      1. I CANNOT EDIT THE SPREADSHEET if you use ANY variation of this pattern.
      2. The EXACT TEXT "I'll change cell" MUST be used - not "I will change" or any variation.
      3. DO NOT add any extra characters, spaces, or formatting to this pattern.
      4. Each edit instruction MUST be on its own line.
      5. Text values MUST be in single quotes: I'll change cell A1 to 'Sales Report'
      6. Numbers need NO quotes: I'll change cell B5 to 100
      7. Formulas MUST be in single quotes: I'll change cell D1 to '=SUM(D2:D10)'
      
      INCORRECT (will fail):
      - "I will change cell A1 to 'Sales Report'"
      - "Let's change cell B5 to 100"
      - "Set cell C10 to 'Customer Name'"
      
      CORRECT (will work):
      I'll change cell A1 to 'Sales Report'
      I'll change cell B5 to 100
      I'll change cell C10 to 'Customer Name'
      
      # FORMAT RULES
      
      1. Always put EACH edit statement ON ITS OWN LINE
      2. For text values, use single quotes: I'll change cell A1 to 'Sales Report'
      3. For numbers, use no quotes: I'll change cell B5 to 100
      4. For formulas, add an equals sign with quotes: I'll change cell C1 to '=SUM(A1:A10)'
      5. For dates, use text format: I'll change cell D1 to '2023-04-01'
      6. Always include all THREE parts: "I'll change cell", cell reference, and value
      
      # WORKFLOW
      
      1. Start by acknowledging what the user wants to do with their spreadsheet
      2. Analyze the spreadsheet data and provide relevant insights
      3. Clearly explain the edits you'll make
      4. List EACH edit command using the EXACT format on its own line
      5. After the edits, explain the impact of these changes
      
      # ANALYSIS CAPABILITIES
      
      For Excel files, you should:
      - Identify patterns, trends, and anomalies in numerical data
      - Suggest optimal formulas for calculations
      - Detect inconsistencies and data quality issues
      - Provide business insights from financial data
      - Recognize and explain relationships between data points
      - Suggest formatting improvements for better readability
      
      # EXAMPLES OF VALID EDIT COMMANDS
      
      I'll change cell A1 to 'Header'
      I'll change cell B5 to 100
      I'll change cell C10 to '01/15/2023'
      I'll change cell D4 to '=AVERAGE(D1:D3)'
      
      The spreadsheet is of type: ${documentType}.`;
      
    // Force the use of Claude 3.7 model for Excel editing
    const editorModel = 'claude-3-7-sonnet-20250219';
      
    // Add Claude 3.7-specific capabilities
    systemPrompt += `
      
      # CLAUDE 3.7 ENHANCED EXCEL CAPABILITIES
      
      As Claude 3.7, you have specialized capabilities for Excel:
      
      1. Advanced formula construction and optimization
      2. Complex pattern recognition in time series data
      3. Statistical anomaly detection
      4. Financial ratio analysis and interpretation
      5. Multi-dimensional data relationship mapping
      6. Natural language to Excel formula translation
      7. Multi-step editing operations with dependency tracking
      8. Data normalization and standardization
      9. Hierarchical data structure recognition
      10. Predictive trend analysis
      
      # MULTIPLE EDIT HANDLING
      
      When a user requests multiple edits:
      - List EACH edit command on its own line
      - Use the EXACT "I'll change cell X to Y" format for EVERY edit
      - NEVER use variations like "I will change cell" or "Let's change cell" - ONLY use "I'll change cell"
      - Ensure each edit is complete and properly formatted
      - Group related edits together
      - Explain the relationship between multiple edits
      
      When making multiple edits, structure your response like this:

      First explain what changes you'll make.

      I'll change cell A1 to 'Header'
      I'll change cell B2 to 100
      I'll change cell C3 to '=SUM(C1:C2)'

      Then explain what these changes accomplish.

      Again, it's CRITICAL that you use EXACTLY the format "I'll change cell X to Y" with NO variations.
      
      # EXAMPLE OF CORRECT EXCEL EDITS FORMAT
      
      Here's an example of how your response should look when making edits:
      
      "Based on your request, I'll make these changes to your spreadsheet:
      
      I'll change cell A1 to 'Sales Report 2023'
      I'll change cell B5 to 1000
      I'll change cell C10 to '=SUM(C1:C9)'
      
      These changes will update the header title, correct the value in B5, and add a total sum formula."
      
      Notice how EACH edit is on its own line and ALL use the EXACT "I'll change cell" format.
      
      # FORMULA RECOMMENDATIONS
      
      When suggesting Excel formulas:
      - Recommend the most efficient formula for the task
      - Explain how the formula works in plain language
      - Always include the formula with proper syntax: I'll change cell A1 to '=FORMULA()'
      - Use appropriate cell references and ranges
      - Ensure proper nesting of complex formulas
      
      # FINAL REMINDERS
      
      - EVERY edit command MUST use the EXACT "I'll change cell X to Y" format
      - Each edit command MUST be on its own line
      - All edits will be automatically applied to the spreadsheet
      - The user will see a new version of the file with your changes
      - The original spreadsheet remains unchanged
      
      Remember: The automated system REQUIRES the EXACT "I'll change cell X to Y" pattern to work.`;

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
          
          // Use enhanced pattern matching for Claude 3.7's responses
          console.log("Starting enhanced pattern matching for Claude 3.7's edit instructions");
          
          // Claude 3.7 uses the prescribed "I'll change cell X to Y" format
          // This exact format is what we've instructed Claude 3.7 to use
          // Handle different quote styles and properly extract values including spaces
          
          // DEBUG: Output the raw assistantResponse to see what Claude 3.7 is actually producing
          console.log("=== RAW CLAUDE 3.7 RESPONSE START ===");
          console.log(assistantResponse);
          console.log("=== RAW CLAUDE 3.7 RESPONSE END ===");
          
          // ISSUE: Claude 3.7 may be using different apostrophe characters or escaping quotes
          // Try matching with broader apostrophe options and multiple quote handling approaches
          
          // First pattern: Standard pattern with flexible apostrophe handling
          const primaryPatternRegex = /I(?:'|'|`|'|"|'|'|´)ll\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(?:'([^']*)'|"([^"]*)"|(=\S+(?:\([^)]*\))?)|(\d+(?:\.\d+)?)|([^'"\s][^'"\s]*(?:\s+[^'"\s]+)*))/gi;
          
          // Second pattern: Simpler with extremely lenient quote/apostrophe handling
          const simplePatternRegex = /I[''`''""´]ll\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+([^,\n\r;]+)/gmi;
          
          // Third pattern: Direct pattern for specific known formats
          const directPatternRegex = /I'll change cell ([A-Za-z]+[0-9]+) to '([^']*)'/gi;
          
          // Fourth pattern: Ultra simple pattern for last resort
          const lastResortPatternRegex = /change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(.+?)(?:\s*[\n\r]|$)/gmi;
          
          // Process all patterns for maximum coverage
          let primaryMatches = [...assistantResponse.matchAll(primaryPatternRegex)];
          let simpleMatches = [...assistantResponse.matchAll(simplePatternRegex)];
          let directMatches = [...assistantResponse.matchAll(directPatternRegex)];
          let lastResortMatches = [...assistantResponse.matchAll(lastResortPatternRegex)];
          
          // Log search results for debugging
          console.log(`Found ${primaryMatches.length} matches with primary Claude 3.7 pattern`);
          console.log(`Found ${simpleMatches.length} matches with simplified Claude 3.7 pattern`);
          console.log(`Found ${directMatches.length} matches with direct pattern`);
          console.log(`Found ${lastResortMatches.length} matches with last resort pattern`);
          
          // Check each match type in more detail
          if (primaryMatches.length > 0) {
            console.log("Primary pattern matches:", JSON.stringify(primaryMatches));
          }
          if (simpleMatches.length > 0) {
            console.log("Simple pattern matches:", JSON.stringify(simpleMatches));
          }
          if (directMatches.length > 0) {
            console.log("Direct pattern matches:", JSON.stringify(directMatches));
          }
          if (lastResortMatches.length > 0) {
            console.log("Last resort matches:", JSON.stringify(lastResortMatches));
          }
          
          // Combine matches from all patterns, avoiding duplicates
          const combinedMatches = [...primaryMatches];
          
          // Function to add unique matches
          const addUniqueMatches = (matches, source) => {
            if (matches.length > 0) {
              matches.forEach(match => {
                // Only add if we don't already have a match for this cell
                const cellRef = match[1]?.toUpperCase();
                if (cellRef && !combinedMatches.some(m => m[1]?.toUpperCase() === cellRef)) {
                  console.log(`Adding unique ${source} match for cell ${cellRef}:`, match);
                  combinedMatches.push(match);
                }
              });
            }
          };
          
          // Add matches from all patterns
          addUniqueMatches(simpleMatches, 'simple pattern');
          addUniqueMatches(directMatches, 'direct pattern');
          addUniqueMatches(lastResortMatches, 'last resort pattern');
          
          console.log(`Combined total: ${combinedMatches.length} unique edit instructions found`);
          
          // Process the combined matches from both patterns
          if (combinedMatches.length > 0) {
            // Convert matches to the format we need, with improved value extraction
            const editInstructions = combinedMatches.map(match => {
              // Different patterns have different capture group structures
              // Primary pattern: match[2-6] for different value types
              // Simple pattern: match[2] for the value
              // Direct pattern: match[2] for the value
              // Last resort: match[2] for the value
              
              const cell = match[1]?.toUpperCase() || '';
              if (!cell) {
                console.warn("Warning: Extracted a match without a valid cell reference");
                return null;
              }
              
              // Get the match length to determine which pattern was used
              const matchLength = match.length;
              
              // Initialize value with direct access to likely value position
              let value = '';
              
              // Handle all possible value positions
              if (matchLength > 6) {
                // Primary pattern with many capture groups
                value = match[2] !== undefined ? match[2] : 
                        match[3] !== undefined ? match[3] : 
                        match[4] !== undefined ? match[4] : 
                        match[5] !== undefined ? match[5] : 
                        match[6] !== undefined ? match[6] : '';
              } else {
                // Simpler patterns where value is in position 2
                value = match[2] || '';
              }
              
              // Clean up the value - handle special cases
              value = value.trim();
              
              // Special case: if the value starts and ends with quotes, strip them
              if ((value.startsWith("'") && value.endsWith("'")) || 
                  (value.startsWith('"') && value.endsWith('"'))) {
                value = value.substring(1, value.length - 1);
              }
              
              console.log(`Raw match for cell ${cell}:`, match);
              console.log(`Extracted value for cell ${cell}: "${value}"`);
              
              return {
                cell: cell,
                value: value
              };
            }).filter(Boolean); // Remove any null entries
            
            console.log(`Extracted ${editInstructions.length} valid edit instructions from Claude 3.7's response:`, JSON.stringify(editInstructions));
            
            // Create a multi-edit plan with all the extracted edits
            if (editInstructions.length > 0) {
              editPlan = {
                description: `Update ${editInstructions.length} cell(s) based on user request`,
                edits: editInstructions.map(instr => ({
                  sheet: "Sheet1", // Default sheet name
                  cell: instr.cell,
                  value: instr.value
                }))
              };
              console.log("Created multi-edit plan from Claude 3.7's responses:", JSON.stringify(editPlan));
            }
          } else {
            // Fallback to comprehensive alternative patterns for Claude 3.7
            console.log("No primary pattern matches, trying comprehensive alternative patterns");
            
            // Advanced pattern matching for different edit instruction formats
            // These patterns cover all the various ways Claude 3.7 might express edit instructions
            const patterns = [
              // Standard editing patterns
              /(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // "I'll" pattern variations
              /I(?:'ll|\s+will|\s+am\s+going\s+to)?\s+(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // Direct cell reference patterns
              /(?:cell\s+)?([A-Za-z]+[0-9]+)(?:\s*(?:should|will|to|must|needs to)\s*)(?:be|contain|have|equal|hold|show)\s+(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // Value placement patterns
              /(?:set|put|place)\s+(?:the\s+)?(?:value|data|content|text|number)\s+(?:in|of|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with)\s+(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // Colon/arrow notation patterns
              /(?:cell\s+)?([A-Za-z]+[0-9]+)(?:\s*(?::|→|->|=|becomes|now contains|is set to)\s*)(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // Recommendation patterns
              /(?:recommend|suggest)\s+(?:changing|setting|updating|modifying)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // Manual edit instruction patterns
              /(?:manually|please|should)\s+(?:edit|change|update|modify|set)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to|contain)\s+(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // Status or result patterns
              /(?:changed|updated|modified|set)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with)\s+(?:'|")?([^'"\n]+?)(?:'|")?(?:\s|$)/gi,
              
              // Formula patterns
              /(?:set|add|create|use|insert)\s+(?:a|the)?\s+formula\s+(?:in|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|:)\s+(?:'|")?(=.+?)(?:'|")?(?:\s|$)/gi,
              
              // Enter value patterns
              /(?:enter|input|type|populate)\s+(?:the\s+)?(?:value|text|number|data)?\s+(?:'|")?([^'"\n]+?)(?:'|")?\s+(?:in|into|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)/gi
            ];
            
            // Process all patterns to find matches
            let allMatches: Array<{pattern: number, match: RegExpMatchArray}> = [];
            
            patterns.forEach((pattern, index) => {
              // Find all matches using the global flag
              // Extract existing flags, remove 'g' if present as we'll add it explicitly
              const flags = pattern.flags.replace(/g/g, '');
              const regex = new RegExp(pattern.source, flags + 'g');
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
            
            // Define the editResponse variable at a higher scope
            let editResponse;
            
            // In Vercel deployment, skip the Firebase Cloud Function to avoid timeout issues
            if (process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT === 'true') {
              console.log('Using direct API call for Vercel deployment (skipping Firebase Cloud Function)');
              
              // Use the documents/edit API directly
              editResponse = await fetch(new URL('/api/documents/edit', request.url).toString(), {
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
            } else {
              try {
                // Only import Firebase Cloud Function utility when not in Vercel environment
                const { processExcelEditsWithCloudFunction } = await import('@/utils/firebase-functions');
                console.log('Using Firebase Cloud Function for Excel editing to avoid timeouts');
                
                // Call the Firebase Cloud Function
                const cloudFunctionResult = await processExcelEditsWithCloudFunction(
                  documentId, 
                  JSON.stringify(editPlan)
                );
                
                console.log('Firebase Cloud Function completed successfully:', cloudFunctionResult);
                
                // Create a response from the cloud function result
                editResponse = {
                  ok: true,
                  json: async () => cloudFunctionResult
                };
              } catch (cloudFunctionError) {
                console.error('Error calling Excel edit Cloud Function:', cloudFunctionError);
                console.log('Falling back to regular API due to Cloud Function error');
                
                // Fall back to the original API if the cloud function fails
                editResponse = await fetch(new URL('/api/documents/edit', request.url).toString(), {
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
              }
            }
            
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