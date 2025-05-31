#!/bin/bash
# Shopify MCP Server - ステージング環境検証スクリプト
# Usage: ./verify_staging.sh [--dns-only|--https-only|--api-only|--all]

set -e  # エラー発生時に停止

# 色付きの出力関数
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# バナー表示
echo "======================================================"
echo "    Shopify MCP Server - ステージング環境検証ツール    "
echo "======================================================"
echo ""

# 設定ファイルのチェック
if [ -f .env.staging ]; then
  info "環境変数ファイルを読み込みます..."
  source .env.staging
else
  warn ".env.stagingファイルが見つかりません。デフォルト値を使用します。"
fi

# デフォルト値の設定
DOMAIN_NAME=${DOMAIN_NAME:-"staging.conea.ai"}
EXPECTED_IP=${EXPECTED_IP:-"34.120.0.79"}
TEST_API_KEY=${TEST_API_KEY:-"test-api-key-for-staging"}

# 結果ディレクトリの作成
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULT_DIR="verification_results_${TIMESTAMP}"
mkdir -p "$RESULT_DIR"

# DNSレコード伝播確認
verify_dns() {
  info "DNSレコードの確認を開始..."
  echo "# DNSレコード検証結果" > "$RESULT_DIR/dns_verification.md"
  echo "実施日時: $(date)" >> "$RESULT_DIR/dns_verification.md"
  echo "ドメイン: $DOMAIN_NAME" >> "$RESULT_DIR/dns_verification.md"
  echo "期待するIPアドレス: $EXPECTED_IP" >> "$RESULT_DIR/dns_verification.md"
  echo "" >> "$RESULT_DIR/dns_verification.md"
  
  # 複数のDNSサーバーで確認
  DNS_SERVERS=("8.8.8.8" "1.1.1.1" "208.67.222.222")
  DNS_SUCCESS=true
  
  echo "## DNS検証結果（複数サーバー）" >> "$RESULT_DIR/dns_verification.md"
  echo "| DNSサーバー | 応答IPアドレス | 結果 |" >> "$RESULT_DIR/dns_verification.md"
  echo "|------------|--------------|------|" >> "$RESULT_DIR/dns_verification.md"
  
  for server in "${DNS_SERVERS[@]}"; do
    info "DNSサーバー ${server} で確認中..."
    RESULT=$(dig +short $DOMAIN_NAME @$server)
    
    if [ -z "$RESULT" ]; then
      echo "| $server | 応答なし | ❌ |" >> "$RESULT_DIR/dns_verification.md"
      DNS_SUCCESS=false
    elif [ "$RESULT" = "$EXPECTED_IP" ]; then
      echo "| $server | $RESULT | ✅ |" >> "$RESULT_DIR/dns_verification.md"
    else
      echo "| $server | $RESULT | ❌ (不一致) |" >> "$RESULT_DIR/dns_verification.md"
      DNS_SUCCESS=false
    fi
  done
  
  echo "" >> "$RESULT_DIR/dns_verification.md"
  
  # ローカルDNS解決確認
  info "ローカルDNS解決を確認中..."
  LOCAL_RESULT=$(dig +short $DOMAIN_NAME)
  echo "## ローカルDNS解決結果" >> "$RESULT_DIR/dns_verification.md"
  
  if [ -z "$LOCAL_RESULT" ]; then
    echo "応答なし ❌" >> "$RESULT_DIR/dns_verification.md"
    DNS_SUCCESS=false
  elif [ "$LOCAL_RESULT" = "$EXPECTED_IP" ]; then
    echo "IPアドレス: $LOCAL_RESULT ✅" >> "$RESULT_DIR/dns_verification.md"
  else
    echo "IPアドレス: $LOCAL_RESULT ❌ (期待値: $EXPECTED_IP)" >> "$RESULT_DIR/dns_verification.md"
    DNS_SUCCESS=false
  fi
  
  echo "" >> "$RESULT_DIR/dns_verification.md"
  
  # 結果サマリー
  if [ "$DNS_SUCCESS" = true ]; then
    success "DNS検証: 成功"
    echo "## 総合判定: ✅ 成功" >> "$RESULT_DIR/dns_verification.md"
    echo "すべてのDNSサーバーが正しいIPアドレス($EXPECTED_IP)を返しています。" >> "$RESULT_DIR/dns_verification.md"
  else
    error "DNS検証: 失敗"
    echo "## 総合判定: ❌ 失敗" >> "$RESULT_DIR/dns_verification.md"
    echo "一部またはすべてのDNSサーバーが正しいIPアドレスを返していません。" >> "$RESULT_DIR/dns_verification.md"
    echo "考えられる原因:" >> "$RESULT_DIR/dns_verification.md"
    echo "- DNSレコードがまだ更新されていない" >> "$RESULT_DIR/dns_verification.md"
    echo "- DNSの伝播が完了していない" >> "$RESULT_DIR/dns_verification.md"
    echo "- DNSキャッシュが古い情報を保持している" >> "$RESULT_DIR/dns_verification.md"
    echo "" >> "$RESULT_DIR/dns_verification.md"
    echo "対応策:" >> "$RESULT_DIR/dns_verification.md"
    echo "- DNSレコードが正しく更新されたか確認する" >> "$RESULT_DIR/dns_verification.md"
    echo "- しばらく待ってDNSの伝播を待つ（最大24時間）" >> "$RESULT_DIR/dns_verification.md"
    echo "- ローカルDNSキャッシュをクリアする" >> "$RESULT_DIR/dns_verification.md"
  fi
  
  return $([[ "$DNS_SUCCESS" = true ]] && echo 0 || echo 1)
}

