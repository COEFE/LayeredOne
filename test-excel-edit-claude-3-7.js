/**
 * Test script for Excel editing with Claude 3.7
 * 
 * This script tests the enhanced Excel editing functionality with Claude 3.7
 * by simulating edit requests and checking the detection of edit patterns.
 */

// Import the parseEditInstruction function from the excelEditor module
// This is a simplified version for testing - in a real implementation, you'd import from the actual module
function parseEditInstruction(instruction) {
  // Claude 3.7 standard format: "I'll change cell X to Y"
  // Handle quotes properly to extract the full value including spaces
  const claudePattern = /I(?:'ll|\s+will)\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(?:'([^']*)'|"([^"]*)"|(=\S+(?:\([^)]*\))?)|(\d+(?:\.\d+)?)|([^'"\s][^'"\s]*(?:\s+[^'"\s]+)*))/i;
  const claudeMatch = instruction.match(claudePattern);
  
  if (claudeMatch) {
    // Extract the value, which could be in any of the capture groups for different quote styles
    const value = claudeMatch[2] !== undefined ? claudeMatch[2] : 
               claudeMatch[3] !== undefined ? claudeMatch[3] : 
               claudeMatch[4] !== undefined ? claudeMatch[4] : 
               claudeMatch[5] !== undefined ? claudeMatch[5] : 
               claudeMatch[6] !== undefined ? claudeMatch[6] : '';
    
    return {
      cell: claudeMatch[1].toUpperCase(),
      value: value.trim()
    };
  }
  
  // Additional pattern for simple edit instructions: "Change cell X to Y"
  const simplePattern = /(?:change|set|update|modify)\s+(?:cell\s+)?([A-Za-z]+[0-9]+)\s+(?:to|as|with|value\s+to)\s+["']?([^"'\n]+)["']?/i;
  const simpleMatch = instruction.match(simplePattern);
  
  if (simpleMatch) {
    return {
      cell: simpleMatch[1].toUpperCase(),
      value: simpleMatch[2].trim()
    };
  }
  
  // Pattern for colon syntax: "A1: 'Header'"
  const colonPattern = /(?:cell\s+)?([A-Za-z]+[0-9]+)(?:\s*(?::|→|->|=)\s*)["']?([^"'\n]+)["']?/i;
  const colonMatch = instruction.match(colonPattern);
  
  if (colonMatch) {
    return {
      cell: colonMatch[1].toUpperCase(),
      value: colonMatch[2].trim()
    };
  }
  
  // No recognizable pattern
  return null;
}

// Function to process a full Claude response with multiple edits
function processClaudeResponse(response) {
  // Split by lines to detect multiple edits
  const lines = response.split('\n');
  const edits = [];
  
  // Process each line
  for (const line of lines) {
    const parsedEdit = parseEditInstruction(line.trim());
    if (parsedEdit && parsedEdit.cell && parsedEdit.value) {
      edits.push({
        sheet: "Sheet1", // Default sheet name
        cell: parsedEdit.cell,
        value: parsedEdit.value
      });
    }
  }
  
  return edits.length > 0 ? edits : null;
}

// Test various edit formats that Claude 3.7 might produce
const testCases = [
  {
    description: "Standard Claude 3.7 format",
    input: "I'll change cell A1 to 'Sales Report'",
    expected: { cell: "A1", value: "Sales Report" }
  },
  {
    description: "Numeric value without quotes",
    input: "I'll change cell B5 to 100",
    expected: { cell: "B5", value: "100" }
  },
  {
    description: "Formula with equals sign",
    input: "I'll change cell C10 to '=SUM(C1:C9)'",
    expected: { cell: "C10", value: "=SUM(C1:C9)" }
  },
  {
    description: "Date value",
    input: "I'll change cell D3 to '2023-01-15'",
    expected: { cell: "D3", value: "2023-01-15" }
  },
  {
    description: "With extra space",
    input: "I'll change cell  E7  to  'Extra Spaces'",
    expected: { cell: "E7", value: "Extra Spaces" }
  },
  {
    description: "Simple edit format",
    input: "Change cell F9 to 200",
    expected: { cell: "F9", value: "200" }
  },
  {
    description: "Colon format",
    input: "G12: 'Q4 Results'",
    expected: { cell: "G12", value: "Q4 Results" }
  },
  {
    description: "Multiple edits on separate lines",
    input: "I'll change cell A1 to 'Header'\nI'll change cell B1 to 'Value'",
    multiline: true,
    expected: [
      { sheet: "Sheet1", cell: "A1", value: "Header" },
      { sheet: "Sheet1", cell: "B1", value: "Value" }
    ]
  },
  {
    description: "Mixed format multiple edits",
    input: "I'll change cell A1 to 'Header'\nB2: 50\nChange cell C3 to 'Complete'",
    multiline: true,
    expected: [
      { sheet: "Sheet1", cell: "A1", value: "Header" },
      { sheet: "Sheet1", cell: "B2", value: "50" },
      { sheet: "Sheet1", cell: "C3", value: "Complete" }
    ]
  }
];

// Run the tests
console.log("TESTING CLAUDE 3.7 EXCEL EDIT PATTERN MATCHING\n");

let totalPassed = 0;
let totalFailed = 0;

testCases.forEach(testCase => {
  console.log(`Test: ${testCase.description}`);
  console.log(`Input: "${testCase.input}"`);
  
  if (testCase.multiline) {
    // For multiline tests, process the entire response
    const results = processClaudeResponse(testCase.input);
    
    console.log("Expected multiple results:");
    console.log(JSON.stringify(testCase.expected, null, 2));
    
    console.log("Actual results:");
    console.log(JSON.stringify(results, null, 2));
    
    const allValid = results.length === testCase.expected.length && 
      results.every((result, i) => {
        return result && 
          result.cell === testCase.expected[i].cell && 
          result.value === testCase.expected[i].value;
      });
    
    if (allValid) {
      console.log("✅ PASSED");
      totalPassed++;
    } else {
      console.log("❌ FAILED");
      totalFailed++;
    }
  } else {
    // For single-line tests
    const result = parseEditInstruction(testCase.input);
    
    console.log("Expected:");
    console.log(JSON.stringify(testCase.expected, null, 2));
    
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result && 
        result.cell === testCase.expected.cell && 
        result.value === testCase.expected.value) {
      console.log("✅ PASSED");
      totalPassed++;
    } else {
      console.log("❌ FAILED");
      totalFailed++;
    }
  }
  
  console.log("\n---\n");
});

console.log(`SUMMARY: ${totalPassed} tests passed, ${totalFailed} tests failed`);

// Example of a full Claude conversation
const exampleClaudeResponse = `
Based on my analysis of your spreadsheet, I can see that the Q2 sales figure for Product B appears to be incorrect. The value of 12500 seems to be an error, as it's significantly higher than the trend. Looking at the previous and following quarters, it should likely be around 1250 instead.

I'll make the following corrections:

I'll change cell B5 to 1250
I'll change cell D10 to '=SUM(D1:D9)'
I'll change cell A1 to 'Sales Report Q1-Q4'

These changes will fix the data error and add a proper title and sum formula.
`;

console.log("\nTESTING FULL CLAUDE RESPONSE PARSING\n");
console.log("Input Claude response:");
console.log(exampleClaudeResponse);

const extractedEdits = processClaudeResponse(exampleClaudeResponse);
console.log("\nExtracted edits:");
console.log(JSON.stringify(extractedEdits, null, 2));

console.log("\nClaude 3.7 Excel edit pattern detection test complete.");