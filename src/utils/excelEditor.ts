/**
 * Excel Editor Utility
 * 
 * This utility provides functions to modify Excel spreadsheets (.xlsx, .xls) using the xlsx library.
 * It allows for cell editing and other spreadsheet modifications with enhanced Claude 3.7 parsing capabilities.
 */
import * as XLSX from 'xlsx';

/**
 * Convert a column letter to index (e.g., A -> 0, Z -> 25, AA -> 26)
 * @param columnLetter The Excel column letter(s)
 * @returns The 0-based column index
 */
function getColumnIndex(columnLetter: string): number {
  let column = 0;
  const length = columnLetter.length;
  
  for (let i = 0; i < length; i++) {
    column += (columnLetter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  
  return column - 1; // Convert to 0-based index
}

/**
 * Parse an Excel cell reference (e.g., "A1", "B5", "AA10")
 * @param cellReference The A1-style cell reference
 * @returns An object with row and column indices (0-based)
 */
function parseCellReference(cellReference: string): { row: number, col: number } {
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
 * Convert row and column indices to an A1-style cell reference
 * @param row The 0-based row index
 * @param col The 0-based column index
 * @returns The A1-style cell reference (e.g., "A1")
 */
function getCellReference(row: number, col: number): string {
  let columnLetter = '';
  let temp = col;
  
  while (temp >= 0) {
    columnLetter = String.fromCharCode(65 + (temp % 26)) + columnLetter;
    temp = Math.floor(temp / 26) - 1;
  }
  
  return `${columnLetter}${row + 1}`;
}

/**
 * Set a single cell value in an Excel worksheet
 * @param worksheet The Excel worksheet to modify
 * @param cellReference The A1-style cell reference (e.g., "A1", "B5")
 * @param value The value to set in the cell
 */
function setCellValue(worksheet: XLSX.WorkSheet, cellReference: string, value: any): void {
  try {
    console.log(`Setting value in cell ${cellReference}: ${value}`);
    
    // Parse the cell reference
    const { row, col } = parseCellReference(cellReference);
    
    // Get the cell address in A1 notation
    const cellAddress = getCellReference(row, col);
    
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
 * Edit cells in an Excel file
 * @param buffer The Excel file buffer to modify
 * @param edits An array of edits to apply, each with sheet name, cell reference, and new value
 * @returns A new buffer with the modified Excel file
 */
export async function editExcelFile(buffer: Buffer, edits: Array<{
  sheet: string;
  cell: string;
  value: any;
}>): Promise<Buffer> {
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
    
    // Serverless-friendly approach to Excel buffer creation
    // Direct buffer creation is more reliable in serverless environments
    
    console.log('Creating output buffer using serverless-compatible method...');
    
    // Use a performance timer to track Excel processing time
    const startTime = Date.now();
    console.log('Excel processing started at:', new Date(startTime).toISOString());
    
    try {
      // Use a more robust write options configuration with optimizations
      const writeOpts: XLSX.WritingOptions = { 
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
        } as XLSX.WritingOptions;
        
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
 * Add a new row to an Excel worksheet
 * @param buffer The Excel file buffer to modify
 * @param sheet The name of the sheet to modify
 * @param rowData An array of values for the new row
 * @param rowIndex Optional 0-based index to insert the row at (appends to end if not specified)
 * @returns A new buffer with the modified Excel file
 */
export async function addRowToExcel(
  buffer: Buffer,
  sheet: string,
  rowData: any[],
  rowIndex?: number
): Promise<Buffer> {
  try {
    // Parse the Excel file from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Check if the specified sheet exists
    if (!workbook.SheetNames.includes(sheet)) {
      throw new Error(`Sheet "${sheet}" not found in the workbook`);
    }
    
    const worksheet = workbook.Sheets[sheet];
    
    // Get the sheet range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Determine where to add the row
    const targetRow = rowIndex !== undefined ? rowIndex : range.e.r + 1;
    
    // Add the row data
    XLSX.utils.sheet_add_aoa(worksheet, [rowData], { origin: { r: targetRow, c: 0 } });
    
    // Update the sheet range if needed
    const newRange = {
      s: { r: range.s.r, c: range.s.c },
      e: { 
        r: Math.max(range.e.r + 1, targetRow + 1), 
        c: Math.max(range.e.c, rowData.length - 1)
      }
    };
    
    worksheet['!ref'] = XLSX.utils.encode_range(newRange);
    
    // Write the modified workbook to a buffer
    const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return outputBuffer;
  } catch (error) {
    console.error('Error adding row to Excel file:', error);
    throw error;
  }
}

/**
 * Update multiple cells in a specific column
 * @param buffer The Excel file buffer to modify
 * @param sheet The name of the sheet to modify
 * @param columnLetter The column letter to update (e.g., "A", "B", "AA")
 * @param updates An array of {row, value} objects, where row is the 1-based row number
 * @returns A new buffer with the modified Excel file
 */
export async function updateColumn(
  buffer: Buffer,
  sheet: string,
  columnLetter: string, 
  updates: Array<{row: number, value: any}>
): Promise<Buffer> {
  try {
    // Parse the Excel file from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Check if the specified sheet exists
    if (!workbook.SheetNames.includes(sheet)) {
      throw new Error(`Sheet "${sheet}" not found in the workbook`);
    }
    
    const worksheet = workbook.Sheets[sheet];
    
    // Get the column index
    const columnIndex = getColumnIndex(columnLetter);
    
    // Apply each update
    for (const update of updates) {
      const { row, value } = update;
      const rowIndex = row - 1; // Convert to 0-based index
      
      // Add the cell value
      XLSX.utils.sheet_add_aoa(worksheet, [[value]], { origin: { r: rowIndex, c: columnIndex } });
    }
    
    // Write the modified workbook to a buffer
    const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return outputBuffer;
  } catch (error) {
    console.error('Error updating column in Excel file:', error);
    throw error;
  }
}

/**
 * Parse natural language edit instruction to extract cell references and values
 * Enhanced to handle Claude 3.7 outputs
 * @param instruction Natural language instruction describing the edit
 * @returns An object with sheet, cell, and value properties if the instruction can be parsed
 */
export function parseEditInstruction(instruction: string): { sheet?: string, cell?: string, value?: any } | null {
  console.log("Parsing instruction:", instruction);

  // Claude 3.7 standard format: "I'll change cell X to Y"
  // Handle different quote styles and properly extract values including spaces
  // Improved pattern matching with better regex structure for different value types
  const claudePattern = /I(?:'ll|\s+will)\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(?:'([^']*)'|"([^"]*)"|(=\S+(?:\([^)]*\))?)|(\d+(?:\.\d+)?)|([^'"\s][^'"\s]*(?:\s+[^'"\s]+)*))/i;
  const claudeMatch = instruction.match(claudePattern);
  
  // Alternative pattern for simpler formats that Claude might use
  const simplePattern = /I'll\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(?:'([^']*)'|"([^"]*)"|(=\S+(?:\([^)]*\))?)|(\d+(?:\.\d+)?)|([^\s].*))/i;
  const simpleMatch = !claudeMatch ? instruction.match(simplePattern) : null;
  
  // Use whichever pattern matched
  const match = claudeMatch || simpleMatch;
  
  if (match) {
    console.log("Match found:", match);
    
    // Extract the value using more robust handling for different capture groups
    // match[2]: single-quoted value
    // match[3]: double-quoted value
    // match[4]: formula value (starting with =)
    // match[5]: numeric value
    // match[6]: unquoted text value
    const value = match[2] !== undefined ? match[2] : 
               match[3] !== undefined ? match[3] : 
               match[4] !== undefined ? match[4] : 
               match[5] !== undefined ? match[5] : 
               match[6] !== undefined ? match[6] : '';
    
    console.log("Extracted cell:", match[1].toUpperCase());
    console.log("Extracted value:", value);
    
    return {
      cell: match[1].toUpperCase(),
      value: value.trim()
    };
  }
  
  // Case 1: Change/set/update cell X to Y
  const cellPattern = /(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i;
  const cellMatch = instruction.match(cellPattern);
  
  if (cellMatch) {
    return {
      cell: cellMatch[1].toUpperCase(),
      value: cellMatch[2].trim()
    };
  }
  
  // Case 2: Add value Y to row X (assuming first column)
  const rowPattern = /(?:add|set|put)\s+(?:value\s+)?["']?([^"'\n]+)["']?\s+(?:to|in|at)\s+row\s+([0-9]+)/i;
  const rowMatch = instruction.match(rowPattern);
  
  if (rowMatch) {
    return {
      cell: `A${rowMatch[2].trim()}`,
      value: rowMatch[1].trim()
    };
  }
  
  // Case 3: Cell reference with colon/arrow: "A1: 100" or "A1 → 100"
  const colonPattern = /(?:cell\s+)?([A-Za-z]+[0-9]+)(?:\s*(?::|→|->|=)\s*)["']?([^"'\n]+)["']?/i;
  const colonMatch = instruction.match(colonPattern);
  
  if (colonMatch) {
    return {
      cell: colonMatch[1].toUpperCase(),
      value: colonMatch[2].trim()
    };
  }
  
  // Case 4: Value pattern: "Set the value in A1 to 100"
  const valuePattern = /(?:set|put|place)\s+(?:the\s+)?(?:value|data|content)\s+(?:in|of|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as)\s+["']?([^"'\n]+)["']?/i;
  const valueMatch = instruction.match(valuePattern);
  
  if (valueMatch) {
    return {
      cell: valueMatch[1].toUpperCase(),
      value: valueMatch[2].trim()
    };
  }
  
  // Case 5: Direct mention: "Cell A1 should be 100"
  const directPattern = /(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:should|will|to|must|needs to)\s+(?:be|contain|have|equal)\s+["']?([^"'\n]+)["']?/i;
  const directMatch = instruction.match(directPattern);
  
  if (directMatch) {
    return {
      cell: directMatch[1].toUpperCase(),
      value: directMatch[2].trim()
    };
  }
  
  // Case 6: Recommendation pattern: "I recommend changing cell A1 to 100"
  const recommendPattern = /recommend\s+(?:changing|setting|updating|modifying)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i;
  const recommendMatch = instruction.match(recommendPattern);
  
  if (recommendMatch) {
    return {
      cell: recommendMatch[1].toUpperCase(),
      value: recommendMatch[2].trim()
    };
  }
  
  // Case 7: Manual edit pattern: "Manually edit cell A1 to contain 100"
  const manualPattern = /(?:manually|should)\s+(?:edit|change|update|modify|set)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to|contain)\s+["']?([^"'\n]+)["']?/i;
  const manualMatch = instruction.match(manualPattern);
  
  if (manualMatch) {
    return {
      cell: manualMatch[1].toUpperCase(),
      value: manualMatch[2].trim()
    };
  }
  
  // Case 8: Cell equals pattern: "cell A1 equals 100"
  const equalsPattern = /(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:equals|is|becomes|gets set to)\s+["']?([^"'\n]+)["']?/i;
  const equalsMatch = instruction.match(equalsPattern);
  
  if (equalsMatch) {
    return {
      cell: equalsMatch[1].toUpperCase(),
      value: equalsMatch[2].trim()
    };
  }
  
  // Case 9: Formula pattern: "Set formula in A1 to =SUM(B1:B10)"
  const formulaPattern = /(?:set|add|create|use)\s+(?:a|the)?\s+formula\s+(?:in|at)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|:)\s+["']?(=.+)["']?/i;
  const formulaMatch = instruction.match(formulaPattern);
  
  if (formulaMatch) {
    return {
      cell: formulaMatch[1].toUpperCase(),
      value: formulaMatch[2].trim()
    };
  }
  
  // Case 10: Most flexible pattern as a fallback
  const flexibleCellPattern = /(?:cell|cells|column|row)?\s*([A-Za-z]+[0-9]+)(?:\s*(?:should|must|to|needs to|will)?\s*(?:be|contain|have|equal|set to|updated to|changed to|become))?\s+["']?([^"'\n]+)["']?/i;
  const flexibleMatch = instruction.match(flexibleCellPattern);
  
  if (flexibleMatch && flexibleMatch[1] && flexibleMatch[2]) {
    return {
      cell: flexibleMatch[1].toUpperCase(),
      value: flexibleMatch[2].trim()
    };
  }
  
  // Sheet name detection
  const sheetPattern = /(?:in|on|at)\s+(?:sheet|tab)\s+["']?([^"']+)["']?/i;
  const sheetMatch = instruction.match(sheetPattern);
  
  let sheet = undefined;
  if (sheetMatch) {
    sheet = sheetMatch[1].trim();
  }
  
  // If at least one match was successful and we have a sheet name, add it
  if ((claudeMatch || cellMatch || rowMatch || colonMatch || valueMatch || directMatch || 
       recommendMatch || manualMatch || equalsMatch || formulaMatch || flexibleMatch) && sheet) {
    let cell = '';
    let value = '';
    
    if (claudeMatch) {
      cell = claudeMatch[1].toUpperCase();
      value = claudeMatch[2].trim();
    } else if (cellMatch) {
      cell = cellMatch[1].toUpperCase();
      value = cellMatch[2].trim();
    } else if (rowMatch) {
      cell = `A${rowMatch[2].trim()}`;
      value = rowMatch[1].trim();
    } else if (colonMatch) {
      cell = colonMatch[1].toUpperCase();
      value = colonMatch[2].trim();
    } else if (valueMatch) {
      cell = valueMatch[1].toUpperCase();
      value = valueMatch[2].trim();
    } else if (directMatch) {
      cell = directMatch[1].toUpperCase();
      value = directMatch[2].trim();
    } else if (recommendMatch) {
      cell = recommendMatch[1].toUpperCase();
      value = recommendMatch[2].trim();
    } else if (manualMatch) {
      cell = manualMatch[1].toUpperCase();
      value = manualMatch[2].trim();
    } else if (equalsMatch) {
      cell = equalsMatch[1].toUpperCase();
      value = equalsMatch[2].trim();
    } else if (formulaMatch) {
      cell = formulaMatch[1].toUpperCase();
      value = formulaMatch[2].trim();
    } else if (flexibleMatch && flexibleMatch[1] && flexibleMatch[2]) {
      cell = flexibleMatch[1].toUpperCase();
      value = flexibleMatch[2].trim();
    }
    
    return { sheet, cell, value };
  }
  
  // If at least one match was successful even without sheet name
  if (claudeMatch || cellMatch || rowMatch || colonMatch || valueMatch || directMatch || 
      recommendMatch || manualMatch || equalsMatch || formulaMatch || 
      (flexibleMatch && flexibleMatch[1] && flexibleMatch[2])) {
    
    let cell = '';
    let value = '';
    
    if (claudeMatch) {
      cell = claudeMatch[1].toUpperCase();
      value = claudeMatch[2].trim();
    } else if (cellMatch) {
      cell = cellMatch[1].toUpperCase();
      value = cellMatch[2].trim();
    } else if (rowMatch) {
      cell = `A${rowMatch[2].trim()}`;
      value = rowMatch[1].trim();
    } else if (colonMatch) {
      cell = colonMatch[1].toUpperCase();
      value = colonMatch[2].trim();
    } else if (valueMatch) {
      cell = valueMatch[1].toUpperCase();
      value = valueMatch[2].trim();
    } else if (directMatch) {
      cell = directMatch[1].toUpperCase();
      value = directMatch[2].trim();
    } else if (recommendMatch) {
      cell = recommendMatch[1].toUpperCase();
      value = recommendMatch[2].trim();
    } else if (manualMatch) {
      cell = manualMatch[1].toUpperCase();
      value = manualMatch[2].trim();
    } else if (equalsMatch) {
      cell = equalsMatch[1].toUpperCase();
      value = equalsMatch[2].trim();
    } else if (formulaMatch) {
      cell = formulaMatch[1].toUpperCase();
      value = formulaMatch[2].trim();
    } else if (flexibleMatch && flexibleMatch[1] && flexibleMatch[2]) {
      cell = flexibleMatch[1].toUpperCase();
      value = flexibleMatch[2].trim();
    }
    
    return {
      sheet: "Sheet1", // Default sheet name
      cell: cell,
      value: value
    };
  }
  
  // No recognizable pattern
  return null;
}

/**
 * Analyze a natural language edit request and generate a plan to modify an Excel file
 * @param editRequest Natural language description of desired edits
 * @returns A structured plan for Excel edits or null if the request can't be parsed
 */
export function analyzeEditRequest(editRequest: string): {
  description: string;
  edits: Array<{sheet: string, cell: string, value: any}>;
} | null {
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
 * Process multiple edits from a Claude 3.7 response
 * @param response The full text response from Claude 3.7
 * @returns Array of edit operations or null if no edits were found
 */
export function processClaudeResponse(response: string): Array<{sheet: string, cell: string, value: any}> | null {
  // Split the response into lines to detect multiple edits
  const lines = response.split('\n');
  const edits: Array<{sheet: string, cell: string, value: any}> = [];
  
  // Process each line for potential edit instructions
  for (const line of lines) {
    const parsedEdit = parseEditInstruction(line.trim());
    if (parsedEdit && parsedEdit.cell && parsedEdit.value) {
      edits.push({
        sheet: parsedEdit.sheet || 'Sheet1',
        cell: parsedEdit.cell,
        value: parsedEdit.value
      });
    }
  }
  
  return edits.length > 0 ? edits : null;
}

/**
 * Handle a natural language Excel editing request with Claude 3.7
 * @param buffer The Excel file buffer to modify
 * @param editRequest The natural language edit request from the user
 * @param claudeResponse The response from Claude 3.7
 * @returns A new buffer with the modified Excel file and summary of changes
 */
export async function handleClaudeExcelEdit(
  buffer: Buffer,
  editRequest: string,
  claudeResponse: string
): Promise<{buffer: Buffer, summary: string}> {
  try {
    // First try to process the Claude response to extract edits
    let edits = processClaudeResponse(claudeResponse);
    
    // If no edits found in the response, try to analyze the original request
    if (!edits || edits.length === 0) {
      const editPlan = analyzeEditRequest(editRequest);
      if (editPlan) {
        edits = editPlan.edits;
      }
    }
    
    // If still no edits found, return an error
    if (!edits || edits.length === 0) {
      throw new Error('Could not determine any valid Excel edits from the request or response');
    }
    
    // Apply the edits to the Excel file
    const newBuffer = await editExcelFile(buffer, edits);
    
    // Create a summary of the changes
    const editSummary = edits.map(edit => 
      `Changed ${edit.cell} in "${edit.sheet}" to ${typeof edit.value === 'string' && edit.value.startsWith('=') ? 'formula' : 'value'} "${edit.value}"`
    ).join('\n');
    
    return {
      buffer: newBuffer,
      summary: `Applied ${edits.length} edit${edits.length > 1 ? 's' : ''}:\n${editSummary}`
    };
  } catch (error) {
    console.error('Error handling Claude Excel edit:', error);
    throw error;
  }
}