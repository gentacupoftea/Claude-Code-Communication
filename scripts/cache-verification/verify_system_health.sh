#!/bin/bash
# システム健全性検証スクリプト
set -e

# 引数処理
ENV="production"
COMPONENTS="all"
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
  echo "本番環境の健全性を検証: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境の健全性を検証: $API_URL"
fi

echo "===== システム健全性検証: $ENV 環境 ====="
echo "対象コンポーネント: $COMPONENTS"

# 一時ファイル
TEMP_RESULTS=$(mktemp)
echo '{
  "components": {
  },
  "alerts": []
}' > "$TEMP_RESULTS"

# 検証結果を一時ファイルに追加
add_component_result() {
  local component=$1
  local status=$2
  local details=$3
  
  # エスケープ処理
  details=$(echo "$details" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\n/\\n/g')
  
  TMP_FILE=$(mktemp)
  jq ".components[\"$component\"] = {\"status\": \"$status\", \"details\": \"$details\"}" "$TEMP_RESULTS" > "$TMP_FILE"
  mv "$TMP_FILE" "$TEMP_RESULTS"
}

# アラートを一時ファイルに追加
add_alert() {
  local severity=$1
  local message=$2
  
  TMP_FILE=$(mktemp)
  jq ".alerts += [{\"severity\": \"$severity\", \"message\": \"$message\"}]" "$TEMP_RESULTS" > "$TMP_FILE"
  mv "$TMP_FILE" "$TEMP_RESULTS"
}

# システム全体のヘルスチェック
check_system_health() {
  # 基本的なヘルスチェック
  HEALTH_ENDPOINT="${API_URL}/api/health"
  echo "基本ヘルスチェック: $HEALTH_ENDPOINT"
  
  HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT")
  
  if [ "$HEALTH_RESPONSE" -eq 200 ]; then
    echo "✅ システム基本ヘルスチェック: 成功"
    add_component_result "system" "healthy" "基本的なヘルスチェックに成功しました。HTTP状態コード: $HEALTH_RESPONSE"
  else
    echo "❌ システム基本ヘルスチェック: 失敗 ($HEALTH_RESPONSE)"
    add_component_result "system" "unhealthy" "基本的なヘルスチェックに失敗しました。HTTP状態コード: $HEALTH_RESPONSE"
    add_alert "critical" "システムのヘルスチェックに失敗しました。緊急の対応が必要です。"
    return 1
  fi
  
  # 詳細ヘルスチェック
  if [ "$THOROUGH" == "true" ]; then
    DETAILED_HEALTH_ENDPOINT="${API_URL}/api/admin/health/detailed"
    echo "詳細ヘルスチェック: $DETAILED_HEALTH_ENDPOINT"
    
    DETAILED_HEALTH=$(curl -s -X GET "$DETAILED_HEALTH_ENDPOINT")
    HEALTH_STATUS=$(echo "$DETAILED_HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$HEALTH_STATUS" == "ok" ]; then
      echo "✅ システム詳細ヘルスチェック: 成功"
    else
      echo "⚠️ システム詳細ヘルスチェック: 警告 ($HEALTH_STATUS)"
      add_alert "warning" "詳細ヘルスチェックで警告が検出されました。状態: $HEALTH_STATUS"
    fi
    
    # サブコンポーネントの状態
    echo "サブコンポーネント状態:"
    echo "$DETAILED_HEALTH" | jq '.components'
  fi
  
  return 0
}

# APIコンポーネントのヘルスチェック
check_api_health() {
  echo "APIコンポーネントの健全性を検証中..."
  
  # APIバージョン確認
  VERSION_ENDPOINT="${API_URL}/api/version"
  VERSION_RESPONSE=$(curl -s -X GET "$VERSION_ENDPOINT")
  
  VERSION=$(echo "$VERSION_RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  BUILD_DATE=$(echo "$VERSION_RESPONSE" | grep -o '"build_date":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$VERSION" ]; then
    echo "✅ APIバージョン確認: 成功 (バージョン: $VERSION, ビルド日時: $BUILD_DATE)"
    add_component_result "api" "healthy" "APIは正常に応答しています。バージョン: $VERSION, ビルド日時: $BUILD_DATE"
  else
    echo "❌ APIバージョン確認: 失敗"
    add_component_result "api" "unhealthy" "APIバージョン情報を取得できませんでした。"
    add_alert "critical" "APIコンポーネントに問題があります。"
    return 1
  fi
  
  # APIレート制限確認
  if [ "$THOROUGH" == "true" ]; then
    RATE_ENDPOINT="${API_URL}/api/admin/rate-limits"
    RATE_RESPONSE=$(curl -s -X GET "$RATE_ENDPOINT")
    
    CURRENT_RATE=$(echo "$RATE_RESPONSE" | grep -o '"current_rate":[0-9.]*' | cut -d':' -f2)
    MAX_RATE=$(echo "$RATE_RESPONSE" | grep -o '"max_rate":[0-9.]*' | cut -d':' -f2)
    
    if [ -n "$CURRENT_RATE" ] && [ -n "$MAX_RATE" ]; then
      USAGE_PERCENT=$(echo "scale=2; $CURRENT_RATE / $MAX_RATE * 100" | bc)
      echo "ℹ️ APIレート制限使用率: $USAGE_PERCENT% ($CURRENT_RATE / $MAX_RATE)"
      
      if (( $(echo "$USAGE_PERCENT > 80" | bc -l) )); then
        add_alert "warning" "APIレート制限の使用率が80%を超えています: $USAGE_PERCENT%"
      fi
    fi
  fi
  
  return 0
}

# キャッシュコンポーネントのヘルスチェック
check_cache_health() {
  echo "キャッシュコンポーネントの健全性を検証中..."
  
  # キャッシュ状態確認
  CACHE_STATUS_ENDPOINT="${API_URL}/api/admin/cache/status"
  CACHE_STATUS=$(curl -s -X GET "$CACHE_STATUS_ENDPOINT")
  
  # キャッシュが有効かどうか確認
  CACHE_ENABLED=$(echo "$CACHE_STATUS" | grep -o '"enabled":[^,}]*' | cut -d ":" -f2)
  
  if [ "$CACHE_ENABLED" == "true" ]; then
    echo "✅ キャッシュ状態確認: 有効"
    
    # アクティブなエンドポイントを取得
    ACTIVE_ENDPOINTS=$(echo "$CACHE_STATUS" | grep -o '"active_endpoints":"[^"]*"' | cut -d'"' -f4)
    echo "ℹ️ アクティブなエンドポイント: $ACTIVE_ENDPOINTS"
    
    # キャッシュ統計確認
    CACHE_STATS_ENDPOINT="${API_URL}/api/admin/cache/stats"
    CACHE_STATS=$(curl -s -X GET "$CACHE_STATS_ENDPOINT")
    
    # ヒット率確認
    HIT_RATE=$(echo "$CACHE_STATS" | grep -o '"overall_hit_rate":[^,}]*' | cut -d ":" -f2)
    if [ -n "$HIT_RATE" ]; then
      HIT_RATE_PERCENT=$(echo "$HIT_RATE * 100" | bc -l)
      printf "ℹ️ キャッシュヒット率: %.2f%%\n" $HIT_RATE_PERCENT
      
      # ヒット率による健全性判断
      if (( $(echo "$HIT_RATE_PERCENT >= 60" | bc -l) )); then
        add_component_result "cache" "healthy" "キャッシュは正常に動作しています。ヒット率: $HIT_RATE_PERCENT%"
      elif (( $(echo "$HIT_RATE_PERCENT >= 40" | bc -l) )); then
        add_component_result "cache" "warning" "キャッシュヒット率が目標値より低いです: $HIT_RATE_PERCENT%"
        add_alert "warning" "キャッシュヒット率が目標値より低いです: $HIT_RATE_PERCENT%"
      else
        add_component_result "cache" "unhealthy" "キャッシュヒット率が非常に低いです: $HIT_RATE_PERCENT%"
        add_alert "critical" "キャッシュヒット率が非常に低いです: $HIT_RATE_PERCENT%"
      fi
    else
      echo "⚠️ キャッシュヒット率情報が取得できません"
      add_component_result "cache" "warning" "キャッシュヒット率情報が取得できません。"
    fi
    
    # メモリ使用率の確認
    MEM_USAGE=$(echo "$CACHE_STATS" | jq -r '.levels[] | select(.name == "memory") | .usage_percent // 0')
    
    if [ -n "$MEM_USAGE" ]; then
      echo "ℹ️ メモリキャッシュ使用率: $MEM_USAGE%"
      
      if (( $(echo "$MEM_USAGE > 90" | bc -l) )); then
        add_alert "critical" "メモリキャッシュ使用率が非常に高いです: $MEM_USAGE%"
      elif (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
        add_alert "warning" "メモリキャッシュ使用率が高いです: $MEM_USAGE%"
      fi
    fi
  else
    echo "❌ キャッシュ状態確認: 無効"
    add_component_result "cache" "unhealthy" "キャッシュが無効になっています。"
    add_alert "critical" "キャッシュシステムが無効になっています。"
    return 1
  fi
  
  return 0
}

# Redisコンポーネントのヘルスチェック
check_redis_health() {
  echo "Redisコンポーネントの健全性を検証中..."
  
  # Redis接続確認
  REDIS_ENDPOINT="${API_URL}/api/admin/redis/ping"
  REDIS_RESPONSE=$(curl -s -X GET "$REDIS_ENDPOINT")
  
  if [[ "$REDIS_RESPONSE" == *"PONG"* ]]; then
    echo "✅ Redis接続確認: 成功"
    add_component_result "redis" "healthy" "Redis接続は正常です。"
  else
    echo "❌ Redis接続確認: 失敗"
    add_component_result "redis" "unhealthy" "Redis接続に失敗しました。"
    add_alert "critical" "Redis接続に問題があります。キャッシュのL2層が機能していません。"
    return 1
  fi
  
  # Redis詳細情報確認
  REDIS_INFO_ENDPOINT="${API_URL}/api/admin/redis/info"
  REDIS_INFO=$(curl -s -X GET "$REDIS_INFO_ENDPOINT")
  
  # Redis接続数
  CONNECTIONS=$(echo "$REDIS_INFO" | grep -o '"connected_clients":[0-9]*' | cut -d':' -f2)
  MEMORY_USED=$(echo "$REDIS_INFO" | grep -o '"used_memory_human":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$CONNECTIONS" ] && [ -n "$MEMORY_USED" ]; then
    echo "ℹ️ Redis接続数: $CONNECTIONS, 使用メモリ: $MEMORY_USED"
    
    # 最大接続数
    MAX_CLIENTS=$(echo "$REDIS_INFO" | grep -o '"maxclients":[0-9]*' | cut -d':' -f2)
    if [ -n "$MAX_CLIENTS" ]; then
      CONN_PERCENT=$(echo "scale=2; $CONNECTIONS / $MAX_CLIENTS * 100" | bc)
      if (( $(echo "$CONN_PERCENT > 80" | bc -l) )); then
        add_alert "warning" "Redis接続数が最大値の80%を超えています: $CONN_PERCENT%"
      fi
    fi
  else
    echo "⚠️ Redis情報を取得できません"
    add_alert "warning" "Redis詳細情報を取得できません。"
  fi
  
  return 0
}

# メモリ使用状況チェック
check_memory_health() {
  echo "メモリ使用状況の健全性を検証中..."
  
  # メモリ使用情報取得
  MEMORY_ENDPOINT="${API_URL}/api/admin/resources/memory"
  MEMORY_STATS=$(curl -s -X GET "$MEMORY_ENDPOINT")
  
  # メモリ使用率確認
  MEM_USED_PERCENT=$(echo "$MEMORY_STATS" | grep -o '"used_percent":[0-9.]*' | cut -d':' -f2)
  MEM_USED_MB=$(echo "$MEMORY_STATS" | grep -o '"used_mb":[0-9.]*' | cut -d':' -f2)
  MEM_TOTAL_MB=$(echo "$MEMORY_STATS" | grep -o '"total_mb":[0-9.]*' | cut -d':' -f2)
  
  if [ -n "$MEM_USED_PERCENT" ]; then
    echo "ℹ️ メモリ使用率: $MEM_USED_PERCENT% ($MEM_USED_MB MB / $MEM_TOTAL_MB MB)"
    
    if (( $(echo "$MEM_USED_PERCENT > 90" | bc -l) )); then
      add_component_result "memory" "unhealthy" "メモリ使用率が非常に高いです: $MEM_USED_PERCENT%"
      add_alert "critical" "システムメモリ使用率が非常に高いです: $MEM_USED_PERCENT%"
    elif (( $(echo "$MEM_USED_PERCENT > 80" | bc -l) )); then
      add_component_result "memory" "warning" "メモリ使用率が高いです: $MEM_USED_PERCENT%"
      add_alert "warning" "システムメモリ使用率が高いです: $MEM_USED_PERCENT%"
    else
      add_component_result "memory" "healthy" "メモリ使用率は正常範囲内です: $MEM_USED_PERCENT%"
    fi
  else
    echo "⚠️ メモリ使用情報を取得できません"
    add_component_result "memory" "unknown" "メモリ使用情報を取得できません。"
  fi
  
  return 0
}

# CPU使用状況チェック
check_cpu_health() {
  echo "CPU使用状況の健全性を検証中..."
  
  # CPU使用情報取得
  CPU_ENDPOINT="${API_URL}/api/admin/resources/cpu"
  CPU_STATS=$(curl -s -X GET "$CPU_ENDPOINT")
  
  # CPU使用率確認
  CPU_USED_PERCENT=$(echo "$CPU_STATS" | grep -o '"used_percent":[0-9.]*' | cut -d':' -f2)
  CPU_CORES=$(echo "$CPU_STATS" | grep -o '"total_cores":[0-9.]*' | cut -d':' -f2)
  
  if [ -n "$CPU_USED_PERCENT" ]; then
    echo "ℹ️ CPU使用率: $CPU_USED_PERCENT% (コア数: $CPU_CORES)"
    
    if (( $(echo "$CPU_USED_PERCENT > 90" | bc -l) )); then
      add_component_result "cpu" "unhealthy" "CPU使用率が非常に高いです: $CPU_USED_PERCENT%"
      add_alert "critical" "CPU使用率が非常に高いです: $CPU_USED_PERCENT%"
    elif (( $(echo "$CPU_USED_PERCENT > 80" | bc -l) )); then
      add_component_result "cpu" "warning" "CPU使用率が高いです: $CPU_USED_PERCENT%"
      add_alert "warning" "CPU使用率が高いです: $CPU_USED_PERCENT%"
    else
      add_component_result "cpu" "healthy" "CPU使用率は正常範囲内です: $CPU_USED_PERCENT%"
    fi
  else
    echo "⚠️ CPU使用情報を取得できません"
    add_component_result "cpu" "unknown" "CPU使用情報を取得できません。"
  fi
  
  return 0
}

# エラーログチェック
check_error_logs() {
  echo "エラーログの健全性を検証中..."
  
  # 最近のエラーログ取得
  LOGS_ENDPOINT="${API_URL}/api/admin/logs/errors?hours=1"
  ERROR_LOGS=$(curl -s -X GET "$LOGS_ENDPOINT")
  
  # エラー数確認
  ERROR_COUNT=$(echo "$ERROR_LOGS" | jq '.logs | length')
  
  if [ -n "$ERROR_COUNT" ]; then
    echo "ℹ️ 過去1時間のエラー数: $ERROR_COUNT"
    
    if [ "$ERROR_COUNT" -gt 50 ]; then
      add_component_result "logs" "unhealthy" "過去1時間に多数のエラーが発生しています: $ERROR_COUNT"
      add_alert "critical" "過去1時間に多数のエラーが発生しています: $ERROR_COUNT"
    elif [ "$ERROR_COUNT" -gt 10 ]; then
      add_component_result "logs" "warning" "過去1時間にいくつかのエラーが発生しています: $ERROR_COUNT"
      add_alert "warning" "過去1時間にいくつかのエラーが発生しています: $ERROR_COUNT"
    else
      add_component_result "logs" "healthy" "エラーログは正常範囲内です: $ERROR_COUNT"
    fi
    
    # エラーログ表示（エラーがある場合）
    if [ "$ERROR_COUNT" -gt 0 ] && [ "$THOROUGH" == "true" ]; then
      echo "最新のエラーログ:"
      echo "$ERROR_LOGS" | jq -r '.logs[:5] | .[] | "\(.timestamp): \(.message)"'
    fi
  else
    echo "⚠️ エラーログ情報を取得できません"
    add_component_result "logs" "unknown" "エラーログ情報を取得できません。"
  fi
  
  return 0
}

# コンポーネントリストの分割
IFS=',' read -ra COMPONENT_LIST <<< "$COMPONENTS"

# 各コンポーネントの健全性検証
for COMPONENT in "${COMPONENT_LIST[@]}"; do
  case $COMPONENT in
    system)
      check_system_health
      ;;
    
    api)
      check_api_health
      ;;
    
    cache)
      check_cache_health
      ;;
    
    redis)
      check_redis_health
      ;;
    
    memory)
      check_memory_health
      ;;
    
    cpu)
      check_cpu_health
      ;;
    
    logs)
      check_error_logs
      ;;
    
    all)
      check_system_health
      check_api_health
      check_cache_health
      check_redis_health
      check_memory_health
      check_cpu_health
      check_error_logs
      ;;
    
    *)
      echo "不明なコンポーネント: $COMPONENT"
      ;;
  esac
  
  echo ""
