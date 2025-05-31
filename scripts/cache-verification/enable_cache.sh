#!/bin/bash
# キャッシュ有効化スクリプト
set -e

# 引数処理
ENV="staging"
ENDPOINTS="all"
LOG_LEVEL="info"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --env=*) ENV="${1#*=}" ;;
    --endpoints=*) ENDPOINTS="${1#*=}" ;;
    --log-level=*) LOG_LEVEL="${1#*=}" ;;
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
  echo "本番環境のキャッシュを有効化: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のキャッシュを有効化: $API_URL"
fi

echo "===== キャッシュ有効化 ====="
echo "対象エンドポイント: $ENDPOINTS"
echo "ログレベル: $LOG_LEVEL"

# キャッシュ設定のJSONを作成
TEMP_CONFIG=$(mktemp)

if [ "$ENDPOINTS" == "all" ]; then
  cat > "$TEMP_CONFIG" << EOF
{
  "enabled": true,
  "log_level": "$LOG_LEVEL",
  "endpoints": "all",
  "memory_settings": {
    "memory_size": 50000000,
    "memory_ttl": 300,
    "enable_compression": true,
    "compression_algorithm": "zlib"
  },
  "redis_settings": {
    "redis_size": 500000000,
    "redis_ttl": 3600,
    "redis_pool_size": 10,
    "redis_connect_timeout": 1.0,
    "redis_read_timeout": 0.5
  },
  "features": {
    "enable_prefetching": true,
    "ttl_jitter": 0.2
  }
}
EOF
else
  # エンドポイントリスト形式
  cat > "$TEMP_CONFIG" << EOF
{
  "enabled": true,
  "log_level": "$LOG_LEVEL",
  "endpoints": "$ENDPOINTS",
  "memory_settings": {
    "memory_size": 50000000,
    "memory_ttl": 300,
    "enable_compression": true,
    "compression_algorithm": "zlib"
  },
  "redis_settings": {
    "redis_size": 500000000,
    "redis_ttl": 3600,
    "redis_pool_size": 10,
    "redis_connect_timeout": 1.0,
    "redis_read_timeout": 0.5
  },
  "features": {
    "enable_prefetching": true,
    "ttl_jitter": 0.2
  }
}
EOF
fi

# キャッシュ設定API呼び出し
ENABLE_ENDPOINT="${API_URL}/api/admin/cache/config"
echo "キャッシュ設定リクエスト送信: $ENABLE_ENDPOINT"
ENABLE_RESPONSE=$(curl -s -X POST "$ENABLE_ENDPOINT" -H "Content-Type: application/json" -d @"$TEMP_CONFIG")

# 一時ファイルの削除
rm "$TEMP_CONFIG"

# レスポンス確認
if echo "$ENABLE_RESPONSE" | grep -q '"status":"success"'; then
  echo "✅ キャッシュ設定が適用されました"
  
  # 詳細情報の表示
  CONFIG_ID=$(echo "$ENABLE_RESPONSE" | grep -o '"config_id":"[^"]*"' | cut -d'"' -f4)
  echo "設定ID: $CONFIG_ID"
  
  # 適用されたエンドポイントの表示
  if [ "$ENDPOINTS" == "all" ]; then
    echo "すべてのエンドポイントでキャッシュが有効化されました"
  else
    echo "以下のエンドポイントでキャッシュが有効化されました:"
    IFS=',' read -ra ENDPOINT_LIST <<< "$ENDPOINTS"
    for EP in "${ENDPOINT_LIST[@]}"; do
      echo "- $EP"
    done
  fi
  
  # 適用確認
  echo "適用されたキャッシュ設定を確認中..."
  VERIFY_ENDPOINT="${API_URL}/api/admin/cache/status"
  VERIFY_RESPONSE=$(curl -s -X GET "$VERIFY_ENDPOINT")
  
  CACHE_ENABLED=$(echo "$VERIFY_RESPONSE" | grep -o '"enabled":[^,}]*' | cut -d ":" -f2)
  CACHE_ENDPOINTS=$(echo "$VERIFY_RESPONSE" | grep -o '"active_endpoints":"[^"]*"' | cut -d'"' -f4)
  
  echo "キャッシュ状態: $([ "$CACHE_ENABLED" == "true" ] && echo "有効" || echo "無効")"
  echo "アクティブエンドポイント: $CACHE_ENDPOINTS"
  
  # メモリ設定とRedis設定の確認
  MEM_SIZE=$(echo "$VERIFY_RESPONSE" | grep -o '"memory_size":[^,}]*' | cut -d ":" -f2)
  REDIS_TTL=$(echo "$VERIFY_RESPONSE" | grep -o '"redis_ttl":[^,}]*' | cut -d ":" -f2)
  
  echo "メモリキャッシュサイズ: $((MEM_SIZE / 1000000))MB"
  echo "Redis TTL: $REDIS_TTL秒"
  
else
  echo "❌ キャッシュ設定の適用に失敗しました:"
  echo "$ENABLE_RESPONSE"
  exit 1
fi

echo "===== キャッシュ有効化完了 ====="