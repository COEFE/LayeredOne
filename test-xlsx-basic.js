// Basic test for the xlsx library
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Create a simple test workbook
function createAndReadTestWorkbook() {
  try {
    console.log('===== XLSX LIBRARY TEST =====');
    console.log('XLSX Version:', XLSX.version);
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
    
    // Write to buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Write to file for inspection
    const testFilePath = path.join(__dirname, 'test-files', 'test-excel.xlsx');
    fs.writeFileSync(testFilePath, buffer);
    
    console.log(`Test Excel file created at: ${testFilePath}`);
    
    // Now read it back to verify
    console.log('\nReading the Excel file back...');
    const readBuffer = fs.readFileSync(testFilePath);
    const readWb = XLSX.read(readBuffer, { type: 'buffer' });
    
    console.log('Available sheets:', readWb.SheetNames);
    const readWs = readWb.Sheets[readWb.SheetNames[0]];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(readWs);
    console.log('\nData read from Excel:');
    console.log(jsonData);
    
    console.log('\nXLSX test completed successfully!');
    return true;
  } catch (error) {
    console.error('ERROR in XLSX test:', error);
    return false;
  }
}

// Run the test
createAndReadTestWorkbook();