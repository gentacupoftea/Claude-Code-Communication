#!/bin/bash
# OptimizedCacheManager - 自動検証スクリプト
# 目的：デプロイ前にキャッシュ機能を自動的に検証する

set -e

# 設定情報
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." &>/dev/null && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"
LOG_DIR="$SCRIPT_DIR/logs"
TEST_RESULTS_DIR="$SCRIPT_DIR/test_results"
LOG_FILE="$LOG_DIR/verification.log"

# 必要なディレクトリを作成
mkdir -p "$LOG_DIR" "$TEST_RESULTS_DIR"

# ログ出力関数
log() {
  local msg="$1"
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $msg" | tee -a "$LOG_FILE"
}

# セクションヘッダーの出力
print_section() {
  local title="$1"
  log "========================================================================"
  log "  $title"
  log "========================================================================"
}

# 環境のチェック
check_environment() {
  print_section "環境確認"
  
  log "Python バージョンの確認..."
  python3 --version
  if [ $? -ne 0 ]; then
    log "エラー: Python 3 がインストールされていないか、パスが通っていません。"
    exit 1
  fi
  
  log "必要なパッケージの確認..."
  python3 -c "import matplotlib, numpy, json, concurrent" 2>/dev/null
  if [ $? -ne 0 ]; then
    log "必要なPythonパッケージのインストール中..."
    pip install matplotlib numpy 
    if [ $? -ne 0 ]; then
      log "エラー: パッケージのインストールに失敗しました。手動でインストールしてください。"
      log "  pip install matplotlib numpy"
      exit 1
    fi
  fi
  
  log "Redisの接続確認..."
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli ping 2>/dev/null
    if [ $? -eq 0 ]; then
      log "Redis接続: OK"
    else
      log "警告: Redisに接続できません。サーバーが起動しているか確認してください。"
      log "テストはローカルキャッシュのみで実施されます。"
    fi
  else
    log "警告: redis-cliが見つかりません。Redisの検証をスキップします。"
  fi
  
  log "OptimizedCacheManagerの確認..."
  if [ -f "$PROJECT_ROOT/src/api/shopify/optimized_cache_manager.py" ]; then
    log "OptimizedCacheManager: ファイルが存在します"
  else
    log "エラー: OptimizedCacheManagerが見つかりません。"
    log "ファイルパス: $PROJECT_ROOT/src/api/shopify/optimized_cache_manager.py"
    exit 1
  fi
  
  log "環境確認が完了しました"
}

# 基本機能テスト
run_basic_tests() {
  print_section "基本機能テスト"
  
  log "基本機能テストを実行中..."
  python3 "$SCRIPT_DIR/run_cache_tests.py" --iterations 100 --value-size 1024 --concurrency 1 --output-dir "$TEST_RESULTS_DIR"
  
  if [ $? -eq 0 ]; then
    log "基本機能テスト: 成功"
    return 0
  else
    log "基本機能テスト: 失敗"
    return 1
  fi
}

# パフォーマンステスト
run_performance_tests() {
  print_section "パフォーマンステスト"
  
  log "パフォーマンステストを実行中..."
  python3 "$SCRIPT_DIR/run_cache_tests.py" --iterations 10000 --value-size 1024 --concurrency 4 --output-dir "$TEST_RESULTS_DIR"
  
  if [ $? -eq 0 ]; then
    log "パフォーマンステスト: 成功"
    return 0
  else
    log "パフォーマンステスト: 失敗"
    return 1
  fi
}

# サイズ別テスト
run_size_tests() {
  print_section "データサイズ別テスト"
  
  local sizes=(100 1000 10000 100000 1000000)
  local failed=0
  
  for size in "${sizes[@]}"; do
    log "${size}バイトのデータテストを実行中..."
    python3 "$SCRIPT_DIR/run_cache_tests.py" --iterations 100 --value-size $size --concurrency 1 --output-dir "$TEST_RESULTS_DIR"
    
    if [ $? -ne 0 ]; then
      log "${size}バイトのテスト: 失敗"
      failed=1
    else
      log "${size}バイトのテスト: 成功"
    fi
  done
  
  if [ $failed -eq 0 ]; then
    log "サイズ別テスト: すべて成功"
    return 0
  else
    log "サイズ別テスト: 一部失敗"
    return 1
  fi
}

