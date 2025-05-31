#!/bin/bash
# OptimizedCacheManager 検証実行スクリプト
set -e

# 色付き出力関数
info() { echo -e "\033[1;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

# 実行ディレクトリの確認
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BASE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

if [ "$(basename "$PWD")" != "cache-deploy-verification" ]; then
  error "このスクリプトは cache-deploy-verification ディレクトリで実行してください"
  info "次のコマンドを実行してください: ./setup_verification_env.sh && cd ~/cache-deploy-verification"
  exit 1
fi

# 引数処理
PHASE="baseline"  # baseline, stage, production-p1, production-p2, production-p3
ENV="staging"
SKIP_CONFIRM=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --phase=*) PHASE="${1#*=}" ;;
    --env=*) ENV="${1#*=}" ;;
    --skip-confirm) SKIP_CONFIRM=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# 設定読み込み
if [ -f "./config.env" ]; then
  source ./config.env
else
  error "設定ファイルが見つかりません: ./config.env"
  exit 1
fi

# 確認プロンプト表示（skipオプションがない場合）
confirm_proceed() {
  if [ "$SKIP_CONFIRM" != "true" ]; then
    read -p "続行しますか？ (y/N): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
      info "処理を中断しました。"
      exit 0
    fi
  fi
}

# ステップ実行関数
run_step() {
  local script=$1
  local desc=$2
  shift 2
  
  info "実行中: $desc"
  
  if [ -x "$script" ]; then
    "$script" "$@"
    if [ $? -eq 0 ]; then
      success "$desc 完了"
    else
      error "$desc 失敗"
      exit 1
    fi
  else
    error "スクリプトが見つからないか実行権限がありません: $script"
    exit 1
  fi
}

# 実行開始のお知らせ
info "OptimizedCacheManager 検証実行: フェーズ = $PHASE, 環境 = $ENV"
info "タイムスタンプ: $(date)"
echo ""

