# ロールバック手順書

## 概要

このドキュメントでは、Conea AI Platformで問題が発生した際のロールバック手順を詳しく説明します。迅速で安全な復旧を実現するため、段階的なロールバック戦略を提供します。

## ロールバック戦略

### 3段階ロールバック方式

1. **レベル1: コード・設定ロールバック**（推奨復旧時間: 5-10分）
2. **レベル2: データベーススキーマロールバック**（推奨復旧時間: 15-30分）
3. **レベル3: 完全システム復旧**（推奨復旧時間: 30-60分）

## 🚨 緊急時の即座対応

### 緊急停止手順

```bash
# 1. 即座にサービスを停止
docker-compose down

# 2. 緊急メンテナンスページの表示
docker run -d -p 80:80 nginx:alpine
docker exec [container-id] sh -c 'echo "メンテナンス中です" > /usr/share/nginx/html/index.html'

# 3. チーム通知
./scripts/emergency-notification.sh "Emergency rollback initiated"
```

### 緊急判断基準

以下の状況では即座にロールバックを実行：

- **システム停止**: 5分以上のサービス停止
- **データ破損**: 重要データの損失・破損の兆候
- **セキュリティ侵害**: 不正アクセスの検出
- **パフォーマンス劣化**: レスポンス時間の500%以上の悪化

## レベル1: コード・設定ロールバック

### 対象
- アプリケーションコード
- 設定ファイル
- 環境変数
- Dockerイメージ

### 手順

#### 1.1 Git履歴の確認

```bash
# 最近のデプロイメント履歴確認
git log --oneline -10

# 直前の安定版を特定
git log --grep="deploy" --oneline -5

# 例: 安定版のコミットハッシュを特定
STABLE_COMMIT="a1b2c3d4"
```

#### 1.2 コードロールバック

```bash
# 作業ブランチの作成
git checkout -b rollback/emergency-$(date +%Y%m%d-%H%M%S)

# 安定版へのリセット
git reset --hard $STABLE_COMMIT

# 強制プッシュ（注意：チーム調整後）
git push origin main --force-with-lease
```

#### 1.3 Docker イメージロールバック

```bash
# 現在のイメージをバックアップタグで保存
docker tag current-image:latest rollback-backup:$(date +%Y%m%d-%H%M%S)

# 安定版イメージに切り替え
docker pull gcr.io/project/conea-backend:stable
docker tag gcr.io/project/conea-backend:stable current-image:latest

# サービス再起動
docker-compose down
docker-compose up -d
```

#### 1.4 設定ファイルロールバック

```bash
# 設定ファイルのバックアップから復元
cp backups/.env.$(date +%Y%m%d) .env
cp backups/docker-compose.yml.backup docker-compose.yml

# nginx設定の復元
cp backups/nginx.conf.backup nginx/nginx.conf
docker-compose restart nginx
```

### 1.5 検証手順

```bash
# サービス状態確認
docker-compose ps

# ヘルスチェック
curl http://localhost:3000/health
curl http://localhost:3000/api/status

# ログ確認
docker-compose logs -f --tail=50

# 基本機能テスト
./scripts/smoke-test.sh
```

## レベル2: データベーススキーマロールバック

### 対象
- データベーススキーマ
- マイグレーション
- インデックス

### 前提条件確認

```bash
# バックアップ存在確認
ls -la backups/database/
ls -la backups/database/schema_backup_$(date +%Y%m%d)*.sql

# 現在のデータベース状態
docker-compose exec postgres psql -U postgres -d conea_db -c '\d'
```

### 手順

#### 2.1 データベース接続確認

```bash
# 接続テスト
docker-compose exec postgres pg_isready -U postgres

# 現在のスキーマバージョン確認
docker-compose exec postgres psql -U postgres -d conea_db -c "SELECT version FROM schema_versions ORDER BY created_at DESC LIMIT 1;"
```

#### 2.2 スキーマバックアップ作成

