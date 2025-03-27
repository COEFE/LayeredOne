#!/bin/bash

# Script to run the storage reference migration

echo "Starting storage reference migration..."
echo "This script will update all documents in Firestore to ensure they have proper storageRef fields."
echo ""

# Check if a specific firebase project ID is provided
if [ -n "$1" ]; then
  echo "Using Firebase project: $1"
  export FIREBASE_PROJECT_ID=$1
else
  echo "No project specified. Using default Firebase project."
fi

# Check if the service account file exists
SERVICE_ACCOUNT_PATH="./firebase-service-account.json"
if [ ! -f "$SERVICE_ACCOUNT_PATH" ]; then
  echo "Error: Firebase service account file not found at $SERVICE_ACCOUNT_PATH"
  echo "Please download your service account key and save it as $SERVICE_ACCOUNT_PATH"
  exit 1
fi

# Set the service account key environment variable
export FIREBASE_SERVICE_ACCOUNT_KEY=$(cat "$SERVICE_ACCOUNT_PATH")

# Run the migration script
echo "Running migration..."
node src/utils/fix-storage-refs.js

echo ""
echo "Migration complete!"