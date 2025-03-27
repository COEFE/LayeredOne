# Production Firebase Fix

This document outlines the solution for Firebase Admin SDK issues in production environments.

## Problem

In production builds, the application encounters errors with Firebase Admin SDK:

```
Error getting Firebase services, using mocks: Error: Cannot find module '@google-cloud/firestore'
Error: Cannot find module '@google-cloud/firestore/build/src/path'
```

This occurs because:
1. The application is creating mock implementations when it should use real services in production
2. The module path resolution fails during build time
3. Some critical sub-dependencies are missing

## Solution

For production environments, we've implemented several fixes:

### 1. Created Real Firebase Configuration

We created a dedicated production configuration file (`admin-config-production.ts`) that does not use mocks at all and properly imports all dependencies.

### 2. Fixed Module Path Resolution

We updated Next.js webpack configuration to properly resolve the missing path module by:
- Adding a webpack alias for `@google-cloud/firestore/build/src/path`
- Creating a local implementation of the path utilities
- Ensuring these modules are marked as external packages

### 3. Added Missing Dependencies

We identified and added critical sub-dependencies:
- `is-set`
- `is-regexp`
- Properly importing `@google-cloud/firestore` and `@google-cloud/storage`

### 4. Production Build Script

We created a new `production-build.sh` script that:
- Installs all required Firebase dependencies
- Creates any missing module files directly in node_modules
- Sets the proper environment variables for production
- Supports different build targets (Vercel, GitHub Pages)

## How to Use

Instead of using the regular build commands, use:

```bash
# For default production build
./production-build.sh

# For Vercel deployment
./production-build.sh vercel

# For GitHub Pages deployment
./production-build.sh github
```

This will ensure:
- No mock implementations are used in production
- All Firebase Admin SDK features work properly
- The build completes without module resolution errors

## Important Notes

1. This fix ensures real Firebase services are used in production, not mocks
2. Mock implementations are only used in development for testing
3. The path module issue is resolved by creating the file structure directly in node_modules
4. Environment variables ensure the correct configuration is loaded