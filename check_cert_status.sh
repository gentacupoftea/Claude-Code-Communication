#!/bin/bash

# ファイル名: check_cert_status.sh
# 説明: Google Cloud Platform (GCP)にログインしてSSL証明書のステータスを確認するスクリプト

# 色の設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 証明書名（デフォルト値を設定）
CERT_NAME=${1:-"shopify-mcp-ssl-cert"}

# ヘルプメッセージを表示する関数
show_help() {
  echo -e "${BLUE}使用方法:${NC} $0 [証明書名]"
  echo
  echo "引数:"
  echo "  証明書名    - 確認するSSL証明書の名前 (デフォルト: shopify-mcp-ssl-cert)"
  echo
  echo "例:"
  echo "  $0                       # デフォルト証明書のステータスを確認"
  echo "  $0 my-custom-ssl-cert    # カスタム証明書のステータスを確認"
  exit 0
}

# ヘルプフラグのチェック
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  show_help
fi

# スクリプト開始メッセージ
echo -e "${BLUE}=== SSL証明書ステータス確認ツール ===${NC}"
echo -e "証明書名: ${YELLOW}${CERT_NAME}${NC}\n"

# gcloudコマンドが利用可能か確認
if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}エラー: gcloudコマンドが見つかりません。${NC}"
  echo "Google Cloud SDKがインストールされているか確認してください。"
  exit 1
fi

# 認証状態の確認
echo -e "${BLUE}Google Cloudの認証状態を確認しています...${NC}"
AUTH_STATUS=$(gcloud auth list 2>&1)

if echo "$AUTH_STATUS" | grep -q "No credentialed accounts."; then
  echo -e "${YELLOW}ログインしていません。認証を開始します...${NC}"
  gcloud auth login

  # 認証が成功したか確認
  if [ $? -ne 0 ]; then
    echo -e "${RED}認証に失敗しました。${NC}"
    exit 1
  fi
elif echo "$AUTH_STATUS" | grep -q "ACTIVE"; then
  ACTIVE_ACCOUNT=$(echo "$AUTH_STATUS" | grep "*" | awk '{print $2}')
  echo -e "${GREEN}既にログイン済みです: ${ACTIVE_ACCOUNT}${NC}"
else
  echo -e "${RED}認証状態の確認中にエラーが発生しました。${NC}"
  exit 1
fi

# プロジェクトの確認
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
echo -e "${BLUE}現在のプロジェクト:${NC} ${YELLOW}${CURRENT_PROJECT}${NC}\n"

# SSL証明書の状態確認
echo -e "${BLUE}SSL証明書「${CERT_NAME}」の状態を確認しています...${NC}"
CERT_INFO=$(gcloud certificate-manager certificates describe ${CERT_NAME} 2>&1)

if [ $? -ne 0 ]; then
  echo -e "${RED}証明書の情報取得に失敗しました:${NC}"
  echo "$CERT_INFO"
  exit 1
fi

# 証明書の状態を抽出して表示
CERT_STATE=$(echo "$CERT_INFO" | grep -E "state:" | awk '{print $2}')

echo -e "\n${BLUE}証明書情報:${NC}"
echo "$CERT_INFO"
echo

if [ "$CERT_STATE" == "ACTIVE" ]; then
  echo -e "${GREEN}証明書の状態: ACTIVE${NC}"
  echo -e "証明書は正常にプロビジョニングされています。"
elif [ "$CERT_STATE" == "PROVISIONING" ]; then
  echo -e "${YELLOW}証明書の状態: PROVISIONING${NC}"
  echo -e "証明書はまだプロビジョニング中です。後ほど再確認してください。"
else
  echo -e "${RED}証明書の状態: ${CERT_STATE}${NC}"
  echo -e "必要に応じてトラブルシューティングを行ってください。"
fi

# 証明書の有効期限を抽出して表示（存在する場合）
EXPIRY_TIME=$(echo "$CERT_INFO" | grep -E "expireTime:" | awk '{print $2}')
if [ ! -z "$EXPIRY_TIME" ]; then
  echo -e "\n${BLUE}有効期限:${NC} ${YELLOW}${EXPIRY_TIME}${NC}"
fi

exit 0