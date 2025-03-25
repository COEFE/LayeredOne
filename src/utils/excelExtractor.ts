/**
 * Excel Text Extraction Utility
 * 
 * This utility extracts text content from Excel spreadsheets (.xlsx, .xls) using the xlsx library.
 * It includes A1 cell references to help identify specific cells in the spreadsheet.
 */
import * as XLSX from 'xlsx';

/**
 * Convert a column index to Excel column letter (e.g., 0 -> A, 25 -> Z, 26 -> AA)
 * @param columnIndex The 0-based column index
 * @returns The Excel column letter(s)
 */
function getColumnLetter(columnIndex: number): string {
  let columnLetter = '';
  let temp = columnIndex;
  
  while (temp >= 0) {
    columnLetter = String.fromCharCode(65 + (temp % 26)) + columnLetter;
    temp = Math.floor(temp / 26) - 1;
  }
  
  return columnLetter;
}

/**
 * Get the A1 cell reference for a given row and column index
 * @param rowIndex The 0-based row index
 * @param columnIndex The 0-based column index
 * @returns The A1 cell reference (e.g., "A1", "B2", "AA10")
 */
function getCellReference(rowIndex: number, columnIndex: number): string {
  return `${getColumnLetter(columnIndex)}${rowIndex + 1}`;
}

/**
 * Extract text content from an Excel buffer with cell references
 * @param buffer The file buffer containing Excel data
 * @returns A formatted string representation of the Excel data with cell references
 */
