#!/bin/bash
set -e

# ステージング環境へビルドコンテンツをデプロイするスクリプト
TIMESTAMP=$(date +%Y%m%d%H%M%S)
FRONTEND_DIR="/Users/mourigenta/shopify-mcp-server/frontend"
BUILD_DIR="$FRONTEND_DIR/build-manual"
TARGET_DIR="/Users/mourigenta/shopify-mcp-server/deployment/staging/static/public"

echo "=== Conea フロントエンドの静的デプロイ ==="
echo "タイムスタンプ: $TIMESTAMP"

# ビルドディレクトリの確認
if [ ! -d "$BUILD_DIR" ]; then
  echo "エラー: ビルドディレクトリ $BUILD_DIR が存在しません"
  exit 1
fi

# ターゲットディレクトリの作成（必要な場合）
mkdir -p "$TARGET_DIR"

# ビルドファイルをコピー
echo "ビルドファイルを $BUILD_DIR から $TARGET_DIR にコピーしています..."
cp -R "$BUILD_DIR/"* "$TARGET_DIR/"

# 環境変数値の更新（必要に応じて）
echo "環境変数の更新..."
if [ -f "$FRONTEND_DIR/env-config.js" ]; then
  node "$FRONTEND_DIR/env-config.js" "$TARGET_DIR"
else
  echo "警告: env-config.js が見つかりません - 環境変数を静的に置換できません"
fi

# デプロイ情報ファイルの生成
DEPLOY_INFO="$TARGET_DIR/deploy-info.json"
cat > "$DEPLOY_INFO" << EOL
{
  "version": "staging-$TIMESTAMP",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "staging",
  "apiUrl": "https://staging.conea.ai/api"
}
EOL

echo "デプロイ情報を $DEPLOY_INFO に保存しました"

# 静的サーバーで確認（オプション）
if command -v python3 &> /dev/null; then
  echo "静的サーバーを起動しています... (Ctrl+C で終了)"
  echo "http://localhost:8000 でアクセスできます"
  cd "$TARGET_DIR" && python3 -m http.server
else
  echo "静的サーバーを起動するには python3 が必要です"
  echo "ブラウザで $TARGET_DIR/index.html を開いて確認してください"
fi

echo "静的デプロイが完了しました"