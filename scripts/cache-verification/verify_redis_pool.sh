#!/bin/bash
# Redis接続プール検証スクリプト
set -e

# 引数処理
MIN_CONNECTIONS=5
MAX_CONNECTIONS=20
ENV="staging"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --min-connections=*) MIN_CONNECTIONS="${1#*=}" ;;
    --max-connections=*) MAX_CONNECTIONS="${1#*=}" ;;
    --env=*) ENV="${1#*=}" ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# 設定読み込み
if [ -f "./config.env" ]; then
  source ./config.env
else
  echo "設定ファイルが見つかりません: ./config.env"
  exit 1
fi

# 環境に基づいてAPIエンドポイントを選択
if [ "$ENV" == "production" ]; then
  API_URL="$PROD_URL"
  echo "本番環境のRedis接続プールを検証: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のRedis接続プールを検証: $API_URL"
fi

echo "===== Redis接続プール検証 ====="

# Redis接続設定情報取得
echo "Redis接続設定情報を取得中..."
REDIS_INFO_ENDPOINT="${API_URL}/api/admin/redis/info"
REDIS_INFO=$(curl -s -X GET "$REDIS_INFO_ENDPOINT")

# 期待する出力例:
# {
#   "pool_size": 10,
#   "min_idle": 5,
#   "max_idle": 10,
#   "max_active": 20,
#   "current_connections": 3
# }

# 接続プール情報の表示
echo "接続プール情報:"
echo "$REDIS_INFO"

# 接続プール設定の検証
POOL_SIZE=$(echo "$REDIS_INFO" | grep -o '"pool_size":[^,}]*' | cut -d ":" -f2)
MAX_ACTIVE=$(echo "$REDIS_INFO" | grep -o '"max_active":[^,}]*' | cut -d ":" -f2)

if [ -z "$POOL_SIZE" ] || [ -z "$MAX_ACTIVE" ]; then
  echo "❌ 接続プール情報が取得できませんでした"
  exit 1
fi

echo "検証中:"
echo "- 接続プールサイズ: $POOL_SIZE"
echo "- 最大アクティブ接続数: $MAX_ACTIVE"
echo "- 期待する最小接続数: $MIN_CONNECTIONS"
echo "- 期待する最大接続数: $MAX_CONNECTIONS"

# 検証
if [ "$POOL_SIZE" -ge "$MIN_CONNECTIONS" ]; then
  echo "✅ 接続プールサイズが最小要件を満たしています"
else
  echo "❌ 接続プールサイズが最小要件を満たしていません"
  exit 1
fi

if [ "$MAX_ACTIVE" -ge "$MAX_CONNECTIONS" ]; then
  echo "✅ 最大アクティブ接続数が要件を満たしています"
else
  echo "❌ 最大アクティブ接続数が要件を満たしていません"
  exit 1
fi

# 負荷テスト（軽量版）
echo "接続プール負荷テスト実行中..."
for i in {1..10}; do
  echo "リクエスト $i/10 送信中..."
  curl -s -X GET "$API_URL/api/admin/redis/ping" > /dev/null &
done

# すべてのバックグラウンドプロセスの終了を待機
wait
echo "負荷テスト完了"

# 接続状態の確認
REDIS_INFO_AFTER=$(curl -s -X GET "$REDIS_INFO_ENDPOINT")
CURRENT_CONNECTIONS=$(echo "$REDIS_INFO_AFTER" | grep -o '"current_connections":[^,}]*' | cut -d ":" -f2)

echo "テスト後の接続数: $CURRENT_CONNECTIONS"
echo "===== Redis接続プール検証完了 ====="