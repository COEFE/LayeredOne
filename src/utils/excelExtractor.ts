/**
 * Excel Data Extractor Utility
 * 
 * This utility provides functions to extract data from Excel spreadsheets (.xlsx, .xls)
 * using the xlsx library, optimized for use with Claude AI for analysis and editing.
 */
import * as XLSX from 'xlsx';

/**
 * Extract data from an Excel file as a 2D array
 * @param buffer The Excel file buffer
 * @param sheetName Optional sheet name to extract (extracts the first sheet if not specified)
 * @returns A 2D array of the sheet data
 */
export function extractExcelData(buffer: Buffer, sheetName?: string): any[][] {
  try {
    console.log(`Extracting Excel data${sheetName ? ` from sheet "${sheetName}"` : ''}`);
    
    // Parse the Excel file - with enhanced options for better data extraction
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true, // Convert date values to JavaScript Date objects
      cellNF: false,   // Don't parse number formats (better performance)
      cellStyles: true, // Keep cell styles for better representation
      WTF: false,      // Don't show formulae (better for Claude)
    });
    
    console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Determine which sheet to extract
    const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];
    
    console.log(`Extracting from sheet "${targetSheet}"`);
    
    // Get the worksheet
    const worksheet = workbook.Sheets[targetSheet];
    
    // Convert to 2D array with better parsing options
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,          // Return an array of arrays
      defval: null,       // Default value for empty cells
      rawNumbers: false,  // Keep formatted numbers
      dateNF: 'yyyy-mm-dd', // Date format
    }) as any[][];
    
    console.log(`Extracted ${data.length} rows of data`);
    return data;
  } catch (error) {
    console.error('Error extracting Excel data:', error);
    throw error;
  }
}

/**
 * Extract structured data from an Excel file, including column headers
 * @param buffer The Excel file buffer
 * @param sheetName Optional sheet name to extract (extracts the first sheet if not specified)
 * @returns An object with headers and rows properties
 */
export function extractStructuredExcelData(buffer: Buffer, sheetName?: string): {
  headers: string[];
  rows: any[][];
  sheetName: string;
} {
  try {
    // Parse the Excel file with enhanced options
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellStyles: true,
      WTF: false,
    });
    
    // Determine which sheet to extract
    const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];
    
    console.log(`Extracting structured data from sheet "${targetSheet}"`);
    
    // Get the worksheet
    const worksheet = workbook.Sheets[targetSheet];
    
    // Convert to array of objects with better parsing options
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      rawNumbers: false,
      dateNF: 'yyyy-mm-dd',
    }) as any[][];
    
    // Separate headers and rows
    const headers = data.length > 0 ? data[0].map(h => h?.toString() || '') : [];
    const rows = data.slice(1);
    
    console.log(`Extracted ${headers.length} columns and ${rows.length} data rows`);
    
    return {
      headers,
      rows,
      sheetName: targetSheet
    };
  } catch (error) {
    console.error('Error extracting structured Excel data:', error);
    throw error;
  }
}

/**
 * Extract sheet information from an Excel file
 * @param buffer The Excel file buffer
 * @returns An array of sheet names and properties
 */
export function getExcelSheetInfo(buffer: Buffer): Array<{
  name: string;
  rowCount: number;
  columnCount: number;
  hasMergedCells: boolean;
  hasFormulas: boolean;
}> {
  try {
    console.log('Extracting Excel sheet information');
    
    // Parse the Excel file
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellStyles: true,
      WTF: false,
    });
    
    // Get info for each sheet
    const sheetInfo = workbook.SheetNames.map(name => {
      const worksheet = workbook.Sheets[name];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      // Check for merged cells
      const mergedCells = worksheet['!merges'] && worksheet['!merges'].length > 0;
      
      // Check for formulas
      let hasFormulas = false;
      Object.keys(worksheet).forEach(key => {
        if (key[0] !== '!' && worksheet[key].f) {
          hasFormulas = true;
        }
      });
      
      return {
        name,
        rowCount: range.e.r + 1,
        columnCount: range.e.c + 1,
        hasMergedCells: mergedCells,
        hasFormulas
      };
    });
    
    console.log(`Extracted info for ${sheetInfo.length} sheets`);
    return sheetInfo;
  } catch (error) {
    console.error('Error getting Excel sheet info:', error);
    throw error;
  }
}

/**
 * Extract a specific cell value from an Excel file
 * @param buffer The Excel file buffer
 * @param sheetName The sheet name
 * @param cellReference The A1-style cell reference (e.g., "A1", "B5")
 * @returns The cell value
 */
export function getExcelCellValue(buffer: Buffer, sheetName: string, cellReference: string): any {
  try {
    console.log(`Extracting cell ${cellReference} from sheet "${sheetName}"`);
    
    // Parse the Excel file
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellStyles: false,
    });
    
    // Check if the sheet exists
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }
    
    // Get the worksheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Get the cell value
    const cell = worksheet[cellReference];
    if (!cell) {
      console.log(`Cell ${cellReference} is empty or undefined`);
      return null;
    }
    
    // Return the value based on type
    if (cell.t === 'n') {
      return cell.v; // Number
    } else if (cell.t === 's') {
      return cell.v; // String
    } else if (cell.t === 'b') {
      return cell.v; // Boolean
    } else if (cell.t === 'd') {
      return cell.v; // Date
    } else if (cell.t === 'e') {
      return null; // Error
    } else if (cell.f) {
      return `=${cell.f}`; // Formula
    } else {
      return cell.v; // Any other type
    }
  } catch (error) {
    console.error(`Error getting Excel cell ${cellReference}:`, error);
    throw error;
  }
}

