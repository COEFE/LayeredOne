#!/bin/bash

# Build the Next.js app
echo "🏗️ Building Next.js app..."
npm run build

# Copy necessary files to the output directory
echo "📋 Copying additional files to output directory..."
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

# Deploy to Firebase
echo "🚀 Deploying to Firebase..."
firebase deploy

echo "✅ Deployment complete!"