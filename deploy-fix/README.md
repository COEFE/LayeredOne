# Vercel Deployment Fix

This directory contains scripts and configuration to fix the Vercel deployment of the Next.js application, particularly focusing on the FUNCTION_INVOCATION_TIMEOUT errors.

## Files included:

1. `build.sh`: A script to properly set up the Next.js application structure during build.
2. `vercel.json`: A configuration file for Vercel with proper settings for the application.
3. `firebase-config.js`: Optimized Firebase configuration with caching to prevent timeouts.
4. `timeout-middleware.js`: Middleware to handle timeouts in API routes and optimize Firebase operations.
5. `example-api-route.js`: Example implementation of an optimized API route using the timeout middleware.

## How it works:

### Directory Structure Fix:
1. The build script identifies the src/app directory and creates a symbolic link to it from the root.
2. It also creates a proper next.config.js file that works with the src directory structure.
3. The vercel.json file adds proper rewrites and settings for optimal deployment.

### Timeout Prevention:
1. The firebase-config.js file provides a caching layer for Firebase operations to reduce load times.
2. The timeout-middleware.js implements a timeout wrapper for API routes to gracefully handle potential timeouts.
3. It also includes helpers to process large operations in smaller chunks to avoid long-running operations.

## Implementation Guidelines:

1. Copy the `vercel.json` to your root directory for Vercel deployments.
2. Import the optimized Firebase config in your API routes: `import { db, getDataWithCache } from '../deploy-fix/firebase-config'`
3. Wrap your API route handlers with the timeout middleware: `export default withTimeout(handler, 8000)`
4. For large data processing, use the `processInChunks` helper from the timeout-middleware.
5. For Firebase queries, use the `optimizeFirebaseQuery` helper to add limits and pagination.

These optimizations should help prevent the FUNCTION_INVOCATION_TIMEOUT errors by ensuring that operations complete within the Vercel time limits.