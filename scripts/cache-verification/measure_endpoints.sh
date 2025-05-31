#!/bin/bash
# エンドポイントレスポンスタイム測定スクリプト
set -e

# 引数処理
ENDPOINTS="products,orders,customers,catalog,recommendations"
REQUESTS=50
OUTPUT="./metrics/baseline/endpoints_$(date +%Y%m%d_%H%M%S).json"
ENV="staging"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --endpoints=*) ENDPOINTS="${1#*=}" ;;
    --requests=*) REQUESTS="${1#*=}" ;;
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
  echo "本番環境のエンドポイントを測定: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のエンドポイントを測定: $API_URL"
fi

# 出力ディレクトリの確認
OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

echo "===== エンドポイントレスポンスタイム測定 ====="
echo "対象エンドポイント: $ENDPOINTS"
echo "リクエスト数: $REQUESTS"
echo "出力ファイル: $OUTPUT"

# 結果の一時ファイル
TEMP_RESULTS=$(mktemp)

# 開始タイムスタンプ
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# JSON結果の初期化
echo '{
  "metadata": {
    "start_time": "'$START_TIME'",
    "requests_per_endpoint": '$REQUESTS',
    "environment": "'$ENV'"
  },
  "endpoints": {}
}' > "$TEMP_RESULTS"

# エンドポイントリストの分割
IFS=',' read -ra ENDPOINT_LIST <<< "$ENDPOINTS"

# 各エンドポイントに対する測定
for ENDPOINT in "${ENDPOINT_LIST[@]}"; do
  echo "エンドポイント測定: $ENDPOINT"
  
  # エンドポイントごとの測定結果
  TIMES=()
  STATUSES=()
  SIZES=()
  
  for i in $(seq 1 $REQUESTS); do
    echo -n "リクエスト $i/$REQUESTS 送信中... "
    
    # レスポンスタイム計測とレスポンス取得
    START=$(date +%s.%N)
    HTTP_RESPONSE=$(curl -s -w "%{http_code},%{size_download},%{time_total}\n" -o /dev/null "$API_URL/api/$ENDPOINT")
    END=$(date +%s.%N)
    
    # レスポンス処理
    IFS=',' read -r STATUS SIZE TIME <<< "$HTTP_RESPONSE"
    
    # 結果保存
    STATUSES+=($STATUS)
    SIZES+=($SIZE)
    TIMES+=($TIME)
    
    echo "ステータス:$STATUS サイズ:$SIZE 時間:${TIME}s"
    
    # リクエスト間の短い間隔
    sleep 0.1
  done
  
  # 統計計算
  TOTAL_TIME=0
  SUCCESS_COUNT=0
  ERROR_COUNT=0
  MIN_TIME=999999
  MAX_TIME=0
  
  for ((i=0; i<${#TIMES[@]}; i++)); do
    TIME=${TIMES[$i]}
    STATUS=${STATUSES[$i]}
    
    TOTAL_TIME=$(echo "$TOTAL_TIME + $TIME" | bc)
    
    if (( $(echo "$TIME < $MIN_TIME" | bc -l) )); then
      MIN_TIME=$TIME
    fi
    
    if (( $(echo "$TIME > $MAX_TIME" | bc -l) )); then
      MAX_TIME=$TIME
    fi
    
    if [[ $STATUS == 2* ]]; then
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
  done
  
  # 平均計算
  AVG_TIME=$(echo "scale=4; $TOTAL_TIME / ${#TIMES[@]}" | bc)
  
  # JSONに結果を追加
  TMP_FILE=$(mktemp)
  jq ".endpoints[\"$ENDPOINT\"] = {
    \"average_time\": $AVG_TIME,
    \"min_time\": $MIN_TIME,
    \"max_time\": $MAX_TIME,
    \"success_count\": $SUCCESS_COUNT,
    \"error_count\": $ERROR_COUNT,
    \"success_rate\": $(echo "scale=4; $SUCCESS_COUNT / $REQUESTS" | bc)
  }" "$TEMP_RESULTS" > "$TMP_FILE"
  mv "$TMP_FILE" "$TEMP_RESULTS"
  
  echo "エンドポイント $ENDPOINT の測定完了"
  echo "平均レスポンスタイム: ${AVG_TIME}s"
  echo "成功率: $SUCCESS_COUNT/$REQUESTS ($(echo "scale=2; 100 * $SUCCESS_COUNT / $REQUESTS" | bc)%)"
  echo ""
done

# 終了タイムスタンプ
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TMP_FILE=$(mktemp)
jq ".metadata.end_time = \"$END_TIME\"" "$TEMP_RESULTS" > "$TMP_FILE"
mv "$TMP_FILE" "$TEMP_RESULTS"

# 結果の保存
mv "$TEMP_RESULTS" "$OUTPUT"
echo "結果を保存しました: $OUTPUT"

echo "===== エンドポイントレスポンスタイム測定完了 ====="