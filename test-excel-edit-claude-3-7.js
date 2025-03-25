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
  const claudePattern = /I(?:'ll|\s+will)\s+change\s+cell\s+([A-Za-z]+[0-9]+)\s+to\s+(?:'([^']*)'|"([^"]*)"|([^'"\s][^'"\s]*(?:\s+[^'"\s]+)*))/i;
  const claudeMatch = instruction.match(claudePattern);
  
  if (claudeMatch) {
    // Extract the value, which could be in any of the capture groups for different quote styles
    const value = claudeMatch[2] || claudeMatch[3] || claudeMatch[4] || '';
    
    return {
      cell: claudeMatch[1].toUpperCase(),
      value: value.trim()
    };
  }
  
  // Additional patterns would be checked here...
  
  return null;
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
    description: "Multiple edits on separate lines",
    input: "I'll change cell A1 to 'Header'\nI'll change cell B1 to 'Value'",
    multiline: true,
    expected: [
      { cell: "A1", value: "Header" },
      { cell: "B1", value: "Value" }
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
    // For multiline tests, split by newline and process each line
    const lines = testCase.input.split("\n");
    const results = lines.map(line => parseEditInstruction(line));
    
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