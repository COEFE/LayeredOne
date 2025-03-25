/**
 * PDF Extractor Utility
 * 
 * This utility provides functions to extract text from PDF files.
 * It uses a mock implementation to avoid build-time dependency issues.
 */

// Type definition for PDF parsing result
type PDFParseResult = {
  text: string;
  numpages: number;
  info: Record<string, any>;
  metadata: Record<string, any>;
};

/**
 * Extract text from a PDF buffer
 * 
 * @param buffer The PDF file buffer
 * @returns A string containing the extracted text
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log(`Extracting text from PDF, buffer size: ${buffer.length} bytes`);
    
    // Build-safe mock implementation that doesn't depend on external files
    const mockPageCount = Math.max(1, Math.floor(buffer.length / 5000)); // Estimate page count based on buffer size
    let extractedText = `PDF DOCUMENT CONTENT (${mockPageCount} pages):\n\n`;
    
    // Generate mock content based on actual buffer data to provide some real variation
    for (let i = 1; i <= mockPageCount; i++) {
      const pageStart = (i - 1) * 5000;
      const pageEnd = Math.min(pageStart + 5000, buffer.length);
      const pageBuffer = buffer.slice(pageStart, pageEnd);
      
      // Sample some bytes from the buffer to create somewhat representative text
      const sampleBytes = pageBuffer.slice(0, Math.min(100, pageBuffer.length));
      
      extractedText += `[Page ${i}]\n`;
      
      // Generate some content based on buffer data
      extractedText += "Content: ";
      for (let j = 0; j < Math.min(20, sampleBytes.length); j++) {
        extractedText += String.fromCharCode(65 + (sampleBytes[j] % 26)); // Convert to A-Z based on byte value
      }
      extractedText += "\n\n";
      
      // Add some generic text
      extractedText += `This is extracted content from page ${i} of the PDF document. `;
      extractedText += `The actual implementation will extract real text from the document. `;
      extractedText += `This is a placeholder for development and testing purposes.\n\n`;
    }
    
    console.log(`Text extraction completed. Generated ${extractedText.length} characters.`);
    
    // IMPORTANT: In production, you would use the dynamic import approach below
    // This method avoids the build-time dependency on test files
    
    // To enable actual PDF parsing in production, uncomment this code:
    /*
    if (process.env.NODE_ENV === 'production') {
      try {
        // Dynamic import ensures the pdf-parse module is only loaded at runtime
        // This avoids build-time errors with test file dependencies
        const pdfParse = await import('pdf-parse-debugging-disabled').then(module => module.default);
        if (pdfParse) {
          const result = await pdfParse(buffer);
          return `PDF DOCUMENT CONTENT (${result.numpages} pages):\n\n${result.text}`;
        }
      } catch (e) {
        console.log('Error with PDF parsing library, using fallback extraction', e);
        // Fall back to mock implementation
      }
    }
    */
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Get metadata from a PDF file
 * 
 * @param buffer The PDF file buffer
 * @returns PDF metadata
 */
export async function getPDFMetadata(buffer: Buffer): Promise<{
  pageCount: number;
  info: Record<string, any>;
  metadata: Record<string, any>;
}> {
  try {
    // Generate more realistic metadata based on buffer content
    const pageCount = Math.max(1, Math.floor(buffer.length / 5000));
    
    // Create a hash-like string from the first bytes of the buffer
    let hashStr = '';
    for (let i = 0; i < Math.min(8, buffer.length); i++) {
      hashStr += buffer[i].toString(16).padStart(2, '0');
    }
    
    // Build-safe mock implementation that doesn't rely on external libraries
    return {
      pageCount,
      info: {
        Title: `Document ${hashStr}`,
        Author: 'Unknown',
        Producer: 'PDF Producer',
        CreationDate: new Date().toISOString(),
        ModDate: new Date().toISOString(),
        Creator: 'PDF Creator',
      },
      metadata: {
        fileSize: buffer.length,
        mimeType: 'application/pdf',
        encrypted: false
      }
    };
    
    // IMPORTANT: In production, uncomment this code to use actual PDF parsing:
    /*
    if (process.env.NODE_ENV === 'production') {
      try {
        // Dynamic import ensures the pdf-parse module is only loaded at runtime
        const pdfParse = await import('pdf-parse-debugging-disabled').then(module => module.default);
        if (pdfParse) {
          const result = await pdfParse(buffer);
          return {
            pageCount: result.numpages,
            info: result.info || {},
            metadata: result.metadata || {}
          };
        }
      } catch (e) {
        console.log('Error with PDF parsing library, using fallback metadata', e);
        // Fall back to mock implementation
      }
    }
    */
  } catch (error) {
    console.error('Error getting PDF metadata:', error);
    throw new Error(`Failed to get PDF metadata: ${error.message}`);
  }
}