done

# 結果の集計
CRITICAL_ALERTS=$(jq '.alerts | map(select(.severity == "critical")) | length' "$TEMP_RESULTS")
WARNING_ALERTS=$(jq '.alerts | map(select(.severity == "warning")) | length' "$TEMP_RESULTS")
UNHEALTHY_COMPONENTS=$(jq '.components | to_entries | map(select(.value.status == "unhealthy")) | length' "$TEMP_RESULTS")

# 結果概要の出力
echo "===== システム健全性検証結果 ====="
echo "重大アラート: $CRITICAL_ALERTS"
echo "警告アラート: $WARNING_ALERTS"
echo "異常コンポーネント: $UNHEALTHY_COMPONENTS"

# アラートがある場合は表示
if [ "$CRITICAL_ALERTS" -gt 0 ] || [ "$WARNING_ALERTS" -gt 0 ]; then
  echo ""
  echo "検出されたアラート:"
  jq -r '.alerts | .[] | "\(.severity): \(.message)"' "$TEMP_RESULTS"
fi

# 結果ファイルの保存
RESULTS_FILE="./reports/health_check_$(date +%Y%m%d_%H%M%S).json"
mkdir -p ./reports
mv "$TEMP_RESULTS" "$RESULTS_FILE"
echo ""
echo "詳細な健全性検証結果を保存しました: $RESULTS_FILE"

# 終了ステータスの決定
if [ "$CRITICAL_ALERTS" -gt 0 ] || [ "$UNHEALTHY_COMPONENTS" -gt 0 ]; then
  echo "❌ システム健全性検証：重大な問題があります"
  exit 1
elif [ "$WARNING_ALERTS" -gt 0 ]; then
  echo "⚠️ システム健全性検証：警告があります"
  exit 0
else
  echo "✅ システム健全性検証：すべて正常です"
  exit 0
fi