case $PHASE in
  baseline)
    info "===== ベースラインパフォーマンス測定開始 ====="
    confirm_proceed
    
    info "Redis接続検証を開始..."
    run_step "./verify_redis_connection.sh" "Redis接続検証" "--env=$ENV"
    
    info "Redis基本操作テストを開始..."
    run_step "./test_redis_operations.sh" "Redis基本操作テスト" "--operations=set,get,del,ttl" "--env=$ENV"
    
    info "Redis接続プール設定テストを開始..."
    run_step "./verify_redis_pool.sh" "Redis接続プール検証" "--min-connections=5" "--max-connections=20" "--env=$ENV"
    
    info "エンドポイントレスポンスタイム測定を開始..."
    run_step "./measure_endpoints.sh" "エンドポイントレスポンスタイム測定" \
      "--endpoints=products,orders,customers,catalog,recommendations" \
      "--requests=50" \
      "--output=./metrics/baseline/endpoints_$(date +%Y%m%d_%H%M%S).json" \
      "--env=$ENV"
    
    info "API呼び出し統計収集を開始..."
    run_step "./collect_api_stats.sh" "API呼び出し統計収集" \
      "--period=6h" \
      "--output=./metrics/baseline/api_calls_$(date +%Y%m%d_%H%M%S).json" \
      "--env=$ENV"
    
    info "リソース使用状況測定を開始..."
    run_step "./measure_resource_usage.sh" "リソース使用状況測定" \
      "--duration=15m" \
      "--interval=15s" \
      "--output=./metrics/baseline/resources_$(date +%Y%m%d_%H%M%S).json" \
      "--env=$ENV"
    
    success "ベースラインパフォーマンス測定完了"
    success "次のステップ: --phase=stage でステージング環境検証を実行してください"
    ;;
    
  stage)
    info "===== ステージング環境検証開始 ====="
    confirm_proceed
    
    info "ステージング環境へのデプロイを開始..."
    run_step "./deploy.sh" "ステージング環境へのデプロイ" "--env=staging" "--branch=main" "--component=all"
    
    info "キャッシュを有効化..."
    run_step "./enable_cache.sh" "キャッシュ有効化" "--env=staging" "--endpoints=products,orders,customers,catalog" "--log-level=debug"
    
    info "キャッシュが有効な状態でのエンドポイント測定を開始..."
    run_step "./measure_endpoints.sh" "キャッシュ有効時のエンドポイント測定" \
      "--endpoints=products,orders,customers,catalog,recommendations" \
      "--requests=50" \
      "--output=./metrics/with_cache/endpoints_$(date +%Y%m%d_%H%M%S).json" \
      "--env=staging"
    
    info "キャッシュが有効な状態でのAPI呼び出し統計収集を開始..."
    run_step "./collect_api_stats.sh" "キャッシュ有効時のAPI呼び出し統計収集" \
      "--period=1h" \
      "--output=./metrics/with_cache/api_calls_$(date +%Y%m%d_%H%M%S).json" \
      "--env=staging"
    
    info "キャッシュが有効な状態でのリソース使用状況測定を開始..."
    run_step "./measure_resource_usage.sh" "キャッシュ有効時のリソース使用状況測定" \
      "--duration=15m" \
      "--interval=15s" \
      "--output=./metrics/with_cache/resources_$(date +%Y%m%d_%H%M%S).json" \
      "--env=staging"
    
    success "ステージング環境検証完了"
    success "次のステップ: --phase=production-p1 で本番環境フェーズ1を実行してください"
    ;;
    
  production-p1)
    info "===== 本番環境フェーズ1: 低リスクエンドポイント ====="
    warn "本番環境へのデプロイを開始します。これは実際のサービスに影響する可能性があります。"
    confirm_proceed
    
    info "本番環境へのキャッシュ設定のデプロイを開始..."
    run_step "./deploy.sh" "本番環境へのキャッシュ設定のデプロイ" "--env=production" "--branch=main" "--component=cache-config"
    
    info "低リスクエンドポイントでのキャッシュ有効化..."
    run_step "./enable_cache.sh" "低リスクエンドポイントでのキャッシュ有効化" "--env=production" "--endpoints=metrics,healthcheck,logs" "--log-level=debug"
    
    info "4時間のモニタリング期間を開始します..."
    echo "モニタリング終了予定時刻: $(date -d "+4 hours")"
    echo "モニタリング期間中に問題が発生した場合は、以下のコマンドでロールバックしてください："
    echo "./rollback_cache.sh --env=production --phase=current"
    
    success "本番環境フェーズ1デプロイ完了"
    success "4時間後に --phase=production-p2 で本番環境フェーズ2を実行してください"
    ;;
    
  production-p2)
    info "===== 本番環境フェーズ2: 中リスクエンドポイント ====="
    warn "本番環境フェーズ2を開始します。これは実際のサービスに影響する可能性があります。"
    confirm_proceed
    
    info "中リスクエンドポイントでのキャッシュ有効化..."
    run_step "./enable_cache.sh" "中リスクエンドポイントでのキャッシュ有効化" "--env=production" "--endpoints=products,catalog,inventory" "--log-level=debug"
    
    info "24時間のモニタリング期間を開始します..."
    echo "モニタリング終了予定時刻: $(date -d "+24 hours")"
    echo "モニタリング期間中に問題が発生した場合は、以下のコマンドでロールバックしてください："
    echo "./rollback_cache.sh --env=production --phase=current"
    
    success "本番環境フェーズ2デプロイ完了"
    success "24時間後に --phase=production-p3 で本番環境フェーズ3を実行してください"
    ;;
    
  production-p3)
    info "===== 本番環境フェーズ3: 全エンドポイント ====="
    warn "本番環境フェーズ3を開始します。これは実際のサービスに影響する可能性があります。"
    confirm_proceed
    
    info "全エンドポイントでのキャッシュ有効化..."
    run_step "./enable_cache.sh" "全エンドポイントでのキャッシュ有効化" "--env=production" "--endpoints=all" "--log-level=info"
    
    info "48時間のモニタリング期間を開始します..."
    echo "モニタリング終了予定時刻: $(date -d "+48 hours")"
    echo "モニタリング期間中に問題が発生した場合は、以下のコマンドでロールバックしてください："
    echo "./rollback_cache.sh --env=production --phase=current"
    
    success "本番環境フェーズ3デプロイ完了"
    success "48時間後に最終評価を行い、デプロイを完了してください"
    ;;
    
  *)
    error "不明なフェーズ: $PHASE"
    info "有効なフェーズ: baseline, stage, production-p1, production-p2, production-p3"
    exit 1
    ;;
esac

info "検証実行完了: フェーズ = $PHASE, 環境 = $ENV"
info "タイムスタンプ: $(date)"