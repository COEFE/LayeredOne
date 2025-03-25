# PDF Support Implementation

This document outlines how PDF support is implemented in the application.

## Current Implementation

The application includes support for PDF document processing using a build-safe approach:

1. **Mock Implementation**: The PDF extractor in `src/utils/pdfExtractor.ts` uses a mock implementation during development and build time that doesn't depend on external libraries or test files.

2. **Dynamic Import Pattern**: The code includes commented sections showing how to enable real PDF parsing in production using dynamic imports, which prevents build-time errors.

3. **Document Processing**: The API route at `src/app/api/documents/process/route.ts` handles PDF files by detecting their content type and calling the appropriate extractor.

## Build Error Avoidance

The mock implementation was created to avoid a common build error with pdf-parse:

```
Error: ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'
```

This error occurs because pdf-parse attempts to access test files during build time, which are not available in the build environment.

## Enabling Real PDF Processing in Production

To enable real PDF parsing in production:

1. Uncomment the dynamic import sections in `pdfExtractor.ts`:

```typescript
if (process.env.NODE_ENV === 'production') {
  try {
    // Dynamic import ensures the pdf-parse module is only loaded at runtime
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
```

2. Make sure the `pdf-parse-debugging-disabled` package is installed (it's already in your package.json).

3. Deploy the application. The dynamic import ensures that the PDF parsing library is only loaded at runtime, not during build time.

## PDF Viewer Component

The application includes a PDF viewer component at `src/components/PDFViewer.tsx` that uses `react-pdf` to display PDF documents with a text layer for selection and copying.

## Advanced PDF Processing

For more advanced PDF processing:

1. **Text Extraction**: The current implementation extracts text from PDFs. You can enhance this to extract structure, tables, and images.

2. **Metadata Handling**: PDF metadata is extracted and can be used for document organization and search.

3. **Integration with Claude**: The system prompts can be updated to better handle PDF content, similar to how they handle Excel files.

## Limitations and Future Work

1. **Large Files**: Very large PDF files might need chunking for efficient processing.

2. **Complex PDFs**: PDFs with complex layouts or heavy use of images may not extract text perfectly.

3. **Text Layer Support**: The PDF viewer has a text layer, but it may not always align perfectly with scanned documents.

4. **OCR Support**: For scanned PDFs without embedded text, OCR functionality could be added in the future.