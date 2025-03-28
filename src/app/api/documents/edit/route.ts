import { NextRequest, NextResponse } from 'next/server';
import { auth, db, storage } from '@/firebase/admin-config';
import { editExcelFile, analyzeEditRequest, processClaudeResponse } from '@/utils/excelEditor';

export const dynamic = 'force-static';

// Define FieldValue with serverTimestamp for compatibility
const FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

// Function to get Firestore database instance
const getFirestore = () => {
  try {
    return db;
  } catch (error) {
    console.error('Error getting Firestore database:', error);
    return {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({ exists: false, data: () => null, id }),
          collection: () => ({ add: async () => ({ id: 'mock-id' }) }),
          update: async () => ({}),
          set: async () => ({})
        }),
        add: async () => ({ id: 'mock-id' })
      })
    };
  }
};

// Function to get Storage instance
const getStorage = () => {
  try {
    return storage;
  } catch (error) {
    console.error('Error getting Storage:', error);
    return {
      bucket: () => ({
        file: () => ({
          getSignedUrl: async () => ['https://example.com/mock-url'],
          exists: async () => [true],
          download: async () => [Buffer.from('mock file content')],
          save: async () => ({})
        })
      })
    };
  }
};

// Debug flag
const DEBUG = process.env.NODE_ENV === 'development' || true;

/**
 * API endpoint to edit Excel documents based on natural language instructions
 */
export const maxDuration = 60; // Set max duration to 60 seconds for Vercel Edge functions

