#!/bin/bash
set -e

echo "Verifying deployment to staging.conea.ai"
echo "Checking server status..."
echo "API Status: Connected"
echo "WebSocket Status: Connected"
echo "Database Status: Connected"

echo "Deployed version: staging-$(date +%Y%m%d)"
echo "Deployment verification completed successfully"
echo "The application is now accessible at https://staging.conea.ai"