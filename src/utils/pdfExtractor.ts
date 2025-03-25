/**
 * PDF Extractor Utility
 * 
 * This utility provides functions to extract text from PDF files using pdf-parse library.
 */

import pdfParse from 'pdf-parse';

/**
 * Extract text from a PDF buffer
 * 
 * @param buffer The PDF file buffer
 * @returns A string containing the extracted text
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log(`Extracting text from PDF, buffer size: ${buffer.length} bytes`);
    
    // Parse the PDF
    const data = await pdfParse(buffer, {
      // Ensure we get all pages
      max: 0
    });
    
    // Get the text content
    const text = data.text || '';
    console.log(`Successfully extracted ${text.length} characters from PDF (${data.numpages} pages)`);
    
    // Format the text for Claude
    const formattedText = formatPDFText(text, data.numpages);
    return formattedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Format PDF text to be more readable for Claude
 * 
 * @param text Raw extracted text
 * @param pageCount Number of pages in the PDF
 * @returns Formatted text
 */
function formatPDFText(text: string, pageCount: number): string {
  // Clean up excess whitespace
  let cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Add a header
  const header = `PDF DOCUMENT CONTENT (${pageCount} pages):\n\n`;
  
  // Add page markers if there's significant content
  if (cleanText.length > 1000) {
    // Attempt to identify page boundaries (this is approximate)
    const estimatedPageLength = Math.floor(cleanText.length / pageCount);
    
    let formattedText = header;
    for (let i = 0; i < pageCount; i++) {
      const startIndex = i * estimatedPageLength;
      const endIndex = (i + 1) * estimatedPageLength;
      
      // Get content for this estimated page
      const pageContent = cleanText.substring(startIndex, endIndex);
      
      // Add page marker
      formattedText += `[Page ${i + 1}]\n${pageContent}\n\n`;
    }
    
    return formattedText;
  }
  
  // For short documents, just return the cleaned text with a header
  return `${header}${cleanText}`;
}

/**
 * Get metadata from a PDF file
 * 
 * @param buffer The PDF file buffer
 * @returns PDF metadata
 */
export async function getPDFMetadata(buffer: Buffer): Promise<any> {
  try {
    const data = await pdfParse(buffer);
    
    return {
      pageCount: data.numpages,
      info: data.info,
      metadata: data.metadata,
      version: data.version
    };
  } catch (error) {
    console.error('Error getting PDF metadata:', error);
    throw error;
  }
}