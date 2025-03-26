/**
 * Firebase Cloud Functions Client
 * 
 * This file provides client-side utilities for interacting with Firebase Cloud Functions
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

// Get the Firebase Functions instance
const functions = getFunctions(app);

/**
 * Process Excel edits using the Firebase Cloud Function
 * 
 * This function will call the processExcelEdits Cloud Function with the specified edit instructions
 * 
 * @param documentId The ID of the document to edit
 * @param editInstructions The edit instructions (either a natural language string or a JSON object)
 * @returns The result from the Cloud Function
 */
export async function processExcelEditsWithCloudFunction(documentId: string, editInstructions: string | object) {
  try {
    console.log('Calling Excel edit Cloud Function with:', { documentId, editInstructions });
    
    // Get a reference to the Cloud Function
    const processExcelEditsFunction = httpsCallable(functions, 'processExcelEdits');
    
    // Call the function with the document ID and edit instructions
    const result = await processExcelEditsFunction({
      documentId,
      editInstructions
    });
    
    console.log('Cloud Function result:', result.data);
    return result.data;
  } catch (error) {
    console.error('Error calling Excel edit Cloud Function:', error);
    throw error;
  }
}