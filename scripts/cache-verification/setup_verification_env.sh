#!/bin/bash
# OptimizedCacheManager 検証環境準備スクリプト
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BASE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
VERIFICATION_DIR="$BASE_DIR/cache-deploy-verification"

echo "===== OptimizedCacheManager 検証環境準備 ====="

# 検証用ディレクトリの作成
mkdir -p "$VERIFICATION_DIR"
cd "$VERIFICATION_DIR"

# メトリクス記録用ディレクトリ
mkdir -p ./metrics/{baseline,with_cache,production}
mkdir -p ./reports
mkdir -p ./backups

echo "基本検証スクリプトの準備..."
cp -r "$SCRIPT_DIR"/* ./

# スクリプトに実行権限を付与
find ./ -name "*.sh" -exec chmod +x {} \;

echo "検証設定ファイルの生成..."
cat > ./config.env << EOF
# 検証環境設定
STAGING_URL=https://staging.api.shopify-mcp.example.com
PROD_URL=https://api.shopify-mcp.example.com
REDIS_STAGING=redis://cache.staging.shopify-mcp.example.com:6379
REDIS_PRODUCTION=redis://cache.shopify-mcp.example.com:6379

# テスト設定
DEFAULT_REQUEST_COUNT=50
DEFAULT_LOAD_DURATION=5m
DEFAULT_LOAD_USERS=50
ENDPOINTS=products,orders,customers,catalog,recommendations

# モニタリング設定
MONITORING_INTERVAL=30s
LONG_MONITORING_INTERVAL=1m
EOF

echo "===== 検証環境準備完了 ====="
echo "検証ディレクトリ: $VERIFICATION_DIR"