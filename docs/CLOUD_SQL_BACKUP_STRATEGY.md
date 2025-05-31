# Cloud SQL バックアップ戦略

このドキュメントでは、Conea プロジェクトにおける Cloud SQL バックアップの戦略と設定方法について説明します。

## 1. バックアップ戦略の概要

Conea プロジェクトでは以下のバックアップ戦略を採用しています：

1. **自動バックアップ**：
   - 毎日指定した時間に自動バックアップを実行
   - バックアップの保持期間を設定して古いバックアップを自動的に削除
   - トランザクションログを保持してポイントインタイムリカバリ（PITR）を実現

2. **手動バックアップ**：
   - 重要な変更前に手動バックアップを作成
   - 無期限に保持される本番環境の定期的なスナップショット
   - 開発環境への展開用のベースイメージ

3. **監視とアラート**：
   - バックアップ失敗時のアラート設定
   - バックアップサイズと所要時間の監視

## 2. バックアップ設定パラメータ

Cloud SQL インスタンスのバックアップには以下のパラメータを設定します：

| パラメータ | 推奨値 | 説明 |
|------------|--------|------|
| バックアップ開始時間 | 01:00 UTC | トラフィックが少ない深夜に実行 |
| バックアップ保持日数 | 7-30 日 | データ重要度による。標準は7日 |
| トランザクションログ保持日数 | 7 日 | ポイントインタイムリカバリ用 |
| バックアップ保存場所 | 同一リージョン | データ所在地要件に基づいて設定 |
| ポイントインタイムリカバリ | 有効 | 特定時点への復元を可能にする |

## 3. バックアップの種類

### 3.1 自動バックアップ

Cloud SQL は毎日自動バックアップを実行します。自動バックアップは次の特徴を持ちます：

- 毎日設定した時間に実行される
- 指定した保持期間後に自動的に削除される（最大365日間保持可能）
- インスタンスが停止される前に最終バックアップが自動的に作成される
- システムのメンテナンス中も実行される

### 3.2 手動バックアップ（オンデマンドバックアップ）

手動バックアップは次のような場合に作成します：

- 重要なデータ更新前
- メジャーアップデート前
- マイグレーション実行前
- 監査要件のための永続的な保存

手動バックアップは明示的に削除するまで保持されます。

## 4. ポイントインタイムリカバリ（PITR）

PITR は以下の機能を提供します：

- トランザクションログを使用して、最大7日前の任意の時点にデータベースを復元可能
- データベース破損やヒューマンエラーから素早く復旧するために重要
- 本番環境では常に有効にすることを推奨

## 5. バックアップの実装方法

バックアップ設定を実装するには以下の方法があります：

### 5.1 CLI による設定（推奨）

提供されている `configure_cloudsql_backup.sh` スクリプトを使用：

```bash
./scripts/configure_cloudsql_backup.sh
```

このスクリプトは対話的にバックアップ設定パラメータを収集し、Cloud SQL インスタンスに適用します。

### 5.2 手動 gcloud コマンド

```bash
gcloud sql instances patch INSTANCE_NAME \
  --backup-start-time=HH:MM \
  --backup-retention-count=DAYS \
  --transaction-log-retention-days=DAYS \
  --backup-location=LOCATION \
  --enable-point-in-time-recovery
```

### 5.3 Terraform による設定（将来の実装）

```hcl
resource "google_sql_database_instance" "conea_db" {
  name             = "conea-db"
  database_version = "POSTGRES_13"
  region           = "asia-northeast1"
  
  settings {
    tier = "db-f1-micro"
    
    backup_configuration {
      enabled                        = true
      start_time                     = "01:00"
      location                       = "asia-northeast1"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }
  }
}
```

## 6. バックアップからの復元

### 6.1 自動バックアップからの復元

```bash
# バックアップの一覧を表示
gcloud sql backups list --instance=INSTANCE_NAME

# 特定のバックアップから既存のインスタンスを復元
gcloud sql instances restore INSTANCE_NAME \
  --restore-backup-name=BACKUP_ID

# 新しいインスタンスとして復元
gcloud sql instances restore INSTANCE_NAME \
  --restore-backup-name=BACKUP_ID \
  --restore-instance=NEW_INSTANCE_NAME
```

### 6.2 ポイントインタイムリカバリによる復元

```bash
# 特定の時点に復元
gcloud sql instances restore INSTANCE_NAME \
  --restore-time="YYYY-MM-DDTHH:MM:SS.SSS+00:00"
```

## 7. バックアップのモニタリングとテスト

### 7.1 モニタリング

Cloud Monitoring でバックアップの状態とパフォーマンスを監視します：

- バックアップの成功/失敗
- バックアップサイズ
- バックアップ所要時間

### 7.2 定期的なテスト復元

四半期に一度は以下をテストすることを推奨します：

1. テスト環境にバックアップを復元
2. データの整合性を検証
3. アプリケーションの機能テスト実行
4. 復元プロセスの所要時間を記録

## 8. 障害復旧計画

データベース障害が発生した場合の復旧手順：

1. 障害のタイプと影響範囲を特定
2. 復旧方法の決定（バックアップ or PITR）
3. 監査証跡のための障害状況のドキュメント化
4. 復旧プロセスの実行
5. データとアプリケーション機能の検証
6. 根本原因分析と将来の予防策の実施