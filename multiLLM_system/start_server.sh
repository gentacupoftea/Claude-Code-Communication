#!/bin/bash

# MultiLLM API Server起動スクリプト

echo "🚀 Starting MultiLLM API Server..."

# 環境変数の設定
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# 仮想環境のチェックと作成
VENV_DIR="venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv $VENV_DIR
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
fi

# 仮想環境のアクティベート
echo "🔧 Activating virtual environment..."
source $VENV_DIR/bin/activate

# Pythonバージョンの確認
echo "📦 Using Python: $(python --version)"

# 必要なパッケージのインストール
if [ ! -f "$VENV_DIR/.installed" ]; then
    echo "📦 Installing dependencies..."
    pip install --upgrade pip
    pip install uvicorn fastapi python-multipart aiohttp pydantic
    if [ $? -eq 0 ]; then
        touch "$VENV_DIR/.installed"
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi
else
    echo "✅ Dependencies already installed"
fi

# Anthropic APIキーの確認
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set. Running in demo mode."
else
    echo "✅ Anthropic API key found"
fi

# ポート設定（デフォルト: 9000）
PORT=${PORT:-9001}

# サーバー起動
echo "📡 Starting server on http://localhost:$PORT"
echo "🌐 Access the improved chat at: http://localhost:3500/improved-chat"
echo ""
echo "⚠️  Note: UI runs on port 3500 (port 3000 is reserved for OpenMemory)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python -m uvicorn api.server:app --host 0.0.0.0 --port $PORT --reload --log-level info

# エラーチェック
if [ $? -ne 0 ]; then
    echo "❌ Failed to start server"
    exit 1
fi