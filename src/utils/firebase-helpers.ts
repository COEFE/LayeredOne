import { collection, setDoc, getDoc, updateDoc, doc, addDoc, DocumentReference, DocumentData } from 'firebase/firestore';
import { db } from '@/firebase/config';

/**
 * Retries a Firebase operation with exponential backoff
 * @param operation The Firebase operation to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in ms
 * @returns Result of the operation
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 300
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        // Calculate delay with exponential backoff and jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Adds a document to Firestore with retry logic
 * @param collectionPath Path to the collection
 * @param data Data to add
 * @returns DocumentReference
 */
export async function addDocumentWithRetry(
  collectionPath: string,
  data: DocumentData
): Promise<DocumentReference<DocumentData>> {
  return retryOperation(async () => {
    // Parse collection path
    const collectionRef = collection(db, collectionPath);
    return await addDoc(collectionRef, data);
  });
}

/**
 * Updates a document in Firestore with retry logic
 * @param documentPath Path to the document
 * @param data Data to update
 * @returns void
 */
export async function updateDocumentWithRetry(
  documentPath: string,
  data: Partial<DocumentData>
): Promise<void> {
  return retryOperation(async () => {
    const docRef = doc(db, documentPath);
    await updateDoc(docRef, data);
  });
}

/**
 * Gets a document from Firestore with retry logic
 * @param documentPath Path to the document
 * @returns DocumentSnapshot
 */
export async function getDocumentWithRetry(documentPath: string) {
  return retryOperation(async () => {
    const docRef = doc(db, documentPath);
    return await getDoc(docRef);
  });
}

/**
 * Sets a document in Firestore with retry logic
 * @param documentPath Path to the document
 * @param data Data to set
 * @returns void
 */
export async function setDocumentWithRetry(
  documentPath: string,
  data: DocumentData
): Promise<void> {
  return retryOperation(async () => {
    const docRef = doc(db, documentPath);
    await setDoc(docRef, data);
  });
}