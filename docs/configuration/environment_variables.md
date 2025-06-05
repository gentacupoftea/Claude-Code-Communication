# 環境変数設定ガイド

## 概要

このドキュメントでは、Conea AI Platformで使用するすべての環境変数について詳しく説明します。セキュリティ、設定管理、環境間の一貫性を確保するための重要な情報を提供します。

## 環境変数一覧

### 🔑 認証・セキュリティ

#### AI API キー

```bash
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# OpenAI GPT API  
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4-turbo-preview

# Google Gemini API
GOOGLE_AI_API_KEY=AIxxxxx
GOOGLE_AI_MODEL=gemini-pro

# 必須：すべての環境で設定
# セキュリティレベル：CRITICAL
```

#### 認証トークン

```bash
# JWT署名用シークレット
JWT_SECRET=your-super-secure-secret-key-256-bits
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# セッション管理
SESSION_SECRET=your-session-secret-key
SESSION_TIMEOUT=3600

# 必須：本番環境では強力なランダム文字列を使用
# セキュリティレベル：CRITICAL
```

### 🗄️ データベース設定

#### PostgreSQL

```bash
# 開発環境
DATABASE_URL=postgresql://postgres:password@localhost:5432/conea_dev
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=conea_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# 本番環境（例）
DATABASE_URL=postgresql://user:pass@db.example.com:5432/conea_prod
DATABASE_SSL=true
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=2
DATABASE_POOL_IDLE_TIMEOUT=10000

# 必須：すべての環境
# セキュリティレベル：HIGH
```

#### Redis

```bash
# 開発環境
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# 本番環境（認証付き）
REDIS_URL=redis://:password@redis.example.com:6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true

# キャッシュ設定
REDIS_CACHE_TTL=3600
REDIS_SESSION_TTL=86400

# 必須：本番環境では認証設定
# セキュリティレベル：MEDIUM
```

### 🌐 外部API設定

#### E-commerce プラットフォーム

```bash
# Shopify
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com

# Amazon/Rakuten
AMAZON_ACCESS_KEY=your-amazon-access-key
AMAZON_SECRET_KEY=your-amazon-secret-key
RAKUTEN_API_KEY=your-rakuten-api-key
RAKUTEN_SECRET=your-rakuten-secret

# 本番環境でのみ設定
# セキュリティレベル：HIGH
```

#### Google Services

```bash
# Google Analytics
GOOGLE_ANALYTICS_KEY=path/to/service-account.json
GOOGLE_ANALYTICS_PROPERTY_ID=GA_PROPERTY_ID
GOOGLE_ANALYTICS_VIEW_ID=GA_VIEW_ID

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# Search Console
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://your-site.com

# 必須：Google統合機能使用時
# セキュリティレベル：MEDIUM
```

### ⚙️ アプリケーション設定

#### 基本設定

```bash
# 環境識別
NODE_ENV=development|staging|production
APP_ENV=development|staging|production

# サーバー設定
PORT=3000
HOST=0.0.0.0
API_BASE_URL=http://localhost:3000

# CORS設定
CORS_ORIGIN=http://localhost:3001,https://your-domain.com
CORS_CREDENTIALS=true

# 必須：すべての環境
# セキュリティレベル：LOW
```

#### MultiLLM システム

```bash
# MultiLLM設定
MULTILLM_ENABLED=true
MULTILLM_DEFAULT_PROVIDER=openai
MULTILLM_FALLBACK_PROVIDER=anthropic
MULTILLM_TIMEOUT=30000

# プロバイダー優先順位
MULTILLM_PROVIDER_PRIORITY=openai,anthropic,google

# レート制限
MULTILLM_RATE_LIMIT_PER_MINUTE=60
MULTILLM_RATE_LIMIT_PER_HOUR=1000

# 推奨：MultiLLM機能使用時
# セキュリティレベル：LOW
```

### 📊 監視・ロギング

#### ログ設定

