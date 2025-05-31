#!/bin/bash

# Test local chat with Orchestrator

echo "🧪 Testing MultiLLM Chat Locally..."

# Check if Orchestrator is running
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "❌ Orchestrator is not running!"
    echo "Please run ./start_orchestrator.sh first"
    exit 1
fi

echo "✅ Orchestrator is running"

# Test chat endpoint
echo "📝 Sending test message..."
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, can you help me write a simple Python function?",
    "context": {
      "projectId": "test-project",
      "taskId": "test-task"
    },
    "user_id": "test-user",
    "include_thinking": true
  }'

echo -e "\n\n✅ Test complete!"