```bash
# 現在の状態をバックアップ
BACKUP_FILE="emergency_backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec postgres pg_dump -U postgres -s conea_db > "backups/database/$BACKUP_FILE"

echo "Emergency backup created: $BACKUP_FILE"
```

#### 2.3 マイグレーションロールバック

```bash
# TODO: マイグレーション機能実装後に有効化
# 利用可能なマイグレーション確認
# npm run db:migration:status

# 特定バージョンまでロールバック
# TARGET_VERSION="20231201_120000"
# npm run db:migration:down --to=$TARGET_VERSION

# または段階的ロールバック
# npm run db:migration:down --steps=3

# 現在は手動でのデータベース状態確認
docker-compose exec postgres psql -U postgres -c "\d" -d conea_db 2>/dev/null || echo "データベース接続を確認してください"
```

#### 2.4 スキーマ復元（重度な場合）

```bash
# 完全スキーマ復元
RESTORE_FILE="backups/database/schema_backup_stable.sql"

# データベース停止・削除・再作成
docker-compose stop postgres
docker-compose rm -f postgres
docker volume rm conea_postgres_data

# 新しいデータベース起動
docker-compose up -d postgres
sleep 10

# スキーマ復元
docker-compose exec postgres psql -U postgres -d conea_db < $RESTORE_FILE
```

### 2.5 データ整合性確認

```bash
# 外部キー制約チェック
docker-compose exec postgres psql -U postgres -d conea_db -c "
SELECT conname, conrelid::regclass AS table_name 
FROM pg_constraint 
WHERE contype = 'f' AND NOT convalidated;
"

# テーブル存在確認
docker-compose exec postgres psql -U postgres -d conea_db -c '\dt'

# 基本クエリテスト
./scripts/database-health-check.sh
```

## レベル3: 完全システム復旧

### 対象
- 全システムコンポーネント
- データ復元
- 外部サービス連携

### 手順

#### 3.1 システム全停止

```bash
# 全サービス停止
docker-compose down

# プロセス確認・強制終了
ps aux | grep -E "(node|postgres|redis)" | grep -v grep
sudo pkill -f "node.*server"

# ポート開放確認
sudo netstat -tulpn | grep -E ":3000|:5432|:6379"
```

#### 3.2 データボリューム復元

```bash
# データボリュームのバックアップから復元
docker volume ls
docker volume rm conea_postgres_data conea_redis_data

# バックアップからボリューム復元
docker run --rm -v conea_postgres_data:/data -v $(pwd)/backups/volumes:/backup alpine sh -c "cd /data && tar xzf /backup/postgres_data_$(date +%Y%m%d).tar.gz"

docker run --rm -v conea_redis_data:/data -v $(pwd)/backups/volumes:/backup alpine sh -c "cd /data && tar xzf /backup/redis_data_$(date +%Y%m%d).tar.gz"
```

#### 3.3 クリーンシステム起動

```bash
# イメージの完全再取得
docker-compose pull

# クリーン起動
docker-compose up -d --force-recreate

# 起動順序の確保
echo "Waiting for database..."
sleep 30

echo "Starting backend services..."
docker-compose up -d backend

echo "Starting additional services..."
docker-compose up -d nginx prometheus grafana
```

#### 3.4 サービス連携復旧

```bash
# 外部API接続確認
./scripts/test-external-apis.sh

# Redis接続確認
docker-compose exec redis redis-cli ping

# データベース接続確認
docker-compose exec backend npm run db:test-connection

# MultiLLM システム確認
./scripts/test-multillm-integration.sh
```

### 3.5 完全性検証

```bash
# エンドツーエンドテスト
./scripts/e2e-test.sh

# パフォーマンステスト
./scripts/performance-test.sh

# セキュリティチェック
./scripts/security-check.sh

# 監視システム復旧確認
curl http://localhost:9090/targets  # Prometheus
curl http://localhost:3001/api/health  # Grafana
```

## 自動ロールバック設定

### 監視ベースの自動ロールバック

