#!/bin/bash

echo "🔍 Checking what's running on port 8000..."
echo ""

# lsofで確認
if command -v lsof &> /dev/null; then
    echo "Using lsof:"
    lsof -i :8000 | grep LISTEN
    echo ""
fi

# psで確認
echo "Python processes that might be using port 8000:"
ps aux | grep -E "python.*8000|uvicorn.*8000|server.*8000" | grep -v grep | head -5

echo ""
echo "💡 Port 8000 appears to be used by another service."
echo "   The MultiLLM API Server will run on port 9000 instead."
echo ""
echo "To start the MultiLLM server on port 9000, run:"
echo "  ./start_server.sh"
echo ""
echo "Or to use a different port:"
echo "  PORT=8001 ./start_server.sh"