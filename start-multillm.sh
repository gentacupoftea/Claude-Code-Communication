#!/bin/bash

# Conea MultiLLMシステム起動スクリプト
# このスクリプトはMultiLLM APIサーバーとフロントエンドを起動します

echo "🚀 Conea MultiLLMシステムを起動します..."

# 現在のディレクトリを保存
ORIGINAL_DIR=$(pwd)

# 1. MultiLLM APIサーバーの起動
echo "📡 MultiLLM APIサーバーを起動中..."
cd /Users/mourigenta/projects/conea-integration/multiLLM_system

# Python仮想環境の確認と作成
if [ ! -d "venv" ]; then
    echo "🔧 Python仮想環境を作成中..."
    python3 -m venv venv
fi

# 仮想環境の有効化
source venv/bin/activate

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
pip install -r requirements.txt 2>/dev/null || echo "⚠️ 一部の依存関係がインストールできませんでした"

# APIサーバーの起動（バックグラウンド）
echo "🌐 APIサーバーをポート9000で起動中..."
nohup python api/server.py > api_server.log 2>&1 &
API_PID=$!
echo "✅ APIサーバーが起動しました (PID: $API_PID)"

# 2. フロントエンドの環境変数を更新
echo "🔧 フロントエンドの環境変数を更新中..."
cd /Users/mourigenta/projects/conea-agent-ui

# 環境変数ファイルのバックアップ
cp .env .env.backup

# API URLを正しいものに更新
cat > .env.local << EOL
# Conea Agent UI v2 環境設定
VITE_API_URL=http://localhost:9000

# LLM API Keys (既存のものを使用)
VITE_CLAUDE_API_KEY=${VITE_CLAUDE_API_KEY}
VITE_GEMINI_API_KEY=${VITE_GEMINI_API_KEY}
VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}

# MCP WebSocket
VITE_MCP_WEBSOCKET_URL=wss://mcp.conea.ai

# 開発設定
VITE_DEV_MODE=true
VITE_LOG_LEVEL=debug
EOL

# 3. フロントエンドの起動
echo "🎨 フロントエンドを起動中..."
npm install
npm run dev &
FRONTEND_PID=$!

# 4. 起動状態の確認
sleep 5
echo ""
echo "✅ Conea MultiLLMシステムが起動しました！"
echo ""
echo "📍 アクセスURL:"
echo "   フロントエンド: http://localhost:5173"
echo "   API サーバー: http://localhost:9000"
echo "   API ドキュメント: http://localhost:9000/docs"
echo ""
echo "🛑 終了するには以下のコマンドを実行してください:"
echo "   kill $API_PID $FRONTEND_PID"
echo ""
echo "📝 ログファイル:"
echo "   API サーバー: /Users/mourigenta/projects/conea-integration/multiLLM_system/api_server.log"
echo ""

# 元のディレクトリに戻る
cd $ORIGINAL_DIR
