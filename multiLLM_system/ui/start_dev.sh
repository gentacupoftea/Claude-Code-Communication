#!/bin/bash

# UI開発サーバー起動スクリプト

echo "🎨 Starting MultiLLM UI on port 3500..."
echo ""

# ポートの確認
if lsof -Pi :3500 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3500 is already in use!"
    echo "Running process:"
    lsof -i :3500
    echo ""
    echo "Try a different port or stop the existing process."
    exit 1
fi

# 環境変数の設定
export PORT=3500
export BROWSER=none  # ブラウザを自動で開かない

# 依存関係の確認
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🚀 Starting development server..."
echo ""
echo "📌 URLs:"
echo "   - Improved Chat: http://localhost:3500/improved-chat"
echo "   - Dashboard: http://localhost:3500/"
echo ""

# 開発サーバーを起動
npm start