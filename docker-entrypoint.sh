#!/bin/sh
# Docker用エントリポイントスクリプト

set -e

# 環境変数をエクスポート（未定義の変数はデフォルト値を使用）
export ENVIRONMENT="${ENVIRONMENT:-staging}"
export API_URL="${API_URL:-https://staging-api.conea.shopify-mcp.com}"
export WEBSOCKET_URL="${WEBSOCKET_URL:-wss://staging-api.conea.shopify-mcp.com/ws}"

# 設定ファイルテンプレートを環境変数で置換
if [ -f /usr/share/nginx/html/env-config.js.template ]; then
  echo "Configuring environment variables..."
  envsubst < /usr/share/nginx/html/env-config.js.template > /usr/share/nginx/html/env-config.js
fi

# バージョン情報や環境情報を表示
if [ -f /usr/share/nginx/html/version.json ]; then
  echo "Container Version Information:"
  cat /usr/share/nginx/html/version.json
fi

# Nginx設定ファイルのドメイン名を置換
if [ -n "$DOMAIN_NAME" ]; then
  echo "Setting domain name to: $DOMAIN_NAME"
  sed -i "s/staging.conea.shopify-mcp.com/$DOMAIN_NAME/g" /etc/nginx/conf.d/default.conf
fi

# API URLを置換
if [ -n "$API_DOMAIN_NAME" ]; then
  echo "Setting API domain name to: $API_DOMAIN_NAME"
  sed -i "s/staging-api.conea.shopify-mcp.com/$API_DOMAIN_NAME/g" /etc/nginx/conf.d/default.conf
fi

echo "Starting Nginx server..."
exec "$@"