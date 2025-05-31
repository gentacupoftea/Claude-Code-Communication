#!/bin/bash

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ID="conea-48fcf"
SERVICE_NAME="conea-backend-staging"
REGION="asia-northeast1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${BLUE}🚀 Conea Backend Staging デプロイスクリプト${NC}"
echo -e "${YELLOW}プロジェクト: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}サービス名: ${SERVICE_NAME}${NC}"
echo -e "${YELLOW}リージョン: ${REGION}${NC}"

# Step 1: Dockerイメージをビルド
echo -e "\n${GREEN}1. Dockerイメージをビルド中...${NC}"
docker build -t ${IMAGE_NAME} .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Dockerビルドに失敗しました${NC}"
    exit 1
fi

# Step 2: イメージをContainer Registryにプッシュ
echo -e "\n${GREEN}2. Container Registryにプッシュ中...${NC}"
docker push ${IMAGE_NAME}

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ イメージのプッシュに失敗しました${NC}"
    echo -e "${YELLOW}gcloud auth configure-docker を実行してください${NC}"
    exit 1
fi

# Step 3: Cloud Runにデプロイ
echo -e "\n${GREEN}3. Cloud Runにデプロイ中...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --port 8000 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 100 \
    --set-env-vars "NODE_ENV=production,MULTILLM_API_URL=https://multillm-api-service-xxxxx-an.a.run.app,MULTILLM_API_KEY=91b731acafbbc18b27bc173938b74da0644883bc02074a0c0b9723c1bb56afb4"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ デプロイが完了しました！${NC}"
    
    # サービスURLを取得
    SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
    echo -e "${BLUE}🔗 サービスURL: ${SERVICE_URL}${NC}"
    echo -e "${BLUE}📊 ヘルスチェック: ${SERVICE_URL}/api/health${NC}"
else
    echo -e "${RED}❌ デプロイに失敗しました${NC}"
    exit 1
fi