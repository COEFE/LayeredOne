# LLM Chat App

A Next.js application that allows users to chat with different Large Language Models (LLMs) and analyze documents using AI.

## Features

- **Chat with LLMs**: Choose from multiple AI models including ChatGPT and Claude
- **Document Analysis**: Upload PDFs, Excel files, CSV files, text files, and more for AI analysis
- **User Authentication**: Firebase-based authentication with email/password and Google sign-in
- **History Saving**: All chats and documents are saved and can be accessed later
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **LLM Integrations**: OpenAI API, Anthropic API
- **Document Processing**: PDF extraction with pdf-parse, spreadsheet processing with xlsx, and LangChain for AI integrations

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase account
- OpenAI API key (for ChatGPT models)
- Anthropic API key (for Claude models)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/llm-chat-app.git
cd llm-chat-app
```

2. Install dependencies:

```bash
npm install
```

3. Create a Firebase project and configure auth, Firestore, and Storage

4. Copy the `.env.example` file to `.env.local` and fill in your Firebase and API credentials:

```bash
cp .env.example .env.local
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Firebase Setup

1. Create a new Firebase project
2. Enable Authentication with email/password and Google sign-in
3. Create a Firestore database
4. Create a Storage bucket
5. Configure the Firebase Storage CORS settings (see instructions below)
6. Add your Firebase config to the `.env.local` file

### Fixing Firebase Storage CORS Issues

To fix CORS issues with Firebase Storage uploads, you need to properly configure your storage bucket. You have several options:

#### Option 1: Using Google Cloud Console (Recommended for Production)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to Cloud Storage > Buckets
4. Find your bucket in the list and click on it
5. Go to the "Permissions" tab
6. Click on "CORS configuration"
7. Add the following configuration:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "Content-Length", "Content-Encoding", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

8. Click "Save"

#### Option 2: Using the Setup Script

We've provided a Node.js script to set up CORS for your Firebase Storage bucket:

1. Make sure you have the Firebase CLI installed and are logged in:
   ```
   npm install -g firebase-tools
   firebase login
   ```

2. Run the setup script:
   ```
   node scripts/setup-cors.js
   ```

#### Option 3: Using gsutil Command Line Tool

If you prefer using the command line:

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Login to your Google account:
   ```sh
   gcloud auth login
   ```
3. Create a file named `cors.json` with the following content:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "Content-Length", "Content-Encoding", "Content-Disposition"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
4. Set the CORS configuration for your bucket:
   ```sh
   gsutil cors set cors.json gs://YOUR-BUCKET-NAME.appspot.com
   ```

## Project Structure

- `/src/app`: Next.js pages and routes
- `/src/components`: Reusable React components
- `/src/context`: React context providers (Auth, etc.)
- `/src/firebase`: Firebase configuration and utilities

## Features to Implement

- Word document (.docx, .doc) support
- PowerPoint presentation (.pptx, .ppt) support
- Improved document chunking and vector search
- Advanced document metadata extraction
- Direct PDF upload for Claude 3.5 and 3.7 models

## Supported Document Types

The application supports various document types for AI analysis:

| Document Type | Status | Notes |
|---------------|--------|-------|
| PDF | ✅ Implemented | Full text extraction with multiple fallbacks |
| Excel | ✅ Implemented | Extracts all sheets with formatting |
| CSV | ✅ Implemented | Preserves tabular data |
| Text | ✅ Implemented | Direct extraction |
| Images | ✅ Implemented | Sent directly to Claude API |
| Word | ⚠️ Planned | Future release |
| PowerPoint | ⚠️ Planned | Future release |

For more details, see [SUPPORTED_DOCUMENT_TYPES.md](./SUPPORTED_DOCUMENT_TYPES.md)

## Troubleshooting

### CORS Issues with Firebase Storage

If you're experiencing CORS errors when uploading files, make sure:

1. Your Firebase Storage bucket has the correct CORS configuration (see above)
2. You're using the correct Firebase Storage bucket name in your environment variables
3. Your Firebase security rules allow the upload operation

Common error message: 
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Fix:** Follow the CORS configuration instructions above. For a quick fix during development, try restarting your dev server with `npm run dev`.

## License

This project is licensed under the MIT License.
