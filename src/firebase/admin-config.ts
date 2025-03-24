import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin SDK only if not already initialized
if (!admin.apps.length) {
  try {
    // Initialize with hard-coded values for Next.js compatibility
    // This avoids the "Critical dependency: the request of a dependency is an expression" error
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "variance-test-4b441",
        clientEmail: "firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com",
        // Replace any newlines in the private key, as environment variables don't preserve them
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCe/m4WApen/M1n\noOwnO1ajvbdJ3mg4nOPtGFg0OUsnc3CrHDVXObIEaNeYHuxOUFgRLbOx8+xcrmRB\nGVoJL367YgIzcaXEVlvFCQ4WrVZDyESWHCjTOafFpAcjM2GgEEiCHRauDSiqwBXo\niyzH/aMKG7zu6xJpRNm2HDlPF9lo6PPC+DGtfV5n4lDWmOQIpghAI4dDbabfLLmL\nuNzk2Ddahx5xcWFiJ/ikLRpnnpbPB1o7EbV0wyKPumCBi8/D5oJQIQ0tl7LuyKAj\nsQ4U4ofxheCE5pq64GEh9SBmCUbnh5mPyS1tItOXw0kNKp66DXvABsBNzIfsa+dr\nnIEgqlE7AgMBAAECggEATo6N3Agp4JGS97nWFMhH1Z1+O1xNiHNUVqhppFwOmw55\nw8GrRU63e2BF7d6RiVw/NzWqjKllxqFP3a5mAxXZe0JAriRf8DNvIlqIAIJilhkU\nckq1jS/2ijuyXx0bBlglS0yOES9lQYCpEn35gVL7xJnR7wZs0WB4ZXdqhX7WJ/Py\nODZykBeJ4qsXcbJO7E58vRQoLj3yYu5wEsoVYriHLiNXfVxAEd3rlZ0UeLjGee9z\nr55TuRv7AhxF63geeXp2uLRt5e6wRyDMsdCFwhwQKJXfnW1NjLr1lhRuvtUANdrB\nfQbPyHklJPAYNUZBax0UvhqTheWJDTHpUHhBpEjbgQKBgQDSnSQpFoQd/MThnUdu\nAzSZ0WEXE1cNWsBf0T64NlJpySo4KOAtyythSjIuytiBmHLndS0JPaWV42bkIFEG\nWlLTdyCaY5MPVtbUCPBJZZeUB3eo44S46Mp0uxxaMGC3wLR2ke2aHTlvQa+yaE4W\ng8ad+t6wlS1jC9WUUsxqIE4f+wKBgQDBQZahY+CP0MDG2q/YJOGpqrft5VxpVPtD\nz8IsG10MjHL/2HK8nw8EJ+AaXINM54mcxLkb0attZZUIf2Hfs8Yi/dF1g4hbahT6\n1MzWBnTYCHYVQt5KAQLH5GJKVJaUtevZBKN6FQ+aohLiOKBc6J0OppL1queN6K7g\nTv7D5gWPwQKBgCrki+++QSvmRaZ5JIn4JydIaBCOBMWYfONGtxJHJeObb3i+gmFx\nJiWLOcsjzpIeHRCcYY6nOmjbRiIhnr6/eGzOrxoiO1n9YoUOSPl5sjQYjTsdEvOh\nnVHGpZCMl7X0jgwzzgL7/q104DZiXbziG3ojFGU8DGFGkLnDXxQh/icvAoGAPWKp\nBxCjlur3IPL74gstBuisTcuKBAczXMHUapAyiTbfnHbTUyiu62IDJDx4lGgDZSFz\nrut1qWUX5sAXhagj6p929f3WxTq3+Ui4287nNGvTnkNEOnuBt57KvdOKlSgIB0Ia\n7z9bWoHav7K+9WQJ50pv6crkjEX5rlRJRk59O8ECgYEAuipnpFp3k05ZUl1W8bVd\nkPzrL9/rxFviaapUi8ZwE4CPEEopXRO6nJSen6QjKkxM3uRBybTa1u1cc2e4AMBV\nyIbP4SVlkIAOoR0jk4e9skCgN0JWjqt36kbbM9GWAAz97Gw25vqxtPFCj0EUahVo\nT78NlclGYfEsc1Qvj/fc7Ws=\n-----END PRIVATE KEY-----\n"
      }),
      projectId: "variance-test-4b441",
      storageBucket: "variance-test-4b441.firebasestorage.app"
    });
    
    console.log('Firebase Admin SDK initialized with hardcoded credentials');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    
    // Last resort fallback 
    if (!admin.apps.length) {
      try {
        console.log('Attempting fallback initialization');
        
        admin.initializeApp({
          projectId: 'variance-test-4b441',
          storageBucket: 'variance-test-4b441.firebasestorage.app'
        });
        
        console.log('Firebase Admin SDK initialized with fallback config (limited functionality)');
      } catch (fallbackError) {
        console.error('Failed to initialize Admin SDK even with fallback:', fallbackError);
        // Just continue - we'll handle errors at the point of use
      }
    }
  }
}

// Export the initialized instances
export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export const adminDb = db;
export const adminAuth = auth;
export const adminStorage = storage;
export { admin };