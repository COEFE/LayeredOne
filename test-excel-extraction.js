// Test script for Excel extraction
const fs = require('fs');
const path = require('path');
const { extractTextFromExcel } = require('./src/utils/excelExtractor');

// Import the xlsx library directly to create a test file
const XLSX = require('xlsx');

// Create a simple test workbook
function createTestWorkbook() {
  console.log('Creating test Excel workbook...');
  
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Create sample data
  const wsData = [
    ['ID', 'Name', 'Value'],
    [1, 'Test Item 1', 100],
    [2, 'Test Item 2', 200],
    [3, 'Test Item 3', 300],
  ];
  
  // Convert data to worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'TestSheet');
  
  // Create a second sheet
  const ws2Data = [
    ['Date', 'Category', 'Amount'],
    [new Date(2023, 0, 1), 'Food', 45.5],
    [new Date(2023, 0, 2), 'Transport', 32.0],
    [new Date(2023, 0, 3), 'Entertainment', 75.25],
  ];
  
  // Convert data to worksheet
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws2, 'Expenses');
  
  // Write to buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  // Write to file for inspection
  const testFilePath = path.join(__dirname, 'test-files', 'test-excel.xlsx');
  fs.writeFileSync(testFilePath, buffer);
  
  console.log(`Test Excel file created at: ${testFilePath}`);
  
  return { buffer, filePath: testFilePath };
}

async function testExcelExtraction() {
  try {
    console.log('===== EXCEL EXTRACTION TEST =====');
    
    // Create test workbook
    const { buffer, filePath } = createTestWorkbook();
    
    // Test extraction
    console.log('Testing extractTextFromExcel function...');
    
    // Read the file back to ensure it's valid
    const fileBuffer = fs.readFileSync(filePath);
    
    // Call the extraction function
    const extractedText = await extractTextFromExcel(fileBuffer);
    
    console.log('\nExtracted Text Result:');
    console.log('======================');
    console.log(extractedText.substring(0, 500) + '...');
    console.log('======================');
    
    console.log('\nExtraction test completed successfully!');
    
  } catch (error) {
    console.error('ERROR in Excel extraction test:', error);
  }
}

// Run the test
testExcelExtraction();