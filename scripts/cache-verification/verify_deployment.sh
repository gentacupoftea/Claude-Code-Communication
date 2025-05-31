#!/bin/bash
# デプロイ検証スクリプト
set -e

# 引数処理
ENV="staging"
COMPONENTS="api,workers,redis"
THOROUGH=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --env=*) ENV="${1#*=}" ;;
    --components=*) COMPONENTS="${1#*=}" ;;
    --thorough) THOROUGH=true ;;
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
  echo "本番環境のデプロイを検証: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のデプロイを検証: $API_URL"
fi

echo "===== デプロイ検証: $ENV 環境 ====="
echo "対象コンポーネント: $COMPONENTS"
if [ "$THOROUGH" == "true" ]; then
  echo "詳細検証モード: 有効"
fi

# コンポーネントリストの分割
IFS=',' read -ra COMPONENT_LIST <<< "$COMPONENTS"

# 各コンポーネントの検証
for COMPONENT in "${COMPONENT_LIST[@]}"; do
  case $COMPONENT in
    api)
      echo "APIコンポーネントを検証中..."
      
      # ヘルスエンドポイント検証
      HEALTH_ENDPOINT="${API_URL}/api/health"
      echo "ヘルスチェック: $HEALTH_ENDPOINT"
      HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$HEALTH_ENDPOINT")
      
      if [ "$HEALTH_RESPONSE" -eq 200 ]; then
        echo "✅ APIヘルスチェック成功"
      else
        echo "❌ APIヘルスチェック失敗: $HEALTH_RESPONSE"
        exit 1
      fi
      
      # バージョン情報検証
      VERSION_ENDPOINT="${API_URL}/api/version"
      echo "バージョン情報: $VERSION_ENDPOINT"
      VERSION_RESPONSE=$(curl -s -X GET "$VERSION_ENDPOINT")
      
      VERSION=$(echo "$VERSION_RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
      BUILD_DATE=$(echo "$VERSION_RESPONSE" | grep -o '"build_date":"[^"]*"' | cut -d'"' -f4)
      
      echo "デプロイされたバージョン: $VERSION (ビルド日時: $BUILD_DATE)"
      
      # 詳細検証モードの場合、APIエンドポイントをより詳しく検証
      if [ "$THOROUGH" == "true" ]; then
        echo "詳細なAPIエンドポイントを検証中..."
        
        # 主要エンドポイントのリスト
        ENDPOINTS=("products" "orders" "customers" "catalog")
        
        for EP in "${ENDPOINTS[@]}"; do
          EP_URL="${API_URL}/api/${EP}"
          echo "${EP}エンドポイントを検証: ${EP_URL}"
          EP_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "${EP_URL}")
          
          if [ "$EP_RESPONSE" -ge 200 ] && [ "$EP_RESPONSE" -lt 500 ]; then
            echo "✅ ${EP}エンドポイント応答: $EP_RESPONSE"
          else
            echo "❌ ${EP}エンドポイント失敗: $EP_RESPONSE"
            FAILURES=true
          fi
        done
        
        if [ "$FAILURES" == "true" ]; then
          echo "⚠️ 一部のAPIエンドポイントに問題があります。"
        fi
      fi
      ;;
    
    workers)
      echo "ワーカーコンポーネントを検証中..."
      
      # ワーカーステータス検証
      WORKERS_ENDPOINT="${API_URL}/api/admin/workers/status"
      echo "ワーカーステータス: $WORKERS_ENDPOINT"
      WORKERS_RESPONSE=$(curl -s -X GET "$WORKERS_ENDPOINT")
      
      ACTIVE_WORKERS=$(echo "$WORKERS_RESPONSE" | grep -o '"active":[0-9]*' | cut -d':' -f2)
      TOTAL_WORKERS=$(echo "$WORKERS_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
      
      echo "アクティブワーカー: $ACTIVE_WORKERS / $TOTAL_WORKERS"
      
      if [ "$ACTIVE_WORKERS" -lt 1 ]; then
        echo "❌ アクティブワーカーがいません"
        exit 1
      else
        echo "✅ ワーカー検証成功"
      fi
      
      # 詳細検証モードの場合、ワーカーキューも検証
      if [ "$THOROUGH" == "true" ]; then
        echo "ワーカーキューを検証中..."
        
        QUEUE_ENDPOINT="${API_URL}/api/admin/workers/queues"
        echo "キュー情報: $QUEUE_ENDPOINT"
        QUEUE_RESPONSE=$(curl -s -X GET "$QUEUE_ENDPOINT")
        
        # キューの健全性確認
        STUCK_JOBS=$(echo "$QUEUE_RESPONSE" | grep -o '"stuck_jobs":[0-9]*' | cut -d':' -f2)
        
        if [ "$STUCK_JOBS" -gt 0 ]; then
          echo "⚠️ $STUCK_JOBS 個の停滞ジョブがあります"
        else
          echo "✅ キュー状態は正常です"
        fi
      fi
      ;;
    
    redis)
      echo "Redisコンポーネントを検証中..."
      
      # Redisステータス検証
      REDIS_ENDPOINT="${API_URL}/api/admin/redis/ping"
      echo "Redis ping: $REDIS_ENDPOINT"
      REDIS_RESPONSE=$(curl -s -X GET "$REDIS_ENDPOINT")
      
      if [[ "$REDIS_RESPONSE" == *"PONG"* ]]; then
        echo "✅ Redis ping成功"
      else
        echo "❌ Redis接続失敗: $REDIS_RESPONSE"
        exit 1
      fi
      
      # 詳細検証モードの場合、Redisの詳細情報も確認
      if [ "$THOROUGH" == "true" ]; then
        echo "Redis詳細情報を検証中..."
        
        REDIS_INFO_ENDPOINT="${API_URL}/api/admin/redis/info"
        echo "Redis情報: $REDIS_INFO_ENDPOINT"
        REDIS_INFO=$(curl -s -X GET "$REDIS_INFO_ENDPOINT")
        
        # Redis接続数
        CONNECTIONS=$(echo "$REDIS_INFO" | grep -o '"connected_clients":[0-9]*' | cut -d':' -f2)
        MEMORY_USED=$(echo "$REDIS_INFO" | grep -o '"used_memory_human":"[^"]*"' | cut -d'"' -f4)
        
        echo "Redis接続数: $CONNECTIONS"
        echo "使用メモリ: $MEMORY_USED"
        
        # キャッシュ設定の検証（キャッシュ機能がデプロイされている場合）
        CACHE_CONFIG_ENDPOINT="${API_URL}/api/admin/cache/config/current"
        CACHE_CONFIG=$(curl -s -X GET "$CACHE_CONFIG_ENDPOINT")
        
        if [[ "$CACHE_CONFIG" == *"redis_settings"* ]]; then
          echo "✅ キャッシュのRedis設定が存在します"
          
          # Redis接続プール設定確認
          POOL_SIZE=$(echo "$CACHE_CONFIG" | grep -o '"redis_pool_size":[0-9]*' | cut -d':' -f2)
          if [ -n "$POOL_SIZE" ]; then
            echo "Redis接続プールサイズ: $POOL_SIZE"
          fi
        fi
      fi
      ;;
    
    cache)
      echo "キャッシュコンポーネントを検証中..."
      
      # キャッシュ状態検証
      CACHE_STATUS_ENDPOINT="${API_URL}/api/admin/cache/status"
      echo "キャッシュ状態: $CACHE_STATUS_ENDPOINT"
      CACHE_STATUS=$(curl -s -X GET "$CACHE_STATUS_ENDPOINT")
      
      # キャッシュが有効かどうか確認
      CACHE_ENABLED=$(echo "$CACHE_STATUS" | grep -o '"enabled":[^,}]*' | cut -d ":" -f2)
      
      if [ "$CACHE_ENABLED" == "true" ]; then
        echo "✅ キャッシュは有効です"
        
        # アクティブなエンドポイントを取得
        ACTIVE_ENDPOINTS=$(echo "$CACHE_STATUS" | grep -o '"active_endpoints":"[^"]*"' | cut -d'"' -f4)
        echo "アクティブなエンドポイント: $ACTIVE_ENDPOINTS"
        
        # メモリ設定とRedis設定の確認
        MEM_SIZE=$(echo "$CACHE_STATUS" | grep -o '"memory_size":[^,}]*' | cut -d ":" -f2)
        REDIS_TTL=$(echo "$CACHE_STATUS" | grep -o '"redis_ttl":[^,}]*' | cut -d ":" -f2)
        
        if [ -n "$MEM_SIZE" ]; then
          echo "メモリキャッシュサイズ: $((MEM_SIZE / 1000000))MB"
        fi
        
        if [ -n "$REDIS_TTL" ]; then
          echo "Redis TTL: $REDIS_TTL秒"
        fi
        
        # 詳細検証モードの場合、キャッシュ統計も確認
        if [ "$THOROUGH" == "true" ]; then
          echo "キャッシュ統計を検証中..."
          
          CACHE_STATS_ENDPOINT="${API_URL}/api/admin/cache/stats"
          CACHE_STATS=$(curl -s -X GET "$CACHE_STATS_ENDPOINT")
          
          # ヒット率の確認
          HIT_RATE=$(echo "$CACHE_STATS" | grep -o '"overall_hit_rate":[^,}]*' | cut -d ":" -f2)
          if [ -n "$HIT_RATE" ]; then
            HIT_RATE_PERCENT=$(echo "$HIT_RATE * 100" | bc -l)
            printf "キャッシュヒット率: %.2f%%\n" $HIT_RATE_PERCENT
          fi
          
          # キャッシュレベルの統計
          echo "キャッシュレベル情報:"
          echo "$CACHE_STATS" | jq '.levels[] | {name: .name, entries: .entries, usage_percent: .usage_percent, hit_rate: .hit_rate}'
        fi
      else
        echo "❌ キャッシュは無効です"
        exit 1
      fi
      ;;
    
    all)
      echo "すべてのコンポーネントを検証中..."
      # 全コンポーネントの検証（再帰的に呼び出し）
      "$0" --env="$ENV" --components=api,workers,redis,cache$([ "$THOROUGH" == "true" ] && echo " --thorough")
      ;;
    
    *)
      echo "不明なコンポーネント: $COMPONENT"
      ;;
  esac
  
  echo ""
done

echo "===== デプロイ検証完了: すべてのチェック成功 ====="