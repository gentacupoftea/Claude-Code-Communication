#!/bin/bash

# Manual deployment script for Conea staging environment
# This script bypasses authentication issues by using local Docker

set -e

echo "🚀 Conea ステージング環境 手動デプロイ開始"

# プロジェクト設定
PROJECT_ID="conea-48fcf"
REGION="asia-northeast1"
SERVICE_NAME="conea-backend-staging"
REPOSITORY="conea-staging"

echo "📋 設定情報:"
echo "  プロジェクト: $PROJECT_ID"
echo "  リージョン: $REGION"
echo "  サービス名: $SERVICE_NAME"

# Docker認証設定（必要に応じて）
echo "🔑 Docker認証設定を試行中..."
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet || echo "認証スキップ（既に設定済みか認証エラー）"

# Artifact Registry リポジトリ作成（既に存在する場合はエラーを無視）
echo "📦 Artifact Registry リポジトリ作成中..."
gcloud artifacts repositories create $REPOSITORY \
    --repository-format=docker \
    --location=$REGION \
    --description="Conea staging container repository" || echo "リポジトリは既に存在します"

# コンテナイメージをプッシュ
echo "🔄 コンテナイメージをプッシュ中..."
IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/backend:latest"
docker tag conea-backend-staging $IMAGE_URI

# プッシュを試行（認証エラーが発生する可能性あり）
echo "📤 イメージをプッシュ中: $IMAGE_URI"
docker push $IMAGE_URI || {
    echo "❌ イメージプッシュに失敗しました"
    echo "💡 解決策: ブラウザで gcloud auth configure-docker の認証を完了してください"
    echo "   または、Google Cloud Console から手動でデプロイしてください"
    exit 1
}

# Cloud Run サービスをデプロイ
echo "🌐 Cloud Run サービスをデプロイ中..."
gcloud run deploy $SERVICE_NAME \
    --image=$IMAGE_URI \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --port=8000 \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --timeout=300 \
    --set-env-vars="NODE_ENV=staging" || {
    echo "❌ Cloud Run デプロイに失敗しました"
    echo "💡 Google Cloud Console から手動でデプロイしてください："
    echo "   https://console.cloud.google.com/run?project=$PROJECT_ID"
    exit 1
}

# デプロイ完了
SERVICE_URL="https://$SERVICE_NAME-$(echo $REGION | tr -d '-')-$PROJECT_ID.a.run.app"
echo "✅ デプロイ完了！"
echo "🔗 バックエンドURL: $SERVICE_URL"
echo "🔗 フロントエンドURL: https://stagingapp-conea-ai.web.app"

# ヘルスチェック
echo "🏥 ヘルスチェック中..."
sleep 10
curl -f "$SERVICE_URL/api/health" || echo "⚠️ ヘルスチェックに失敗（サービス起動中の可能性があります）"

echo "🎉 ステージング環境デプロイ完了！"