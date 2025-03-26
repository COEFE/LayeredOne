# Vercel Deployment Fix

This directory contains scripts and configuration to fix the Vercel deployment of the Next.js application.

## Files included:

1. `build.sh`: A script to properly set up the Next.js application structure during build.
2. `vercel.json`: A configuration file for Vercel with proper settings for the application.

## How it works:

1. The build script identifies the src/app directory and creates a symbolic link to it from the root.
2. It also creates a proper next.config.js file that works with the src directory structure.
3. The vercel.json file adds proper rewrites and settings for optimal deployment.