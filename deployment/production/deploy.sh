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

# バージョン情報
if [ -z "$VERSION" ]; then
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  VERSION="v$(date +%Y.%m.%d)-${TIMESTAMP}"
fi
echo "デプロイバージョン: $VERSION"

# 現在のアクティブ環境を確認
cd /opt/conea
CURRENT_ENV=$(cat current_env.txt 2>/dev/null || echo "blue")
if [ "$CURRENT_ENV" = "blue" ]; then
  NEXT_ENV="green"
else
  NEXT_ENV="blue"
fi
echo "現在の環境: $CURRENT_ENV、次の環境: $NEXT_ENV"

# 次の環境にデプロイ
cd /opt/conea/$NEXT_ENV

# 最新のコードを取得
echo "最新のコードを取得しています..."
git pull

# イメージのバージョンを更新
echo "Dockerイメージのバージョンを更新しています..."
sed -i "s|conea/frontend:latest|conea/frontend:$VERSION|g" docker-compose.yml
sed -i "s|conea/backend:latest|conea/backend:$VERSION|g" docker-compose.yml

# Docker Composeを使用してサービスを再起動
echo "コンテナを再起動しています..."
docker-compose pull
docker-compose down
docker-compose up -d

# サービスが起動するのを待つ
echo "サービスの起動を待機しています..."
sleep 20

# ヘルスチェックの実行
echo "ヘルスチェックを実行しています..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "Failed")
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health.txt || echo "Failed")

if [ "$BACKEND_HEALTH" != "200" ] || [ "$FRONTEND_HEALTH" != "200" ]; then
  echo "エラー: ヘルスチェックに失敗しました。デプロイを中止します。"
  echo "バックエンド: $BACKEND_HEALTH、フロントエンド: $FRONTEND_HEALTH"
  exit 1
fi

# Nginxの設定を更新
echo "Nginxの設定を更新しています..."
cd /opt/conea/nginx
sed -i "s/proxy_pass http:\/\/$CURRENT_ENV/proxy_pass http:\/\/$NEXT_ENV/g" conf.d/production.conf

# Nginxに設定をリロードさせる
echo "Nginxの設定をリロードしています..."
docker exec nginx-proxy nginx -s reload

# 現在のアクティブ環境を更新
echo "$NEXT_ENV" > /opt/conea/current_env.txt

echo "デプロイが完了しました。新しいアクティブ環境: $NEXT_ENV"
echo "アプリケーションは https://conea.example.com でアクセスできます"

# デプロイ情報をログに記録
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployed version $VERSION to $NEXT_ENV environment" >> /opt/conea/deploy.log