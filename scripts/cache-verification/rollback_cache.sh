#!/bin/bash
# キャッシュロールバックスクリプト
set -e

# 引数処理
ENV="production"
PHASE="current"  # current または complete
FORCE=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --env=*) ENV="${1#*=}" ;;
    --phase=*) PHASE="${1#*=}" ;;
    --force) FORCE=true ;;
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
  echo "本番環境のキャッシュをロールバック: $API_URL"
else
  API_URL="$STAGING_URL"
  echo "ステージング環境のキャッシュをロールバック: $API_URL"
fi

echo "===== キャッシュロールバック: $PHASE ====="

# 現在のフェーズを検出する関数
detect_current_phase() {
  local status_endpoint="${API_URL}/api/admin/cache/status"
  local status_response=$(curl -s -X GET "$status_endpoint")
  
  # キャッシュが有効かどうか確認
  local cache_enabled=$(echo "$status_response" | grep -o '"enabled":[^,}]*' | cut -d ":" -f2)
  if [ "$cache_enabled" != "true" ]; then
    echo "キャッシュは現在無効です。ロールバックは不要です。"
    exit 0
  fi
  
  # アクティブなエンドポイントを取得
  local active_endpoints=$(echo "$status_response" | grep -o '"active_endpoints":"[^"]*"' | cut -d'"' -f4)
  
  # フェーズを判定
  if [ "$active_endpoints" == "all" ]; then
    echo "phase3"  # 全エンドポイントが有効
  elif [[ "$active_endpoints" == *"products"* ]] || [[ "$active_endpoints" == *"catalog"* ]] || [[ "$active_endpoints" == *"inventory"* ]]; then
    echo "phase2"  # 中リスクエンドポイントが有効
  elif [[ "$active_endpoints" == *"metrics"* ]] || [[ "$active_endpoints" == *"healthcheck"* ]] || [[ "$active_endpoints" == *"logs"* ]]; then
    echo "phase1"  # 低リスクエンドポイントが有効
  else
    echo "unknown"
  fi
}

# システムスナップショットの作成
echo "現在のシステム状態のスナップショットを作成中..."
SNAPSHOT_FILE="./backups/pre_rollback_$(date +%Y%m%d_%H%M%S).json"
mkdir -p ./backups

# システム状態の取得
CACHE_STATUS_ENDPOINT="${API_URL}/api/admin/cache/status"
RESOURCE_STATUS_ENDPOINT="${API_URL}/api/admin/resources"

CACHE_STATUS=$(curl -s -X GET "$CACHE_STATUS_ENDPOINT")
RESOURCE_STATUS=$(curl -s -X GET "$RESOURCE_STATUS_ENDPOINT")

# スナップショットJSONの作成
cat > "$SNAPSHOT_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENV",
  "cache_status": $CACHE_STATUS,
  "resource_status": $RESOURCE_STATUS
}
EOF

echo "スナップショットを保存しました: $SNAPSHOT_FILE"

# ロールバックの実行
if [ "$PHASE" == "current" ]; then
  echo "現在のフェーズのみをロールバック..."
  CURRENT_PHASE=$(detect_current_phase)
  echo "検出されたフェーズ: $CURRENT_PHASE"
  
  case $CURRENT_PHASE in
    phase3)
      echo "フェーズ3 -> フェーズ2 へロールバック (中リスクエンドポイントのみ有効化)"
      ROLLBACK_ENDPOINTS="products,catalog,inventory"
      ;;
    phase2)
      echo "フェーズ2 -> フェーズ1 へロールバック (低リスクエンドポイントのみ有効化)"
      ROLLBACK_ENDPOINTS="metrics,healthcheck,logs"
      ;;
    phase1)
      echo "フェーズ1 -> 完全無効化 へロールバック"
      ROLLBACK_ENDPOINTS=""
      ;;
    unknown)
      echo "フェーズを検出できませんでした。安全のため、完全無効化を実施します。"
      ROLLBACK_ENDPOINTS=""
      ;;
  esac
  