```bash
# ログレベル
LOG_LEVEL=info|debug|warn|error
LOG_FORMAT=json|simple
LOG_FILE=logs/app.log

# ログ出力先
LOG_TO_FILE=true
LOG_TO_CONSOLE=true

# 開発環境：debug、本番環境：info推奨
# セキュリティレベル：LOW
```

#### 監視設定

```bash
# Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
PROMETHEUS_METRICS_ENDPOINT=/metrics

# 健康チェック
HEALTH_CHECK_ENDPOINT=/health
HEALTH_CHECK_TIMEOUT=5000

# APM (Application Performance Monitoring)
APM_ENABLED=false
APM_SERVER_URL=https://apm.example.com

# 推奨：本番環境で有効化
# セキュリティレベル：LOW
```

### 🚀 デプロイメント設定

#### Docker設定

```bash
# Docker Compose
COMPOSE_PROJECT_NAME=conea
COMPOSE_FILE=docker-compose.yml

# イメージタグ
DOCKER_IMAGE_TAG=latest
DOCKER_REGISTRY=gcr.io/your-project

# 開発環境で使用
# セキュリティレベル：LOW
```

#### Cloud Run設定

```bash
# Google Cloud Run
CLOUD_RUN_SERVICE=conea-backend
CLOUD_RUN_REGION=asia-northeast1
CLOUD_RUN_PLATFORM=managed

# リソース制限
CLOUD_RUN_MEMORY=2Gi
CLOUD_RUN_CPU=2
CLOUD_RUN_MAX_INSTANCES=100
CLOUD_RUN_MIN_INSTANCES=1

# 本番環境デプロイ時に使用
# セキュリティレベル：LOW
```

## 環境別設定例

### 開発環境 (.env.development)

```bash
# 基本設定
NODE_ENV=development
APP_ENV=development
PORT=3000
LOG_LEVEL=debug

# データベース（ローカル）
DATABASE_URL=postgresql://postgres:password@localhost:5432/conea_dev
REDIS_URL=redis://localhost:6379

# AI API（開発用キー）
ANTHROPIC_API_KEY=sk-ant-api03-dev-xxxxx
OPENAI_API_KEY=sk-dev-xxxxx

# 外部API（テスト環境）
SHOPIFY_API_KEY=dev-api-key
SHOPIFY_ACCESS_TOKEN=shpat_dev_xxxxx

# セキュリティ（開発用）
JWT_SECRET=dev-jwt-secret-not-for-production
SESSION_SECRET=dev-session-secret
```

### ステージング環境 (.env.staging)

```bash
# 基本設定
NODE_ENV=staging
APP_ENV=staging
PORT=3000
LOG_LEVEL=info

# データベース（ステージング）
DATABASE_URL=postgresql://user:pass@staging-db:5432/conea_staging
DATABASE_SSL=true
REDIS_URL=redis://:pass@staging-redis:6379

# AI API（ステージング用キー）
ANTHROPIC_API_KEY=sk-ant-api03-staging-xxxxx
OPENAI_API_KEY=sk-staging-xxxxx

# 外部API（ステージング環境）
SHOPIFY_API_KEY=staging-api-key
SHOPIFY_ACCESS_TOKEN=shpat_staging_xxxxx

# セキュリティ（ステージング用）
JWT_SECRET=staging-jwt-secret-secure-256-bits
SESSION_SECRET=staging-session-secret-secure
```

### 本番環境 (.env.production)

