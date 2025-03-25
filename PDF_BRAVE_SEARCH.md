# PDF with Brave Search Integration

This document explains how the application integrates PDF documents with Claude 3.7 and Brave Search functionality.

## Overview

When users chat about PDF documents, the application:

1. Automatically selects Claude 3.7 Sonnet as the model
2. Performs a Brave web search using the user's query + PDF title as context
3. Provides both the PDF content and relevant search results to Claude
4. Displays the "PDF mode with Brave search" indicator to the user

## Implementation

### 1. Model Selection for PDFs

In the `DocumentChat` component, PDFs are automatically identified, and the model selector is locked to Claude 3.7:

```typescript
// Check if document is a PDF to force Claude 3.7
const isPDF = docContentType.includes('pdf') || 
             docName.toLowerCase().endsWith('.pdf');
             
if (isPDF) {
  console.log('PDF document detected - locking model to Claude 3.7 Sonnet');
  setSelectedModel('claude-3-7-sonnet-20250219');
  setModelLocked(true);
}
```

### 2. Brave Search Integration

When a user asks a question about a PDF, the backend API performs a Brave search and includes the results:

```typescript
if (isPDF && BRAVE_API_KEY) {
  try {
    // Create search query by extracting key terms from the user message
    // and combining with document title for context
    const searchQuery = `${message} ${documentName} pdf`;
    
    // Call Brave Search API
    const braveSearchResponse = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });
    
    // Process and include search results in Claude messages
    // ...
  } catch (error) {
    console.error('Error during Brave search:', error);
  }
}
```

### 3. Enhanced System Prompt

The system prompt for Claude is enhanced with instructions about Brave Search:

```
You have access to Brave Search to complement your PDF analysis and provide additional context.
When the user asks a question that might benefit from more recent or external information related
to the PDF content, you should perform a search to supplement your answer. When you do this,
clearly indicate what information comes from the PDF versus from your search.
```

## Setup

1. Obtain a Brave Search API key from [https://brave.com/search/api/](https://brave.com/search/api/)

2. Add your API key to the environment variables:
   ```
   BRAVE_API_KEY=your_brave_search_api_key_here
   ```

3. Ensure Claude 3.7 is available through your Anthropic API subscription

## User Experience

- Users see a blue "PDF mode with Brave search" indicator when viewing PDFs
- The model selector is replaced with "Using Claude 3.7 for PDFs" notice
- Claude will incorporate web search results when appropriate, clearly citing sources

## Limitations

- Without a Brave API key, the functionality falls back to regular PDF analysis
- Search results quality depends on the relevance between the query and PDF title
- Brave Search results are limited to the top 5 most relevant matches