elif [ "$PHASE" == "complete" ]; then
  echo "キャッシュ機能を完全にロールバック..."
  ROLLBACK_ENDPOINTS=""
else
  echo "不明なフェーズ: $PHASE"
  exit 1
fi

# 確認プロンプト（forceオプションがない場合）
if [ "$FORCE" != "true" ]; then
  read -p "キャッシュ設定をロールバックします。続行しますか？ (y/N): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "ロールバックをキャンセルしました。"
    exit 0
  fi
fi

# ロールバック実行
ROLLBACK_ENDPOINT="${API_URL}/api/admin/cache/config"
TEMP_CONFIG=$(mktemp)

if [ -z "$ROLLBACK_ENDPOINTS" ]; then
  # キャッシュを完全に無効化
  cat > "$TEMP_CONFIG" << EOF
{
  "enabled": false,
  "log_level": "info",
  "endpoints": ""
}
EOF
else
  # 特定のエンドポイントのみ有効化
  cat > "$TEMP_CONFIG" << EOF
{
  "enabled": true,
  "log_level": "debug",
  "endpoints": "$ROLLBACK_ENDPOINTS"
}
EOF
fi

echo "ロールバック設定を適用中..."
ROLLBACK_RESPONSE=$(curl -s -X POST "$ROLLBACK_ENDPOINT" -H "Content-Type: application/json" -d @"$TEMP_CONFIG")

# 一時ファイルの削除
rm "$TEMP_CONFIG"

# レスポンス確認
if echo "$ROLLBACK_RESPONSE" | grep -q '"status":"success"'; then
  echo "✅ ロールバックが正常に適用されました"
  
  # 詳細情報の表示
  CONFIG_ID=$(echo "$ROLLBACK_RESPONSE" | grep -o '"config_id":"[^"]*"' | cut -d'"' -f4)
  echo "設定ID: $CONFIG_ID"
  
  # 適用確認
  echo "ロールバック後の設定を確認中..."
  VERIFY_ENDPOINT="${API_URL}/api/admin/cache/status"
  VERIFY_RESPONSE=$(curl -s -X GET "$VERIFY_ENDPOINT")
  
  CACHE_ENABLED=$(echo "$VERIFY_RESPONSE" | grep -o '"enabled":[^,}]*' | cut -d ":" -f2)
  CACHE_ENDPOINTS=$(echo "$VERIFY_RESPONSE" | grep -o '"active_endpoints":"[^"]*"' | cut -d'"' -f4)
  
  echo "キャッシュ状態: $([ "$CACHE_ENABLED" == "true" ] && echo "有効" || echo "無効")"
  
  if [ "$CACHE_ENABLED" == "true" ]; then
    echo "アクティブエンドポイント: $CACHE_ENDPOINTS"
  fi
  
else
  echo "❌ ロールバックの適用に失敗しました:"
  echo "$ROLLBACK_RESPONSE"
  exit 1
fi

# システム健全性の検証
echo "システム健全性の検証..."
HEALTH_ENDPOINT="${API_URL}/api/health"
HEALTH_RESPONSE=$(curl -s -X GET "$HEALTH_ENDPOINT")

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  echo "✅ システムは健全に動作しています"
else
  echo "⚠️ システム健全性の確認に問題があります:"
  echo "$HEALTH_RESPONSE"
  
  # 健全でない場合は追加のデバッグ情報を収集
  DEBUG_ENDPOINT="${API_URL}/api/admin/diagnostics"
  DEBUG_RESPONSE=$(curl -s -X GET "$DEBUG_ENDPOINT")
  
  echo "診断情報:"
  echo "$DEBUG_RESPONSE" | jq .
  
  echo "システム管理者に連絡してください。"
fi

echo "===== キャッシュロールバック完了 ====="