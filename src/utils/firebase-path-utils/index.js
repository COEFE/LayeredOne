/**
 * Firestore path utilities - CommonJS version for webpack
 */
module.exports = {
  documentPathFromResourceName: (resourceName) => {
    if (!resourceName) return '';
    const parts = resourceName.split('/');
    return parts.filter((_, i) => i % 2 === 1).join('/');
  },
  relativeName: (projectId, resourcePath) => {
    return `projects/${projectId}/databases/(default)/documents/${resourcePath}`;
  },
  databaseRootPath: (projectId) => {
    return `projects/${projectId}/databases/(default)`;
  },
  isDocumentPath: (path) => {
    return path && path.split('/').length % 2 === 0;
  },
  isCollectionPath: (path) => {
    return path && path.split('/').length % 2 === 1;
  }
};