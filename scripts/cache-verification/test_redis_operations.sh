#!/bin/bash
# Redis基本操作テストスクリプト
set -e

# 引数処理
OPERATIONS="set,get,del,ttl"
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --operations=*) OPERATIONS="${1#*=}" ;;
    --env=*) ENV="${1#*=}" ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# デフォルト環境
ENV=${ENV:-"staging"}

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
  echo "本番環境のRedis操作をテスト: $REDIS_URI"
else
  REDIS_URI="$REDIS_STAGING"
  echo "ステージング環境のRedis操作をテスト: $REDIS_URI"
fi

# Redis操作テスト関数
test_redis_operations() {
  local redis_host=$(echo "$REDIS_URI" | sed -E 's|redis://([^:]+).*|\1|')
  local redis_port=$(echo "$REDIS_URI" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|')
  local test_key="optimized_cache_test_$(date +%s)"
  local test_value="test_value_$(date +%s)"
  local test_ttl=60
  
  echo "テストキー: $test_key"
  echo "テスト値: $test_value"
  
  # SETテスト
  if [[ "$OPERATIONS" == *"set"* ]]; then
    echo "SET操作テスト..."
    SET_RESULT=$(redis-cli -h "$redis_host" -p "$redis_port" SET "$test_key" "$test_value" EX "$test_ttl")
    
    if [ "$SET_RESULT" == "OK" ]; then
      echo "✅ SET操作成功"
    else
      echo "❌ SET操作失敗: $SET_RESULT"
      return 1
    fi
  fi
  
  # GETテスト
  if [[ "$OPERATIONS" == *"get"* ]]; then
    echo "GET操作テスト..."
    GET_RESULT=$(redis-cli -h "$redis_host" -p "$redis_port" GET "$test_key")
    
    if [ "$GET_RESULT" == "$test_value" ]; then
      echo "✅ GET操作成功: 値=$GET_RESULT"
    else
      echo "❌ GET操作失敗: $GET_RESULT"
      return 1
    fi
  fi
  
  # TTLテスト
  if [[ "$OPERATIONS" == *"ttl"* ]]; then
    echo "TTL操作テスト..."
    TTL_RESULT=$(redis-cli -h "$redis_host" -p "$redis_port" TTL "$test_key")
    
    if [ "$TTL_RESULT" -gt 0 ] && [ "$TTL_RESULT" -le "$test_ttl" ]; then
      echo "✅ TTL操作成功: 残り時間=$TTL_RESULT秒"
    else
      echo "❌ TTL操作失敗: $TTL_RESULT"
      return 1
    fi
  fi
  
  # DELテスト
  if [[ "$OPERATIONS" == *"del"* ]]; then
    echo "DEL操作テスト..."
    DEL_RESULT=$(redis-cli -h "$redis_host" -p "$redis_port" DEL "$test_key")
    
    if [ "$DEL_RESULT" == "1" ]; then
      echo "✅ DEL操作成功"
      
      # 削除確認
      VERIFY_RESULT=$(redis-cli -h "$redis_host" -p "$redis_port" GET "$test_key")
      if [ -z "$VERIFY_RESULT" ]; then
        echo "✅ キーが正常に削除されたことを確認"
      else
        echo "❌ キー削除の確認失敗: $VERIFY_RESULT"
        return 1
      fi
    else
      echo "❌ DEL操作失敗: $DEL_RESULT"
      return 1
    fi
  fi
  
  return 0
}

echo "===== Redis基本操作テスト ====="

# Redis操作テスト実行
if command -v redis-cli &> /dev/null; then
  test_redis_operations
  if [ $? -eq 0 ]; then
    echo "✅ Redis基本操作テスト成功"
  else
    echo "❌ Redis基本操作テスト失敗"
    exit 1
  fi
else
  echo "redis-cliが見つかりません。APIを使用した検証はこのスクリプトではサポートされていません。"
  exit 1
fi

echo "===== Redis基本操作テスト完了 ====="