#!/bin/bash
# リソース使用状況測定スクリプト
set -e

# 引数処理
DURATION="15m"
INTERVAL="15s"
OUTPUT="./metrics/baseline/resources_$(date +%Y%m%d_%H%M%S).json"
ENV="staging"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --duration=*) DURATION="${1#*=}" ;;
    --interval=*) INTERVAL="${1#*=}" ;;
    --output=*) OUTPUT="${1#*=}" ;;
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
  echo "本番環境のリソース使用状況を測定: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のリソース使用状況を測定: $API_URL"
fi

# 出力ディレクトリの確認
OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

echo "===== リソース使用状況測定 ====="
echo "測定期間: $DURATION"
echo "測定間隔: $INTERVAL"
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

DURATION_SECONDS=$(convert_to_seconds "$DURATION")
INTERVAL_SECONDS=$(convert_to_seconds "$INTERVAL")
ITERATIONS=$((DURATION_SECONDS / INTERVAL_SECONDS))

# 結果の一時ファイル
TEMP_RESULTS=$(mktemp)

# 開始タイムスタンプ
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# JSON結果の初期化
echo '{
  "metadata": {
    "start_time": "'$START_TIME'",
    "duration": "'$DURATION'",
    "interval": "'$INTERVAL'",
    "environment": "'$ENV'"
  },
  "samples": []
}' > "$TEMP_RESULTS"

echo "測定開始 ($ITERATIONS 回の測定, ${DURATION_SECONDS}秒間)"

for i in $(seq 1 $ITERATIONS); do
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "サンプル $i/$ITERATIONS 収集中... ($TIMESTAMP)"
  
  # リソース情報取得
  RESOURCE_ENDPOINT="${API_URL}/api/admin/resources"
  RESOURCE_INFO=$(curl -s -X GET "$RESOURCE_ENDPOINT")
  
  # 期待する出力例:
  # {
  #   "memory": {
  #     "total_mb": 4096,
  #     "used_mb": 2048,
  #     "used_percent": 50.0
  #   },
  #   "cpu": {
  #     "total_cores": 4,
  #     "used_percent": 30.5
  #   },
  #   "redis": {
  #     "memory_used_mb": 256,
  #     "memory_used_percent": 25.0,
  #     "connections": 15
  #   }
  # }
  
  # サンプルにタイムスタンプを追加
  SAMPLE=$(echo "$RESOURCE_INFO" | jq ". += {\"timestamp\": \"$TIMESTAMP\"}")
  
  # JSONに結果を追加
  TMP_FILE=$(mktemp)
  jq ".samples += [$SAMPLE]" "$TEMP_RESULTS" > "$TMP_FILE"
  mv "$TMP_FILE" "$TEMP_RESULTS"
  
  # リソース使用状況の表示
  MEM_USED=$(echo "$SAMPLE" | jq -r '.memory.used_percent')
  CPU_USED=$(echo "$SAMPLE" | jq -r '.cpu.used_percent')
  REDIS_MEM=$(echo "$SAMPLE" | jq -r '.redis.memory_used_percent')
  echo "メモリ使用率: ${MEM_USED}%, CPU使用率: ${CPU_USED}%, Redisメモリ使用率: ${REDIS_MEM}%"
  
  # 次のサンプルまで待機（最後のイテレーションでは待機しない）
  if [ $i -lt $ITERATIONS ]; then
    sleep $INTERVAL_SECONDS
  fi
done

# 終了タイムスタンプ
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TMP_FILE=$(mktemp)
jq ".metadata.end_time = \"$END_TIME\"" "$TEMP_RESULTS" > "$TMP_FILE"
mv "$TMP_FILE" "$TEMP_RESULTS"

# 統計情報の計算
echo "統計情報を計算中..."
TMP_FILE=$(mktemp)

# メモリ使用率の計算
MEM_AVG=$(jq -r '[.samples[].memory.used_percent] | add / length' "$TEMP_RESULTS")
MEM_MAX=$(jq -r '[.samples[].memory.used_percent] | max' "$TEMP_RESULTS")
MEM_MIN=$(jq -r '[.samples[].memory.used_percent] | min' "$TEMP_RESULTS")

# CPU使用率の計算
CPU_AVG=$(jq -r '[.samples[].cpu.used_percent] | add / length' "$TEMP_RESULTS")
CPU_MAX=$(jq -r '[.samples[].cpu.used_percent] | max' "$TEMP_RESULTS")
CPU_MIN=$(jq -r '[.samples[].cpu.used_percent] | min' "$TEMP_RESULTS")

# Redis使用率の計算
REDIS_AVG=$(jq -r '[.samples[].redis.memory_used_percent] | add / length' "$TEMP_RESULTS")
REDIS_MAX=$(jq -r '[.samples[].redis.memory_used_percent] | max' "$TEMP_RESULTS")
REDIS_MIN=$(jq -r '[.samples[].redis.memory_used_percent] | min' "$TEMP_RESULTS")

# 統計情報を追加
jq ".summary = {
  \"memory\": {
    \"average\": $MEM_AVG,
    \"max\": $MEM_MAX,
    \"min\": $MEM_MIN
  },
  \"cpu\": {
    \"average\": $CPU_AVG,
    \"max\": $CPU_MAX,
    \"min\": $CPU_MIN
  },
  \"redis\": {
    \"average\": $REDIS_AVG,
    \"max\": $REDIS_MAX,
    \"min\": $REDIS_MIN
  }
}" "$TEMP_RESULTS" > "$TMP_FILE"
mv "$TMP_FILE" "$TEMP_RESULTS"

# 結果の保存
mv "$TEMP_RESULTS" "$OUTPUT"
echo "結果を保存しました: $OUTPUT"

# 統計情報の表示
echo "測定結果サマリ:"
echo "メモリ使用率: 平均=${MEM_AVG}%, 最大=${MEM_MAX}%, 最小=${MEM_MIN}%"
echo "CPU使用率: 平均=${CPU_AVG}%, 最大=${CPU_MAX}%, 最小=${CPU_MIN}%"
echo "Redisメモリ使用率: 平均=${REDIS_AVG}%, 最大=${REDIS_MAX}%, 最小=${REDIS_MIN}%"

echo "===== リソース使用状況測定完了 ====="