/**
 * Excel Text Extraction Utility
 * 
 * This utility extracts text content from Excel spreadsheets (.xlsx, .xls) using the xlsx library.
 */
import * as XLSX from 'xlsx';

/**
 * Extract text content from an Excel buffer
 * @param buffer The file buffer containing Excel data
 * @returns A formatted string representation of the Excel data
 */
export async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  try {
    // Parse the Excel file from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Initialize text extraction result
    let extractedText = '';
    
    // Process each sheet in the workbook
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON for easier processing
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Add sheet name as a header
      extractedText += `## Sheet: ${sheetName}\n\n`;
      
      // Format as a table with column names as headers
      if (jsonData.length > 0) {
        // Get the headers (first row)
        const headers = jsonData[0] as any[];
        if (headers && headers.length > 0) {
          // Add column headers
          extractedText += '| ' + headers.map(h => String(h || '')).join(' | ') + ' |\n';
          // Add separator row
          extractedText += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
          
          // Add data rows
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row && row.length > 0) {
              // Create row with proper cell alignment to headers
              let rowContent = '| ';
              for (let j = 0; j < headers.length; j++) {
                rowContent += (j < row.length ? String(row[j] || '') : '') + ' | ';
              }
              extractedText += rowContent.trim() + '\n';
            }
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
    
    return extractedText.trim();
  } catch (error) {
    console.error('Error extracting text from Excel:', error);
    return `Error extracting text from Excel file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Process an Excel file and extract meaningful text representation
 * @param buffer The file buffer
 * @returns Formatted text content from the Excel file
 */
export async function processExcelFile(buffer: Buffer): Promise<string> {
  return extractTextFromExcel(buffer);
}