```bash
# 基本設定
NODE_ENV=production
APP_ENV=production
PORT=3000
LOG_LEVEL=info

# データベース（本番）
DATABASE_URL=postgresql://user:strongpass@prod-db:5432/conea_production
DATABASE_SSL=true
DATABASE_POOL_MAX=20
REDIS_URL=redis://:strongpass@prod-redis:6379
REDIS_TLS=true

# AI API（本番キー）
ANTHROPIC_API_KEY=sk-ant-api03-prod-xxxxx
OPENAI_API_KEY=sk-prod-xxxxx
GOOGLE_AI_API_KEY=AIprod-xxxxx

# 外部API（本番環境）
SHOPIFY_API_KEY=prod-api-key
SHOPIFY_ACCESS_TOKEN=shpat_prod_xxxxx
SHOPIFY_WEBHOOK_SECRET=secure-webhook-secret

# セキュリティ（本番用強固な設定）
JWT_SECRET=super-secure-jwt-secret-256-bits-production
SESSION_SECRET=super-secure-session-secret-production

# 監視
PROMETHEUS_ENABLED=true
LOG_TO_FILE=true
APM_ENABLED=true
```

## セキュリティベストプラクティス

### 🔒 機密情報の管理

#### 1. 環境変数の暗号化

```bash
# GPGを使用した暗号化
gpg --symmetric --cipher-algo AES256 .env.production
# .env.production.gpg が生成される

# 復号化
gpg --decrypt .env.production.gpg > .env.production
```

#### 2. 外部シークレット管理サービス

```bash
# Google Secret Manager
GOOGLE_SECRET_MANAGER_ENABLED=true
GOOGLE_SECRET_PROJECT_ID=your-project

# AWS Secrets Manager
AWS_SECRETS_MANAGER_ENABLED=true
AWS_REGION=ap-northeast-1

# Azure Key Vault
AZURE_KEY_VAULT_ENABLED=true
AZURE_KEY_VAULT_URL=https://vault.vault.azure.net/
```

#### 3. アクセス制御

```bash
# ファイル権限の設定
chmod 600 .env.production
chown app:app .env.production

# 環境変数ファイルのGit除外
# .gitignoreに追加
.env.production
.env.staging
.env.local
*.env.backup
```

### 🛡️ 検証・監査

#### 環境変数の検証

```bash
# 必須変数の確認スクリプト
./scripts/validate-env.sh production

# セキュリティ監査
./scripts/security-audit.sh

# 機密情報の漏洩チェック
git-secrets --scan
```

## トラブルシューティング

### よくある問題

#### 1. データベース接続エラー

```bash
# 問題：DATABASE_URLの形式エラー
# 解決：正しい形式の確認
postgresql://[user[:password]@][host][:port][/dbname][?param1=value1&...]

# デバッグ
echo $DATABASE_URL
npm run db:test-connection
```

#### 2. Redis接続エラー

```bash
# 問題：REDIS_URLの認証エラー
# 解決：パスワード形式の確認
redis://:password@host:port/db

# デバッグ
redis-cli -u $REDIS_URL ping
```

#### 3. API キーエラー

```bash
# 問題：APIキーの形式または有効性
# 解決：キーの確認とテスト

# Anthropicキーのテスト
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/models

# OpenAIキーのテスト
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

### 環境変数のデバッグ

```bash
# 環境変数の表示（機密情報をマスク）
./scripts/show-env.sh

# 設定値の検証
./scripts/validate-config.sh

# 環境間の差分確認
diff .env.staging .env.production
```

## 自動化・CI/CD

### 環境変数の自動設定

```yaml
# GitHub Actions example
- name: Set Environment Variables
  run: |
    echo "NODE_ENV=production" >> $GITHUB_ENV
    echo "DATABASE_URL=${{ secrets.DATABASE_URL }}" >> $GITHUB_ENV
    echo "JWT_SECRET=${{ secrets.JWT_SECRET }}" >> $GITHUB_ENV
```

### 検証の自動化

```bash
# pre-deployment validation
./scripts/pre-deploy-validation.sh
```

## 関連ドキュメント

- [デプロイメントガイド](../infrastructure/deployment_guide.md)
- [セキュリティガイド](../security/security_guide.md)
- [ロールバック手順](../infrastructure/rollback_procedures.md)

---

このガイドは定期的に更新され、新しい環境変数や設定オプションが追加された際に情報が更新されます。設定に関する質問や提案がある場合は、開発チームまでお問い合わせください。