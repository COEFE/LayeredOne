# Dependency Issues and Solutions

## NPM CI Error

When running `npm ci`, you might encounter this error:

```
npm error code EUSAGE
npm error
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error
npm error Invalid: lock file's is-regexp@3.1.0 does not satisfy is-regexp@2.1.0
npm error Missing: react-icons@5.5.0 from lock file
npm error Invalid: lock file's tailwindcss@3.4.17 does not satisfy tailwindcss@3.3.0
npm error Invalid: lock file's lilconfig@3.1.3 does not satisfy lilconfig@2.1.0
npm error Invalid: lock file's postcss-import@15.1.0 does not satisfy postcss-import@14.1.0
npm error Invalid: lock file's postcss-load-config@4.0.2 does not satisfy postcss-load-config@3.1.4
npm error Invalid: lock file's postcss-nested@6.2.0 does not satisfy postcss-nested@6.0.0
npm error Missing: quick-lru@5.1.1 from lock file
npm error Missing: yaml@1.10.2 from lock file
```

## Solution

This project uses specific versions of dependencies that are compatible with PostCSS 7, which is required for the build process. The package versions might appear out of sync with the package-lock.json.

### Option 1: Quick Fix Script

Run the following script to fix the dependency versions:

```bash
node fix-package-json-ci.js && npm install --legacy-peer-deps
```

### Option 2: Manual Fix

If you prefer to fix the issue manually:

1. Delete the package-lock.json file:
   ```
   rm -f package-lock.json
   ```

2. Edit package.json and ensure these exact versions:
   ```json
   "is-regexp": "2.1.0",
   "react-icons": "5.5.0",
   "tailwindcss": "3.3.0",
   "lilconfig": "2.0.4", 
   "postcss-import": "12.0.1",
   "postcss-load-config": "2.1.2",
   "postcss-nested": "4.2.3",
   "quick-lru": "5.1.1",
   "yaml": "1.10.2"
   ```

3. Install dependencies with legacy peer deps flag:
   ```
   npm install --legacy-peer-deps
   ```

## CI/CD Pipeline

Our GitHub Actions workflow includes a step to fix these dependency issues automatically before building the project. The workflow:

1. Fixes the package.json dependencies to use compatible versions
2. Uses `npm install --legacy-peer-deps` to install dependencies
3. Builds the project with the necessary environment variables

## Why This Happens

This project uses a mix of newer and older dependencies, particularly:

- Using PostCSS 7.0.39 (older version) but some dependencies expect PostCSS 8+
- Using specific versions of TailwindCSS and other tools that require compatibility adjustments
- Some peer dependency conflicts between different packages

The fix ensures all dependencies are compatible with each other, especially focusing on PostCSS 7 compatibility.