export async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  try {
    // Parse the Excel file from buffer with additional options for larger sheets
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellFormula: true,   // parse and include formulas
      cellNF: true,        // parse number formats
      cellStyles: true,    // include cell styles
      rawNumbers: false    // convert raw numbers to strings
    });
    
    // Initialize text extraction result
    let extractedText = '';
    
    // Process each sheet in the workbook
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Get the sheet range - expand range if necessary
      let range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      // Add sheet name as a header
      extractedText += `## Sheet: ${sheetName}\n\n`;
      extractedText += `Range: ${worksheet['!ref'] || 'A1'}\n\n`;
      
      // Add raw cell listing first as it's the most reliable method
      extractedText += `## Complete Cell Listing for Sheet "${sheetName}":\n\n`;
      
      // List all non-empty cells with their references
      const cellAddresses = Object.keys(worksheet)
        .filter(key => key !== '!ref' && key !== '!margins' && !key.startsWith('!'));
      
      if (cellAddresses.length > 0) {
        // Find the maximum column and row to ensure we have the complete range
        let maxCol = 0;
        let maxRow = 0;
        
        cellAddresses.forEach(addr => {
          const cellRef = XLSX.utils.decode_cell(addr);
          maxCol = Math.max(maxCol, cellRef.c);
          maxRow = Math.max(maxRow, cellRef.r);
        });
        
        // Update range if larger cells were found
        if (maxCol > range.e.c || maxRow > range.e.r) {
          range.e.c = Math.max(range.e.c, maxCol);
          range.e.r = Math.max(range.e.r, maxRow);
          console.log(`Expanded range to include all cells: ${XLSX.utils.encode_range(range)}`);
        }
        
        // Group cells by row for better organization
        const rowGroups: {[key: number]: string[]} = {};
        
        cellAddresses.forEach(addr => {
          const cellRef = XLSX.utils.decode_cell(addr);
          const cellValue = XLSX.utils.format_cell(worksheet[addr]);
          const rowNum = cellRef.r + 1; // Convert to 1-based
          
          if (!rowGroups[rowNum]) {
            rowGroups[rowNum] = [];
          }
          
          rowGroups[rowNum].push(`Cell ${addr}: ${cellValue}`);
        });
        
        // Output cells grouped by row
        const rows = Object.keys(rowGroups).map(Number).sort((a, b) => a - b);
        
        rows.forEach(rowNum => {
          extractedText += `Row ${rowNum}:\n`;
          rowGroups[rowNum].sort(); // Sort cells within row alphabetically
          rowGroups[rowNum].forEach(cell => {
            extractedText += `- ${cell}\n`;
          });
          extractedText += '\n';
        });
      } else {
        extractedText += 'No data cells found in this sheet.\n\n';
      }
      
      // Only show full grid for reasonable sized sheets (limit to 50x26 for readability)
      if (range.e.r < 50 && range.e.c < 26) {
        extractedText += '\n## Grid View (Column/Row Format):\n\n';
        
        // Add a row with column headers (A, B, C, etc.)
        extractedText += '| Cell Ref | ';
        for (let c = 0; c <= range.e.c; c++) {
          extractedText += `Column ${getColumnLetter(c)} | `;
        }
        extractedText += '\n';
        
        // Add separator row
        extractedText += '| --- | ';
        for (let c = 0; c <= range.e.c; c++) {
          extractedText += '--- | ';
        }
        extractedText += '\n';
        
        // Process each row
        for (let r = 0; r <= range.e.r; r++) {
          // Add row number
          extractedText += `| Row ${r + 1} | `;
          
          // Process each cell in the row
          for (let c = 0; c <= range.e.c; c++) {
            const cellRef = getCellReference(r, c);
            const cell = worksheet[cellRef];
            
            // Get formatted cell value or empty string
            const cellValue = cell ? XLSX.utils.format_cell(cell) : '';
            
            // Add cell value with its reference in a comment
            extractedText += `${cellValue} (${cellRef}) | `;
          }
          
          extractedText += '\n';
        }
      } else {
        extractedText += '\n## Grid View Omitted (Sheet too large)\n';
        extractedText += `This sheet has ${range.e.r + 1} rows and ${range.e.c + 1} columns, which is too large to display as a grid.\n`;
        extractedText += 'Please refer to the complete cell listing above or use specific cell references in your queries.\n\n';
      }
      
      // Add a more traditional tabular representation using the JSON data
      extractedText += '\n## Tabular Data View:\n\n';
      
      // Convert sheet to JSON for tabular display with all options for max compatibility
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: '',
        blankrows: true
      });
      
      if (jsonData.length > 0) {
        // Get the headers (first row)
        const headers = jsonData[0] as any[];
        if (headers && headers.length > 0) {
          // Add column headers with letters
          extractedText += '| Cell | ' + headers.map((h, idx) => 
            `${getColumnLetter(idx)}: ${String(h || '')}`).join(' | ') + ' |\n';
          
          // Add separator row
          extractedText += '| --- | ' + headers.map(() => '---').join(' | ') + ' |\n';
          
          // Add data rows with row numbers (limit to 100 rows for readability)
          const maxRows = Math.min(jsonData.length, 100);
          for (let i = 1; i < maxRows; i++) {
            const row = jsonData[i] as any[];
            if (row) {
              // Create row with row number prefix
              let rowContent = `| Row ${i + 1} | `;
              for (let j = 0; j < headers.length; j++) {
                const cellRef = getCellReference(i, j);
                const cellValue = j < row.length ? String(row[j] || '') : '';
                rowContent += `${cellValue} [${cellRef}] | `;
              }
              extractedText += rowContent.trim() + '\n';
            }
          }
          
          // Note if rows were truncated
          if (jsonData.length > 100) {
            extractedText += '\n*Note: Table truncated to 100 rows for readability. See complete cell listing for all data.*\n';
          }
        } else {
          // Special case for empty sheets or non-tabular data
          extractedText += 'Sheet appears to be empty or does not contain tabular data.\n';
        }
      } else {
        extractedText += 'Empty sheet\n';
      }

      // Add spacing between sheets
      extractedText += '\n\n';
    });
    
    // Add a usage guide at the end
    extractedText += `
## How to Reference Cells

When referring to specific cells in your queries, use the standard Excel cell reference notation:
- Column letters followed by row numbers (e.g., A1, B5, C10)
- Cells are referenced as [COLUMN][ROW] (e.g., A1 is column A, row 1)
- Columns are lettered: A, B, C, ... , Z, AA, AB, etc.
- Rows are numbered starting from 1

Examples:
- "What's the value in cell B3?"
- "Sum the values in column C"
- "Compare cells A5 and D5"
`;
    
    return extractedText.trim();
  } catch (error) {
    console.error('Error extracting text from Excel:', error);
    return `Error extracting text from Excel file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Process an Excel file and extract meaningful text representation with cell references
 * @param buffer The file buffer
 * @returns Formatted text content from the Excel file with cell references
 */
export async function processExcelFile(buffer: Buffer): Promise<string> {
  return extractTextFromExcel(buffer);
}