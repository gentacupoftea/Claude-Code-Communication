#!/bin/bash
# Script to run Shopify Sync tests in Docker environment

set -e

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Navigate to project root
cd "$PROJECT_ROOT"

# Ensure coverage directory exists
mkdir -p coverage

# Build and run tests in Docker
echo "Running Shopify Sync tests in Docker environment..."
docker-compose -f docker/test/docker-compose.test.yml up --build --abort-on-container-exit

# Check the exit code
EXIT_CODE=$?

# Clean up Docker resources
echo "Cleaning up Docker resources..."
docker-compose -f docker/test/docker-compose.test.yml down

# Display coverage report if available
if [ -f coverage/coverage.xml ]; then
    echo "Coverage report generated at coverage/coverage.xml"
    
    # Check if coverage-badge is installed
    if command -v coverage-badge &> /dev/null; then
        echo "Generating coverage badge..."
        coverage-badge -o coverage/coverage-badge.svg -f
    else
        echo "coverage-badge not found. Install with 'pip install coverage-badge' to generate badges"
    fi
fi

exit $EXIT_CODE