# Conea Platform v1.1.0 デプロイメントガイド

このガイドでは、Conea Platform v1.1.0の本番環境およびステージング環境へのデプロイ方法を詳細に説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [環境設定](#環境設定)
4. [ステージング環境デプロイ](#ステージング環境デプロイ)
5. [本番環境デプロイ](#本番環境デプロイ)
6. [監視とヘルスチェック](#監視とヘルスチェック)
7. [トラブルシューティング](#トラブルシューティング)

## 概要

Conea Platform v1.1.0は以下のコンポーネントで構成されています：

### アーキテクチャ構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend v2   │    │  Integrated     │    │   MultiLLM      │
│  (Next.js 15)   │    │   Backend       │    │   System        │
│                 │    │  (Node.js +     │    │ (Claude, GPT,   │
│                 │    │   Python)       │    │  Gemini)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                       │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     Redis       │    │   Firebase      │
│   Database      │    │    Cache        │    │   Hosting       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### デプロイメント環境

#### ステージング環境
- **フロントエンド**: https://staging.conea.ai
- **アプリケーション**: https://stagingapp.conea.ai  
- **API**: https://api-staging.conea.ai
- **管理画面**: https://admin-staging.conea.ai

#### 本番環境
- **メインサイト**: https://conea.ai
- **アプリケーション**: https://app.conea.ai
- **API**: https://api.conea.ai
- **管理画面**: https://admin.conea.ai

## 前提条件

### 必要なツール
- **Docker**: 24.0+ & Docker Compose v2
- **Node.js**: 22.15.0 (推奨)
- **Python**: 3.9+
- **Firebase CLI**: 最新版
- **Google Cloud CLI**: 最新版
- **Git**: 2.40+

### 必要な権限・アクセス
- Google Cloud Platform プロジェクト管理者権限
- Firebase プロジェクト編集者権限
- GitHub リポジトリへの push 権限
- ドメイン管理権限 (conea.ai)

### API キー
```bash
# 必須 API キー
ANTHROPIC_API_KEY=sk-ant-xxxxx          # Claude API
OPENAI_API_KEY=sk-xxxxx                 # OpenAI API  
GOOGLE_CLOUD_PROJECT_ID=conea-platform  # GCP プロジェクト ID
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx        # Shopify API
RAKUTEN_APP_ID=xxxxx                    # 楽天 API

# Firebase 設定
FIREBASE_PROJECT_ID=conea-platform
FIREBASE_API_KEY=xxxxx
FIREBASE_AUTH_DOMAIN=conea-platform.firebaseapp.com
```

## 環境設定

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/conea-integration.git
cd conea-integration
git checkout v1.1.0  # 安定版を使用
```

### 2. 環境変数設定

#### ステージング環境 (.env.staging)
```bash
# API 設定
NODE_ENV=staging
API_URL=https://api-staging.conea.ai
FRONTEND_URL=https://staging.conea.ai

# データベース
DATABASE_URL=postgresql://user:pass@staging-db:5432/conea_staging
REDIS_URL=redis://staging-redis:6379

# Firebase
FIREBASE_PROJECT_ID=conea-staging
NEXT_PUBLIC_FIREBASE_API_KEY=staging-api-key

# セキュリティ
JWT_SECRET=staging-jwt-secret
CORS_ORIGIN=https://staging.conea.ai,https://stagingapp.conea.ai
```

#### 本番環境 (.env.production)
```bash
# API 設定
NODE_ENV=production
API_URL=https://api.conea.ai
FRONTEND_URL=https://conea.ai

# データベース
DATABASE_URL=postgresql://user:pass@prod-db:5432/conea_production
REDIS_URL=redis://prod-redis:6379

# Firebase
FIREBASE_PROJECT_ID=conea-platform
NEXT_PUBLIC_FIREBASE_API_KEY=production-api-key

# セキュリティ
JWT_SECRET=production-jwt-secret
CORS_ORIGIN=https://conea.ai,https://app.conea.ai
```

### 3. Docker設定

#### ステージング用 docker-compose.staging.yml
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend-v2
      dockerfile: Dockerfile.staging
    environment:
      - NODE_ENV=staging
    ports:
      - "3000:3000"
    
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=staging
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: conea_staging
      POSTGRES_USER: conea_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_staging_data:/var/lib/postgresql/data
    
  redis:
    image: redis:7-alpine
    volumes:
      - redis_staging_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/staging.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend

volumes:
  postgres_staging_data:
  redis_staging_data:
```

## ステージング環境デプロイ

### 1. 事前準備

```bash
# 依存関係のインストール
npm install

# フロントエンドビルド
cd frontend-v2
npm install
npm run build
cd ..

# Dockerイメージのビルド
docker-compose -f docker-compose.staging.yml build
```

### 2. データベースマイグレーション

```bash
# マイグレーション実行
docker-compose -f docker-compose.staging.yml run backend npm run migrate

# 初期データの投入
docker-compose -f docker-compose.staging.yml run backend npm run seed:staging
```

### 3. ステージング環境起動

```bash
# 全サービス起動
docker-compose -f docker-compose.staging.yml up -d

# ログ確認
docker-compose -f docker-compose.staging.yml logs -f
```

### 4. Firebase Hosting デプロイ

```bash
# Firebase CLI ログイン
firebase login

# ステージングプロジェクト設定
firebase use conea-staging

# フロントエンドビルド
cd frontend-v2
npm run build
npm run export

# Firebase デプロイ
firebase deploy --only hosting:staging
```

### 5. ヘルスチェック

```bash
# API ヘルスチェック
curl https://api-staging.conea.ai/health

# フロントエンド確認
curl -I https://staging.conea.ai

# 統合テスト実行
npm run test:integration:staging
```

## 本番環境デプロイ

### 1. 最終確認

```bash
# ステージング環境でのテスト結果確認
npm run test:e2e:staging

# セキュリティスキャン
npm run security:scan

# パフォーマンステスト
npm run performance:test:staging
```

### 2. 本番環境ビルド

```bash
# 本番用Dockerイメージビルド
docker-compose -f docker-compose.production.yml build

# イメージをレジストリにプッシュ
docker tag conea-frontend:latest gcr.io/conea-platform/frontend:v1.1.0
docker tag conea-backend:latest gcr.io/conea-platform/backend:v1.1.0

docker push gcr.io/conea-platform/frontend:v1.1.0
docker push gcr.io/conea-platform/backend:v1.1.0
```

### 3. データベースバックアップ

```bash
# 本番データベースバックアップ
gcloud sql export sql conea-prod-db gs://conea-backups/backup-$(date +%Y%m%d-%H%M%S).sql

# バックアップ確認
gsutil ls gs://conea-backups/
```

### 4. 本番環境デプロイ

```bash
# Blue-Green デプロイ戦略
# 1. Green環境に新バージョンデプロイ
kubectl apply -f k8s/production/green-deployment.yaml

# 2. ヘルスチェック
kubectl get pods -l version=green
kubectl logs -l version=green

# 3. トラフィック切り替え
kubectl apply -f k8s/production/service-green.yaml

# 4. 旧バージョン（Blue）の削除
kubectl delete -f k8s/production/blue-deployment.yaml
```

### 5. Firebase 本番デプロイ

```bash
# 本番プロジェクト設定
firebase use conea-platform

# フロントエンド本番ビルド
cd frontend-v2
NODE_ENV=production npm run build
npm run export

# 本番デプロイ
firebase deploy --only hosting:production

# カスタムドメイン設定確認
firebase hosting:sites:list
```

## 監視とヘルスチェック

### 1. システム監視設定

#### Prometheus メトリクス
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'conea-backend'
    static_configs:
      - targets: ['api.conea.ai:8000']
    metrics_path: '/metrics'
    
  - job_name: 'conea-frontend'
    static_configs:
      - targets: ['conea.ai:3000']
```

#### Grafana ダッシュボード
- **API パフォーマンス**: レスポンス時間、エラー率、スループット
- **システムリソース**: CPU、メモリ、ディスク使用率
- **LLM プロバイダー**: API使用状況、レート制限
- **EC API**: Shopify、楽天 API の応答時間

### 2. アラート設定

```yaml
# alerts.yml
groups:
  - name: conea-platform
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
```

### 3. ヘルスチェックスクリプト

```bash
#!/bin/bash
# health-check.sh

# API ヘルスチェック
echo "=== API Health Check ==="
curl -f https://api.conea.ai/health || exit 1

# フロントエンド確認
echo "=== Frontend Check ==="
curl -f -I https://conea.ai || exit 1

# データベース接続確認
echo "=== Database Check ==="
curl -f https://api.conea.ai/health/database || exit 1

# Redis 接続確認
echo "=== Redis Check ==="
curl -f https://api.conea.ai/health/redis || exit 1

# LLM プロバイダー確認
echo "=== LLM Providers Check ==="
curl -f https://api.conea.ai/llm/providers/status || exit 1

echo "All health checks passed!"
```

### 4. 自動復旧設定

```yaml
# auto-restart.yml (Kubernetes)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: conea-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: gcr.io/conea-platform/backend:v1.1.0
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            Port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. API 接続エラー
```bash
# エラー: API connection timeout
# 解決方法:
docker-compose logs backend
kubectl logs -l app=conea-backend

# ネットワーク設定確認
docker network ls
kubectl get services
```

#### 2. データベース接続エラー
```bash
# エラー: Database connection failed
# 解決方法:
docker-compose exec postgres psql -U conea_user -d conea_production

# 接続設定確認
echo $DATABASE_URL
kubectl get secrets db-credentials -o yaml
```

#### 3. Firebase Hosting エラー
```bash
# エラー: Firebase deploy failed
# 解決方法:
firebase debug
firebase use --debug

# カスタムドメインの確認
firebase hosting:sites:get conea-platform
```

#### 4. SSL証明書エラー
```bash
# エラー: SSL certificate invalid
# 解決方法:
openssl x509 -in /etc/nginx/ssl/conea.ai.crt -text -noout

# Let's Encrypt 証明書更新
certbot renew --nginx
```

#### 5. メモリ不足エラー
```bash
# エラー: Out of memory
# 解決方法:
docker stats
kubectl top pods

# メモリ制限の調整
docker-compose restart backend
kubectl scale deployment conea-backend --replicas=5
```

### ロールバック手順

#### 緊急時ロールバック
```bash
# 1. 以前のバージョンにタグ切り替え
git checkout v1.0.0

# 2. Dockerイメージロールバック
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d

# 3. データベースロールバック (必要な場合)
gcloud sql import sql conea-prod-db gs://conea-backups/backup-20250530-120000.sql

# 4. Firebase ロールバック
firebase hosting:clone conea-platform:v1.0.0 conea-platform:current
```

### ログ分析

#### 重要なログファイル
```bash
# アプリケーションログ
/var/log/conea/application.log
/var/log/conea/error.log

# Nginx ログ
/var/log/nginx/access.log
/var/log/nginx/error.log

# システムログ
/var/log/syslog
journalctl -u conea-backend
```

#### ログ分析コマンド
```bash
# エラー率の確認
grep "ERROR" /var/log/conea/application.log | wc -l

# レスポンス時間の分析
awk '{print $10}' /var/log/nginx/access.log | sort -n | tail -n 100

# メモリ使用量の監視
grep "Memory" /var/log/syslog | tail -n 20
```

## メンテナンス

### 定期メンテナンス

#### 週次タスク
- ログローテーション
- データベース統計更新
- SSL証明書有効期限確認
- セキュリティパッチ適用

#### 月次タスク
- パフォーマンス最適化
- データベースバックアップ検証
- 容量計画見直し
- セキュリティ監査

```bash
# 週次メンテナンススクリプト
#!/bin/bash
# weekly-maintenance.sh

# ログローテーション
logrotate -f /etc/logrotate.d/conea

# データベース統計更新
docker-compose exec postgres psql -U conea_user -d conea_production -c "ANALYZE;"

# ディスク使用量確認
df -h
docker system df

# 不要なDockerリソース削除
docker system prune -af

echo "Weekly maintenance completed"
```

## サポート

### 緊急時連絡先
- **運用チーム**: ops@conea.ai
- **開発チーム**: dev@conea.ai
- **セキュリティ**: security@conea.ai

### ドキュメント
- [API リファレンス](./API_REFERENCE.md)
- [開発者ガイド](./DEVELOPER_GUIDE.md)
- [アーキテクチャ概要](./ARCHITECTURE.md)

### 外部リソース
- [GitHub Issues](https://github.com/your-org/conea-integration/issues)
- [Slack チャンネル](https://conea-team.slack.com)
- [ステータスページ](https://status.conea.ai)

---

*最終更新: 2025-05-31 | Conea Platform v1.1.0*