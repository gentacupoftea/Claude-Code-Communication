# Cloud SQL 高度なバックアップ構成

このドキュメントでは、Conea プロジェクトの Cloud SQL インスタンスに対する高度なバックアップ構成について説明します。

## 1. バックアップスケジュールの最適化

### 1.1 バックアップウィンドウの選択

バックアップウィンドウを選択する際の考慮事項：

- **トラフィックが少ない時間帯**：アプリケーションのトラフィックパターンを分析し、最もユーザーが少ない時間帯を選択
- **メンテナンスウィンドウとの重複回避**：Google Cloud の自動メンテナンスウィンドウとバックアップウィンドウが重複しないように設定
- **タイムゾーン考慮**：UTC時間で設定するため、日本時間との時差（+9時間）を考慮

**推奨設定**：
- 開発環境：UTC 15:00（日本時間 00:00）
- ステージング環境：UTC 16:00（日本時間 01:00）
- 本番環境：UTC 17:00（日本時間 02:00）

### 1.2 段階的な保持ポリシー

データの重要性によって異なる保持ポリシーを使用：

| 環境 | 自動バックアップ保持 | トランザクションログ保持 | 手動バックアップポリシー |
|------|---------------------|------------------------|------------------------|
| 開発 | 3日 | 2日 | 重要マイルストーン時のみ、30日保持 |
| ステージング | 7日 | 4日 | スプリント終了時、60日保持 |
| 本番 | 14-30日 | 7日 | 月次バックアップを1年保持、四半期バックアップを3年保持 |

## 2. 異なる環境のためのバックアップスクリプト例

### 2.1 開発環境用バックアップ設定

```bash
#!/bin/bash
# 開発環境用バックアップ設定

PROJECT_ID="conea-project-dev"
INSTANCE_NAME="conea-db-dev"
RETENTION_DAYS=3
TRANSACTION_LOG_DAYS=2
START_TIME="15:00"
BACKUP_LOCATION="asia-northeast1"

gcloud sql instances patch $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --backup-start-time=$START_TIME \
  --backup-retention-count=$RETENTION_DAYS \
  --transaction-log-retention-days=$TRANSACTION_LOG_DAYS \
  --backup-location=$BACKUP_LOCATION \
  --enable-point-in-time-recovery
```

### 2.2 本番環境用バックアップ設定

```bash
#!/bin/bash
# 本番環境用バックアップ設定

PROJECT_ID="conea-project-prod"
INSTANCE_NAME="conea-db-prod"
RETENTION_DAYS=30
TRANSACTION_LOG_DAYS=7
START_TIME="17:00"
BACKUP_LOCATION="asia-northeast1"

gcloud sql instances patch $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --backup-start-time=$START_TIME \
  --backup-retention-count=$RETENTION_DAYS \
  --transaction-log-retention-days=$TRANSACTION_LOG_DAYS \
  --backup-location=$BACKUP_LOCATION \
  --enable-point-in-time-recovery
```

## 3. バックアップ検証の自動化

### 3.1 バックアップ検証スクリプト

以下のスクリプトを定期的に実行し、バックアップの整合性を検証します：

```bash
#!/bin/bash
# バックアップ検証スクリプト

PROJECT_ID="conea-project-prod"
SOURCE_INSTANCE="conea-db-prod"
TEST_INSTANCE="conea-db-verify"
REGION="asia-northeast1"

# 最新のバックアップIDを取得
BACKUP_ID=$(gcloud sql backups list \
  --instance=$SOURCE_INSTANCE \
  --project=$PROJECT_ID \
  --limit=1 \
  --format="value(id)")

# 検証用の一時インスタンスを作成して復元
echo "Backup ID $BACKUP_ID から検証インスタンスを作成します..."
gcloud sql instances create $TEST_INSTANCE \
  --project=$PROJECT_ID \
  --region=$REGION \
  --tier=db-f1-micro \
  --no-backup \
  --database-version=POSTGRES_13 \
  --root-password="$(openssl rand -base64 24)"

# バックアップから復元
gcloud sql instances restore $SOURCE_INSTANCE \
  --project=$PROJECT_ID \
  --restore-backup-name=$BACKUP_ID \
  --restore-instance=$TEST_INSTANCE

# 基本的な検証クエリを実行
echo "データベースの整合性を検証しています..."
PGPASSWORD=$(gcloud secrets versions access latest \
  --secret=DB_VERIFY_PASSWORD --project=$PROJECT_ID)

# 検証クエリの例（実際のテーブルに合わせて調整）
psql -h $(gcloud sql instances describe $TEST_INSTANCE \
  --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)") \
  -U postgres -d conea_db -c "SELECT COUNT(*) FROM users;" 

# 検証が終わったら一時インスタンスを削除
echo "検証完了。一時インスタンスを削除します..."
gcloud sql instances delete $TEST_INSTANCE \
  --project=$PROJECT_ID --quiet
```

