#!/bin/bash
# Conea (Shopify-MCP-Server) ステージング環境デプロイスクリプト
set -e

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ユーティリティ関数
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# 開始メッセージ
log_step "Conea ステージング環境へのデプロイを開始します"

# プロジェクトのルートディレクトリに移動
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# ビルド成果物の確認
BUILD_DIR="dist/staging"
if [ ! -d "$BUILD_DIR" ]; then
  log_error "ビルド成果物が見つかりません。先に build-staging.sh スクリプトを実行してください。"
  exit 1
fi

# ビルド成果物の検証
log_step "ビルド成果物の検証"
if [ ! -f "$BUILD_DIR/index.html" ]; then
  log_error "フロントエンドのビルド成果物が不完全です。"
  exit 1
fi

if [ ! -f "$BUILD_DIR/Dockerfile" ]; then
  log_error "Dockerfileが見つかりません。"
  exit 1
fi

if [ ! -f "$BUILD_DIR/.env" ]; then
  log_error "環境変数ファイルが見つかりません。"
  exit 1
fi

# Dockerイメージのビルドとタグ付け
log_step "Dockerイメージのビルド"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
IMAGE_NAME="conea/staging"
IMAGE_TAG="v-$TIMESTAMP"
FULL_IMAGE_NAME="$IMAGE_NAME:$IMAGE_TAG"

log_info "Dockerイメージをビルドしています: $FULL_IMAGE_NAME"
cd "$BUILD_DIR"
docker build -t "$FULL_IMAGE_NAME" . || { log_error "Dockerイメージのビルドに失敗しました"; exit 1; }
docker tag "$FULL_IMAGE_NAME" "$IMAGE_NAME:latest" || { log_error "Dockerイメージのタグ付けに失敗しました"; exit 1; }

# Google Container Registry (GCR) または Google Artifact Registry (GAR) へのプッシュ
log_step "コンテナレジストリへのプッシュ"
GCR_HOST="gcr.io"
PROJECT_ID=$(grep -m 1 "SHOPIFY_MCP_PROJECT_ID" .env | cut -d'=' -f2)
GCR_IMAGE="$GCR_HOST/$PROJECT_ID/$IMAGE_NAME:$IMAGE_TAG"
GCR_LATEST="$GCR_HOST/$PROJECT_ID/$IMAGE_NAME:latest"

log_info "認証情報を確認しています..."
gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin https://$GCR_HOST || { log_error "GCRへの認証に失敗しました"; exit 1; }

log_info "イメージをタグ付けしています: $GCR_IMAGE"
docker tag "$FULL_IMAGE_NAME" "$GCR_IMAGE" || { log_error "GCRイメージのタグ付けに失敗しました"; exit 1; }
docker tag "$FULL_IMAGE_NAME" "$GCR_LATEST" || { log_error "GCRイメージのタグ付け(latest)に失敗しました"; exit 1; }

log_info "イメージをプッシュしています..."
docker push "$GCR_IMAGE" || { log_error "GCRへのイメージプッシュに失敗しました"; exit 1; }
docker push "$GCR_LATEST" || { log_error "GCRへのイメージプッシュ(latest)に失敗しました"; exit 1; }

# GCP Cloud RunまたはGKEへのデプロイ
log_step "ステージング環境へのデプロイ"
SERVICE_NAME=$(grep -m 1 "SHOPIFY_MCP_SERVICE_NAME" .env | cut -d'=' -f2)

# クラウドランにデプロイする場合
log_info "Cloud Runにデプロイしています..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$GCR_IMAGE" \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --memory "${MEMORY:-2Gi}" \
  --cpu "${CPU:-2}" \
  --min-instances "${MIN_INSTANCES:-1}" \
  --max-instances "${MAX_INSTANCES:-3}" \
  --set-env-vars "ENVIRONMENT=staging" \
  --project "$PROJECT_ID" || { log_error "Cloud Runデプロイに失敗しました"; exit 1; }

# デプロイのURLを取得
DEPLOY_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region asia-northeast1 --project "$PROJECT_ID" --format 'value(status.url)')

# DNSレコードの更新が必要かチェック
DOMAIN_NAME=$(grep -m 1 "DOMAIN_NAME" .env | cut -d'=' -f2)
if [ -n "$DOMAIN_NAME" ]; then
  log_info "ドメイン名が設定されています: $DOMAIN_NAME"
  log_warn "DNSレコードが適切に設定されていることを確認してください。"
  log_info "Cloud Runカスタムドメインを確認: https://console.cloud.google.com/run/domains"
fi

# 健全性チェック
log_step "デプロイ後の健全性チェック"
log_info "エンドポイントに接続を試みています: $DEPLOY_URL"
curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL" | grep -q "200" && \
  log_info "サービスは正常に応答しています" || log_warn "サービスの応答が異常です"

# デプロイの成功メッセージ
log_step "デプロイが完了しました"
log_info "サービスURL: $DEPLOY_URL"
if [ -n "$DOMAIN_NAME" ]; then
  log_info "カスタムドメイン: https://$DOMAIN_NAME"
fi

# 検証コマンド
log_info "デプロイを検証するには、次のコマンドを実行してください:"
echo -e "${BLUE}  curl -v $DEPLOY_URL/version.json${NC}"
echo ""
log_info "これでステージング環境へのデプロイが完了しました"