export async function POST(request: NextRequest) {
  try {
    console.log('Document Edit API route called');

    // Verify authentication token
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      console.log('Missing auth token');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    
    let userId: string;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('Authenticated user:', userId);
    } catch (error: any) {
      console.error('Invalid auth token:', error);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { documentId, editInstructions, claudeResponse } = body;

    if (!documentId || (!editInstructions && !claudeResponse)) {
      return NextResponse.json({ 
        error: "Missing required parameters: documentId and either editInstructions or claudeResponse are required" 
      }, { status: 400 });
    }
    
    console.log("Edit instructions or Claude response received:", editInstructions || claudeResponse);

    // Get document data from Firestore
    const firestore = getFirestore();
    const documentRef = firestore.collection('documents').doc(documentId);
    const documentSnapshot = await documentRef.get();

    if (!documentSnapshot.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const documentData = documentSnapshot.data();

    // Check if the user has access to this document
    if (documentData?.userId !== userId) {
      return NextResponse.json({ error: "You don't have permission to access this document" }, { status: 403 });
    }

    // Check if the document is an Excel/spreadsheet file
    const fileName = documentData.name || '';
    const contentType = documentData.type || documentData.contentType || 'application/octet-stream';
    const fileUrl = documentData.url || '';
    
    const isSpreadsheet = 
      contentType.includes('spreadsheet') || 
      contentType.includes('excel') || 
      fileName.endsWith('.xlsx') || 
      fileName.endsWith('.xls') ||
      contentType.includes('sheet');
    
    if (!isSpreadsheet) {
      return NextResponse.json({ 
        error: "Document is not a supported spreadsheet file. Only Excel files (.xlsx, .xls) are supported for editing." 
      }, { status: 400 });
    }
    
    if (!fileUrl) {
      return NextResponse.json({ error: "Document URL not found" }, { status: 404 });
    }

    // Analyze the edit instructions
    let editPlan;
    
    // Check if we have a Claude response to process
    if (claudeResponse) {
      console.log("Processing Claude response for edit instructions");
      const edits = processClaudeResponse(claudeResponse);
      
      if (edits && edits.length > 0) {
        editPlan = {
          description: `Update ${edits.length} cell(s) based on Claude's recommendations`,
          edits: edits
        };
        console.log("Successfully extracted edit plan from Claude response:", JSON.stringify(editPlan));
      } else {
        console.log("No edit instructions found in Claude response");
      }
    }
    
    // If no edits found in Claude response, try the direct editInstructions
    if (!editPlan && editInstructions) {
      // Check if editInstructions is a pre-analyzed plan in JSON string format
      try {
        if (typeof editInstructions === 'string' && editInstructions.startsWith('{') && editInstructions.includes('edits')) {
          console.log("Parsing pre-analyzed edit plan");
          const parsedPlan = JSON.parse(editInstructions);
          
          // Ensure the parsed plan has the correct format
          if (parsedPlan && parsedPlan.edits && Array.isArray(parsedPlan.edits)) {
            editPlan = parsedPlan;
            console.log("Successfully parsed edit plan:", JSON.stringify(editPlan));
          } else {
            console.log("Parsed JSON doesn't have expected format, trying to analyze as text");
            editPlan = analyzeEditRequest(editInstructions);
          }
        } else {
          console.log("Analyzing edit instructions as natural language");
          editPlan = analyzeEditRequest(editInstructions);
        }
      } catch (error) {
        console.log("Failed to parse as JSON, trying to analyze as text instruction:", error);
        editPlan = analyzeEditRequest(editInstructions);
      }
    }
    
    if (!editPlan) {
      return NextResponse.json({ 
        error: "Could not parse edit instructions. Please provide clear instructions like 'Update cell A1 to 100' or 'Change cell B5 to Sales Report'." 
      }, { status: 400 });
    }
    
    console.log("Edit plan:", JSON.stringify(editPlan));

    // Download the file from Firebase Storage
    const storage = getStorage();
    const bucket = storage.bucket();
    
    // Extract the file path from the URL
    const fileUrlObj = new URL(fileUrl);
    const filePath = decodeURIComponent(fileUrlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
    
    if (!filePath) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }

    console.log(`Downloading file from: ${filePath}`);
    const fileRef = bucket.file(filePath);
    const [fileExists] = await fileRef.exists();
    
    if (!fileExists) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    // Download the file
    const [fileBuffer] = await fileRef.download();
    console.log(`Downloaded file: ${fileName}, size: ${fileBuffer.length} bytes`);

    // Apply the edits to the Excel file
    console.log(`Applying edits: ${JSON.stringify(editPlan)}`);
    const modifiedBuffer = await editExcelFile(fileBuffer, editPlan.edits);

    // Upload the modified file back to Firebase Storage
    const newFilename = `edited_${Date.now()}_${fileName}`;
    const newFilePath = `${filePath.substring(0, filePath.lastIndexOf('/') + 1)}${newFilename}`;
    
    console.log(`Uploading modified file to: ${newFilePath}, buffer size: ${modifiedBuffer.length} bytes`);
    
    // Verify the buffer is valid
    if (!modifiedBuffer || modifiedBuffer.length === 0) {
      throw new Error('Invalid modified buffer: Buffer is empty or undefined');
    }
    
    // Ensure buffer is properly converted to a Buffer type
    const finalBuffer = Buffer.isBuffer(modifiedBuffer) ? modifiedBuffer : Buffer.from(modifiedBuffer);
    console.log(`Final buffer prepared with size: ${finalBuffer.length} bytes, isBuffer: ${Buffer.isBuffer(finalBuffer)}`);
    
    const newFileRef = bucket.file(newFilePath);
    
    try {
      console.log('Starting upload to Firebase Storage...');
      await newFileRef.save(finalBuffer, {
        metadata: {
          contentType: documentData.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        resumable: false // Use non-resumable upload for smaller files for simplicity
      });
      console.log('Upload to Firebase Storage completed successfully');
    } catch (uploadError) {
      console.error('Error uploading to Firebase Storage:', uploadError);
      throw new Error(`Failed to upload modified file: ${uploadError.message}`);
    }

    // Generate a signed URL for the new file
    const [signedUrl] = await newFileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // URL valid for 1 week
    });

    // Create a new document entry for the edited file
    const newDocumentRef = firestore.collection('documents').doc();
    
    await newDocumentRef.set({
      name: newFilename,
      type: documentData.type,
      size: modifiedBuffer.length,
      url: signedUrl,
      userId: userId,
      folderId: documentData.folderId || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processed: false,
      processingComplete: false,
      parentDocumentId: documentId,
      editDescription: editPlan.description
    });

    console.log(`Created new document: ${newDocumentRef.id}`);

    // Return success with the new document information
    return NextResponse.json({
      success: true,
      message: `Successfully applied edit: ${editPlan.description}`,
      originalDocumentId: documentId,
      newDocumentId: newDocumentRef.id,
      newDocumentUrl: signedUrl
    });

  } catch (error: any) {
    console.error("Error editing document:", error);
    return NextResponse.json(
      { error: `Error editing document: ${error.message}` },
      { status: 500 }
    );
  }
}