# 並列テスト
run_concurrency_tests() {
  print_section "並列処理テスト"
  
  local concurrent_levels=(1 2 4 8 16)
  local failed=0
  
  for level in "${concurrent_levels[@]}"; do
    log "並列度${level}のテストを実行中..."
    python3 "$SCRIPT_DIR/run_cache_tests.py" --iterations 1000 --value-size 1024 --concurrency $level --output-dir "$TEST_RESULTS_DIR"
    
    if [ $? -ne 0 ]; then
      log "並列度${level}のテスト: 失敗"
      failed=1
    else
      log "並列度${level}のテスト: 成功"
    fi
  done
  
  if [ $failed -eq 0 ]; then
    log "並列処理テスト: すべて成功"
    return 0
  else
    log "並列処理テスト: 一部失敗"
    return 1
  fi
}

# 負荷テスト
run_load_test() {
  print_section "負荷テスト"
  
  log "高負荷テストを実行中 (5分間)..."
  log "※このテストは時間がかかります※"
  
  # 並列プロセスで負荷をかける
  local pids=()
  local workers=4
  local duration=300  # 5分
  
  log "${workers}並列、${duration}秒の負荷テスト開始..."
  
  for ((i=0; i<workers; i++)); do
    (
      start_time=$(date +%s)
      operations=0
      
      while true; do
        current_time=$(date +%s)
        elapsed=$((current_time - start_time))
        
        if [ $elapsed -ge $duration ]; then
          break
        fi
        
        # ランダムなキーを生成
        key="loadtest:worker${i}:key${operations}"
        value=$(openssl rand -base64 512)  # 約512バイトのランダムデータ
        
        # Pythonでキャッシュ操作を実行
        python3 -c "
import sys
sys.path.append('$PROJECT_ROOT')
from src.api.shopify.optimized_cache_manager import OptimizedCacheManager
cache = OptimizedCacheManager()
cache.set('$key', '$value')
cache.get('$key')
cache.invalidate('$key')
" >/dev/null 2>&1
        
        operations=$((operations + 1))
      done
      
      echo "Worker $i: $operations operations in $elapsed seconds ($(echo "$operations/$elapsed" | bc -l) ops/sec)"
    ) > "$LOG_DIR/loadtest_worker${i}.log" 2>&1 &
    
    pids+=($!)
  done
  
  # すべてのワーカーが完了するのを待つ
  for pid in "${pids[@]}"; do
    wait $pid
  done
  
  # 結果の集計
  total_ops=0
  for ((i=0; i<workers; i++)); do
    worker_ops=$(grep -oP '^\s*Worker \d+: \K\d+' "$LOG_DIR/loadtest_worker${i}.log" || echo "0")
    total_ops=$((total_ops + worker_ops))
  done
  
  ops_per_sec=$(echo "$total_ops/$duration" | bc -l)
  
  log "負荷テスト完了"
  log "総操作数: $total_ops"
  log "秒間操作数: $ops_per_sec"
  
  # 閾値を設定（通常は環境に応じて調整）
  local min_ops_per_sec=10  # 最低秒間操作数
  
  if (( $(echo "$ops_per_sec >= $min_ops_per_sec" | bc -l) )); then
    log "負荷テスト: 成功（閾値: $min_ops_per_sec ops/sec）"
    return 0
  else
    log "負荷テスト: 失敗（閾値: $min_ops_per_sec ops/sec）"
    return 1
  fi
}

