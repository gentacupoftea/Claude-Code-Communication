#!/bin/bash
# キャッシュモニタリング開始スクリプト
set -e

# 引数処理
ENV="staging"
COMPONENTS="cache,api,memory"
INTERVAL="30s"
DURATION=""
OUTPUT="./metrics/monitoring_$(date +%Y%m%d_%H%M%S).json"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --env=*) ENV="${1#*=}" ;;
    --components=*) COMPONENTS="${1#*=}" ;;
    --interval=*) INTERVAL="${1#*=}" ;;
    --duration=*) DURATION="${1#*=}" ;;
    --output=*) OUTPUT="${1#*=}" ;;
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
  echo "本番環境のモニタリングを開始: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のモニタリングを開始: $API_URL"
fi

# 出力ディレクトリの確認
OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

echo "===== キャッシュモニタリング開始 ====="
echo "モニタリング対象コンポーネント: $COMPONENTS"
echo "サンプリング間隔: $INTERVAL"
if [ -n "$DURATION" ]; then
  echo "モニタリング期間: $DURATION"
else
  echo "モニタリング期間: 無期限（Ctrl+Cで終了）"
fi
echo "出力ファイル: $OUTPUT"

# 期間をミリ秒に変換
convert_to_seconds() {
  local time=$1
  local value=${time%[smhd]}
  local unit=${time#$value}
  
  case $unit in
    s) echo $value ;;
    m) echo $((value * 60)) ;;
    h) echo $((value * 3600)) ;;
    d) echo $((value * 86400)) ;;
    *) echo $value ;;
  esac
}

INTERVAL_SECONDS=$(convert_to_seconds "$INTERVAL")

# 結果の一時ファイル
TEMP_RESULTS=$(mktemp)

# 開始タイムスタンプ
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# JSON結果の初期化
echo '{
  "metadata": {
    "start_time": "'$START_TIME'",
    "interval": "'$INTERVAL'",
    "environment": "'$ENV'",
    "components": "'$COMPONENTS'"
  },
  "samples": []
}' > "$TEMP_RESULTS"

echo "モニタリング開始: $START_TIME"

# モニタリング終了関数
cleanup() {
  END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  TMP_FILE=$(mktemp)
  jq ".metadata.end_time = \"$END_TIME\"" "$TEMP_RESULTS" > "$TMP_FILE"
  mv "$TMP_FILE" "$OUTPUT"
  
  echo ""
  echo "モニタリング終了: $END_TIME"
  echo "モニタリングデータを保存しました: $OUTPUT"
  exit 0
}

# シグナルハンドラー設定
trap cleanup SIGINT SIGTERM

# 終了時間の計算
END_TIME_SECONDS=0
if [ -n "$DURATION" ]; then
  DURATION_SECONDS=$(convert_to_seconds "$DURATION")
  START_TIME_SECONDS=$(date +%s)
  END_TIME_SECONDS=$((START_TIME_SECONDS + DURATION_SECONDS))
  echo "予定終了時刻: $(date -d @$END_TIME_SECONDS)"
fi

