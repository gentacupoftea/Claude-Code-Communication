#!/bin/bash
# Cloud SQLバックアップ設定スクリプト - Conea Project

set -e  # エラー発生時に停止

# 色付きの出力関数
info() { echo -e "\033[1;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

# バナー表示
echo "======================================================"
echo "       Conea Project - Cloud SQLバックアップ設定       "
echo "======================================================"
echo ""

# 設定ファイルのチェック
if [ -f .env ]; then
  info "環境変数ファイルを読み込みます..."
  source .env
else
  error ".env ファイルが見つかりません。setup_gcp.sh を先に実行してください。"
  exit 1
fi

# 必要な環境変数の確認
if [ -z "$PROJECT_ID" ] || [ -z "$REGION" ] || [ -z "$DB_INSTANCE_NAME" ]; then
  error "必要な環境変数が設定されていません。setup_gcp.sh を再実行してください。"
  exit 1
fi

# バックアップ設定のデフォルト値
DEFAULT_START_TIME="01:00"  # 午前1時
DEFAULT_RETENTION_DAYS=7    # 7日間保持
DEFAULT_TRANSACTION_LOG_RETENTION_DAYS=7  # トランザクションログ7日間保持
DEFAULT_BACKUP_LOCATION="$REGION"  # デフォルトはインスタンスと同じリージョン

# 設定値の入力
read -p "バックアップ開始時間 (24時間形式 HH:MM) [$DEFAULT_START_TIME]: " BACKUP_START_TIME
BACKUP_START_TIME=${BACKUP_START_TIME:-$DEFAULT_START_TIME}

read -p "バックアップ保持日数 (1-365) [$DEFAULT_RETENTION_DAYS]: " BACKUP_RETENTION_DAYS
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-$DEFAULT_RETENTION_DAYS}

read -p "トランザクションログ保持日数 (1-7) [$DEFAULT_TRANSACTION_LOG_RETENTION_DAYS]: " TRANSACTION_LOG_RETENTION_DAYS
TRANSACTION_LOG_RETENTION_DAYS=${TRANSACTION_LOG_RETENTION_DAYS:-$DEFAULT_TRANSACTION_LOG_RETENTION_DAYS}

read -p "バックアップの保存場所（リージョン）[$DEFAULT_BACKUP_LOCATION]: " BACKUP_LOCATION
BACKUP_LOCATION=${BACKUP_LOCATION:-$DEFAULT_BACKUP_LOCATION}

# ポイントインタイムリカバリの有効化
read -p "ポイントインタイムリカバリを有効にしますか？ (y/n) [y]: " ENABLE_PITR
ENABLE_PITR=${ENABLE_PITR:-y}
if [[ $ENABLE_PITR == "y" || $ENABLE_PITR == "Y" ]]; then
  PITR_FLAG="--enable-point-in-time-recovery"
else
  PITR_FLAG="--no-enable-point-in-time-recovery"
fi

# 設定を表示して確認
echo ""
echo "以下の設定でCloud SQLバックアップを構成します:"
echo "プロジェクトID: $PROJECT_ID"
echo "データベースインスタンス: $DB_INSTANCE_NAME"
echo "バックアップ開始時間: $BACKUP_START_TIME UTC"
echo "バックアップ保持日数: $BACKUP_RETENTION_DAYS 日"
echo "トランザクションログ保持日数: $TRANSACTION_LOG_RETENTION_DAYS 日"
echo "バックアップ保存場所: $BACKUP_LOCATION"
echo "ポイントインタイムリカバリ: ${ENABLE_PITR}"
echo ""

read -p "続行しますか？ (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
  error "バックアップ設定を中止します。"
  exit 1
fi

# バックアップ設定の適用
info "Cloud SQLインスタンス $DB_INSTANCE_NAME のバックアップ設定を更新しています..."

# gcloud SQLインスタンスにバックアップ設定を適用
gcloud sql instances patch $DB_INSTANCE_NAME \
  --backup-start-time=$BACKUP_START_TIME \
  --backup-retention-count=$BACKUP_RETENTION_DAYS \
  --transaction-log-retention-days=$TRANSACTION_LOG_RETENTION_DAYS \
  --backup-location=$BACKUP_LOCATION \
  $PITR_FLAG

# バックアップ設定の確認
info "バックアップ設定を確認しています..."
gcloud sql instances describe $DB_INSTANCE_NAME \
  --format="yaml(settings.backupConfiguration)"

success "Cloud SQLバックアップ設定が完了しました！"

# バックアップの手動テスト
echo ""
read -p "今すぐテストバックアップを作成しますか？ (y/n): " CREATE_TEST_BACKUP
if [[ $CREATE_TEST_BACKUP == "y" || $CREATE_TEST_BACKUP == "Y" ]]; then
  info "テストバックアップを作成しています..."
  gcloud sql backups create --instance=$DB_INSTANCE_NAME --description="手動テストバックアップ"
  
  # テストバックアップの確認
  gcloud sql backups list --instance=$DB_INSTANCE_NAME --limit=1
  
  success "テストバックアップが作成されました！"
fi

echo ""
echo "======================================================"
success "Cloud SQLバックアップ設定が完了しました！"
echo ""
info "手動バックアップの作成コマンド:"
echo "  gcloud sql backups create --instance=$DB_INSTANCE_NAME --description=\"バックアップの説明\""
info "バックアップの一覧表示コマンド:"
echo "  gcloud sql backups list --instance=$DB_INSTANCE_NAME"
info "バックアップからの復元コマンド:"
echo "  gcloud sql instances restore $DB_INSTANCE_NAME --restore-backup-name=BACKUP_ID"
echo "======================================================"