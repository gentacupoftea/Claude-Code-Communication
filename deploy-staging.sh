#!/bin/bash

# Conea ステージング環境デプロイスクリプト
# 実行方法: ./deploy-staging.sh

set -e  # エラー時にスクリプトを停止

# 色付きログ用の定数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 環境変数の設定
export PROJECT_ID="conea-project-staging"
export REGION="asia-northeast1"
export SERVICE_NAME="conea-backend-staging"

log_info "Coneaステージング環境へのデプロイを開始します..."

# プロジェクト設定の確認
log_info "Google Cloud プロジェクトを設定中: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# 現在のプロジェクトを確認
CURRENT_PROJECT=$(gcloud config get-value project)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    log_error "プロジェクト設定に失敗しました。現在: $CURRENT_PROJECT, 期待: $PROJECT_ID"
    exit 1
fi

log_success "プロジェクト設定完了: $CURRENT_PROJECT"

# 必要なAPIの有効化
log_info "必要なGoogle Cloud APIを有効化中..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    firebase.googleapis.com

# ステージング環境変数の読み込み
if [ -f ".env.staging" ]; then
    log_info "ステージング環境変数を読み込み中..."
    set -a
    source .env.staging
    set +a
    log_success "環境変数の読み込み完了"
else
    log_warning ".env.stagingファイルが見つかりません"
fi

# デプロイ前チェック
log_info "デプロイ前チェックを実行中..."

# Git状態の確認
if [ -n "$(git status --porcelain)" ]; then
    log_warning "未コミットの変更があります。コミットすることをお勧めします。"
    git status --short
    read -p "続行しますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "デプロイを中断しました"
        exit 1
    fi
fi

# フロントエンドビルド
log_info "フロントエンドをビルド中..."
cd frontend-v2
npm ci
npm run build
log_success "フロントエンドビルド完了"
cd ..

# バックエンドの依存関係チェック
log_info "バックエンドの依存関係をチェック中..."
cd backend
npm ci
log_success "バックエンド依存関係チェック完了"
cd ..

# Cloud Buildを使用してデプロイ
log_info "Cloud Buildを使用してデプロイを開始..."
gcloud builds submit --config=cloudbuild.staging.yaml \
    --substitutions=_REGION=$REGION,_SERVICE_NAME=$SERVICE_NAME .

# デプロイ結果の確認
log_info "デプロイ結果を確認中..."

# バックエンドのヘルスチェック
BACKEND_URL="https://$SERVICE_NAME-$REGION.a.run.app"
log_info "バックエンドのヘルスチェック: $BACKEND_URL/health"

# 最大30秒間ヘルスチェックを試行
for i in {1..6}; do
    if curl -f "$BACKEND_URL/health" > /dev/null 2>&1; then
        log_success "バックエンドが正常に動作しています"
        break
    else
        log_warning "ヘルスチェック試行中... ($i/6)"
        sleep 5
    fi
    if [ $i -eq 6 ]; then
        log_error "バックエンドのヘルスチェックに失敗しました"
        exit 1
    fi
done

# フロントエンドの確認
FRONTEND_URL="https://staging-conea-ai.web.app"
log_info "フロントエンドの確認: $FRONTEND_URL"

if curl -f "$FRONTEND_URL" > /dev/null 2>&1; then
    log_success "フロントエンドが正常にアクセス可能です"
else
    log_warning "フロントエンドへのアクセスに問題がある可能性があります"
fi

# デプロイ完了メッセージ
log_success "ステージング環境へのデプロイが完了しました！"
echo
echo "=== デプロイ情報 ==="
echo "フロントエンド: $FRONTEND_URL"
echo "バックエンド: $BACKEND_URL"
echo "プロジェクト: $PROJECT_ID"
echo "リージョン: $REGION"
echo "==================="
echo
log_info "ステージング環境でのテストを開始してください"

# OpenMemoryに記録
if command -v /Users/mourigenta/openmemory_cli.sh &> /dev/null; then
    /Users/mourigenta/openmemory_cli.sh 記憶して "Coneaステージング環境デプロイ完了 - $(date '+%Y-%m-%d %H:%M:%S') - フロントエンド: $FRONTEND_URL, バックエンド: $BACKEND_URL"
fi