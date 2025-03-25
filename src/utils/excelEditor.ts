/**
 * Excel Editor Utility
 * 
 * This utility provides functions to modify Excel spreadsheets (.xlsx, .xls) using the xlsx library.
 * It allows for cell editing and other spreadsheet modifications.
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
    
    // One of the most common issues with Excel editing is buffer handling
    // Instead of using XLSX.write, let's try a different approach with a temporary file
    
    console.log('Creating output buffer using a more robust method...');
    
    // First, write to a temporary file
    const tmpFileName = `/tmp/tmp_excel_${Date.now()}.xlsx`;
    try {
      // Write to a temporary file
      console.log(`Writing to temporary file: ${tmpFileName}`);
      XLSX.writeFile(workbook, tmpFileName);
      
      // Read the file back as a buffer (avoids issues with direct buffer creation)
      console.log(`Reading temporary file back as buffer`);
      const fs = require('fs');
      const outputBuffer = fs.readFileSync(tmpFileName);
      
      // Clean up temporary file
      try {
        fs.unlinkSync(tmpFileName);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temporary file: ${cleanupError}`);
      }
      
      console.log(`Excel edit complete: Output buffer size ${outputBuffer.length} bytes`);
      return outputBuffer;
    } catch (fileError) {
      console.error(`Error with file-based approach, falling back to direct buffer creation: ${fileError}`);
      
      // Fall back to direct buffer creation
      const options = { type: 'buffer', bookType: 'xlsx' } as XLSX.WritingOptions;
      const outputBuffer = XLSX.write(workbook, options);
      
      console.log(`Excel edit complete (fallback method): Output buffer size ${outputBuffer.length} bytes`);
      return outputBuffer;
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
 * @param instruction Natural language instruction describing the edit
 * @returns An object with sheet, cell, and value properties if the instruction can be parsed
 */
export function parseEditInstruction(instruction: string): { sheet?: string, cell?: string, value?: any } | null {
  // Case 1: Change/set/update cell X to Y
  const cellPattern = /(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"']+)["']?/i;
  const cellMatch = instruction.match(cellPattern);
  
  if (cellMatch) {
    return {
      cell: cellMatch[1].toUpperCase(),
      value: cellMatch[2].trim()
    };
  }
  
  // Case 2: Add value Y to row X (assuming first column)
  const rowPattern = /(?:add|set|put)\s+(?:value\s+)?["']?([^"']+)["']?\s+(?:to|in|at)\s+row\s+([0-9]+)/i;
  const rowMatch = instruction.match(rowPattern);
  
  if (rowMatch) {
    return {
      cell: `A${rowMatch[2].trim()}`,
      value: rowMatch[1].trim()
    };
  }
  
  // Case 3: Find more flexible edit patterns
  const flexibleCellPattern = /(?:cell|cells|column|row)?\s*([A-Za-z]+[0-9]+)(?:\s*(?:should|must|to|needs to|will)?\s*(?:be|contain|have|equal|set to|updated to|changed to|become))?\s+["']?([^"']+)["']?/i;
  const flexibleMatch = instruction.match(flexibleCellPattern);
  
  if (flexibleMatch && flexibleMatch[1] && flexibleMatch[2]) {
    return {
      cell: flexibleMatch[1].toUpperCase(),
      value: flexibleMatch[2].trim()
    };
  }
  
  // Case 4: Sheet name specified
  const sheetPattern = /(?:in|on|at)\s+(?:sheet|tab)\s+["']?([^"']+)["']?/i;
  const sheetMatch = instruction.match(sheetPattern);
  
  let sheet = undefined;
  if (sheetMatch) {
    sheet = sheetMatch[1].trim();
  }
  
  // If at least one match was successful and we have a sheet name, add it
  if ((cellMatch || rowMatch || flexibleMatch) && sheet) {
    return {
      sheet: sheet,
      cell: cellMatch ? cellMatch[1].toUpperCase() : 
            rowMatch ? `A${rowMatch[2].trim()}` : 
            flexibleMatch![1].toUpperCase(),
      value: cellMatch ? cellMatch[2].trim() : 
             rowMatch ? rowMatch[1].trim() : 
             flexibleMatch![2].trim()
    };
  }
  
  // If at least one match was successful even without sheet name
  if (cellMatch || rowMatch || (flexibleMatch && flexibleMatch[1] && flexibleMatch[2])) {
    return {
      sheet: "Sheet1", // Default sheet name
      cell: cellMatch ? cellMatch[1].toUpperCase() : 
            rowMatch ? `A${rowMatch[2].trim()}` : 
            flexibleMatch![1].toUpperCase(),
      value: cellMatch ? cellMatch[2].trim() : 
             rowMatch ? rowMatch[1].trim() : 
             flexibleMatch![2].trim()
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