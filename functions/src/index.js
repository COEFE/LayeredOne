/**
 * Excel Editor Cloud Function
 * 
 * This function handles Excel editing operations with extended timeout compared to serverless functions.
 * It uses Firebase Cloud Functions for computation-intensive Excel processing.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const XLSX = require('xlsx');

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Process Excel edit operations
 * Config: Memory 1GB, Timeout 300 seconds (5 minutes)
 */
exports.processExcelEdits = functions
  .runWith({
    timeoutSeconds: 300, // 5 minutes
    memory: '1GB'
  })
  .https.onCall(async (data, context) => {
    try {
      console.log('Excel Edit Cloud Function invoked');

      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
      }

      const userId = context.auth.uid;
      console.log('Authenticated user:', userId);

      // Extract data from the request
      const { documentId, editInstructions } = data;

      if (!documentId || !editInstructions) {
        throw new functions.https.HttpsError(
          'invalid-argument', 
          'Missing required parameters: documentId and editInstructions are required'
        );
      }

      console.log('Edit instructions received:', editInstructions);

      // Get document data from Firestore
      const documentRef = admin.firestore().collection('documents').doc(documentId);
      const documentSnapshot = await documentRef.get();

      if (!documentSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Document not found');
      }

      const documentData = documentSnapshot.data();

      // Check if the user has access to this document
      if (documentData?.userId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied', 
          "You don't have permission to access this document"
        );
      }

      // Check if the document is an Excel/spreadsheet file
      const fileName = documentData.name || '';
      const contentType = documentData.type || documentData.contentType || 'application/octet-stream';
      const fileUrl = documentData.url || '';

      const isSpreadsheet = 
        contentType.includes('spreadsheet') || 
        contentType.includes('excel') || 
        fileName.endsWith('.xlsx') || 
        fileName.endsWith('.xls') ||
        contentType.includes('sheet');

      if (!isSpreadsheet) {
        throw new functions.https.HttpsError(
          'invalid-argument', 
          "Document is not a supported spreadsheet file. Only Excel files (.xlsx, .xls) are supported for editing."
        );
      }

      if (!fileUrl) {
        throw new functions.https.HttpsError('not-found', 'Document URL not found');
      }

      // Analyze the edit instructions
      let editPlan;

      // Check if editInstructions is a pre-analyzed plan in JSON string format
      try {
        if (typeof editInstructions === 'string' && editInstructions.startsWith('{') && editInstructions.includes('edits')) {
          console.log("Parsing pre-analyzed edit plan");
          const parsedPlan = JSON.parse(editInstructions);
          
          // Ensure the parsed plan has the correct format
          if (parsedPlan && parsedPlan.edits && Array.isArray(parsedPlan.edits)) {
            editPlan = parsedPlan;
            console.log("Successfully parsed edit plan:", JSON.stringify(editPlan));
          } else {
            console.log("Parsed JSON doesn't have expected format, trying to analyze as text");
            editPlan = analyzeEditRequest(editInstructions);
          }
        } else {
          console.log("Analyzing edit instructions as natural language");
          editPlan = analyzeEditRequest(editInstructions);
        }
      } catch (error) {
        console.log("Failed to parse as JSON, trying to analyze as text instruction:", error);
        editPlan = analyzeEditRequest(editInstructions);
      }

      if (!editPlan || !editPlan.edits || !Array.isArray(editPlan.edits) || editPlan.edits.length === 0) {
        throw new functions.https.HttpsError(
          'invalid-argument', 
          "Could not parse edit instructions. Please provide clear instructions like 'Update cell A1 to 100' or 'Change cell B5 to Sales Report'."
        );
      }

      console.log("Edit plan:", JSON.stringify(editPlan));

      // Download the file from Firebase Storage
      const bucket = admin.storage().bucket();
      
      // Extract the file path from the URL
      const fileUrlObj = new URL(fileUrl);
      const filePath = decodeURIComponent(fileUrlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
      
      if (!filePath) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid file URL');
      }

      console.log(`Downloading file from: ${filePath}`);
      const fileRef = bucket.file(filePath);
      const [fileExists] = await fileRef.exists();
      
      if (!fileExists) {
        throw new functions.https.HttpsError('not-found', 'File not found in storage');
      }

      // Download the file
      const [fileBuffer] = await fileRef.download();
      console.log(`Downloaded file: ${fileName}, size: ${fileBuffer.length} bytes`);

      // Apply the edits to the Excel file
      console.log(`Applying edits: ${JSON.stringify(editPlan)}`);
      const modifiedBuffer = await editExcelFile(fileBuffer, editPlan.edits);

      // Upload the modified file back to Firebase Storage
      const newFilename = `edited_${Date.now()}_${fileName}`;
      const newFilePath = `${filePath.substring(0, filePath.lastIndexOf('/') + 1)}${newFilename}`;
      
      console.log(`Uploading modified file to: ${newFilePath}, buffer size: ${modifiedBuffer.length} bytes`);
      
      // Verify the buffer is valid
      if (!modifiedBuffer || modifiedBuffer.length === 0) {
        throw new functions.https.HttpsError('internal', 'Invalid modified buffer: Buffer is empty or undefined');
      }
      
      const newFileRef = bucket.file(newFilePath);
      
      try {
        console.log('Starting upload to Firebase Storage...');
        await newFileRef.save(modifiedBuffer, {
          metadata: {
            contentType: documentData.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          },
          resumable: false // Use non-resumable upload for smaller files for simplicity
        });
        console.log('Upload to Firebase Storage completed successfully');
      } catch (uploadError) {
        console.error('Error uploading to Firebase Storage:', uploadError);
        throw new functions.https.HttpsError('internal', `Failed to upload modified file: ${uploadError.message}`);
      }

      // Generate a signed URL for the new file
      const [signedUrl] = await newFileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // URL valid for 1 week
      });

      // Create a new document entry for the edited file
      const newDocumentRef = admin.firestore().collection('documents').doc();
      
      await newDocumentRef.set({
        name: newFilename,
        type: documentData.type,
        size: modifiedBuffer.length,
        url: signedUrl,
        userId: userId,
        folderId: documentData.folderId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        processed: false,
        processingComplete: false,
        parentDocumentId: documentId,
        editDescription: editPlan.description
      });

      console.log(`Created new document: ${newDocumentRef.id}`);

      // Return success with the new document information
      return {
        success: true,
        message: `Successfully applied edit: ${editPlan.description}`,
        originalDocumentId: documentId,
        newDocumentId: newDocumentRef.id,
        newDocumentUrl: signedUrl
      };
    } catch (error) {
      console.error('Error in Excel Edit Cloud Function:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Helper function to analyze edit request
 */
function analyzeEditRequest(editRequest) {
  // Parse the edit request
  const parsedEdit = parseEditInstruction(editRequest);
  
  if (!parsedEdit || !parsedEdit.cell) {
    return null;
  }
  
  // Use default sheet if not specified
  const sheet = parsedEdit.sheet || 'Sheet1';
  
  // Create a structured edit plan
  return {
    description: `Update cell ${parsedEdit.cell} in sheet "${sheet}" to value "${parsedEdit.value}"`,
    edits: [{
      sheet: sheet,
      cell: parsedEdit.cell,
      value: parsedEdit.value
    }]
  };
}

/**
 * Helper function to parse edit instruction
 */
function parseEditInstruction(instruction) {
  console.log("Parsing instruction:", instruction);

  // Claude 3.7 standard format: "I'll change cell X to Y"
  // Handle different quote styles and properly extract values including spaces
  const claudePattern = /I(?:'ll|\s+will)\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(?:'([^']*)'|"([^"]*)"|(=\S+(?:\([^)]*\))?)|(\d+(?:\.\d+)?)|([^'"\s][^'"\s]*(?:\s+[^'"\s]+)*))/i;
  const claudeMatch = instruction.match(claudePattern);
  
  // Alternative pattern for simpler formats
  const simplePattern = /I'll\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(?:'([^']*)'|"([^"]*)"|(=\S+(?:\([^)]*\))?)|(\d+(?:\.\d+)?)|([^\s].*))/i;
  const simpleMatch = !claudeMatch ? instruction.match(simplePattern) : null;
  
  // Direct pattern for common formats
  const directPattern = /change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(.+?)(?:\s*[\n\r]|$)/i;
  const directMatch = (!claudeMatch && !simpleMatch) ? instruction.match(directPattern) : null;
  
  // Use whichever pattern matched
  const match = claudeMatch || simpleMatch || directMatch;
  
  if (match) {
    console.log("Match found:", match);
    
    // Extract value and handle different pattern types
    let value = '';
    if (claudeMatch || simpleMatch) {
      value = match[2] !== undefined ? match[2] : 
              match[3] !== undefined ? match[3] : 
              match[4] !== undefined ? match[4] : 
              match[5] !== undefined ? match[5] : 
              match[6] !== undefined ? match[6] : '';
    } else {
      // For direct pattern, value is in position 2
      value = match[2] || '';
    }
    
    // Clean up value
    value = value.trim();
    
    // Handle quoted values
    if ((value.startsWith("'") && value.endsWith("'")) || 
        (value.startsWith('"') && value.endsWith('"'))) {
      value = value.substring(1, value.length - 1);
    }
    
    return {
      cell: match[1].toUpperCase(),
      value: value
    };
  }
  
  return null;
}

/**
 * Edit Excel file with provided instructions
 */
async function editExcelFile(buffer, edits) {
  try {
    console.log(`Starting Excel edit: Buffer size ${buffer.length} bytes, Edits: ${JSON.stringify(edits)}`);
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty or invalid buffer provided');
    }
    
    if (!edits || !Array.isArray(edits) || edits.length === 0) {
      throw new Error('No edits provided or invalid edits array');
    }
    
    // Parse the Excel file from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log(`Successfully parsed workbook. Available sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Apply each edit
    for (const edit of edits) {
      const { sheet, cell, value } = edit;
      console.log(`Processing edit: Sheet "${sheet}", Cell ${cell}, Value: ${value}`);
      
      // Check if the specified sheet exists
      if (!workbook.SheetNames.includes(sheet)) {
        // Try case-insensitive match
        const matchingSheet = workbook.SheetNames.find(
          s => s.toLowerCase() === sheet.toLowerCase()
        );
        
        if (matchingSheet) {
          console.log(`Sheet name case mismatch. Using "${matchingSheet}" instead of "${sheet}"`);
          const worksheet = workbook.Sheets[matchingSheet];
          setCellValue(worksheet, cell, value);
        } else {
          console.error(`Available sheets: ${workbook.SheetNames.join(', ')}`);
          throw new Error(`Sheet "${sheet}" not found in the workbook`);
        }
      } else {
        const worksheet = workbook.Sheets[sheet];
        
        // Apply the edit
        console.log(`Setting value in cell ${cell}`);
        setCellValue(worksheet, cell, value);
      }
    }
    
    // Use a performance timer to track Excel processing time
    const startTime = Date.now();
    console.log('Excel processing started at:', new Date(startTime).toISOString());
    
    try {
      // Use a more robust write options configuration with optimizations
      const writeOpts = { 
        type: 'buffer',
        bookType: 'xlsx',
        compression: true, // Enable compression for better reliability
        cellDates: false,  // Disable date conversion for better performance
        cellNF: false,     // Disable number format for better performance
        cellStyles: true   // Maintain styles
      };
      
      // Write directly to buffer with performance optimization
      console.log('Writing Excel data directly to buffer...');
      const outputBuffer = XLSX.write(workbook, writeOpts);
      
      // Validate the buffer
      if (!outputBuffer || outputBuffer.length === 0) {
        throw new Error('Generated buffer is empty or invalid');
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      console.log(`Excel processing completed in ${processingTime}ms`);
      console.log(`Excel edit complete: Output buffer size ${outputBuffer.length} bytes`);
      return outputBuffer;
    } catch (bufferError) {
      console.error(`Error with primary buffer creation approach: ${bufferError}`);
      
      // Try an alternate approach as fallback with performance optimization
      console.log('Attempting alternate buffer creation method...');
      
      try {
        // Create a different workbook object
        const newWorkbook = XLSX.utils.book_new();
        
        // Copy only necessary properties for better performance
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          XLSX.utils.book_append_sheet(newWorkbook, sheet, sheetName);
        });
        
        // Use a simpler write configuration optimized for performance
        const simpleOpts = { 
          type: 'buffer', 
          bookType: 'xlsx',
          cellDates: false,
          cellNF: false,
          cellStyles: false,
          compression: true
        };
        
        const fallbackBuffer = XLSX.write(newWorkbook, simpleOpts);
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        console.log(`Excel processing completed (fallback) in ${processingTime}ms`);
        console.log(`Excel edit complete (fallback method): Output buffer size ${fallbackBuffer.length} bytes`);
        return fallbackBuffer;
      } catch (fallbackError) {
        console.error(`All buffer creation methods failed: ${fallbackError}`);
        throw new Error(`Failed to create Excel buffer: ${bufferError.message}, fallback also failed: ${fallbackError.message}`);
      }
    }
  } catch (error) {
    console.error('Error editing Excel file:', error);
    throw error;
  }
}

/**
 * Helper function to set cell value
 */
function setCellValue(worksheet, cellReference, value) {
  try {
    console.log(`Setting value in cell ${cellReference}: ${value}`);
    
    // Parse the cell reference
    const { row, col } = parseCellReference(cellReference);
    
    // Convert value to appropriate type if needed
    let processedValue = value;
    if (typeof value === 'string') {
      // Try to convert to number if it looks like one
      if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
        processedValue = parseFloat(value);
      } else if (value.trim().toLowerCase() === 'true') {
        processedValue = true;
      } else if (value.trim().toLowerCase() === 'false') {
        processedValue = false;
      }
      // Handle formula
      else if (value.trim().startsWith('=')) {
        processedValue = { f: value.trim() };
      }
    }
    
    console.log(`Processed value type: ${typeof processedValue}, value: ${JSON.stringify(processedValue)}`);
    
    // Set cell value directly in the worksheet object
    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
    if (!worksheet[cellRef]) {
      worksheet[cellRef] = { t: 's', v: '' }; // Create the cell if it doesn't exist
    }
    
    if (typeof processedValue === 'object' && processedValue !== null && 'f' in processedValue) {
      // It's a formula
      worksheet[cellRef].f = processedValue.f;
      delete worksheet[cellRef].v; // Remove any previous value
      worksheet[cellRef].t = 'n'; // Assume numeric result for formulas
    } else {
      // Normal value
      worksheet[cellRef].v = processedValue;
      // Set appropriate type
      if (typeof processedValue === 'number') {
        worksheet[cellRef].t = 'n';
      } else if (typeof processedValue === 'boolean') {
        worksheet[cellRef].t = 'b';
      } else {
        worksheet[cellRef].t = 's';
      }
    }
    
    // Make sure the sheet range includes this cell
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    if (row > range.e.r) range.e.r = row;
    if (col > range.e.c) range.e.c = col;
    worksheet['!ref'] = XLSX.utils.encode_range(range);
    
    console.log(`Successfully set cell ${cellReference} to ${JSON.stringify(processedValue)}`);
  } catch (error) {
    console.error(`Error setting cell ${cellReference} value:`, error);
    throw error;
  }
}

/**
 * Parse an Excel cell reference (e.g., "A1", "B5", "AA10")
 */
function parseCellReference(cellReference) {
  // Regular expression to match A1-style cell references
  const match = cellReference.match(/^([A-Za-z]+)([0-9]+)$/);
  
  if (!match) {
    throw new Error(`Invalid cell reference: ${cellReference}`);
  }
  
  const columnLetter = match[1].toUpperCase();
  const rowNumber = parseInt(match[2], 10);
  
  return {
    row: rowNumber - 1, // Convert to 0-based index
    col: getColumnIndex(columnLetter)
  };
}

/**
 * Convert a column letter to index (e.g., A -> 0, Z -> 25, AA -> 26)
 */
function getColumnIndex(columnLetter) {
  let column = 0;
  const length = columnLetter.length;
  
  for (let i = 0; i < length; i++) {
    column += (columnLetter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  
  return column - 1; // Convert to 0-based index
}