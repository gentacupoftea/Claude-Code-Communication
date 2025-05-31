#!/bin/bash

# Start MultiLLM Workers

echo "🚀 Starting MultiLLM Workers..."

# Navigate to workers directory
cd workers

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

# Check for API keys
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. OpenAI worker will not start."
else
    echo "✅ OpenAI API key found"
    # Start OpenAI worker in background
    echo "🤖 Starting OpenAI Worker..."
    python openai_worker.py &
    OPENAI_PID=$!
    echo "   PID: $OPENAI_PID"
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set. Claude worker will not start."
else
    echo "✅ Anthropic API key found"
    # Start Claude worker in background
    echo "🤖 Starting Claude Worker..."
    python claude_worker.py &
    CLAUDE_PID=$!
    echo "   PID: $CLAUDE_PID"
fi

echo ""
echo "✅ Workers started!"
echo "Press Ctrl+C to stop all workers"

# Wait for interrupt
trap 'echo "Stopping workers..."; kill $OPENAI_PID $CLAUDE_PID 2>/dev/null; exit' INT
wait