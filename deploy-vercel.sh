#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}=== Vercel Manual Deployment Tool ===${NC}"
echo -e "${YELLOW}=====================================${NC}"
echo ""

# Check if deploy hook URL is set
if [ -z "$1" ]; then
  echo -e "${RED}Error: No deploy hook URL provided${NC}"
  echo "Usage: ./deploy-vercel.sh <DEPLOY_HOOK_URL>"
  echo ""
  echo "To get a deploy hook URL:"
  echo "1. Go to your Vercel project settings"
  echo "2. Navigate to 'Git Integration' > 'Deploy Hooks'"
  echo "3. Create a new deploy hook and copy the URL"
  exit 1
fi

DEPLOY_HOOK_URL=$1

echo -e "${GREEN}Pushing latest changes to GitHub...${NC}"
git push origin main

echo -e "${GREEN}Triggering Vercel deployment using deploy hook...${NC}"
curl -X POST "$DEPLOY_HOOK_URL"

echo ""
echo -e "${GREEN}Deployment triggered! Check your Vercel dashboard for status.${NC}"
echo -e "${GREEN}https://vercel.com/dashboard${NC}"