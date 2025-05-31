#!/bin/bash
# OptimizedCacheManager デプロイスクリプト
set -e

# 引数処理
ENV="staging"
BRANCH="main"
COMPONENT="all"
TAG=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --env=*) ENV="${1#*=}" ;;
    --branch=*) BRANCH="${1#*=}" ;;
    --component=*) COMPONENT="${1#*=}" ;;
    --tag=*) TAG="${1#*=}" ;;
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

echo "===== OptimizedCacheManager デプロイ ====="
echo "環境: $ENV"
echo "ブランチ: $BRANCH"
echo "コンポーネント: $COMPONENT"
if [ -n "$TAG" ]; then
  echo "タグ: $TAG"
fi

# 環境に基づいてデプロイURLを選択
if [ "$ENV" == "production" ]; then
  DEPLOY_URL="$PROD_URL"
  echo "本番環境へのデプロイ: $DEPLOY_URL"
else
  DEPLOY_URL="$STAGING_URL"
  echo "ステージング環境へのデプロイ: $DEPLOY_URL"
fi

# デプロイ開始時間
START_TIME=$(date +%s)

# コンポーネント特定のデプロイ
if [ "$COMPONENT" == "cache-config" ]; then
  echo "キャッシュ設定のみをデプロイ..."
  
  # タグの取り扱い
  TAG_PARAM=""
  if [ -n "$TAG" ]; then
    TAG_PARAM="--tag=$TAG"
  fi
  
  # キャッシュ設定デプロイAPI呼び出し
  DEPLOY_ENDPOINT="${DEPLOY_URL}/api/admin/deploy/cache-config"
  DEPLOY_PARAMS="branch=$BRANCH&env=$ENV"
  if [ -n "$TAG" ]; then
    DEPLOY_PARAMS="${DEPLOY_PARAMS}&tag=$TAG"
  fi
  
  echo "デプロイリクエスト送信: $DEPLOY_ENDPOINT?$DEPLOY_PARAMS"
  DEPLOY_RESPONSE=$(curl -s -X POST "$DEPLOY_ENDPOINT?$DEPLOY_PARAMS")
  
  # レスポンス確認
  if echo "$DEPLOY_RESPONSE" | grep -q '"status":"success"'; then
    DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | grep -o '"deploy_id":"[^"]*"' | cut -d'"' -f4)
    echo "デプロイ開始: ID=$DEPLOY_ID"
  else
    echo "❌ デプロイ開始に失敗しました:"
    echo "$DEPLOY_RESPONSE"
    exit 1
  fi
  
  # デプロイ状態の監視
  echo "デプロイ状態を監視中..."
  DEPLOY_STATUS="in_progress"
  
  while [ "$DEPLOY_STATUS" == "in_progress" ]; do
    sleep 5
    STATUS_ENDPOINT="${DEPLOY_URL}/api/admin/deploy/status/${DEPLOY_ID}"
    STATUS_RESPONSE=$(curl -s -X GET "$STATUS_ENDPOINT")
    
    DEPLOY_STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    DEPLOY_PROGRESS=$(echo "$STATUS_RESPONSE" | grep -o '"progress":[0-9.]*' | cut -d':' -f2)
    
    echo "デプロイ状態: $DEPLOY_STATUS (進捗: ${DEPLOY_PROGRESS}%)"
    
    if [ "$DEPLOY_STATUS" == "failed" ]; then
      DEPLOY_ERROR=$(echo "$STATUS_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
      echo "❌ デプロイに失敗しました: $DEPLOY_ERROR"
      exit 1
    fi
  done
  
  if [ "$DEPLOY_STATUS" == "success" ]; then
    echo "✅ キャッシュ設定のデプロイが完了しました"
  else
    echo "❌ デプロイに失敗しました: 最終状態 = $DEPLOY_STATUS"
    exit 1
  fi
  
else
  # 完全デプロイの場合
  echo "完全デプロイを実行..."
  
  # タグの取り扱い
  TAG_PARAM=""
  if [ -n "$TAG" ]; then
    TAG_PARAM="--tag=$TAG"
  fi
  
  # デプロイAPI呼び出し
  DEPLOY_ENDPOINT="${DEPLOY_URL}/api/admin/deploy"
  DEPLOY_PARAMS="branch=$BRANCH&env=$ENV"
  if [ -n "$TAG" ]; then
    DEPLOY_PARAMS="${DEPLOY_PARAMS}&tag=$TAG"
  fi
  
  echo "デプロイリクエスト送信: $DEPLOY_ENDPOINT?$DEPLOY_PARAMS"
  DEPLOY_RESPONSE=$(curl -s -X POST "$DEPLOY_ENDPOINT?$DEPLOY_PARAMS")
  
  # レスポンス確認
  if echo "$DEPLOY_RESPONSE" | grep -q '"status":"success"'; then
    DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | grep -o '"deploy_id":"[^"]*"' | cut -d'"' -f4)
    echo "デプロイ開始: ID=$DEPLOY_ID"
  else
    echo "❌ デプロイ開始に失敗しました:"
    echo "$DEPLOY_RESPONSE"
    exit 1
  fi
  
  # デプロイ状態の監視
  echo "デプロイ状態を監視中..."
  DEPLOY_STATUS="in_progress"
  
  while [ "$DEPLOY_STATUS" == "in_progress" ]; do
    sleep 10
    STATUS_ENDPOINT="${DEPLOY_URL}/api/admin/deploy/status/${DEPLOY_ID}"
    STATUS_RESPONSE=$(curl -s -X GET "$STATUS_ENDPOINT")
    
    DEPLOY_STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    DEPLOY_PROGRESS=$(echo "$STATUS_RESPONSE" | grep -o '"progress":[0-9.]*' | cut -d':' -f2)
    
    echo "デプロイ状態: $DEPLOY_STATUS (進捗: ${DEPLOY_PROGRESS}%)"
    
    if [ "$DEPLOY_STATUS" == "failed" ]; then
      DEPLOY_ERROR=$(echo "$STATUS_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
      echo "❌ デプロイに失敗しました: $DEPLOY_ERROR"
      exit 1
    fi
  done
  
  if [ "$DEPLOY_STATUS" == "success" ]; then
    echo "✅ デプロイが完了しました"
  else
    echo "❌ デプロイに失敗しました: 最終状態 = $DEPLOY_STATUS"
    exit 1
  fi
fi

# デプロイ時間の計算
END_TIME=$(date +%s)
DEPLOY_TIME=$((END_TIME - START_TIME))
echo "デプロイ完了: $((DEPLOY_TIME / 60))分 $((DEPLOY_TIME % 60))秒"

echo "===== デプロイ完了 ====="