# モニタリングループ
SAMPLE_COUNT=0
while true; do
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  CURRENT_TIME_SECONDS=$(date +%s)
  
  # 経過時間チェック
  if [ $END_TIME_SECONDS -gt 0 ] && [ $CURRENT_TIME_SECONDS -ge $END_TIME_SECONDS ]; then
    echo "指定された期間が終了しました"
    cleanup
  fi
  
  # サンプルカウンター更新
  SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
  echo -n "サンプル #$SAMPLE_COUNT 収集中... "
  
  # コンポーネントリストの分割
  IFS=',' read -ra COMPONENT_LIST <<< "$COMPONENTS"
  
  # 各コンポーネントのデータ収集
  SAMPLE_DATA="{"
  
  for COMPONENT in "${COMPONENT_LIST[@]}"; do
    case $COMPONENT in
      cache)
        # キャッシュ統計情報の収集
        CACHE_ENDPOINT="${API_URL}/api/admin/cache/stats"
        CACHE_STATS=$(curl -s -X GET "$CACHE_ENDPOINT")
        SAMPLE_DATA="${SAMPLE_DATA}\"cache\": ${CACHE_STATS},"
        ;;
      
      api)
        # API統計情報の収集
        API_STATS_ENDPOINT="${API_URL}/api/admin/statistics?period=1m"
        API_STATS=$(curl -s -X GET "$API_STATS_ENDPOINT")
        SAMPLE_DATA="${SAMPLE_DATA}\"api\": ${API_STATS},"
        ;;
      
      memory)
        # メモリ使用情報の収集
        MEMORY_ENDPOINT="${API_URL}/api/admin/resources/memory"
        MEMORY_STATS=$(curl -s -X GET "$MEMORY_ENDPOINT")
        SAMPLE_DATA="${SAMPLE_DATA}\"memory\": ${MEMORY_STATS},"
        ;;
      
      cpu)
        # CPU使用情報の収集
        CPU_ENDPOINT="${API_URL}/api/admin/resources/cpu"
        CPU_STATS=$(curl -s -X GET "$CPU_ENDPOINT")
        SAMPLE_DATA="${SAMPLE_DATA}\"cpu\": ${CPU_STATS},"
        ;;
      
      db)
        # データベース接続情報の収集
        DB_ENDPOINT="${API_URL}/api/admin/resources/database"
        DB_STATS=$(curl -s -X GET "$DB_ENDPOINT")
        SAMPLE_DATA="${SAMPLE_DATA}\"db\": ${DB_STATS},"
        ;;
      
      network)
        # ネットワーク統計情報の収集
        NETWORK_ENDPOINT="${API_URL}/api/admin/resources/network"
        NETWORK_STATS=$(curl -s -X GET "$NETWORK_ENDPOINT")
        SAMPLE_DATA="${SAMPLE_DATA}\"network\": ${NETWORK_STATS},"
        ;;
      
      *)
        echo "不明なコンポーネント: $COMPONENT"
        ;;
    esac
  done
  
  # 最後のカンマを削除して閉じる
  SAMPLE_DATA="${SAMPLE_DATA%,}}"
  
  # タイムスタンプの追加
  SAMPLE_WITH_TIMESTAMP="$(echo "${SAMPLE_DATA}" | jq ". += {\"timestamp\": \"$TIMESTAMP\"}")"
  
  # JSONに結果を追加
  TMP_FILE=$(mktemp)
  jq ".samples += [$SAMPLE_WITH_TIMESTAMP]" "$TEMP_RESULTS" > "$TMP_FILE"
  mv "$TMP_FILE" "$TEMP_RESULTS"
  
  # 定期的な保存（10サンプルごと）
  if [[ $((SAMPLE_COUNT % 10)) -eq 0 ]]; then
    cp "$TEMP_RESULTS" "$OUTPUT"
    echo -n "[保存済] "
  fi
  
  # キャッシュ統計情報の表示（キャッシュコンポーネントが含まれる場合）
  if [[ "$COMPONENTS" == *"cache"* ]]; then
    CACHE_HIT_RATE=$(echo "$SAMPLE_WITH_TIMESTAMP" | jq -r '.cache.overall_hit_rate // 0')
    MEMORY_USAGE=$(echo "$SAMPLE_WITH_TIMESTAMP" | jq -r '.cache.levels[] | select(.name == "memory") | .usage_percent // 0')
    REDIS_USAGE=$(echo "$SAMPLE_WITH_TIMESTAMP" | jq -r '.cache.levels[] | select(.name == "redis") | .usage_percent // 0')
    echo "キャッシュヒット率: ${CACHE_HIT_RATE:.2%}, メモリ使用率: ${MEMORY_USAGE:.1f}%, Redis使用率: ${REDIS_USAGE:.1f}%"
  else
    echo "サンプル収集完了"
  fi
  
  # 次のサンプルまで待機
  sleep $INTERVAL_SECONDS
done