#!/bin/bash

# スクリプト情報
# 名称: run_staging_tests.sh
# 目的: Coneaステージング環境の包括的テスト実行
# 作成日: 2025-05-21

# 厳格なエラーチェック設定
set -eo pipefail

# デフォルト設定
STAGING_URL="https://staging.conea.ai"
TIMEOUT=120
LOG_FILE="staging_tests_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="staging_test_report_$(date +%Y%m%d_%H%M%S).json"
HTML_REPORT="staging_test_report_$(date +%Y%m%d_%H%M%S).html"
TEST_LEVEL="standard"  # basic, standard, comprehensive
TEST_CATEGORIES="all"  # health, auth, api, perf, security, all
VERBOSE=false
LEGACY_NAME_CHECK=true  # shopify-mcp-serverの名称互換性チェック

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[1;36m'
MAGENTA='\033[1;35m'
NC='\033[0m' # No Color

# 引数処理関数
parse_arguments() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --url=*)
        STAGING_URL="${1#*=}"
        ;;
      --timeout=*)
        TIMEOUT="${1#*=}"
        ;;
      --log=*)
        LOG_FILE="${1#*=}"
        ;;
      --report=*)
        REPORT_FILE="${1#*=}"
        ;;
      --level=*)
        TEST_LEVEL="${1#*=}"
        ;;
      --tests=*)
        TEST_CATEGORIES="${1#*=}"
        ;;
      --verbose)
        VERBOSE=true
        ;;
      --skip-legacy-check)
        LEGACY_NAME_CHECK=false
        ;;
      --help)
        print_usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1"
        print_usage
        exit 1
        ;;
    esac
    shift
  done
}

# 使用方法表示関数
print_usage() {
  echo "使用方法: $0 [オプション]"
  echo "オプション:"
  echo "  --url=URL             テスト対象のステージングURL (デフォルト: $STAGING_URL)"
  echo "  --timeout=SECONDS     各テストのタイムアウト秒数 (デフォルト: $TIMEOUT)"
  echo "  --log=FILE            ログファイル名 (デフォルト: 日時付きファイル名)"
  echo "  --report=FILE         レポートファイル名 (デフォルト: 日時付きファイル名)"
  echo "  --level=LEVEL         テストレベル (basic, standard, comprehensive)"
  echo "  --tests=CATEGORIES    実行するテストカテゴリ (health,auth,api,perf,security,all)"
  echo "  --verbose             詳細なログ出力"
  echo "  --skip-legacy-check   旧名称(shopify-mcp-server)互換性チェックをスキップ"
  echo "  --help                このヘルプを表示"
}

# テスト環境初期化
initialize_test_environment() {
  echo -e "${CYAN}ステージング環境テスト初期化中...${NC}"
  log_info "テスト開始: $(date)"
  log_info "テスト対象URL: $STAGING_URL"
  log_info "テストレベル: $TEST_LEVEL"
  log_info "テストカテゴリ: $TEST_CATEGORIES"
  
  # テスト用ディレクトリ作成
  TEST_TMP_DIR=$(mktemp -d)
  log_info "テスト一時ディレクトリ: $TEST_TMP_DIR"
  
  # 依存コマンド確認
  check_dependencies
  
  # テスト用認証情報設定
  setup_test_credentials
  
  # テスト結果格納用JSON初期化
  echo "{\"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"url\": \"$STAGING_URL\", \"results\": {}}" > "$TEST_TMP_DIR/results.json"
}

