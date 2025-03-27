#!/bin/bash

# Script to configure CORS settings for Firebase Storage
# This sets up proper CORS headers to allow cross-origin requests to your bucket

echo "Configuring CORS settings for Firebase Storage..."

# Check if gsutil is available
if ! command -v gsutil &> /dev/null; then
  echo "Error: gsutil not found. Please install Google Cloud SDK."
  echo "Visit: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Check if the user is logged in
if ! gsutil ls &> /dev/null; then
  echo "You need to log in to Google Cloud first."
  echo "Run: gcloud auth login"
  exit 1
fi

# Get the bucket name
if [ -z "$1" ]; then
  # Try to get from firebase config
  if [ -f "firebase.json" ]; then
    BUCKET=$(grep -o '"storageBucket": "[^"]*' firebase.json | cut -d'"' -f4)
  fi

  if [ -z "$BUCKET" ]; then
    read -p "Enter your Firebase Storage bucket name (e.g., your-project-id.appspot.com): " BUCKET
  else
    echo "Found bucket in firebase.json: $BUCKET"
    read -p "Use this bucket? [Y/n]: " USE_FOUND
    if [[ $USE_FOUND =~ ^[Nn]$ ]]; then
      read -p "Enter your Firebase Storage bucket name: " BUCKET
    fi
  fi
else
  BUCKET=$1
fi

# Ensure bucket has gs:// prefix
if [[ $BUCKET != gs://* ]]; then
  BUCKET="gs://$BUCKET"
fi

echo "Setting CORS configuration for bucket: $BUCKET"
echo "This will allow cross-origin requests from any domain."

# Apply CORS configuration
gsutil cors set cors.json $BUCKET

if [ $? -eq 0 ]; then
  echo "CORS configuration applied successfully!"
  echo "Your Firebase Storage bucket now allows cross-origin requests."
  echo "This should fix issues with loading Excel files in the document viewer."
else
  echo "Failed to apply CORS configuration."
  echo "Please check your permissions and bucket name."
fi