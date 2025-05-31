#!/bin/bash
# Conea (Shopify-MCP-Server) ステージング環境ビルドスクリプト
set -e

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# 環境変数ファイルの確認
if [ ! -f .env.staging ]; then
  log_error "ステージング環境の設定ファイル (.env.staging) が見つかりません。"
  exit 1
fi

log_info "Conea ステージング環境のビルドを開始します。"

# プロジェクトのルートディレクトリに移動
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# フロントエンドのビルド
log_info "フロントエンドのビルドを開始します..."
cd frontend

# 依存関係のインストール
log_info "依存関係をインストールしています..."
npm ci --legacy-peer-deps || { log_error "npm ci に失敗しました"; exit 1; }

# 環境変数の設定
log_info "ステージング環境変数を読み込んでいます..."
cp ../.env.staging .env.production.local || { log_error "環境変数ファイルのコピーに失敗しました"; exit 1; }

# プロダクションビルド
log_info "フロントエンドをビルドしています..."
npm run build --legacy-peer-deps || { log_error "フロントエンドのビルドに失敗しました"; exit 1; }

# バックエンドのビルド準備
cd ..
log_info "バックエンドのビルド準備を開始します..."

# ビルド成果物のディレクトリ作成
BUILD_DIR="dist/staging"
mkdir -p "$BUILD_DIR" || { log_error "ビルドディレクトリの作成に失敗しました"; exit 1; }

# フロントエンドの成果物をコピー
log_info "フロントエンドの成果物をコピーしています..."
cp -r frontend/build/* "$BUILD_DIR/" || { log_error "フロントエンドの成果物のコピーに失敗しました"; exit 1; }

# Nginxの設定をコピー
log_info "Nginx設定ファイルをコピーしています..."
mkdir -p "$BUILD_DIR/config/nginx" || { log_error "Nginx設定ディレクトリの作成に失敗しました"; exit 1; }
cp nginx/conea-dashboard.conf "$BUILD_DIR/config/nginx/" || { log_error "Nginx設定ファイルのコピーに失敗しました"; exit 1; }

# 環境変数ファイルをコピー
log_info "環境変数ファイルをコピーしています..."
cp .env.staging "$BUILD_DIR/.env" || { log_error "環境変数ファイルのコピーに失敗しました"; exit 1; }

# Dockerfileをコピー
log_info "Dockerfileをコピーしています..."
cp Dockerfile "$BUILD_DIR/" || { log_error "Dockerfileのコピーに失敗しました"; exit 1; }

# package.jsonとpackage-lock.jsonをコピー
log_info "package.jsonをコピーしています..."
cp frontend/package.json frontend/package-lock.json "$BUILD_DIR/" || { log_error "package.jsonのコピーに失敗しました"; exit 1; }

# バージョン情報ファイルを作成
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "N/A")
VERSION=$(grep -m 1 "version" frontend/package.json | cut -d'"' -f4)

cat > "$BUILD_DIR/version.json" << EOF
{
  "version": "$VERSION",
  "build_date": "$TIMESTAMP",
  "git_commit": "$GIT_COMMIT",
  "environment": "staging"
}
EOF

log_info "バージョン情報ファイルを作成しました: $BUILD_DIR/version.json"

# ビルドの成功メッセージ
log_info "Conea ステージング環境のビルドが完了しました。"
log_info "ビルド成果物は $BUILD_DIR に格納されています。"
log_info "デプロイするには deploy-staging.sh スクリプトを実行してください。"