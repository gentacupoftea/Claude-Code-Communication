# Conea AI Platform デプロイメントガイド

## 概要

このドキュメントでは、Conea AI Platformの本番環境・ステージング環境へのデプロイメント手順を詳しく説明します。安全で確実なデプロイメントを実現するための手順とベストプラクティスを提供します。

## 前提条件

### 必要なツール・権限

- Docker および Docker Compose v2.0+
- Google Cloud CLI (`gcloud`) - Cloud Run デプロイ用
- 適切なGCPプロジェクトへのアクセス権限
- 本番環境 SSL 証明書（Let's Encrypt または購入証明書）

### 環境変数の準備

詳細は `docs/configuration/environment_variables.md` を参照してください。

```bash
# 必須環境変数の例
ANTHROPIC_API_KEY=your-claude-api-key
OPENAI_API_KEY=your-openai-api-key
DATABASE_PASSWORD=secure-password
JWT_SECRET=your-jwt-secret
NODE_ENV=production
```

## デプロイメント方法

### 1. Docker Compose デプロイメント（推奨）

#### 1.1 基本デプロイメント

```bash
# リポジトリのクローン・更新
git clone https://github.com/your-org/conea-integration.git
cd conea-integration
git pull origin main

# 環境変数の設定
cp .env.example .env
# .env ファイルを編集して適切な値を設定

# SSL証明書の配置（本番環境の場合）
mkdir -p ssl/
# SSL証明書ファイルを ssl/ ディレクトリに配置

# サービスの起動
docker-compose up -d

# デプロイメント確認
docker-compose ps
docker-compose logs -f
```

#### 1.2 ヘルスチェック

```bash
# 各サービスの状態確認
curl http://localhost:3000/health
curl http://localhost:3000/api/status

# データベース接続確認
docker-compose exec backend npm run db:ping

# Redis接続確認
docker-compose exec redis redis-cli ping
```

### 2. Google Cloud Run デプロイメント

#### 2.1 事前準備

```bash
# Google Cloud認証
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Container Registry認証
gcloud auth configure-docker
```

#### 2.2 デプロイメント手順

```bash
# Dockerイメージのビルド
docker build -t gcr.io/YOUR_PROJECT_ID/conea-backend .

# イメージをContainer Registryにプッシュ
docker push gcr.io/YOUR_PROJECT_ID/conea-backend

# Cloud Runサービスのデプロイ
gcloud run deploy conea-backend \
  --image gcr.io/YOUR_PROJECT_ID/conea-backend \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=your-db-url"

# カスタムドメインの設定（必要に応じて）
gcloud run domain-mappings create \
  --service conea-backend \
  --domain your-domain.com
```

### 3. 手動デプロイメント

#### 3.1 依存関係のインストール

```bash
# Node.js依存関係
npm install --production

# Python依存関係
pip install -r requirements.txt
```

#### 3.2 データベースセットアップ

```bash
# PostgreSQLの起動
sudo systemctl start postgresql

# データベースの作成
createdb conea_production

# マイグレーションの実行
npm run db:migrate
```

#### 3.3 アプリケーションの起動

```bash
# 本番モードでの起動
NODE_ENV=production npm start

# プロセス管理（PM2使用）
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## サービス構成

### アーキテクチャ概要

```
┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │────│  Load Balancer  │
│   (Port 80/443) │    │                 │
└─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         │              │  Backend API    │
         └──────────────│  (Port 3000)    │
                        └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
           ┌─────────────┐ ┌───────────┐ ┌───────────┐
           │ PostgreSQL  │ │   Redis   │ │Prometheus │
           │ (Port 5432) │ │(Port 6380)│ │(Port 9090)│
           └─────────────┘ └───────────┘ └───────────┘
```

### ポート構成

| サービス | 内部ポート | 外部ポート | 説明 |
|---------|----------|----------|------|
| Nginx | 80/443 | 80/443 | リバースプロキシ、SSL終端 |
| Backend API | 3000 | 3000 | メインAPIサーバー |
| PostgreSQL | 5432 | 5432 | 主データベース |
| Redis | 6379 | 6380 | キャッシュ・セッション管理 |
| Prometheus | 9090 | 9090 | メトリクス収集 |
| Grafana | 3001 | 3001 | 監視ダッシュボード |

**注意**: Redis の外部ポートは 6380 に設定されており、`docker-compose.yml` の構成と一致します。

## 監視・ロギング

### ヘルスチェックエンドポイント

- **API Health**: `GET /health`
- **システム情報**: `GET /api/status`
- **データベース接続**: `GET /api/db/health`
- **Redis接続**: `GET /api/cache/health`

### ログ管理

```bash
# Docker Composeログの確認
docker-compose logs -f [サービス名]