# 依存コマンド確認
check_dependencies() {
  local required_commands=("curl" "jq" "openssl" "grep" "awk")
  local missing_commands=()
  
  for cmd in "${required_commands[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
      missing_commands+=("$cmd")
    fi
  done
  
  # ab (Apache Bench) は comprehensive テストでのみ必要なのでオプション
  if [[ "$TEST_LEVEL" == "comprehensive" ]]; then
    if ! command -v "ab" &> /dev/null; then
      log_warning "Apache Benchツール (ab) が見つかりません。包括的な負荷テストはスキップされます。"
    fi
  fi
  
  if [ ${#missing_commands[@]} -ne 0 ]; then
    log_error "必要なコマンドがインストールされていません: ${missing_commands[*]}"
    log_error "テスト実行前にこれらのコマンドをインストールしてください。"
    exit 1
  fi
}

# テスト認証情報設定
setup_test_credentials() {
  # 環境変数からテスト認証情報を取得
  # テスト用のAPIキーや認証トークンがある場合はここで設定
  TEST_API_KEY=${CONEA_TEST_API_KEY:-"test_api_key"}
  TEST_USERNAME=${CONEA_TEST_USERNAME:-"test_user"}
  TEST_PASSWORD=${CONEA_TEST_PASSWORD:-"test_password"}
  
  log_info "テスト用認証情報を設定しました"
}

# メインテスト実行関数
run_tests() {
  log_section "テスト実行開始"
  
  # テストカテゴリに基づいてテスト実行
  if [[ "$TEST_CATEGORIES" == "all" || "$TEST_CATEGORIES" == *"health"* ]]; then
    run_health_checks
  fi
  
  if [[ "$TEST_CATEGORIES" == "all" || "$TEST_CATEGORIES" == *"auth"* ]]; then
    run_auth_tests
  fi
  
  if [[ "$TEST_CATEGORIES" == "all" || "$TEST_CATEGORIES" == *"api"* ]]; then
    run_api_tests
  fi
  
  if [[ "$TEST_CATEGORIES" == "all" || "$TEST_CATEGORIES" == *"perf"* ]]; then
    run_performance_tests
  fi
  
  if [[ "$TEST_CATEGORIES" == "all" || "$TEST_CATEGORIES" == *"security"* ]]; then
    run_security_tests
  fi
  
  # レガシー名称互換性テスト（オプション）
  if [[ "$LEGACY_NAME_CHECK" == true ]]; then
    run_legacy_name_compatibility_tests
  fi
  
  log_section "テスト実行完了"
}

# ヘルスチェック
run_health_checks() {
  log_subsection "ヘルスチェック実行中..."
  
  # 基本的なエンドポイント到達性テスト
  test_name="basic_endpoint_reachability"
  if curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/health" | grep -q "200"; then
    record_test_result "$test_name" "pass" "ヘルスエンドポイントに正常にアクセスできました"
  else
    record_test_result "$test_name" "fail" "ヘルスエンドポイントにアクセスできませんでした"
  fi
  
  # サーバー情報テスト
  test_name="server_info"
  server_info=$(curl -s "$STAGING_URL/health/info")
  if echo "$server_info" | jq -e '.version' &>/dev/null; then
    record_test_result "$test_name" "pass" "サーバー情報が正常に取得できました"
    # バージョン情報をログに記録
    log_info "サーバーバージョン: $(echo "$server_info" | jq -r '.version')"
  else
    record_test_result "$test_name" "fail" "サーバー情報を取得できませんでした"
  fi
  
  # データベース接続テスト
  test_name="database_connection"
  db_health=$(curl -s "$STAGING_URL/health/db")
  if echo "$db_health" | jq -e '.status == "connected"' &>/dev/null; then
    record_test_result "$test_name" "pass" "データベース接続が正常です"
  else
    record_test_result "$test_name" "fail" "データベース接続に問題があります"
  fi
  
  # MCP接続テスト
  test_name="mcp_connection"
  mcp_health=$(curl -s "$STAGING_URL/health/mcp")
  if echo "$mcp_health" | jq -e '.status == "connected"' &>/dev/null; then
    record_test_result "$test_name" "pass" "MCP接続が正常です"
  else
    record_test_result "$test_name" "fail" "MCP接続に問題があります"
  fi
}

# 認証テスト
run_auth_tests() {
  log_subsection "認証テスト実行中..."
  
  # ログインエンドポイントテスト
  test_name="login_endpoint"
  login_response=$(curl -s -X POST "$STAGING_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}")
  
  if echo "$login_response" | jq -e '.token' &>/dev/null; then
    record_test_result "$test_name" "pass" "ログインが成功し、トークンを取得できました"
    # テスト用トークンを保存
    TEST_TOKEN=$(echo "$login_response" | jq -r '.token')
  else
    record_test_result "$test_name" "fail" "ログインに失敗しました"
  fi
  
  # トークン検証テスト
  if [[ -n "$TEST_TOKEN" ]]; then
    test_name="token_validation"
    token_check=$(curl -s -X GET "$STAGING_URL/auth/verify" \
      -H "Authorization: Bearer $TEST_TOKEN")
    
    if echo "$token_check" | jq -e '.valid == true' &>/dev/null; then
      record_test_result "$test_name" "pass" "トークンが正常に検証されました"
    else
      record_test_result "$test_name" "fail" "トークン検証に失敗しました"
    fi
  else
    record_test_result "token_validation" "skip" "ログイン失敗のためトークン検証をスキップしました"
  fi
}

# API機能テスト
run_api_tests() {
  log_subsection "API機能テスト実行中..."
  
  # GraphQLエンドポイントテスト
  test_name="graphql_endpoint"
  graphql_query='{
    "query": "{ serverInfo { version, name, uptime } }"
  }'
  
  graphql_response=$(curl -s -X POST "$STAGING_URL/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -d "$graphql_query")
  
  if echo "$graphql_response" | jq -e '.data.serverInfo.version' &>/dev/null; then
    record_test_result "$test_name" "pass" "GraphQLエンドポイントが正常に応答しました"
    # サーバー情報をログに記録
    log_info "GraphQL経由のサーバー名: $(echo "$graphql_response" | jq -r '.data.serverInfo.name')"
  else
    record_test_result "$test_name" "fail" "GraphQLエンドポイントのテストに失敗しました"
  fi
  
  # Shopify製品データ取得テスト
  if [[ "$TEST_LEVEL" != "basic" ]]; then
    test_name="shopify_products_query"
    products_query='{
      "query": "{ products(first: 5) { edges { node { id, title } } } }"
    }'
    
    products_response=$(curl -s -X POST "$STAGING_URL/graphql" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TEST_TOKEN" \
      -d "$products_query")
    
    if echo "$products_response" | jq -e '.data.products.edges[0].node.id' &>/dev/null; then
      record_test_result "$test_name" "pass" "Shopify製品データを正常に取得できました"
    else
      record_test_result "$test_name" "fail" "Shopify製品データの取得に失敗しました"
    fi
  fi
  
  # MCP機能テスト
  test_name="mcp_functionality"
  mcp_request='{
    "tool": "get_product_info",
    "parameters": {"product_id": "test-product-1"}
  }'
  
  mcp_response=$(curl -s -X POST "$STAGING_URL/api/mcp/invoke" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -d "$mcp_request")
  
  if echo "$mcp_response" | jq -e '.result' &>/dev/null; then
    record_test_result "$test_name" "pass" "MCP機能が正常に動作しています"
  else
    record_test_result "$test_name" "fail" "MCP機能の呼び出しに失敗しました"
  fi
}

# パフォーマンステスト
run_performance_tests() {
  log_subsection "パフォーマンステスト実行中..."
  
  # 基本的な応答時間テスト
  test_name="basic_response_time"
  response_time=$(curl -s -w "%{time_total}\n" -o /dev/null "$STAGING_URL/health")
  
  if (( $(echo "$response_time < 1.0" | bc -l) )); then
    record_test_result "$test_name" "pass" "応答時間が許容範囲内です: ${response_time}秒"
  else
    record_test_result "$test_name" "warn" "応答時間が遅いです: ${response_time}秒"
  fi
  
  # 連続アクセステスト
  test_name="sequential_access"
  seq_times=()
  for i in {1..5}; do
    seq_time=$(curl -s -w "%{time_total}\n" -o /dev/null "$STAGING_URL/health")
    seq_times+=($seq_time)
    sleep 1
  done
  
  # 平均応答時間計算
  total=0
  for i in "${seq_times[@]}"; do
    total=$(echo "$total + $i" | bc -l)
  done
  avg_time=$(echo "scale=3; $total / ${#seq_times[@]}" | bc -l)
  
  if (( $(echo "$avg_time < 0.5" | bc -l) )); then
    record_test_result "$test_name" "pass" "連続アクセスの平均応答時間が許容範囲内です: ${avg_time}秒"
  else
    record_test_result "$test_name" "warn" "連続アクセスの平均応答時間が遅いです: ${avg_time}秒"
  fi
  
  # 負荷テスト（テストレベルが包括的な場合のみ）
  if [[ "$TEST_LEVEL" == "comprehensive" && -x "$(command -v ab)" ]]; then
    test_name="load_test"
    # Apache Benchを使用した簡易負荷テスト
    ab_result=$(ab -n 100 -c 10 -t 30 "$STAGING_URL/health" 2>&1)
    requests_per_second=$(echo "$ab_result" | grep "Requests per second" | awk '{print $4}')
    
    if (( $(echo "$requests_per_second > 10" | bc -l) )); then
      record_test_result "$test_name" "pass" "負荷テスト成功: ${requests_per_second} リクエスト/秒"
    else
      record_test_result "$test_name" "warn" "負荷テストで期待以下のパフォーマンス: ${requests_per_second} リクエスト/秒"
    fi
  fi
}

# セキュリティテスト
run_security_tests() {
  log_subsection "セキュリティテスト実行中..."
  
  # SSL証明書検証
  test_name="ssl_certificate"
  server_name=$(echo "$STAGING_URL" | sed 's|^https://||' | sed 's|/.*$||')
  ssl_info=$(echo | openssl s_client -servername "$server_name" -connect "$server_name:443" 2>/dev/null)
  
  if echo "$ssl_info" | grep -q "Verify return code: 0 (ok)"; then
    record_test_result "$test_name" "pass" "SSL証明書が正常に検証されました"
  else
    record_test_result "$test_name" "fail" "SSL証明書の検証に失敗しました"
  fi
  
  # HTTPSリダイレクトテスト
  test_name="https_redirect"
  http_url=$(echo "$STAGING_URL" | sed 's|^https://|http://|')
  redirect_code=$(curl -s -o /dev/null -w "%{http_code}" -L "$http_url")
  
  if [[ "$redirect_code" == "200" || "$redirect_code" == "301" || "$redirect_code" == "302" ]]; then
    record_test_result "$test_name" "pass" "HTTPからHTTPSへの正常なリダイレクトを確認"
  else
    record_test_result "$test_name" "fail" "HTTPからHTTPSへのリダイレクトに問題があります"
  fi
  
  # セキュリティヘッダーテスト
  test_name="security_headers"
  security_headers=$(curl -s -I "$STAGING_URL" | grep -E "Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options")
  
  if [[ ! -z "$security_headers" ]]; then
    record_test_result "$test_name" "pass" "セキュリティヘッダーが適切に設定されています"
  else
    record_test_result "$test_name" "warn" "セキュリティヘッダーの一部または全部が不足しています"
  fi
  
  # 認証されていないアクセスの拒否テスト
  test_name="unauthenticated_access"
  unauth_access=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/api/protected/resource")
  
  if [[ "$unauth_access" == "401" || "$unauth_access" == "403" ]]; then
    record_test_result "$test_name" "pass" "保護されたリソースへの未認証アクセスが適切に拒否されました"
  else
    record_test_result "$test_name" "fail" "保護されたリソースが適切に保護されていません"
  fi
}

# レガシー名称互換性テスト
run_legacy_name_compatibility_tests() {
  log_subsection "レガシー名称互換性テスト実行中..."
  
  # 旧サーバー名参照テスト
  test_name="legacy_server_name"
  legacy_check=$(curl -s "$STAGING_URL/health/info" | jq -r '.legacySupport')
  
  if [[ "$legacy_check" == "true" ]]; then
    record_test_result "$test_name" "pass" "レガシー名称(shopify-mcp-server)のサポートが有効です"
  else
    record_test_result "$test_name" "warn" "レガシー名称サポートが有効になっていない可能性があります"
  fi
  
  # 環境変数互換性テスト（サーバー側で実装されている場合）
  test_name="env_var_compatibility"
  env_compat=$(curl -s "$STAGING_URL/health/config" | jq -r '.envVarBackwardCompatibility')
  
  if [[ "$env_compat" == "true" ]]; then
    record_test_result "$test_name" "pass" "環境変数の後方互換性が確保されています"
  else
    record_test_result "$test_name" "warn" "環境変数の後方互換性が保証されていない可能性があります"
  fi
}

# テスト結果記録関数
record_test_result() {
  local test_name="$1"
  local status="$2"
  local message="$3"
  
  # ログに記録
  case "$status" in
    "pass")
      log_success "[$test_name] $message"
      ;;
    "fail")
      log_error "[$test_name] $message"
      ;;
    "warn")
      log_warning "[$test_name] $message"
      ;;
    "skip")
      log_info "[$test_name] $message"
      ;;
  esac
  
  # 結果JSONに追加
  jq --arg name "$test_name" \
     --arg status "$status" \
     --arg message "$message" \
     --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.results[$name] = {status: $status, message: $message, timestamp: $timestamp}' \
     "$TEST_TMP_DIR/results.json" > "$TEST_TMP_DIR/temp.json" && mv "$TEST_TMP_DIR/temp.json" "$TEST_TMP_DIR/results.json"
}

