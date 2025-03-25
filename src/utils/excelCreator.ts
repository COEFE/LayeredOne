/**
 * Excel Creator Utility
 * 
 * This utility provides functions to create blank Excel spreadsheets (.xlsx)
 * with optimizations for serverless environments to avoid timeouts.
 */
import * as XLSX from 'xlsx';

/**
 * Creates a blank Excel workbook with a single sheet
 * Optimized for serverless environments to avoid timeout errors
 * @param sheetName Optional name for the sheet (defaults to "Sheet1")
 * @returns Buffer containing the Excel file
 */
export async function createBlankExcel(sheetName: string = 'Sheet1'): Promise<Buffer> {
  try {
    console.log(`Creating blank Excel file with sheet: ${sheetName}`);
    
    // Create a minimal workbook object - using the minimal approach to reduce memory usage
    const workbook = XLSX.utils.book_new();
    
    // Create a minimal worksheet with just enough data to be valid
    // This empty object approach uses less memory than creating a full worksheet
    const worksheet: XLSX.WorkSheet = {};
    
    // Set minimal required properties for a valid worksheet
    worksheet['!ref'] = 'A1:A1'; // Minimal range
    
    // Add a single empty cell to ensure the file is valid
    worksheet['A1'] = { t: 's', v: '' };
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Use lightweight options for writing the workbook
    // Lower compression to reduce CPU usage and avoid timeouts
    const writeOpts: XLSX.WritingOptions = { 
      type: 'buffer',
      bookType: 'xlsx',
      compression: false, // Disable compression to speed up processing
      bookSST: false,     // Disable shared string table for small files
      Props: {            // Minimal metadata
        Title: "New Document",
        CreatedDate: new Date()
      }
    };
    
    // Write the workbook to a buffer with timeout handling
    console.log('Writing Excel workbook to buffer...');
    
    // Use a promise with timeout to prevent hanging
    const outputBuffer = await Promise.race([
      // Main promise to generate the buffer
      Promise.resolve(XLSX.write(workbook, writeOpts)),
      
      // Timeout promise to fail after 5 seconds
      new Promise<Buffer>((_, reject) => 
        setTimeout(() => reject(new Error('Excel creation timed out')), 5000)
      )
    ]);
    
    console.log(`Excel creation complete: Output buffer size ${outputBuffer.length} bytes`);
    return outputBuffer;
  } catch (error) {
    console.error('Error creating Excel file:', error);
    
    // Try an even more lightweight fallback approach
    console.log('Attempting fallback creation method...');
    
    try {
      // Create minimal workbook with absolutely no extras
      const minimalWorkbook = {
        SheetNames: [sheetName],
        Sheets: {
          [sheetName]: {
            '!ref': 'A1:A1',
            'A1': { t: 's', v: '' }
          }
        }
      };
      
      // Minimal write options
      const minimalOpts = { 
        type: 'buffer', 
        bookType: 'xlsx',
        compression: false
      } as XLSX.WritingOptions;
      
      // Direct write with minimal options
      const fallbackBuffer = XLSX.write(minimalWorkbook, minimalOpts);
      console.log(`Excel creation complete (fallback): Buffer size ${fallbackBuffer.length} bytes`);
      return fallbackBuffer;
    } catch (fallbackError) {
      console.error('All Excel creation methods failed:', fallbackError);
      throw new Error(`Failed to create Excel file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Creates a template Excel workbook with headers and sample data
 * Optimized for serverless environments
 * @param headers Array of column headers
 * @param sampleData Optional sample data row (array of values)
 * @param sheetName Optional name for the sheet (defaults to "Sheet1")
 * @returns Buffer containing the Excel file
 */
export async function createTemplateExcel(
  headers: string[],
  sampleData?: any[],
  sheetName: string = 'Sheet1'
): Promise<Buffer> {
  try {
    console.log(`Creating template Excel with ${headers.length} columns`);
    
    // Create minimal workbook
    const workbook = XLSX.utils.book_new();
    
    // Create worksheet data with headers and optional sample row
    const data: any[][] = [headers];
    if (sampleData && sampleData.length > 0) {
      data.push(sampleData);
    }
    
    // Convert data array to worksheet - more efficient than manual cell creation
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Low-resource write options
    const writeOpts: XLSX.WritingOptions = { 
      type: 'buffer',
      bookType: 'xlsx',
      compression: false
    };
    
    // Write to buffer with timeout protection
    const outputBuffer = await Promise.race([
      Promise.resolve(XLSX.write(workbook, writeOpts)),
      new Promise<Buffer>((_, reject) => 
        setTimeout(() => reject(new Error('Excel template creation timed out')), 5000)
      )
    ]);
    
    console.log(`Excel template creation complete: Output size ${outputBuffer.length} bytes`);
    return outputBuffer;
  } catch (error) {
    console.error('Error creating Excel template:', error);
    throw error;
  }
}