### 3.2 バックアップ検証のスケジュール設定

Cloud Scheduler を使用して、バックアップ検証を自動化：

```bash
# 毎週月曜の午前10時にバックアップ検証を実行
gcloud scheduler jobs create http verify-backup \
  --schedule="0 10 * * 1" \
  --uri="https://cloudfunctions.googleapis.com/v1/projects/$PROJECT_ID/locations/$REGION/functions/verifyBackup" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"instanceName": "conea-db-prod"}' \
  --oauth-service-account-email=$SERVICE_ACCOUNT
```

## 4. クロスリージョンバックアップ戦略

高可用性と災害復旧のための複数リージョンバックアップ戦略：

### 4.1 クロスリージョンバックアップの構成

```bash
#!/bin/bash
# プライマリリージョン（東京）でのバックアップ設定
gcloud sql instances patch conea-db-prod \
  --project=conea-project-prod \
  --backup-start-time="17:00" \
  --backup-location="asia-northeast1" \
  --enable-point-in-time-recovery

# 重要バックアップを別リージョン（大阪）に手動でエクスポート
gcloud sql export bak conea-db-prod \
  gs://conea-backup-osaka/monthly/$(date +%Y-%m-%d)-db-backup.bak \
  --project=conea-project-prod \
  --offload
```

### 4.2 バックアップファイルの地理的複製

```bash
# Cloud Storageバケットに地理的冗長性を設定
gsutil mb -l asia-northeast1 -c STANDARD gs://conea-backup-primary
gsutil mb -l asia-northeast2 -c STANDARD gs://conea-backup-secondary

# オブジェクトのライフサイクル管理を設定
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 365,
          "isLive": true
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://conea-backup-primary
gsutil lifecycle set lifecycle.json gs://conea-backup-secondary

# プライマリからセカンダリへの自動複製設定
gsutil rewrite -r gs://conea-backup-primary/ gs://conea-backup-secondary/
```

## 5. 暗号化とセキュリティ

### 5.1 バックアップの暗号化設定

```bash
# Cloud SQLインスタンスにCMEK（顧客管理の暗号鍵）を設定
gcloud sql instances patch conea-db-prod \
  --project=conea-project-prod \
  --kms-key-name="projects/conea-project-prod/locations/asia-northeast1/keyRings/conea-keyring/cryptoKeys/conea-db-key" \
  --disk-encryption-key-version=1
```

### 5.2 バックアップへのアクセス制御

```bash
# バックアップへのアクセス権限を制限
gcloud projects add-iam-policy-binding conea-project-prod \
  --member="serviceAccount:backup-auditor@conea-project-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.viewer"

# バックアップ復元権限を別途制限
gcloud projects add-iam-policy-binding conea-project-prod \
  --member="group:db-admins@conea.com" \
  --role="roles/cloudsql.restoreAdmin"
```

## 6. コスト最適化の戦略

### 6.1 バックアップコスト見積もり

| バックアップ設定 | 予想保存容量 | 月額コスト見積もり |
|-----------------|--------------|-------------------|
| 日次バックアップ 7日保持 | 約 7x DB サイズ | 約 ¥xxxx/月 |
| 日次バックアップ 30日保持 | 約 30x DB サイズ | 約 ¥xxxx/月 |
| トランザクションログ 7日保持 | 変更量による | 約 ¥xxxx/月 |

### 6.2 コスト最適化のヒント

- **使用率の低い環境では保持期間を短くする**
- **開発環境は週末のみバックアップを取得する設定も可能**
- **古いバックアップは低コストのCold/Archive Storageクラスに移動**
- **デフォルトのバックアップ設定を見直し、実際の需要に合わせて調整**

```bash
# 低コストストレージクラスへの移行ルールを設定
cat > archive-lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "ARCHIVE"},
        "condition": {
          "age": 90,
          "isLive": true
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set archive-lifecycle.json gs://conea-long-term-backups
```

---

これらの高度な設定と戦略を適切に実装することで、データの保護を最大化しつつ、コストとパフォーマンスのバランスを取ることができます。環境や要件に合わせて適宜カスタマイズしてください。