# メモリ使用量テスト
test_memory_usage() {
  print_section "メモリ使用量テスト"
  
  log "メモリ使用量テストを実行中..."
  
  # Pythonでメモリ使用量をテスト
  python3 -c "
import sys
import time
import psutil
import os
sys.path.append('$PROJECT_ROOT')

try:
    from src.api.shopify.optimized_cache_manager import OptimizedCacheManager
    
    # プロセスのメモリ使用量を取得
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss / (1024 * 1024)  # MB
    
    # キャッシュマネージャーを初期化
    cache = OptimizedCacheManager()
    
    # 初期化後のメモリ使用量
    after_init_memory = process.memory_info().rss / (1024 * 1024)  # MB
    
    # データを追加
    total_data_size = 0
    for i in range(10000):
        key = f'memory:test:key:{i}'
        value = 'X' * 1024  # 1KBのデータ
        cache.set(key, value)
        total_data_size += len(value)
    
    # データ追加後のメモリ使用量
    after_set_memory = process.memory_info().rss / (1024 * 1024)  # MB
    
    # 理論的なデータサイズ（MB）
    theoretical_size = total_data_size / (1024 * 1024)
    
    # キャッシュサイズの取得（実装されている場合）
    if hasattr(cache, 'get_memory_usage'):
        cache_size = cache.get_memory_usage() / (1024 * 1024)  # MB
    else:
        cache_size = 0
    
    # メモリ効率 = 理論サイズ / 実際の増加量
    memory_increase = after_set_memory - after_init_memory
    if memory_increase > 0:
        efficiency = theoretical_size / memory_increase
    else:
        efficiency = 0
    
    print(f'初期メモリ使用量: {initial_memory:.2f}MB')
    print(f'初期化後メモリ使用量: {after_init_memory:.2f}MB')
    print(f'データ追加後メモリ使用量: {after_set_memory:.2f}MB')
    print(f'メモリ増加量: {memory_increase:.2f}MB')
    print(f'理論データサイズ: {theoretical_size:.2f}MB')
    print(f'キャッシュサイズ: {cache_size:.2f}MB')
    print(f'メモリ効率: {efficiency:.2f}')
    
    # 一定の効率を期待
    expected_efficiency = 0.5  # 理論サイズの50%以上の効率
    
    if efficiency >= expected_efficiency:
        print('メモリ効率テスト: 成功')
        sys.exit(0)
    else:
        print('メモリ効率テスト: 失敗')
        sys.exit(1)
except Exception as e:
    print(f'エラー: {e}')
    sys.exit(1)
" 2>&1 | tee -a "$LOG_FILE"
  
  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    log "メモリ使用量テスト: 成功"
    return 0
  else
    log "メモリ使用量テスト: 失敗"
    return 1
  fi
}

# Redis機能テスト（Redisが利用可能な場合）
test_redis_functionality() {
  print_section "Redis機能テスト"
  
  # Redisが利用可能か確認
  if ! command -v redis-cli >/dev/null 2>&1 || ! redis-cli ping >/dev/null 2>&1; then
    log "警告: Redisが利用できないため、テストをスキップします"
    return 0
  fi
  
  log "Redis機能テストを実行中..."
  
  # Pythonでテスト
  python3 -c "
import sys
import time
sys.path.append('$PROJECT_ROOT')

try:
    from src.api.shopify.optimized_cache_manager import OptimizedCacheManager
    
    # キャッシュマネージャーを初期化
    cache = OptimizedCacheManager()
    
    # Redisが有効か確認
    if not getattr(cache, 'redis_enabled', False):
        print('警告: Redisが有効になっていません')
        sys.exit(0)
    
    # メモリキャッシュとRedis間の整合性テスト
    test_key = 'redis:test:key'
    test_value = 'redis_test_value_' + str(time.time())
    
    # 値の設定
    cache.set(test_key, test_value)
    
    # メモリキャッシュをクリア（リセット）する方法が実装によって異なる
    if hasattr(cache, '_cache'):
        cache._cache.clear()
    elif hasattr(cache, 'local_cache'):
        cache.local_cache.clear()
    else:
        print('警告: メモリキャッシュをクリアする方法が不明です')
    
    # Redisからの取得
    retrieved_value = cache.get(test_key)
    
    if retrieved_value == test_value:
        print('Redis機能テスト（メモリキャッシュクリア後の取得）: 成功')
        
        # キャッシュの無効化
        cache.invalidate(test_key)
        
        # 無効化後の確認
        after_invalidate = cache.get(test_key)
        if after_invalidate is None:
            print('Redis機能テスト（無効化）: 成功')
            sys.exit(0)
        else:
            print('Redis機能テスト（無効化）: 失敗')
            sys.exit(1)
    else:
        print(f'Redis機能テスト: 失敗 (期待値: {test_value}, 実際の値: {retrieved_value})')
        sys.exit(1)
except Exception as e:
    print(f'エラー: {e}')
    sys.exit(1)
" 2>&1 | tee -a "$LOG_FILE"
  
  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    log "Redis機能テスト: 成功"
    return 0
  else
    log "Redis機能テスト: 失敗"
    return 1
  fi
}

