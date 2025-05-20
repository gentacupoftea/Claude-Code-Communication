#!/bin/bash

# 楽天API実テスト用 - 改良版実行スクリプト
# 既存の問題を回避して楽天APIのテストを実行します

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# プロジェクトルートパス
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
LOG_FILE="${PROJECT_ROOT}/rakuten_test_improved.log"

# 必要なパッケージ確認
echo -e "${CYAN}===== 必要なパッケージ確認 =====${NC}"
required_packages=("aiohttp" "cachetools" "httpx" "pydantic>=2.0.0" "fastapi" "uvicorn")

for package in "${required_packages[@]}"; do
  echo -n "Checking $package... "
  if pip install "$package" &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}Failed${NC}"
    exit 1
  fi
done

# モックサーバー起動と確認
echo -e "${CYAN}===== モックサーバーの起動確認 =====${NC}"
echo "ensure_mock_server.pyスクリプトを使用して確実にモックサーバーを起動します..."

python3 "${PROJECT_ROOT}/tests/api/rakuten/ensure_mock_server.py"
if [ $? -ne 0 ]; then
  echo -e "${RED}モックサーバーの起動に失敗しました${NC}"
  exit 1
fi

# サーバーのPIDを取得
MOCK_SERVER_PID=$(pgrep -f "python3.*mock_rakuten_server.py") || true
if [ -n "$MOCK_SERVER_PID" ]; then
  echo -e "${GREEN}モックサーバーが稼働中です (PID: ${MOCK_SERVER_PID})${NC}"
else
  echo -e "${YELLOW}警告: モックサーバーのPIDを特定できませんでした${NC}"
fi

# テスト実行
echo -e "${CYAN}===== 楽天APIテスト実行 =====${NC}"
echo "環境変数を設定して直接テストスクリプトを実行します..."

# 環境変数設定
export RAKUTEN_BASE_URL="http://127.0.0.1:8080"
export RAKUTEN_SERVICE_SECRET="mock_service_secret"
export RAKUTEN_LICENSE_KEY="mock_license_key"
export RAKUTEN_SHOP_ID="mock_shop_id"
export RAKUTEN_TEST_MODE="true"

# コマンドライン引数の解析
ENABLE_RATE_LIMIT_TEST=false
if [ "$1" == "--enable-rate-limit-test" ] || [ "$1" == "-r" ]; then
  ENABLE_RATE_LIMIT_TEST=true
  echo -e "${YELLOW}レート制限テストを有効化しました${NC}"
fi

# 実行
if [ "$ENABLE_RATE_LIMIT_TEST" = true ]; then
  (cd "$PROJECT_ROOT" && python3 ./tests/api/rakuten/run_rakuten_tests.py --enable-rate-limit-test | tee -a "$LOG_FILE")
else
  (cd "$PROJECT_ROOT" && python3 ./tests/api/rakuten/run_rakuten_tests.py | tee -a "$LOG_FILE")
fi
TEST_RESULT=$?

# モックサーバー停止
echo -e "${CYAN}===== モックサーバーを停止 =====${NC}"
kill $MOCK_SERVER_PID
echo -e "${GREEN}モックサーバーを停止しました${NC}"

# 結果表示
echo -e "${CYAN}===== テスト結果 =====${NC}"
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}テストが成功しました${NC}"
else
  echo -e "${YELLOW}テストが完了しましたが、一部エラーがありました${NC}"
  echo "ログファイル: $LOG_FILE"
fi

echo -e "詳細レポートは rakuten_api_test_report.json を確認してください"
echo -e "${BLUE}===== テスト終了 =====${NC}"

exit $TEST_RESULT