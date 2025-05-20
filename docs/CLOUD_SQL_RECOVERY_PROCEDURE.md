# Cloud SQL 復旧手順

このドキュメントでは、Cloud SQLデータベースの復旧手順を詳細に説明します。障害発生時に迅速に対応できるよう、このドキュメントを熟読し、定期的な復旧訓練を実施してください。

## 1. 復旧シナリオの特定

まず、発生した問題に適した復旧方法を特定します：

| シナリオ | 復旧方法 | 所要時間目安 | データ損失 |
|---------|---------|------------|----------|
| 誤ったデータ変更/削除 | ポイントインタイムリカバリ | 30-60分 | 変更時点〜現在 |
| データベース破損 | 最新の自動バックアップから復元 | 15-30分 | 最大24時間 |
| インスタンス削除 | 最終バックアップから復元 | 30-60分 | 最大24時間 |
| リージョン障害 | クロスリージョンバックアップから復元 | 1-2時間 | 最大24時間 |

## 2. 前提条件の確認

復旧作業を開始する前に、以下の項目を確認してください：

- [ ] 復旧を実行するGCPプロジェクトIDの確認（`PROJECT_ID`）
- [ ] 復元するCloud SQLインスタンス名の確認（`SOURCE_INSTANCE`）
- [ ] 復元先インスタンス名の決定（`TARGET_INSTANCE`、既存か新規作成か）
- [ ] 復元に使用するバックアップIDまたは時間の特定
- [ ] 必要なIAM権限の確認（`cloudsql.instances.restore`と`cloudsql.instances.restoreBackup`）
- [ ] アプリケーション影響範囲の特定と通知

## 3. 自動バックアップからの復元手順

### 3.1 バックアップの一覧表示

```bash
# 利用可能なバックアップの確認
gcloud sql backups list \
  --instance=SOURCE_INSTANCE \
  --project=PROJECT_ID
```

出力例：
```
ID          WINDOW_START_TIME                   ERROR  STATUS
1621234567  2025-05-21T01:00:00.000+00:00       -      SUCCESSFUL
1621148167  2025-05-20T01:00:00.000+00:00       -      SUCCESSFUL
...
```

### 3.2 同じインスタンスへの復元

> ⚠️ **警告**: この操作は現在のデータベースの内容を上書きします。慎重に実行してください。

```bash
# バックアップから同じインスタンスに復元
gcloud sql instances restore SOURCE_INSTANCE \
  --project=PROJECT_ID \
  --restore-backup-name=BACKUP_ID
```

### 3.3 新しいインスタンスへの復元（推奨）

```bash
# 新しいインスタンスを作成して復元（安全なオプション）
gcloud sql instances restore SOURCE_INSTANCE \
  --project=PROJECT_ID \
  --restore-backup-name=BACKUP_ID \
  --restore-instance=TARGET_INSTANCE
```

## 4. ポイントインタイムリカバリ（PITR）

特定の時点に復元する場合の手順：

### 4.1 利用可能な復元時点の確認

```bash
# 復元可能な時間範囲の確認
gcloud sql instances describe SOURCE_INSTANCE \
  --project=PROJECT_ID \
  --format="default(settings.backupConfiguration.pointInTimeRecoveryEnabled, \
                    earliestVersionTime, \
                    settings.backupConfiguration.transactionLogRetentionDays)"
```

### 4.2 同じインスタンスへのPITR実行

```bash
# 特定の時点に復元（ISO 8601形式の時間指定）
gcloud sql instances restore SOURCE_INSTANCE \
  --project=PROJECT_ID \
  --restore-time="YYYY-MM-DDTHH:MM:SS.SSS+00:00"
```

### 4.3 新しいインスタンスへのPITR実行（推奨）

```bash
# 新しいインスタンスを作成して特定時点に復元
gcloud sql instances restore SOURCE_INSTANCE \
  --project=PROJECT_ID \
  --restore-time="YYYY-MM-DDTHH:MM:SS.SSS+00:00" \
  --restore-instance=TARGET_INSTANCE
```

## 5. クロスリージョン復元手順

リージョン障害時の復元手順：

### 5.1 別リージョンでの新インスタンス作成

