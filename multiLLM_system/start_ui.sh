#!/bin/bash

# MultiLLM UI起動スクリプト

echo "🎨 Starting MultiLLM UI..."
echo ""

# ディレクトリ移動
cd "$(dirname "$0")/ui"

# node_modulesの確認
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

echo "🚀 Starting UI on http://localhost:3500"
echo ""
echo "📌 Available routes:"
echo "   - Improved Chat: http://localhost:3500/improved-chat"
echo "   - Classic Chat:  http://localhost:3500/chat"
echo "   - Dashboard:     http://localhost:3500/"
echo ""
echo "⚠️  Note: Make sure the API server is running on port 9000"
echo "   Run ./start_server.sh in another terminal"
echo ""
echo "Press Ctrl+C to stop the UI"
echo ""

# UIを起動（ポート3500）
npm start