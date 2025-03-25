#!/bin/bash

# Script to run the Excel editing functionality with Claude 3.7
# This script performs necessary environment setup and launches the application
# with Excel editing features enabled

echo "🧮 Excel Editing with Claude 3.7 Setup Script"
echo "============================================="

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "⚠️  Warning: .env.local file not found. Creating a template..."
  cat > .env.local << EOF
# Claude API Key
ANTHROPIC_API_KEY=your_claude_api_key_here

# Brave Search API Key (optional, enhances context for Excel editing)
BRAVE_API_KEY=your_brave_api_key_here

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_AUTH_DOMAIN=your_auth_domain_here
FIREBASE_PROJECT_ID=your_project_id_here
FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
FIREBASE_APP_ID=your_app_id_here
EOF

  echo "✅ Created .env.local template. Please edit it with your actual API keys and credentials."
  exit 1
fi

# Check if Claude API key is set
if ! grep -q "ANTHROPIC_API_KEY=" .env.local || grep -q "ANTHROPIC_API_KEY=your_claude_api_key_here" .env.local; then
  echo "❌ Claude API key not configured. Please set ANTHROPIC_API_KEY in .env.local"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Build the application
echo "🏗️  Building the application with Excel editing support..."
npm run build

# Start the application
echo "🚀 Starting the application with Excel editing enabled..."
echo "🧮 Spreadsheet files will automatically use Claude 3.7 for enhanced editing"
npm run start

# If the script gets here, the application has been stopped
echo "👋 Application terminated. Thanks for using Excel Editing with Claude 3.7!"