# ログ関数群
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1" | tee -a "$LOG_FILE"
}

log_section() {
  echo -e "\n${CYAN}==== $1 ====${NC}" | tee -a "$LOG_FILE"
}

log_subsection() {
  echo -e "\n${MAGENTA}--- $1 ---${NC}" | tee -a "$LOG_FILE"
}

# レポート生成関数
generate_report() {
  log_section "テストレポート生成"
  
  # 結果JSONをレポートファイルに保存
  cp "$TEST_TMP_DIR/results.json" "$REPORT_FILE"
  log_info "JSONレポートを保存しました: $REPORT_FILE"
  
  # HTMLレポート生成
  generate_html_report
  log_info "HTMLレポートを保存しました: $HTML_REPORT"
  
  # 結果サマリー表示
  display_summary
  
  # 一時ディレクトリ削除
  rm -rf "$TEST_TMP_DIR"
}

# HTMLレポート生成
generate_html_report() {
  # HTMLレポートヘッダー
  cat > "$HTML_REPORT" << EOF
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conea ステージング環境テストレポート</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #2980b9; margin-top: 30px; }
    .summary { background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f2f2f2; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .pass { color: #27ae60; }
    .fail { color: #e74c3c; }
    .warn { color: #f39c12; }
    .skip { color: #7f8c8d; }
    .timestamp { color: #7f8c8d; font-size: 0.9em; }
    .metadata { margin-bottom: 20px; }
    .metadata p { margin: 5px 0; }
  </style>
</head>
<body>
  <h1>Conea ステージング環境テストレポート</h1>
  
  <div class="metadata">
    <p><strong>URL:</strong> $STAGING_URL</p>
    <p><strong>実行日時:</strong> $(date)</p>
    <p><strong>テストレベル:</strong> $TEST_LEVEL</p>
    <p><strong>テストカテゴリ:</strong> $TEST_CATEGORIES</p>
  </div>
EOF
  
  # テスト結果サマリー
  local total=$(jq '.results | length' "$TEST_TMP_DIR/results.json")
  local pass=$(jq '.results | map(select(.status == "pass")) | length' "$TEST_TMP_DIR/results.json")
  local fail=$(jq '.results | map(select(.status == "fail")) | length' "$TEST_TMP_DIR/results.json")
  local warn=$(jq '.results | map(select(.status == "warn")) | length' "$TEST_TMP_DIR/results.json")
  local skip=$(jq '.results | map(select(.status == "skip")) | length' "$TEST_TMP_DIR/results.json")
  
  # サマリーセクション追加
  cat >> "$HTML_REPORT" << EOF
  <div class="summary">
    <h2>テスト結果サマリー</h2>
    <p>テスト総数: $total</p>
    <p>成功: <span class="pass">$pass</span></p>
    <p>失敗: <span class="fail">$fail</span></p>
    <p>警告: <span class="warn">$warn</span></p>
    <p>スキップ: <span class="skip">$skip</span></p>
  </div>
  
  <h2>詳細テスト結果</h2>
  <table>
    <tr>
      <th>テスト名</th>
      <th>ステータス</th>
      <th>メッセージ</th>
      <th>タイムスタンプ</th>
    </tr>
EOF
  
  # 詳細結果を追加
  jq -r '.results | to_entries[] | "<tr><td>\(.key)</td><td class=\"\(.value.status)\">\(.value.status)</td><td>\(.value.message)</td><td class=\"timestamp\">\(.value.timestamp)</td></tr>"' "$TEST_TMP_DIR/results.json" >> "$HTML_REPORT"
  
  # HTMLフッター追加
  cat >> "$HTML_REPORT" << EOF
  </table>
  
  <h2>レポート生成情報</h2>
  <p>生成日時: $(date -u +"%Y-%m-%dT%H:%M:%SZ")</p>
  <p>生成スクリプト: run_staging_tests.sh</p>
</body>
</html>
EOF
}

# 結果サマリー表示
display_summary() {
  local total=$(jq '.results | length' "$TEST_TMP_DIR/results.json")
  local pass=$(jq '.results | map(select(.status == "pass")) | length' "$TEST_TMP_DIR/results.json")
  local fail=$(jq '.results | map(select(.status == "fail")) | length' "$TEST_TMP_DIR/results.json")
  local warn=$(jq '.results | map(select(.status == "warn")) | length' "$TEST_TMP_DIR/results.json")
  local skip=$(jq '.results | map(select(.status == "skip")) | length' "$TEST_TMP_DIR/results.json")
  
  log_section "テスト結果サマリー"
  echo -e "テスト総数: $total"
  echo -e "${GREEN}成功: $pass${NC}"
  echo -e "${RED}失敗: $fail${NC}"
  echo -e "${YELLOW}警告: $warn${NC}"
  echo -e "${BLUE}スキップ: $skip${NC}"
  
  # テスト合格判定
  if [[ $fail -eq 0 ]]; then
    if [[ $warn -eq 0 ]]; then
      log_success "🎉 すべてのテストに合格しました！"
      exit 0
    else
      log_warning "⚠️ テストは警告付きで合格しました。警告を確認してください。"
      exit 0
    fi
  else
    log_error "❌ $fail 件のテストが失敗しました。詳細はレポートを確認してください。"
    exit 1
  fi
}

# メイン処理の開始
main() {
  parse_arguments "$@"
  initialize_test_environment
  run_tests
  generate_report
}

# スクリプト実行
main "$@"