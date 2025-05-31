#!/bin/bash

# Simple deployment without billing requirements
set -e

echo "🚀 シンプルなCloud Runデプロイを開始します"

# Build the Docker image locally
echo "🐳 Dockerイメージをビルド中..."
docker build -t shopify-mcp-server:latest .

# Tag for Google Container Registry
PROJECT_ID="conea-48fcf"
IMAGE_NAME="gcr.io/${PROJECT_ID}/shopify-mcp-server:latest"

echo "🏷️ イメージにタグを付与中..."
docker tag shopify-mcp-server:latest ${IMAGE_NAME}

# Configure Docker authentication for GCR
echo "🔐 Docker認証を設定中..."
gcloud auth configure-docker --quiet

# Push the image to GCR
echo "📤 イメージをプッシュ中..."
docker push ${IMAGE_NAME}

# Deploy to Cloud Run
echo "🚀 Cloud Runにデプロイ中..."
gcloud run deploy shopify-mcp-server \
  --image ${IMAGE_NAME} \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 3 \
  --min-instances 0 \
  --port 8000 \
  --set-env-vars "NODE_ENV=production,API_HOST=0.0.0.0,PORT=8000" \
  --project ${PROJECT_ID}

# Get the service URL
SERVICE_URL=$(gcloud run services describe shopify-mcp-server \
  --region asia-northeast1 \
  --project ${PROJECT_ID} \
  --format "value(status.url)")

echo ""
echo "✅ デプロイ完了！"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "📋 次のステップ:"
echo "1. フロントエンドのAPI_BASE_URLを更新: ${SERVICE_URL}"
echo "2. curl ${SERVICE_URL}/health でテスト"
echo "3. https://staging-conea-ai.web.app で設定"