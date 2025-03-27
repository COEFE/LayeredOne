# Vercel Deployment Troubleshooting Guide

## Creating a New Vercel Project

If you're experiencing persistent deployment issues with Vercel, follow these steps to create a new Vercel project:

1. Go to the [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository (LayeredOne)
4. Configure the following settings:
   - Framework Preset: **Next.js**
   - Build Command: `SIMPLE_PDF=true npm run build`
   - Output Directory: `.next`
   - Environment Variables:
     - `NEXT_PUBLIC_VERCEL_DEPLOYMENT`: `true`
     - `NODE_ENV`: `production`

5. Click "Deploy"

## Current Troubleshooting Approach

The application employs several strategies to ensure compatibility with Vercel's serverless environment:

1. **Dependency Management**:
   - The `scripts/vercel-deploy.js` script automatically removes problematic dependencies during build:
     - PDF-related libraries (`react-pdf`, `pdfjs-dist`, `@react-pdf/renderer`)
     - UI component libraries with compilation issues (`react-icons`)

2. **PDF Viewer Implementation**:
   - Uses an ultra-minimal HTML5-based PDF viewer on Vercel deployments
   - No external dependencies, just relies on browser's built-in PDF rendering capabilities
   - Falls back to download link if viewing fails

3. **Environment Detection**:
   - Uses `NEXT_PUBLIC_VERCEL_DEPLOYMENT` environment variable to conditionally load components
   - Different component implementations for different environments (Vercel vs. non-Vercel)

4. **Build Configuration**:
   - Uses `SIMPLE_PDF=true` flag to trigger simplified builds
   - Externalized problematic packages in webpack configuration
   - Disabled ESLint and TypeScript checking during build to bypass non-critical errors

## Authentication in Vercel Preview Deployments

When using Vercel preview deployments, you need to configure Firebase Authentication to allow the Vercel preview URLs:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Authentication → Settings → Authorized Domains
3. Add your Vercel preview URLs (e.g., `layered-one-git-main-your-username.vercel.app`)

Without this configuration, Firebase Authentication will block sign-in attempts from preview deployments.

## Additional Troubleshooting

If you continue to experience issues:

- Check the Vercel build logs for specific error messages
- Test locally with `SIMPLE_PDF=true npm run build` to simulate Vercel build
- Consider creating a minimal reproduction of the issue in a separate repository
- Review Vercel's [Troubleshooting Guide](https://vercel.com/docs/concepts/deployments/troubleshooting) for common issues

## Contact Support

If you've tried the steps above and still encounter issues, please:

1. Gather the complete build logs from Vercel
2. Note any error messages or warnings
3. Document the steps you've taken to troubleshoot
4. File an issue in the GitHub repository or contact Vercel support