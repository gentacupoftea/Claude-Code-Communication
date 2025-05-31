#!/bin/bash
# OptimizedCacheManager - Docker環境でのテスト実行スクリプト
# 目的：コンテナ環境でキャッシュ機能をテストする

set -e

# 設定情報
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." &>/dev/null && pwd)"

# 必要なディレクトリの確認
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/test_results"

print_header() {
  echo
  echo "==============================================================="
  echo "  $1"
  echo "==============================================================="
  echo
}

# Dockerのインストール確認
check_docker() {
  print_header "Docker環境の確認"
  
  if ! command -v docker >/dev/null 2>&1; then
    echo "エラー: Dockerがインストールされていません。"
    echo "https://docs.docker.com/get-docker/ からインストールしてください。"
    exit 1
  fi
  
  if ! command -v docker-compose >/dev/null 2>&1; then
    echo "エラー: Docker Composeがインストールされていません。"
    echo "https://docs.docker.com/compose/install/ からインストールしてください。"
    exit 1
  fi
  
  echo "Docker: $(docker --version)"
  echo "Docker Compose: $(docker-compose --version)"
  echo "Docker環境の確認が完了しました。"
}

# テスト環境のビルドと起動
setup_test_environment() {
  print_header "テスト環境のセットアップ"
  
  echo "Docker イメージをビルド中..."
  cd "$SCRIPT_DIR"
  docker-compose build
  
  echo "コンテナを起動中..."
  docker-compose up -d redis
  
  # Redisの起動待機
  echo "Redisの起動を待機中..."
  sleep 3
  
  echo "Redis接続テスト中..."
  docker-compose exec -T redis redis-cli ping
  
  if [ $? -eq 0 ]; then
    echo "Redis接続テスト: 成功"
  else
    echo "エラー: Redisに接続できません。"
    docker-compose logs redis
    exit 1
  fi
  
  echo "テスト環境のセットアップが完了しました。"
}

# 基本テストの実行
run_basic_tests() {
  print_header "基本テストの実行"
  
  echo "基本機能テストを実行中..."
  docker-compose run --rm app python run_cache_tests.py --iterations 100 --value-size 1024
  
  if [ $? -eq 0 ]; then
    echo "基本テスト: 成功"
    return 0
  else
    echo "基本テスト: 失敗"
    return 1
  fi
}

# パフォーマンステストの実行
run_performance_tests() {
  print_header "パフォーマンステストの実行"
  
  if [ "$SKIP_PERFORMANCE" = "true" ]; then
    echo "パフォーマンステストはスキップします。"
    return 0
  fi
  
  echo "パフォーマンステストを実行中..."
  docker-compose run --rm app python run_cache_tests.py --iterations 10000 --value-size 1024 --concurrency 4
  
  if [ $? -eq 0 ]; then
    echo "パフォーマンステスト: 成功"
    return 0
  else
    echo "パフォーマンステスト: 失敗"
    return 1
  fi
}

# 完全な検証の実行
run_full_verification() {
  print_header "完全検証の実行"
  
  if [ "$SKIP_FULL" = "true" ]; then
    echo "完全検証はスキップします。"
    return 0
  fi
  
  echo "完全検証を実行中..."
  docker-compose run --rm app ./automated_verification.sh
  
  if [ $? -eq 0 ]; then
    echo "完全検証: 成功"
    return 0
  else
    echo "完全検証: 失敗"
    return 1
  fi
}

# テスト環境のクリーンアップ
cleanup() {
  print_header "テスト環境のクリーンアップ"
  
  echo "コンテナを停止中..."
  cd "$SCRIPT_DIR"
  docker-compose down
  
  echo "テスト環境のクリーンアップが完了しました。"
}

# ヘルプメッセージの表示
show_help() {
  echo "使用方法: $0 [オプション]"
  echo ""
  echo "オプション:"
  echo "  --help, -h          このヘルプメッセージを表示"
  echo "  --basic-only        基本テストのみ実行"
  echo "  --skip-performance  パフォーマンステストをスキップ"
  echo "  --skip-full         完全検証をスキップ"
  echo "  --cleanup-only      テスト環境のクリーンアップのみ実行"
  echo ""
  echo "例:"
  echo "  $0                  すべてのテストを実行"
  echo "  $0 --basic-only     基本テストのみ実行"
  echo "  $0 --cleanup-only   テスト環境のクリーンアップのみ実行"
}

# コマンドライン引数の処理
process_args() {
  BASIC_ONLY=false
  SKIP_PERFORMANCE=false
  SKIP_FULL=false
  CLEANUP_ONLY=false
  
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --help|-h)
        show_help
        exit 0
        ;;
      --basic-only)
        BASIC_ONLY=true
        SKIP_PERFORMANCE=true
        SKIP_FULL=true
        ;;
      --skip-performance)
        SKIP_PERFORMANCE=true
        ;;
      --skip-full)
        SKIP_FULL=true
        ;;
      --cleanup-only)
        CLEANUP_ONLY=true
        ;;
      *)
        echo "エラー: 不明なオプション: $1"
        show_help
        exit 1
        ;;
    esac
    shift
  done
}

# メイン実行関数
main() {
  process_args "$@"
  
  if [ "$CLEANUP_ONLY" = "true" ]; then
    cleanup
    exit 0
  fi
  
  check_docker
  setup_test_environment
  
  # 各テストの実行と結果の保存
  run_basic_tests
  BASIC_RESULT=$?
  
  run_performance_tests
  PERFORMANCE_RESULT=$?
  
  run_full_verification
  FULL_RESULT=$?
  
  # クリーンアップ
  cleanup
  
  # 結果の表示
  print_header "テスト結果サマリー"
  echo "基本テスト: $([ $BASIC_RESULT -eq 0 ] && echo "成功 ✓" || echo "失敗 ✗")"
  
  if [ "$SKIP_PERFORMANCE" != "true" ]; then
    echo "パフォーマンステスト: $([ $PERFORMANCE_RESULT -eq 0 ] && echo "成功 ✓" || echo "失敗 ✗")"
  fi
  
  if [ "$SKIP_FULL" != "true" ]; then
    echo "完全検証: $([ $FULL_RESULT -eq 0 ] && echo "成功 ✓" || echo "失敗 ✗")"
  fi
  
  echo ""
  echo "テスト結果の詳細: $SCRIPT_DIR/test_results/"
  echo "ログファイル: $SCRIPT_DIR/logs/"
  
  # 総合結果の判定
  TOTAL_RESULT=0
  
  if [ $BASIC_RESULT -ne 0 ]; then
    TOTAL_RESULT=1
  fi
  
  if [ "$SKIP_PERFORMANCE" != "true" ] && [ $PERFORMANCE_RESULT -ne 0 ]; then
    TOTAL_RESULT=1
  fi
  
  if [ "$SKIP_FULL" != "true" ] && [ $FULL_RESULT -ne 0 ]; then
    TOTAL_RESULT=1
  fi
  
  if [ $TOTAL_RESULT -eq 0 ]; then
    echo "総合結果: 成功 ✓"
  else
    echo "総合結果: 失敗 ✗"
  fi
  
  return $TOTAL_RESULT
}

# スクリプトの実行
main "$@"
exit $?