```bash
# /etc/cron.d/conea-monitor
*/5 * * * * root /opt/conea/scripts/health-monitor.sh

# health-monitor.sh の例
#!/bin/bash
HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" != "200" ]; then
    FAILURE_COUNT=$(($(cat /tmp/conea_failures || echo 0) + 1))
    echo $FAILURE_COUNT > /tmp/conea_failures
    
    if [ $FAILURE_COUNT -ge 3 ]; then
        echo "Auto-rollback triggered after $FAILURE_COUNT failures"
        /opt/conea/scripts/auto-rollback.sh
        rm /tmp/conea_failures
    fi
else
    rm -f /tmp/conea_failures
fi
```

### Circuit Breaker設定

```javascript
// backend/src/middleware/circuit-breaker.js
const CircuitBreaker = require('opossum');

const options = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

const breaker = new CircuitBreaker(apiCall, options);

breaker.fallback(() => 'Service temporarily unavailable');

breaker.on('open', () => {
  console.log('Circuit breaker opened - initiating graceful degradation');
  // Potential auto-rollback trigger
});
```

## ロールバック後の対応

### 1. 影響評価

```bash
# システム状態レポート生成
./scripts/generate-system-report.sh > reports/rollback_report_$(date +%Y%m%d_%H%M%S).txt

# データ損失確認
./scripts/data-integrity-check.sh

# ユーザー影響分析
./scripts/user-impact-analysis.sh
```

### 2. 通知・コミュニケーション

```bash
# ステークホルダー通知
./scripts/notify-stakeholders.sh "rollback-completed"

# ユーザー通知準備
./scripts/prepare-user-notification.sh

# 開発チーム報告
./scripts/generate-incident-report.sh
```

### 3. 根本原因分析

```bash
# ログ分析
./scripts/analyze-failure-logs.sh

# パフォーマンスメトリクス確認
./scripts/export-metrics.sh --from="2 hours ago" --to="now"

# 外部依存関係チェック
./scripts/check-external-dependencies.sh
```

## 予防策・改善点

### 自動バックアップ強化

```bash
# 自動バックアップスクリプト例
#!/bin/bash
# /opt/conea/scripts/automated-backup.sh

# データベースバックアップ
docker-compose exec postgres pg_dump -U postgres conea_db | gzip > backups/database/auto_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 設定ファイルバックアップ
tar czf backups/configs/config_backup_$(date +%Y%m%d_%H%M%S).tar.gz .env docker-compose.yml nginx/

# 古いバックアップの削除（7日以上経過）
find backups/ -name "*.gz" -mtime +7 -delete
find backups/ -name "*.tar.gz" -mtime +7 -delete
```

### Blue-Green デプロイメント

```yaml
# docker-compose.blue-green.yml
version: '3.8'
services:
  backend-blue:
    image: conea-backend:blue
    ports:
      - "3000:3000"
  
  backend-green:
    image: conea-backend:green
    ports:
      - "3001:3000"
  
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/blue-green.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - backend-blue
      - backend-green
```

## ロールバック操作ログ

すべてのロールバック操作は自動的にログ記録されます：

```bash
# ログファイル場所
/var/log/conea/rollback-operations.log

# ログ例
2024-01-15 14:30:00 [INFO] Rollback initiated - Level 1
2024-01-15 14:30:05 [INFO] Git reset to commit a1b2c3d4
2024-01-15 14:30:15 [INFO] Docker services restarted
2024-01-15 14:30:30 [INFO] Health check passed - Rollback completed
2024-01-15 14:30:35 [INFO] Notification sent to stakeholders
```

## 関連ドキュメント

- [デプロイメントガイド](./deployment_guide.md)
- [環境変数設定ガイド](../configuration/environment_variables.md)
- [インシデント対応マニュアル](../operations/incident_response.md)
- [監視・アラート設定](../monitoring/alerting_guide.md)

---

このロールバック手順書は、システムの安定性確保のための重要なドキュメントです。定期的な訓練と手順の見直しを行い、緊急時に迅速で正確な対応ができるよう準備しておくことが重要です。