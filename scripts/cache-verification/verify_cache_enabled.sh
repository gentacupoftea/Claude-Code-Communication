#!/bin/bash
# キャッシュ有効化確認スクリプト
set -e

# 引数処理
ENV="staging"
ENDPOINTS="all"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --env=*) ENV="${1#*=}" ;;
    --endpoints=*) ENDPOINTS="${1#*=}" ;;
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
  echo "本番環境のキャッシュ状態を確認: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のキャッシュ状態を確認: $API_URL"
fi

echo "===== キャッシュ有効化確認 ====="
echo "対象エンドポイント: $ENDPOINTS"

# キャッシュ状態確認API呼び出し
CACHE_STATUS_ENDPOINT="${API_URL}/api/admin/cache/status"
echo "キャッシュ状態を確認中: $CACHE_STATUS_ENDPOINT"
CACHE_STATUS=$(curl -s -X GET "$CACHE_STATUS_ENDPOINT")

# キャッシュが有効かどうか確認
CACHE_ENABLED=$(echo "$CACHE_STATUS" | grep -o '"enabled":[^,}]*' | cut -d ":" -f2)
if [ "$CACHE_ENABLED" != "true" ]; then
  echo "❌ キャッシュが無効になっています"
  exit 1
fi

# アクティブなエンドポイントを取得
ACTIVE_ENDPOINTS=$(echo "$CACHE_STATUS" | grep -o '"active_endpoints":"[^"]*"' | cut -d'"' -f4)
echo "アクティブなエンドポイント: $ACTIVE_ENDPOINTS"

# 指定されたエンドポイントが有効になっているか確認
if [ "$ENDPOINTS" == "all" ]; then
  if [ "$ACTIVE_ENDPOINTS" != "all" ]; then
    echo "❌ すべてのエンドポイントでキャッシュが有効になっていません"
    echo "現在のアクティブエンドポイント: $ACTIVE_ENDPOINTS"
    exit 1
  else
    echo "✅ すべてのエンドポイントでキャッシュが有効になっています"
  fi
else
  # エンドポイントリストの分割
  IFS=',' read -ra ENDPOINT_LIST <<< "$ENDPOINTS"
  
  for EP in "${ENDPOINT_LIST[@]}"; do
    if [ "$ACTIVE_ENDPOINTS" == "all" ]; then
      echo "✅ エンドポイント '$EP' はキャッシュが有効です (すべて有効)"
    elif [[ "$ACTIVE_ENDPOINTS" == *"$EP"* ]]; then
      echo "✅ エンドポイント '$EP' はキャッシュが有効です"
    else
      echo "❌ エンドポイント '$EP' はキャッシュが有効になっていません"
      FAILURE=true
    fi
  done
  
  if [ "$FAILURE" == "true" ]; then
    exit 1
  fi
fi

# キャッシュ設定の詳細情報
echo "キャッシュ設定情報:"
echo "$CACHE_STATUS" | jq '.'

# キャッシュが実際に機能しているか確認
echo "キャッシュヒット率を確認中..."
CACHE_STATS_ENDPOINT="${API_URL}/api/admin/cache/stats"
CACHE_STATS=$(curl -s -X GET "$CACHE_STATS_ENDPOINT")

# ヒット率の確認
HIT_RATE=$(echo "$CACHE_STATS" | grep -o '"overall_hit_rate":[^,}]*' | cut -d ":" -f2)
if [ -z "$HIT_RATE" ]; then
  echo "⚠️ キャッシュヒット率情報が取得できません。キャッシュが使用されていない可能性があります。"
  echo "リクエストをもう少し送信してから再確認してください。"
else
  HIT_RATE_PERCENT=$(echo "$HIT_RATE * 100" | bc -l)
  printf "現在のキャッシュヒット率: %.2f%%\n" $HIT_RATE_PERCENT
  
  if (( $(echo "$HIT_RATE_PERCENT < 10" | bc -l) )); then
    echo "⚠️ キャッシュヒット率が低いです。キャッシュが効果的に使用されていない可能性があります。"
    echo "キャッシュウォームアップを検討するか、しばらく待ってから再確認してください。"
  elif (( $(echo "$HIT_RATE_PERCENT >= 10" | bc -l) )) && (( $(echo "$HIT_RATE_PERCENT < 40" | bc -l) )); then
    echo "ℹ️ キャッシュヒット率は許容範囲内ですが、改善の余地があります。"
  else
    echo "✅ キャッシュヒット率は良好です。"
  fi
fi

echo "===== キャッシュ有効化確認完了 ====="