/**
 * Extract a range of cells from an Excel file as a 2D array
 * @param buffer The Excel file buffer
 * @param sheetName The sheet name
 * @param range The range in A1 notation (e.g., "A1:B5")
 * @returns A 2D array of the range values
 */
export function getExcelRange(buffer: Buffer, sheetName: string, range: string): any[][] {
  try {
    console.log(`Extracting range ${range} from sheet "${sheetName}"`);
    
    // Parse the Excel file
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellStyles: false,
    });
    
    // Check if the sheet exists
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }
    
    // Get the worksheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Parse the range
    const rangeRef = range.split(':');
    if (rangeRef.length !== 2) {
      throw new Error(`Invalid range format: ${range}. Expected format like "A1:B5".`);
    }
    
    // Get the range values as an array
    const rangeOptions = { range: range };
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      range: range,
      defval: null
    }) as any[][];
    
    console.log(`Extracted ${data.length} rows from range ${range}`);
    return data;
  } catch (error) {
    console.error(`Error getting Excel range ${range}:`, error);
    throw error;
  }
}

/**
 * Format Excel data for Claude AI analysis
 * @param data The Excel data as a 2D array
 * @param options Optional formatting options
 * @returns A formatted string representation of the Excel data
 */
export function formatExcelForClaude(
  data: any[][], 
  options?: {
    maxRows?: number;
    maxCols?: number;
    includeHeaders?: boolean;
    formatAsMarkdown?: boolean;
  }
): string {
  try {
    const { 
      maxRows = 100,
      maxCols = 20,
      includeHeaders = true,
      formatAsMarkdown = true 
    } = options || {};
    
    // Limit the number of rows and columns
    const limitedData = data.slice(0, maxRows).map(row => 
      row.slice(0, maxCols).map(cell => 
        cell === null || cell === undefined ? '' : String(cell)
      )
    );
    
    // Format as markdown table if requested
    if (formatAsMarkdown) {
      let markdown = '';
      
      // Add headers
      if (includeHeaders && limitedData.length > 0) {
        markdown += '| ' + limitedData[0].join(' | ') + ' |\n';
        markdown += '| ' + limitedData[0].map(() => '---').join(' | ') + ' |\n';
        
        // Add data rows
        for (let i = includeHeaders ? 1 : 0; i < limitedData.length; i++) {
          markdown += '| ' + limitedData[i].join(' | ') + ' |\n';
        }
      } else {
        // No headers, just data
        for (const row of limitedData) {
          markdown += '| ' + row.join(' | ') + ' |\n';
        }
      }
      
      return markdown;
    } else {
      // Format as plain text
      return limitedData.map(row => row.join('\t')).join('\n');
    }
  } catch (error) {
    console.error('Error formatting Excel data for Claude:', error);
    return 'Error formatting Excel data: ' + error.message;
  }
}

/**
 * Generate a Claude-friendly analysis prompt for Excel data
 * @param data The Excel data or structured data
 * @returns A prompt for Claude to analyze the Excel data
 */
export function generateClaudeExcelPrompt(
  data: any[][] | { headers: string[], rows: any[][], sheetName: string }
): string {
  try {
    // Determine if we have structured data or raw data
    const isStructured = !Array.isArray(data);
    
    // Get the data in the right format
    const rows = isStructured ? data.rows : data;
    const headers = isStructured ? data.headers : (rows.length > 0 ? rows[0] : []);
    const sheetName = isStructured ? data.sheetName : 'Sheet1';
    
    // Format a small sample of the data for the prompt
    const dataSample = formatExcelForClaude(
      [headers].concat(rows.slice(0, 5)), 
      { maxRows: 6, maxCols: 10, includeHeaders: true, formatAsMarkdown: true }
    );
    
    // Generate a prompt for Claude to analyze
    return `
You are examining an Excel spreadsheet called "${sheetName}" with ${rows.length} rows and ${headers.length} columns.

The column headers are:
${headers.join(', ')}

Here's a sample of the data:
${dataSample}

Please analyze this Excel data for insights, patterns, and potential improvements. You can:
1. Describe the overall structure and purpose of the data
2. Identify any patterns or trends in the data
3. Suggest potential calculations or formulas that might be useful
4. Recommend any formatting or structural improvements
5. Provide specific edit suggestions if you see issues with the data

After your analysis, if the user asks for edits, you can suggest specific cell changes using the format "I'll change cell X1 to Y" which will be automatically detected and applied.
`;
  } catch (error) {
    console.error('Error generating Claude Excel prompt:', error);
    return 'Error generating prompt: ' + error.message;
  }
}

/**
 * Prepare an Excel file for Claude AI, extracting key information
 * @param buffer The Excel file buffer
 * @returns An object with structured data and a prompt for Claude
 */
export function prepareExcelForClaude(buffer: Buffer): {
  structuredData: { headers: string[], rows: any[][], sheetName: string };
  sheetInfo: Array<{ name: string, rowCount: number, columnCount: number, hasMergedCells: boolean, hasFormulas: boolean }>;
  samplePrompt: string;
} {
  try {
    // Extract structured data
    const structuredData = extractStructuredExcelData(buffer);
    
    // Get sheet info
    const sheetInfo = getExcelSheetInfo(buffer);
    
    // Generate a sample prompt
    const samplePrompt = generateClaudeExcelPrompt(structuredData);
    
    return {
      structuredData,
      sheetInfo,
      samplePrompt
    };
  } catch (error) {
    console.error('Error preparing Excel for Claude:', error);
    throw error;
  }
}