# HTTPS接続確認
verify_https() {
  info "HTTPS接続の確認を開始..."
  echo "# HTTPS接続検証結果" > "$RESULT_DIR/https_verification.md"
  echo "実施日時: $(date)" >> "$RESULT_DIR/https_verification.md"
  echo "ドメイン: $DOMAIN_NAME" >> "$RESULT_DIR/https_verification.md"
  echo "" >> "$RESULT_DIR/https_verification.md"
  
  HTTPS_SUCCESS=true
  
  # 基本接続テスト
  info "基本接続テストを実行中..."
  echo "## 基本接続テスト" >> "$RESULT_DIR/https_verification.md"
  echo '```' >> "$RESULT_DIR/https_verification.md"
  
  CURL_RESULT=$(curl -I https://$DOMAIN_NAME 2>&1)
  CURL_EXIT_CODE=$?
  
  echo "$CURL_RESULT" >> "$RESULT_DIR/https_verification.md"
  echo '```' >> "$RESULT_DIR/https_verification.md"
  
  if [ $CURL_EXIT_CODE -eq 0 ]; then
    if echo "$CURL_RESULT" | grep -q "HTTP/"; then
      success "基本接続テスト: 成功"
      echo "### 結果: ✅ 成功" >> "$RESULT_DIR/https_verification.md"
    else
      error "基本接続テスト: 失敗"
      echo "### 結果: ❌ 失敗" >> "$RESULT_DIR/https_verification.md"
      HTTPS_SUCCESS=false
    fi
  else
    error "基本接続テスト: 失敗"
    echo "### 結果: ❌ 失敗" >> "$RESULT_DIR/https_verification.md"
    HTTPS_SUCCESS=false
  fi
  
  echo "" >> "$RESULT_DIR/https_verification.md"
  
  # SSL証明書検証
  info "SSL証明書を検証中..."
  echo "## SSL証明書検証" >> "$RESULT_DIR/https_verification.md"
  echo '```' >> "$RESULT_DIR/https_verification.md"
  
  SSL_RESULT=$(openssl s_client -connect $DOMAIN_NAME:443 -servername $DOMAIN_NAME </dev/null 2>/dev/null | openssl x509 -noout -text | grep -A2 "Validity")
  SSL_EXIT_CODE=$?
  
  if [ $SSL_EXIT_CODE -eq 0 ] && [ ! -z "$SSL_RESULT" ]; then
    echo "$SSL_RESULT" >> "$RESULT_DIR/https_verification.md"
    echo '```' >> "$RESULT_DIR/https_verification.md"
    
    success "SSL証明書検証: 成功"
    echo "### 結果: ✅ 成功" >> "$RESULT_DIR/https_verification.md"
  else
    echo "SSL証明書を取得できませんでした" >> "$RESULT_DIR/https_verification.md"
    echo '```' >> "$RESULT_DIR/https_verification.md"
    
    error "SSL証明書検証: 失敗"
    echo "### 結果: ❌ 失敗" >> "$RESULT_DIR/https_verification.md"
    HTTPS_SUCCESS=false
  fi
  
  echo "" >> "$RESULT_DIR/https_verification.md"
  
  # 結果サマリー
  if [ "$HTTPS_SUCCESS" = true ]; then
    success "HTTPS検証: 成功"
    echo "## 総合判定: ✅ 成功" >> "$RESULT_DIR/https_verification.md"
    echo "HTTPS接続とSSL証明書の検証に成功しました。" >> "$RESULT_DIR/https_verification.md"
  else
    error "HTTPS検証: 失敗"
    echo "## 総合判定: ❌ 失敗" >> "$RESULT_DIR/https_verification.md"
    echo "HTTPS接続またはSSL証明書の検証に失敗しました。" >> "$RESULT_DIR/https_verification.md"
    echo "考えられる原因:" >> "$RESULT_DIR/https_verification.md"
    echo "- DNSレコードが正しく更新されていない" >> "$RESULT_DIR/https_verification.md"
    echo "- SSL証明書がまだプロビジョニング中" >> "$RESULT_DIR/https_verification.md"
    echo "- ロードバランサーの設定が不完全" >> "$RESULT_DIR/https_verification.md"
    echo "- Cloud Runサービスが応答していない" >> "$RESULT_DIR/https_verification.md"
    echo "" >> "$RESULT_DIR/https_verification.md"
    echo "対応策:" >> "$RESULT_DIR/https_verification.md"
    echo "- DNSレコードが正しいIPアドレスを指しているか確認する" >> "$RESULT_DIR/https_verification.md"
    echo "- GCPコンソールでSSL証明書のステータスを確認する" >> "$RESULT_DIR/https_verification.md"
    echo "- ロードバランサーとCloud Runサービスの設定を確認する" >> "$RESULT_DIR/https_verification.md"
  fi
  
  return $([[ "$HTTPS_SUCCESS" = true ]] && echo 0 || echo 1)
}

# API基本機能確認
verify_api() {
  info "API機能の確認を開始..."
  echo "# API機能検証結果" > "$RESULT_DIR/api_verification.md"
  echo "実施日時: $(date)" >> "$RESULT_DIR/api_verification.md"
  echo "ドメイン: $DOMAIN_NAME" >> "$RESULT_DIR/api_verification.md"
  echo "" >> "$RESULT_DIR/api_verification.md"
  
  API_SUCCESS=true
  
  # ヘルスチェック
  info "ヘルスチェックエンドポイントを確認中..."
  echo "## ヘルスチェック" >> "$RESULT_DIR/api_verification.md"
  echo '```' >> "$RESULT_DIR/api_verification.md"
  
  HEALTH_RESULT=$(curl -s https://$DOMAIN_NAME/health 2>&1)
  HEALTH_EXIT_CODE=$?
  
  echo "$HEALTH_RESULT" >> "$RESULT_DIR/api_verification.md"
  echo '```' >> "$RESULT_DIR/api_verification.md"
  
  if [ $HEALTH_EXIT_CODE -eq 0 ] && [ ! -z "$HEALTH_RESULT" ]; then
    if echo "$HEALTH_RESULT" | grep -q "status"; then
      success "ヘルスチェック: 成功"
      echo "### 結果: ✅ 成功" >> "$RESULT_DIR/api_verification.md"
    else
      warn "ヘルスチェック: 応答はあるが期待したJSONではない"
      echo "### 結果: ⚠️ 警告" >> "$RESULT_DIR/api_verification.md"
    fi
  else
    error "ヘルスチェック: 失敗"
    echo "### 結果: ❌ 失敗" >> "$RESULT_DIR/api_verification.md"
    API_SUCCESS=false
  fi
  
  echo "" >> "$RESULT_DIR/api_verification.md"
  
  # 認証テスト
  info "認証エンドポイントを確認中..."
  echo "## 認証テスト" >> "$RESULT_DIR/api_verification.md"
  echo '```' >> "$RESULT_DIR/api_verification.md"
  
  AUTH_RESULT=$(curl -s -X POST https://$DOMAIN_NAME/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "test-user", "password": "test-password"}' 2>&1)
  AUTH_EXIT_CODE=$?
  
  echo "$AUTH_RESULT" >> "$RESULT_DIR/api_verification.md"
  echo '```' >> "$RESULT_DIR/api_verification.md"
  
  if [ $AUTH_EXIT_CODE -eq 0 ] && [ ! -z "$AUTH_RESULT" ]; then
    if echo "$AUTH_RESULT" | grep -q "token"; then
      success "認証テスト: 成功"
      echo "### 結果: ✅ 成功" >> "$RESULT_DIR/api_verification.md"
      
      # トークンを抽出
      AUTH_TOKEN=$(echo "$AUTH_RESULT" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
      echo "認証トークン: $AUTH_TOKEN" >> "$RESULT_DIR/api_verification.md"
      echo "" >> "$RESULT_DIR/api_verification.md"
      
      # トークンを使ったMCP機能テスト
      if [ ! -z "$AUTH_TOKEN" ]; then
        info "MCP機能を確認中..."
        echo "## MCP機能テスト" >> "$RESULT_DIR/api_verification.md"
        echo '```' >> "$RESULT_DIR/api_verification.md"
        
        MCP_RESULT=$(curl -s -X POST https://$DOMAIN_NAME/api/mcp/invoke \
          -H "Authorization: Bearer $AUTH_TOKEN" \
          -H "Content-Type: application/json" \
          -d '{
            "tool": "get_product_info",
            "parameters": {"product_id": "test-product-1"}
          }' 2>&1)
        MCP_EXIT_CODE=$?
        
        echo "$MCP_RESULT" >> "$RESULT_DIR/api_verification.md"
        echo '```' >> "$RESULT_DIR/api_verification.md"
        
        if [ $MCP_EXIT_CODE -eq 0 ] && [ ! -z "$MCP_RESULT" ]; then
          success "MCP機能テスト: 成功"
          echo "### 結果: ✅ 成功" >> "$RESULT_DIR/api_verification.md"
        else
          error "MCP機能テスト: 失敗"
          echo "### 結果: ❌ 失敗" >> "$RESULT_DIR/api_verification.md"
          API_SUCCESS=false
        fi
      fi
    else
      warn "認証テスト: 応答はあるがトークンが含まれていない"
      echo "### 結果: ⚠️ 警告" >> "$RESULT_DIR/api_verification.md"
    fi
  else
    error "認証テスト: 失敗"
    echo "### 結果: ❌ 失敗" >> "$RESULT_DIR/api_verification.md"
    API_SUCCESS=false
  fi
  
  echo "" >> "$RESULT_DIR/api_verification.md"
  
  # 結果サマリー
  if [ "$API_SUCCESS" = true ]; then
    success "API検証: 成功"
    echo "## 総合判定: ✅ 成功" >> "$RESULT_DIR/api_verification.md"
    echo "API基本機能の検証に成功しました。" >> "$RESULT_DIR/api_verification.md"
  else
    error "API検証: 失敗"
    echo "## 総合判定: ❌ 失敗" >> "$RESULT_DIR/api_verification.md"
    echo "API基本機能の検証に失敗しました。" >> "$RESULT_DIR/api_verification.md"
    echo "考えられる原因:" >> "$RESULT_DIR/api_verification.md"
    echo "- APIサーバーが応答していない" >> "$RESULT_DIR/api_verification.md"
    echo "- APIエンドポイントのパスが想定と異なる" >> "$RESULT_DIR/api_verification.md"
    echo "- 認証情報が無効" >> "$RESULT_DIR/api_verification.md"
    echo "" >> "$RESULT_DIR/api_verification.md"
    echo "対応策:" >> "$RESULT_DIR/api_verification.md"
    echo "- Cloud Runサービスのログを確認する" >> "$RESULT_DIR/api_verification.md"
    echo "- APIエンドポイントのパスを確認する" >> "$RESULT_DIR/api_verification.md"
    echo "- テスト用認証情報が正しく設定されているか確認する" >> "$RESULT_DIR/api_verification.md"
  fi
  
  return $([[ "$API_SUCCESS" = true ]] && echo 0 || echo 1)
}

# 総合レポート作成
generate_summary() {
  info "検証結果のサマリーを作成中..."
  
  echo "# Shopify MCPサーバー ステージング環境検証結果" > "$RESULT_DIR/summary.md"
  echo "実施日時: $(date)" >> "$RESULT_DIR/summary.md"
  echo "検証者: $(whoami)" >> "$RESULT_DIR/summary.md"
  echo "" >> "$RESULT_DIR/summary.md"
  
  echo "## 検証項目と結果" >> "$RESULT_DIR/summary.md"
  echo "| 検証項目 | 結果 | 詳細 |" >> "$RESULT_DIR/summary.md"
  echo "|----------|------|------|" >> "$RESULT_DIR/summary.md"
  
  DNS_STATUS="未実施"
  HTTPS_STATUS="未実施"
  API_STATUS="未実施"
  
  if [ -f "$RESULT_DIR/dns_verification.md" ]; then
    if grep -q "総合判定: ✅ 成功" "$RESULT_DIR/dns_verification.md"; then
      DNS_STATUS="✅ 成功"
    else
      DNS_STATUS="❌ 失敗"
    fi
  fi
  
  if [ -f "$RESULT_DIR/https_verification.md" ]; then
    if grep -q "総合判定: ✅ 成功" "$RESULT_DIR/https_verification.md"; then
      HTTPS_STATUS="✅ 成功"
    else
      HTTPS_STATUS="❌ 失敗"
    fi
  fi
  
  if [ -f "$RESULT_DIR/api_verification.md" ]; then
    if grep -q "総合判定: ✅ 成功" "$RESULT_DIR/api_verification.md"; then
      API_STATUS="✅ 成功"
    else
      API_STATUS="❌ 失敗"
    fi
  fi
  
  echo "| DNSレコード検証 | ${DNS_STATUS} | [詳細](dns_verification.md) |" >> "$RESULT_DIR/summary.md"
  echo "| HTTPS接続検証 | ${HTTPS_STATUS} | [詳細](https_verification.md) |" >> "$RESULT_DIR/summary.md"
  echo "| API機能検証 | ${API_STATUS} | [詳細](api_verification.md) |" >> "$RESULT_DIR/summary.md"
  
  echo "" >> "$RESULT_DIR/summary.md"
  
  # 総合判定
  OVERALL_SUCCESS=true
  
  if [[ "$DNS_STATUS" != "✅ 成功" && "$DNS_STATUS" != "未実施" ]] || \
     [[ "$HTTPS_STATUS" != "✅ 成功" && "$HTTPS_STATUS" != "未実施" ]] || \
     [[ "$API_STATUS" != "✅ 成功" && "$API_STATUS" != "未実施" ]]; then
    OVERALL_SUCCESS=false
  fi
  
  if [ "$OVERALL_SUCCESS" = true ]; then
    echo "## 総合判定: ✅ 成功" >> "$RESULT_DIR/summary.md"
    echo "すべての検証項目が成功しているか、未実施です。" >> "$RESULT_DIR/summary.md"
  else
    echo "## 総合判定: ❌ 失敗" >> "$RESULT_DIR/summary.md"
    echo "一部の検証項目が失敗しています。" >> "$RESULT_DIR/summary.md"
  fi
  
  echo "" >> "$RESULT_DIR/summary.md"
  echo "## 次のステップ" >> "$RESULT_DIR/summary.md"
  
  if [ "$OVERALL_SUCCESS" = true ]; then
    echo "1. 自動テストスイートを実行する (./scripts/run_staging_tests.sh)" >> "$RESULT_DIR/summary.md"
    echo "2. モニタリング設定を確認する" >> "$RESULT_DIR/summary.md"
    echo "3. セキュリティスキャンを実行する" >> "$RESULT_DIR/summary.md"
    echo "4. 最終検証レポートを作成する" >> "$RESULT_DIR/summary.md"
  else
    echo "1. 失敗した検証項目の問題を修正する" >> "$RESULT_DIR/summary.md"
    echo "2. 検証を再実行する" >> "$RESULT_DIR/summary.md"
  fi
  
  success "検証結果サマリーを作成しました: $RESULT_DIR/summary.md"
}

# メイン処理
case "$1" in
  "--dns-only")
    verify_dns
    ;;
  "--https-only")
    verify_https
    ;;
  "--api-only")
    verify_api
    ;;
  "--all" | "")
    DNS_RESULT=false
    HTTPS_RESULT=false
    API_RESULT=false
    
    if verify_dns; then
      DNS_RESULT=true
      
      if verify_https; then
        HTTPS_RESULT=true
        
        if verify_api; then
          API_RESULT=true
        fi
      fi
    fi
    
    generate_summary
    
    # 総合結果表示
    echo ""
    echo "======================================================"
    echo "                   検証結果サマリー                   "
    echo "======================================================"
    echo "DNSレコード検証: $([ "$DNS_RESULT" = true ] && echo "✅ 成功" || echo "❌ 失敗")"
    echo "HTTPS接続検証: $([ "$HTTPS_RESULT" = true ] && echo "✅ 成功" || echo "❌ 失敗")"
    echo "API機能検証: $([ "$API_RESULT" = true ] && echo "✅ 成功" || echo "❌ 失敗")"
    echo "======================================================"
    echo "レポート: $RESULT_DIR/summary.md"
    echo "======================================================"
    
    if [ "$DNS_RESULT" = true ] && [ "$HTTPS_RESULT" = true ] && [ "$API_RESULT" = true ]; then
      success "すべての検証が成功しました。次のステップへ進むことができます。"
      exit 0
    else
      error "一部または全ての検証が失敗しました。レポートを確認し、問題を修正してください。"
      exit 1
    fi
    ;;
  *)
    echo "使用法: $0 [--dns-only|--https-only|--api-only|--all]"
    echo ""
    echo "オプション:"
    echo "  --dns-only    DNSレコードの検証のみ実行"
    echo "  --https-only  HTTPS接続の検証のみ実行"
    echo "  --api-only    API機能の検証のみ実行"
    echo "  --all         すべての検証を実行（デフォルト）"
    exit 1
    ;;
esac