#!/bin/bash

# Conea MultiLLMシステム 診断スクリプト
# システムの状態を確認し、問題を特定します

echo "🔍 Conea MultiLLMシステムの診断を開始します..."
echo ""

# 1. プロセスの確認
echo "📊 実行中のプロセスを確認中..."
echo "----------------------------------------"

# Python APIサーバーの確認
if pgrep -f "api/server.py" > /dev/null; then
    echo "✅ MultiLLM APIサーバー: 実行中"
    API_PID=$(pgrep -f "api/server.py")
    echo "   PID: $API_PID"
else
    echo "❌ MultiLLM APIサーバー: 停止中"
fi

# Node.jsフロントエンドの確認
if pgrep -f "vite" > /dev/null; then
    echo "✅ フロントエンド開発サーバー: 実行中"
    VITE_PID=$(pgrep -f "vite")
    echo "   PID: $VITE_PID"
else
    echo "❌ フロントエンド開発サーバー: 停止中"
fi

echo ""

# 2. ポートの確認
echo "🔌 ポートの使用状況を確認中..."
echo "----------------------------------------"

# ポート9000（API）の確認
if lsof -i :9000 > /dev/null 2>&1; then
    echo "✅ ポート9000 (API): 使用中"
    lsof -i :9000 | grep LISTEN | head -1
else
    echo "❌ ポート9000 (API): 未使用"
fi

# ポート5173（Vite）の確認
if lsof -i :5173 > /dev/null 2>&1; then
    echo "✅ ポート5173 (フロントエンド): 使用中"
    lsof -i :5173 | grep LISTEN | head -1
else
    echo "❌ ポート5173 (フロントエンド): 未使用"
fi

echo ""

# 3. APIエンドポイントの確認
echo "🌐 APIエンドポイントの確認中..."
echo "----------------------------------------"

# APIヘルスチェック
if curl -s http://localhost:9000/health > /dev/null 2>&1; then
    echo "✅ API ヘルスチェック: 正常"
    echo "   レスポンス:"
    curl -s http://localhost:9000/health | python3 -m json.tool | head -10
else
    echo "❌ API ヘルスチェック: 失敗"
fi

echo ""

# 4. ログファイルの確認
echo "📝 最新のログを確認中..."
echo "----------------------------------------"

LOG_FILE="/Users/mourigenta/projects/conea-integration/multiLLM_system/api_server.log"
if [ -f "$LOG_FILE" ]; then
    echo "APIサーバーログ (最新10行):"
    tail -10 "$LOG_FILE"
else
    echo "⚠️ APIサーバーログファイルが見つかりません"
fi

echo ""

# 5. 環境変数の確認
echo "🔧 環境変数の確認中..."
echo "----------------------------------------"

ENV_FILE="/Users/mourigenta/projects/conea-agent-ui/.env"
if [ -f "$ENV_FILE" ]; then
    echo "フロントエンド環境変数 (API URL):"
    grep "VITE_API_URL" "$ENV_FILE"
else
    echo "⚠️ 環境変数ファイルが見つかりません"
fi

echo ""
echo "🏁 診断完了"
echo ""

# 推奨アクション
echo "💡 推奨アクション:"
echo "----------------------------------------"

if ! pgrep -f "api/server.py" > /dev/null; then
    echo "1. MultiLLM APIサーバーを起動してください:"
    echo "   ./start-multillm.sh"
fi

if ! pgrep -f "vite" > /dev/null; then
    echo "2. フロントエンド開発サーバーを起動してください:"
    echo "   cd /Users/mourigenta/projects/conea-agent-ui && npm run dev"
fi

if [ -f "$ENV_FILE" ] && ! grep -q "http://localhost:9000" "$ENV_FILE"; then
    echo "3. フロントエンドのAPI URLを修正してください:"
    echo "   VITE_API_URL=http://localhost:9000"
fi
