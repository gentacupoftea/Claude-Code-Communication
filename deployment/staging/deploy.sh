#!/bin/bash
set -e

# スクリプトの場所をベースディレクトリとして設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 環境変数ファイルを読み込む（存在する場合）
if [ -f .env ]; then
  echo "環境変数ファイルを読み込んでいます..."
  export $(grep -v '^#' .env | xargs)
fi

# タイムスタンプ付きのバージョンを生成
TIMESTAMP=$(date +%Y%m%d%H%M%S)
VERSION="${BUILD_VERSION:-staging}-${TIMESTAMP}"
echo "デプロイバージョン: $VERSION"

# 必要なディレクトリの作成
mkdir -p nginx/certs
mkdir -p nginx/logs

# 自己署名証明書の生成（本番環境では適切な証明書を使用してください）
if [ ! -f nginx/certs/staging.conea.example.com.crt ]; then
  echo "SSL証明書を生成しています..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/certs/staging.conea.example.com.key \
    -out nginx/certs/staging.conea.example.com.crt \
    -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Conea/OU=Staging/CN=staging.conea.example.com"
fi

# コンテナのビルドとデプロイ
echo "Dockerイメージをビルドしています..."
docker-compose build \
  --build-arg REACT_APP_VERSION=$VERSION \
  --build-arg REACT_APP_API_URL=https://staging.conea.example.com/api \
  --build-arg REACT_APP_WS_URL=wss://staging.conea.example.com/ws

# 古いコンテナを停止して新しいコンテナを起動
echo "コンテナをデプロイしています..."
docker-compose down
docker-compose up -d

# デプロイ後のヘルスチェック
echo "ヘルスチェックを実行しています..."
sleep 10  # サービスの起動を待つ

# バックエンドのヘルスチェック
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "Failed")
if [ "$BACKEND_HEALTH" == "200" ]; then
  echo "バックエンドは正常に動作しています"
else
  echo "警告: バックエンドのヘルスチェックに失敗しました: $BACKEND_HEALTH"
fi

# フロントエンドのヘルスチェック
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health.txt || echo "Failed")
if [ "$FRONTEND_HEALTH" == "200" ]; then
  echo "フロントエンドは正常に動作しています"
else
  echo "警告: フロントエンドのヘルスチェックに失敗しました: $FRONTEND_HEALTH"
fi

echo "ステージング環境へのデプロイが完了しました"
echo "アプリケーションは https://staging.conea.example.com でアクセスできます"