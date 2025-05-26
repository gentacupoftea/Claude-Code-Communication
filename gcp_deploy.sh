#!/bin/bash

# Google Cloud認証後のデプロイスクリプト
set -e

echo "🚀 Google Cloud認証後のデプロイを開始します"

# 認証確認
echo "📋 認証状況を確認中..."
gcloud auth list

# プロジェクト設定
echo "🔧 プロジェクトを設定中..."
gcloud config set project conea-staging

# 利用可能プロジェクト確認
echo "📂 利用可能なプロジェクト:"
gcloud projects list --format="table(projectId,name)" | grep -E "(conea|PROJECT_ID)"

# 現在の設定確認
echo "⚙️ 現在の設定:"
gcloud config list

# バックエンドデプロイ実行
echo "🚀 バックエンドをデプロイ中..."
cd /Users/mourigenta/shopify-mcp-server
python3 scripts/deploy_backend.py --env staging

# デプロイ確認
echo "✅ デプロイ確認中..."
sleep 10

# ヘルスチェック
echo "🏥 ヘルスチェック実行中..."
curl -s https://staging-api.conea.ai/health || echo "⚠️ バックエンドがまだ起動中です"

echo "🎉 デプロイプロセス完了！"
echo ""
echo "📍 次のステップ:"
echo "1. https://staging-conea-ai.web.app にアクセス"
echo "2. 設定 → API設定 → Shopify設定"  
echo "3. 認証情報を入力してテスト"