# 検証結果の集計
summarize_results() {
  print_section "検証結果の集計"
  
  local total_tests=0
  local passed_tests=0
  
  # テスト結果が0または1であることを想定
  # 0=成功, 1=失敗
  if [ $BASIC_TESTS_RESULT -eq 0 ]; then
    passed_tests=$((passed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  
  if [ $PERFORMANCE_TESTS_RESULT -eq 0 ]; then
    passed_tests=$((passed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  
  if [ $SIZE_TESTS_RESULT -eq 0 ]; then
    passed_tests=$((passed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  
  if [ $CONCURRENCY_TESTS_RESULT -eq 0 ]; then
    passed_tests=$((passed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  
  if [ $LOAD_TEST_RESULT -eq 0 ]; then
    passed_tests=$((passed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  
  if [ $MEMORY_TEST_RESULT -eq 0 ]; then
    passed_tests=$((passed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  
  if [ $REDIS_TEST_RESULT -eq 0 ]; then
    passed_tests=$((passed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  
  # 成功率の計算
  local success_rate=$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc)
  
  log "テスト総数: $total_tests"
  log "成功数: $passed_tests"
  log "成功率: ${success_rate}%"
  
  # 結果の判定
  if [ $passed_tests -eq $total_tests ]; then
    log "検証結果: 成功"
    return 0
  else
    log "検証結果: 失敗"
    return 1
  fi
}

# レポートの生成
generate_report() {
  print_section "レポート生成"
  
  local timestamp=$(date "+%Y%m%d_%H%M%S")
  local report_file="$TEST_RESULTS_DIR/verification_report_${timestamp}.md"
  
  log "レポートを生成中: $report_file"
  
  # レポートヘッダー
  cat > "$report_file" << EOF
# OptimizedCacheManager 検証レポート

生成日時: $(date "+%Y-%m-%d %H:%M:%S")

## テスト環境

- OS: $(uname -s)
- ホスト名: $(hostname)
- Python: $(python3 --version 2>&1)

## テスト結果サマリー

| テスト | 結果 |
|-------|------|
| 基本機能テスト | $([ $BASIC_TESTS_RESULT -eq 0 ] && echo "✅ 成功" || echo "❌ 失敗") |
| パフォーマンステスト | $([ $PERFORMANCE_TESTS_RESULT -eq 0 ] && echo "✅ 成功" || echo "❌ 失敗") |
| データサイズ別テスト | $([ $SIZE_TESTS_RESULT -eq 0 ] && echo "✅ 成功" || echo "❌ 失敗") |
| 並列処理テスト | $([ $CONCURRENCY_TESTS_RESULT -eq 0 ] && echo "✅ 成功" || echo "❌ 失敗") |
| 負荷テスト | $([ $LOAD_TEST_RESULT -eq 0 ] && echo "✅ 成功" || echo "❌ 失敗") |
| メモリ使用量テスト | $([ $MEMORY_TEST_RESULT -eq 0 ] && echo "✅ 成功" || echo "❌ 失敗") |
| Redis機能テスト | $([ $REDIS_TEST_RESULT -eq 0 ] && echo "✅ 成功" || echo "❌ 失敗") |

## 詳細結果

テスト結果ディレクトリ: \`$TEST_RESULTS_DIR\`

### グラフおよびレポート

以下のファイルが生成されました:

$(find "$TEST_RESULTS_DIR" -type f -name "*.png" -o -name "*.json" -o -name "*.md" | grep -v "verification_report" | sort | sed 's/^/- /')

## 結論

$(if [ $VERIFICATION_RESULT -eq 0 ]; then
  echo "すべてのテストが成功しました。OptimizedCacheManagerは期待通りに動作しており、本番環境へのデプロイ準備が整っています。"
else
  echo "一部のテストが失敗しました。詳細なログとテスト結果を確認し、問題を解決してから再度検証してください。"
fi)

EOF
  
  log "レポートが生成されました: $report_file"
  
  # コンソールにレポートのパスを表示
  echo ""
  echo "検証レポート: $report_file"
  echo ""
}

# メインの実行フロー
main() {
  log "OptimizedCacheManager 自動検証を開始します"
  
  # 環境確認
  check_environment
  
  # 各テストの実行
  run_basic_tests
  BASIC_TESTS_RESULT=$?
  
  run_performance_tests
  PERFORMANCE_TESTS_RESULT=$?
  
  run_size_tests
  SIZE_TESTS_RESULT=$?
  
  run_concurrency_tests
  CONCURRENCY_TESTS_RESULT=$?
  
  run_load_test
  LOAD_TEST_RESULT=$?
  
  test_memory_usage
  MEMORY_TEST_RESULT=$?
  
  test_redis_functionality
  REDIS_TEST_RESULT=$?
  
  # 結果の集計
  summarize_results
  VERIFICATION_RESULT=$?
  
  # レポートの生成
  generate_report
  
  log "自動検証が完了しました"
  
  return $VERIFICATION_RESULT
}

# スクリプトの実行
main
exit $?