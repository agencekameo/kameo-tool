#!/bin/bash
# Script to redeploy with middleware once Vercel incident is resolved
# Run: bash scripts/redeploy-with-middleware.sh

echo "Deploying kameo-tool with middleware to Vercel production..."
echo ""

npx vercel --prod --yes 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo "Deployment with middleware SUCCEEDED!"
  echo "Auth protection is now fully active."
else
  echo ""
  echo "Deployment FAILED - Vercel incident may still be active."
  echo "Check https://www.vercel-status.com/ for updates."
  echo "Retry later with: bash scripts/redeploy-with-middleware.sh"
fi