```bash
# 別リージョンに新しいインスタンスを作成
gcloud sql instances create TARGET_INSTANCE \
  --project=PROJECT_ID \
  --database-version=POSTGRES_13 \
  --region=FALLBACK_REGION \
  --tier=db-custom-2-7680 \
  --storage-size=100 \
  --storage-type=SSD
```

### 5.2 バックアップからのインポート

```bash
# Cloud Storageからバックアップをインポート
gcloud sql import bak TARGET_INSTANCE \
  --project=PROJECT_ID \
  gs://BACKUP_BUCKET/BACKUP_FILE.bak
```

## 6. 復元後の検証手順

データベース復元後、以下の検証を行ってください：

### 6.1 基本的な接続確認

```bash
# インスタンスへの接続確認
gcloud sql connect TARGET_INSTANCE \
  --project=PROJECT_ID \
  --user=postgres
```

### 6.2 データ整合性の確認

```sql
-- データベース一覧の確認
\l

-- テーブル一覧の確認
\dt

-- 重要テーブルのレコード数確認
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM products;

-- 最新データの確認
SELECT MAX(created_at) FROM orders;
```

### 6.3 アプリケーション接続テスト

以下の手順でアプリケーションとの接続を検証します：

1. アプリケーション設定の接続情報を更新
2. 読み取り専用操作でのテスト
3. 書き込み操作のテスト
4. 主要な機能の動作確認

## 7. アプリケーション切り替え手順

復元が検証済みの場合、本番環境への切り替え手順：

### 7.1 準備作業

```bash
# 切り替え前のメンテナンスモード有効化
# アプリケーション固有の手順によります

# アクティブなコネクション確認
gcloud sql instances describe SOURCE_INSTANCE \
  --project=PROJECT_ID \
  --format="default(connectionName, gceZone, state, databaseVersion, \
                    settings.tier, settings.availabilityType, \
                    settings.dataDiskSizeGb, settings.dataDiskType, \
                    ipAddresses)"
```

### 7.2 接続情報更新

```bash
# 新しいインスタンスの接続情報を取得
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe TARGET_INSTANCE \
  --project=PROJECT_ID \
  --format="value(connectionName)")

INSTANCE_IP=$(gcloud sql instances describe TARGET_INSTANCE \
  --project=PROJECT_ID \
  --format="value(ipAddresses[0].ipAddress)")

# 接続情報の更新（環境によって方法が異なります）
# - Secret Managerの更新
# - 環境変数の更新
# - Kubernetesシークレットの更新
# - 構成ファイルの更新
```

### 7.3 アプリケーションの再起動

```bash
# Kubernetes環境の場合の例
kubectl rollout restart deployment/conea-app -n conea

# Cloud Runの場合の例
gcloud run services update conea-service \
  --project=PROJECT_ID \
  --region=REGION \
  --update-env-vars="DB_CONNECTION_NAME=$INSTANCE_CONNECTION_NAME"
```

## 8. ロールバック手順

復元が失敗した場合のロールバック手順：

### 8.1 元のインスタンスへの切り戻し

```bash
# 元の接続情報を使用してアプリケーションを再構成
# 具体的な手順は環境によって異なります
```

### 8.2 一時インスタンスの削除

```bash
# 不要になった復元インスタンスの削除
gcloud sql instances delete TARGET_INSTANCE \
  --project=PROJECT_ID \
  --quiet
```

## 9. 復旧後の報告書作成

復旧作業完了後、以下の情報を含む報告書を作成してください：

1. インシデント概要と影響範囲
2. 発生時刻と検出方法
3. 選択した復旧方法と理由
4. 復旧手順の詳細とタイムライン
5. データ損失の有無と量
6. 根本原因分析
7. 再発防止策

## 附録：復旧所要時間の目安

| インスタンスサイズ | バックアップからの復元 | PITRでの復元 | 新インスタンス作成時の追加時間 |
|-------------------|---------------------|-------------|-------------------------|
| 10GB未満 | 5-15分 | 10-20分 | +5分 |
| 10-50GB | 15-30分 | 20-40分 | +10分 |
| 50-100GB | 30-60分 | 40-80分 | +15分 |
| 100GB以上 | 60分+ | 80分+ | +30分 |

---

**注意**: 実際の復旧時間はデータベースの負荷、GCPリージョンのリソース可用性、およびデータベースの構成によって異なります。十分な時間的余裕を持って計画してください。

---

**最終更新**: 2025年5月21日