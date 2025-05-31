#!/bin/bash

# Start all MultiLLM System components

echo "🚀 Starting MultiLLM System..."
echo "================================"

# Start Orchestrator in background
echo "📋 Starting Orchestrator..."
./start_orchestrator.sh &
ORCHESTRATOR_PID=$!

# Wait for Orchestrator to be ready
echo "⏳ Waiting for Orchestrator to start..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Orchestrator is ready!"
        break
    fi
    sleep 1
done

# Start Workers
echo ""
echo "🤖 Starting Workers..."
./start_workers.sh &
WORKERS_PID=$!

# Wait a bit for workers to register
sleep 3

# Show status
echo ""
echo "================================"
echo "🎉 MultiLLM System Started!"
echo "================================"
echo ""
echo "📍 Orchestrator API: http://localhost:8000"
echo "📊 API Documentation: http://localhost:8000/docs"
echo ""
echo "🌐 To test the system:"
echo "   1. Open https://multillm-demo-2025.web.app"
echo "   2. Go to Chat and select 'AI (Orchestrator)' mode"
echo "   3. Send a message!"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'echo ""; echo "Stopping all services..."; kill $ORCHESTRATOR_PID $WORKERS_PID 2>/dev/null; exit' INT
wait