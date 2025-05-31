#!/bin/bash

# Start the Orchestrator API Server

echo "🚀 Starting MultiLLM Orchestrator API Server..."

# Navigate to orchestrator directory
cd orchestrator

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Start Redis if not running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "🔴 Starting Redis..."
    if command -v redis-server &> /dev/null; then
        redis-server --daemonize yes
    else
        echo "⚠️  Redis not found. Please install Redis first."
        echo "   On macOS: brew install redis && brew services start redis"
        exit 1
    fi
fi

# Start the API server
echo "🌐 Starting API server on http://localhost:8000"
python api_server.py