# 特定サービスのログ
docker-compose logs -f backend
docker-compose logs -f nginx

# ログファイルの保存場所
./logs/
├── backend.log
├── nginx-access.log
├── nginx-error.log
└── database.log
```

### メトリクス監視

Prometheusメトリクスは以下のエンドポイントで確認できます：

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin123)

### 主要メトリクス

- HTTP リクエスト数・レスポンス時間
- データベース接続数・クエリ実行時間
- Redis接続数・キャッシュヒット率
- システムリソース使用量（CPU、メモリ、ディスク）

## トラブルシューティング

### よくある問題と解決方法

#### 1. データベース接続エラー

```bash
# 接続確認
docker-compose exec backend npm run db:ping

# データベースコンテナの状態確認
docker-compose ps postgres
docker-compose logs postgres

# 解決策
# 1. 環境変数DATABASE_URLの確認
# 2. PostgreSQLコンテナの再起動
docker-compose restart postgres
```

#### 2. Redis接続エラー

```bash
# Redis接続確認
docker-compose exec redis redis-cli ping

# 解決策
# 1. Redisコンテナの再起動
docker-compose restart redis
# 2. Redis設定の確認
docker-compose exec redis cat /usr/local/etc/redis/redis.conf
```

#### 3. SSL証明書エラー

```bash
# 証明書の確認
openssl x509 -in ssl/certificate.crt -text -noout

# Let's Encrypt証明書の更新
certbot renew --dry-run

# 解決策
# 1. 証明書の有効期限確認
# 2. nginx設定の確認
# 3. nginxの再起動
docker-compose restart nginx
```

#### 4. メモリ不足エラー

```bash
# メモリ使用量の確認
docker stats

# 解決策
# 1. 不要なコンテナの停止
# 2. docker-compose.ymlのメモリ制限調整
# 3. スワップファイルの設定
```

### ログ分析のためのコマンド

```bash
# エラーログの抽出
docker-compose logs backend | grep -i error

# アクセスログの分析
docker-compose logs nginx | grep "GET /api"

# パフォーマンス分析
docker-compose logs backend | grep "Response time"

# データベースクエリ分析
docker-compose logs postgres | grep "LOG:"
```

## セキュリティ考慮事項

### 基本的なセキュリティ設定

1. **環境変数の保護**
   - `.env` ファイルは本番環境でのみ使用
   - 機密情報はEnvironment Managerや外部シークレット管理サービスを使用

2. **ネットワークセキュリティ**
   - 必要なポートのみ開放
   - ファイアウォール設定の実装
   - VPCまたはプライベートネットワークの使用

3. **SSL/TLS設定**
   - すべての通信でHTTPS強制
   - 強固な暗号化スイートの使用
   - HTTP Strict Transport Security (HSTS) の有効化

### 定期的なセキュリティ更新

```bash
# Dockerイメージの更新
docker-compose pull
docker-compose up -d

# OS パッケージの更新
sudo apt update && sudo apt upgrade

# Node.js依存関係の脆弱性チェック
npm audit
npm audit fix
```

## パフォーマンス最適化

### 基本的な最適化設定

1. **データベース最適化**
   - インデックスの最適化
   - クエリパフォーマンスの監視
   - 接続プール設定の調整

2. **Redis キャッシュ最適化**
   - 適切なキャッシュ戦略の実装
   - メモリ使用量の監視
   - TTL設定の最適化

3. **API レスポンス最適化**
   - 圧縮の有効化
   - レスポンスキャッシュの実装
   - 無駄なデータ転送の削減

### 負荷テスト

```bash
# Apache Bench を使用した基本的な負荷テスト
ab -n 1000 -c 10 http://localhost:3000/api/health

# より詳細な負荷テスト
./scripts/load-test.sh
```

## バックアップ・災害復旧

### データベースバックアップ

```bash
# 手動バックアップ
docker-compose exec postgres pg_dump -U postgres conea_db > backup_$(date +%Y%m%d).sql

# 自動バックアップスクリプト
./scripts/backup-database.sh

# バックアップの復元
docker-compose exec postgres psql -U postgres -d conea_db < backup_20240101.sql
```

### 設定ファイルのバックアップ

```bash
# 重要な設定ファイルのバックアップ
cp .env backup/.env.$(date +%Y%m%d)
cp docker-compose.yml backup/docker-compose.yml.$(date +%Y%m%d)
```

## 関連ドキュメント

- [環境変数設定ガイド](./environment_variables.md)
- [ロールバック手順](./rollback_procedures.md)
- [リリースチェックリスト](../developer-guide/release_checklist.md)
- [セキュリティガイド](../security/security_guide.md)

---

このデプロイメントガイドは定期的に更新され、最新のベストプラクティスと手順を反映します。質問や提案がある場合は、開発チームまでお問い合わせください。