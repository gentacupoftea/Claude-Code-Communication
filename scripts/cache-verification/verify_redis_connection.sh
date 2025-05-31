#!/bin/bash
# Redis接続検証スクリプト
set -e

# 引数処理
ENV="staging"
while [[ "$#" -gt 0 ]]; do
  case $1 in
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

# 環境に基づいてRedis URIを選択
if [ "$ENV" == "production" ]; then
  REDIS_URI="$REDIS_PRODUCTION"
  echo "本番環境のRedis接続を検証: $REDIS_URI"
else
  REDIS_URI="$REDIS_STAGING"
  echo "ステージング環境のRedis接続を検証: $REDIS_URI"
fi

echo "===== Redis接続検証 ====="

# Redis接続確認（redis-cliがインストールされている場合）
if command -v redis-cli &> /dev/null; then
  echo "redis-cliを使用して接続テスト..."
  REDIS_HOST=$(echo "$REDIS_URI" | sed -E 's|redis://([^:]+).*|\1|')
  REDIS_PORT=$(echo "$REDIS_URI" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|')
  
  echo "PING テスト..."
  PING_RESULT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING)
  if [ "$PING_RESULT" == "PONG" ]; then
    echo "✅ PING成功"
  else
    echo "❌ PING失敗: $PING_RESULT"
    exit 1
  fi
  
  echo "INFO テスト..."
  INFO_RESULT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO | head -n 5)
  echo "$INFO_RESULT"
  
  echo "Redis接続パラメータ確認..."
  echo "最大接続数:"
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" CONFIG GET maxclients
  
  echo "タイムアウト設定:"
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" CONFIG GET timeout
  
  echo "メモリポリシー:"
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" CONFIG GET maxmemory-policy
  
else
  echo "redis-cliが見つかりません。APIを使用して接続テスト..."
  
  # APIを通じたRedis接続検証（実際の環境に合わせて修正）
  API_URL=""
  if [ "$ENV" == "production" ]; then
    API_URL="$PROD_URL/api/admin/redis/ping"
  else
    API_URL="$STAGING_URL/api/admin/redis/ping"
  fi
  
  echo "API経由でのPINGテスト: $API_URL"
  RESPONSE=$(curl -s -X GET "$API_URL")
  
  if [[ "$RESPONSE" == *"PONG"* ]]; then
    echo "✅ Redis接続成功"
  else
    echo "❌ Redis接続失敗: $RESPONSE"
    exit 1
  fi
fi

echo "===== Redis接続検証完了 ====="