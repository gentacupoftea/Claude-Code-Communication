#!/bin/bash
# Start Google Analytics MCP Server

set -e

echo "🚀 Starting Google Analytics MCP Server..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "Please copy .env.example to .env and configure your settings"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
if [ -z "$GA_CREDENTIALS_PATH" ]; then
    echo "❌ GA_CREDENTIALS_PATH not set in .env"
    exit 1
fi

if [ -z "$GA_PROPERTY_ID" ]; then
    echo "❌ GA_PROPERTY_ID not set in .env"
    exit 1
fi

# Check if Redis is running
if ! nc -z localhost 6379 2>/dev/null; then
    echo "📦 Starting Redis..."
    docker-compose -f docker-compose.ga.yml up -d redis
    echo "⏰ Waiting for Redis to start..."
    sleep 5
fi

# Install dependencies if needed
if ! python -c "import google.analytics.data" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements-ga.txt
fi

# Run verification
echo "🔍 Verifying GA integration..."
python verify_ga_integration.py

if [ $? -ne 0 ]; then
    echo "❌ GA integration verification failed"
    exit 1
fi

# Start the server
echo "🚀 Starting GA server on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo "Press Ctrl+C to stop"
echo ""

uvicorn src.google_analytics.main:app --host 0.0.0.0 --port 8000 --reload