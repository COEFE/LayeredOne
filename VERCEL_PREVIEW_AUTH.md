# Handling Firebase Authentication with Vercel Preview Deployments

This document explains how to handle Firebase Authentication with dynamic Vercel preview deployments.

## The Challenge

Vercel generates unique URLs for each preview deployment (e.g., `project-name-git-branch-username.vercel.app`). 
Firebase Authentication requires all domains to be explicitly authorized in the Firebase Console.

This creates a conflict: 
- You can't pre-authorize Vercel preview URLs because they're dynamically generated
- Firebase rejects authentication requests from unauthorized domains

## Solutions

### Short-term solution

For each Vercel preview deployment:

1. When deploying, note the preview URL Vercel generates
2. Go to [Firebase Console](https://console.firebase.google.com/) > Select your project
3. Go to Authentication > Settings > Authorized Domains
4. Add the specific preview URL domain (e.g., `project-name-git-branch-username.vercel.app`)
5. Wait a few minutes for the changes to propagate
6. Test authentication on the preview URL

### Medium-term solution

Use a fixed custom domain for all preview deployments:

1. Configure a custom domain in Vercel (e.g., `preview.yourdomain.com`)
2. Set up the DNS records as instructed by Vercel
3. Configure Vercel to use this domain for all preview deployments
4. Add `preview.yourdomain.com` to Firebase's authorized domains list
5. All preview deployments will now use this authorized domain

### Long-term solution

Create separate Firebase projects for different environments:

1. Create separate Firebase projects for:
   - Production
   - Staging/QA
   - Development
   
2. Configure each environment with the appropriate authentication domains
   - Production: `yourapp.com`
   - Staging: `staging.yourapp.com`
   - Development: `localhost`, `dev.yourapp.com`, etc.
   
3. Use environment variables to select the correct Firebase config based on the deployment environment

## Implementation Notes

In this application, we have implemented the following approach:

1. Dynamic domain detection in `src/firebase/config.ts`:
   ```javascript
   // Dynamically set authDomain based on environment
   if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
     firebaseConfig.authDomain = window.location.hostname;
   }
   ```

2. Enhanced error messaging in `src/context/AuthContext.tsx` that:
   - Detects Vercel preview URLs
   - Provides clear error messages for unauthorized domains
   - Logs detailed troubleshooting steps in the console

3. Custom client-side navigation in authentication pages to avoid React Server Components issues:
   ```javascript
   <a 
     href="/login" 
     onClick={(e) => {
       e.preventDefault();
       window.location.href = "/login";
     }}
     className="text-blue-500 hover:text-blue-600"
   >
     Log in
   </a>
   ```

## Common Issues

### "auth/unauthorized-domain" error

This error occurs when Firebase rejects authentication from an unauthorized domain.

**Solution:** Add the domain to Firebase Console > Authentication > Settings > Authorized Domains.

### "auth/popup-blocked" error

This error occurs when the browser blocks the authentication popup.

**Solution:** Users should allow popups from your domain, or you can implement a fallback to redirect authentication.

### 404 errors after authentication

This can happen if React Server Components navigation is used with authentication.

**Solution:** Use client-side navigation with `window.location.href` instead of Next.js `<Link>` components for authentication flows.

## Best Practices

1. Always test authentication on both production and preview deployments
2. Log authentication errors clearly for users with actionable steps
3. Consider using a fixed domain strategy for preview environments
4. Keep authorized domains list up to date in Firebase Console