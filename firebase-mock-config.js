/**
 * Firebase Mock Configuration for GitHub Pages
 * 
 * This module provides mock implementations of Firebase Admin SDK
 * for static builds. This avoids the "Invalid PEM formatted message" error
 * that occurs when trying to initialize Firebase Admin SDK in a static build.
 */

// Mock class for Firestore
class MockFirestore {
  constructor() {
    this.collection = (name) => ({
      doc: (id) => ({
        get: async () => ({ exists: false, data: () => null, id: id || 'mock-id' }),
        collection: (subName) => this.collection(subName),
        update: async () => ({}),
        set: async () => ({}),
        delete: async () => ({})
      }),
      add: async () => ({ id: 'mock-id' }),
      where: () => ({
        get: async () => ({ empty: true, docs: [], forEach: () => {} })
      })
    });
  }
}

// Mock class for Auth
class MockAuth {
  constructor() {
    this.verifyIdToken = async () => ({ uid: 'mock-user-id' });
    this.getUser = async () => ({ uid: 'mock-user-id', email: 'mock@example.com' });
  }
}

// Mock class for Storage
class MockStorage {
  constructor() {
    this.bucket = () => ({
      file: () => ({
        getSignedUrl: async () => ['https://example.com/mock-url'],
        save: async () => ({}),
        delete: async () => ({}),
        exists: async () => [true],
        download: async () => [Buffer.from('mock-file-content')]
      })
    });
  }
}

// Mock Admin SDK
const admin = {
  apps: [{}], // Pretend we're already initialized
  initializeApp: () => {},
  credential: {
    cert: () => ({}),
    applicationDefault: () => ({})
  },
  firestore: () => new MockFirestore(),
  auth: () => new MockAuth(),
  storage: () => new MockStorage()
};

// Export mock implementations
const db = new MockFirestore();
const auth = new MockAuth();
const storage = new MockStorage();

// Firestore path utility
const firestorePath = {
  documentPathFromResourceName: (resourceName) => {
    if (!resourceName) return '';
    const parts = resourceName.split('/');
    return parts.filter((_, i) => i % 2 === 1).join('/');
  },
  relativeName: (projectId, resourcePath) => {
    return `projects/${projectId}/databases/(default)/documents/${resourcePath}`;
  }
};

// Field value replacement
const FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

module.exports = {
  admin,
  db,
  auth,
  storage,
  firestorePath,
  FieldValue
};