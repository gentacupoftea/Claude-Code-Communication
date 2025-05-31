#!/bin/bash
# API呼び出し統計収集スクリプト
set -e

# 引数処理
PERIOD="6h"
OUTPUT="./metrics/baseline/api_calls_$(date +%Y%m%d_%H%M%S).json"
ENV="staging"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --period=*) PERIOD="${1#*=}" ;;
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
  echo "本番環境のAPI統計を収集: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のAPI統計を収集: $API_URL"
fi

# 出力ディレクトリの確認
OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

echo "===== API呼び出し統計収集 ====="
echo "収集期間: $PERIOD"
echo "出力ファイル: $OUTPUT"

# API統計情報取得
echo "API統計情報を取得中..."
API_STATS_ENDPOINT="${API_URL}/api/admin/statistics"
API_STATS=$(curl -s -X GET "${API_STATS_ENDPOINT}?period=${PERIOD}")

# 期待する出力例:
# {
#   "total_calls": 12500,
#   "average_calls_per_minute": 34.7,
#   "endpoints": {
#     "products": {
#       "calls": 5000,
#       "errors": 50,
#       "average_response_time": 0.123
#     },
#     "orders": {
#       "calls": 3000,
#       "errors": 30,
#       "average_response_time": 0.156
#     },
#     ...
#   }
# }

# API統計情報の検証
if ! echo "$API_STATS" | jq . > /dev/null 2>&1; then
  echo "❌ API統計の取得に失敗しました: JSONが無効です"
  echo "$API_STATS"
  exit 1
fi

# メタデータ追加
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
API_STATS_WITH_METADATA=$(echo "$API_STATS" | jq ". += {\"metadata\": {\"timestamp\": \"$TIMESTAMP\", \"period\": \"$PERIOD\", \"environment\": \"$ENV\"}}")

# 統計情報の表示
echo "API呼び出し総数: $(echo "$API_STATS_WITH_METADATA" | jq -r '.total_calls')"
echo "分あたりの平均呼び出し数: $(echo "$API_STATS_WITH_METADATA" | jq -r '.average_calls_per_minute')"
echo ""
echo "上位エンドポイント（呼び出し回数順）:"
echo "$API_STATS_WITH_METADATA" | jq -r '.endpoints | to_entries | sort_by(-.value.calls) | .[:5] | .[] | "- \(.key): \(.value.calls)回 (平均応答時間: \(.value.average_response_time)秒, エラー率: \(.value.errors / .value.calls * 100 | floor / 100)%)"'

# 結果の保存
echo "$API_STATS_WITH_METADATA" > "$OUTPUT"
echo "結果を保存しました: $OUTPUT"

echo "===== API呼び出し統計収集完了 ====="