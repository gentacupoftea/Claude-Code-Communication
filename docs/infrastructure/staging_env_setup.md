# Conea Integration - ステージング環境セットアップガイド

## ⚠️ 重要な注意事項

**本文書内のプレースホルダー値について**
本文書中の `xxx`、`your-key-here`、省略されたAPIキーなどのプレースホルダーは、必ず実際の環境に応じた値に置き換えてください。プレースホルダーをそのまま使用すると、システムが正常に動作しません。

## 概要

このドキュメントでは、Conea Integrationプロジェクトのステージング環境における主要な設定値、設定手順、および注意点をまとめています。

## 🔗 CI/CD連携情報

**関連ワークフローファイル:**
- フロントエンド: `.github/workflows/frontend-main-ci.yml`
- バックエンドAPI: `.github/workflows/backend-api-ci.yml`
- MultiLLM API: `.github/workflows/multillm-api-ci.yml`

これらのワークフローは、以下の環境変数を参照・利用します：
- `STAGING_API_URL` → NEXT_PUBLIC_API_URL
- `STAGING_SUPABASE_URL` → NEXT_PUBLIC_SUPABASE_URL
- `STAGING_FIREBASE_PROJECT_ID` → Firebase デプロイ設定

## 🌐 プラットフォーム構成

### Firebase Configuration

#### プロジェクト情報
- **プロジェクトID**: `conea-integration-staging`
- **リージョン**: `asia-northeast1` (東京)
- **Firebase Hosting**: `app-staging` ターゲット
- **Firestore**: Native mode
- **Firebase Authentication**: Email/Password, Google OAuth

#### Firebase Hosting 設定
```json
{
  "hosting": [
    {
      "target": "app-staging",
      "public": ".next/out",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(js|css)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "max-age=31536000"
            }
          ]
        }
      ]
    }
  ]
}
```

#### Firebase セキュリティルール確認事項
- **Firestore Rules**: RLS（Row Level Security）ポリシーが適用済み
- **Storage Rules**: 認証済みユーザーのみアクセス可能
- **Authentication Rules**: Email verification required

### Supabase Configuration

#### プロジェクト情報
- **プロジェクトURL**: `https://conea-staging.supabase.co`
- **リージョン**: `ap-northeast-1` (東京)
- **Database**: PostgreSQL 15
- **Storage**: Public buckets for assets, private for user data

#### 主要テーブル
1. **enhanced_notifications**
   - RLSポリシー: ユーザー自身の通知のみアクセス可能
   - インデックス: user_id, created_at
   
2. **file_metadata**
   - RLSポリシー: ファイル所有者のみアクセス可能
   - 暗号化: AES-256 with user-specific keys

#### RLS ポリシー確認
```sql
-- enhanced_notifications テーブル
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'enhanced_notifications';

-- file_metadata テーブル
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'file_metadata';
```

#### Supabase Storage設定
```sql
-- バケット設定確認
SELECT name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets;

-- ストレージポリシー確認
SELECT * FROM storage.policies;
```

### Google Cloud Platform (GCP)

#### プロジェクト情報
- **プロジェクトID**: `conea-integration-staging`
- **リージョン**: `asia-northeast1`
- **Cloud Run**: APIサービス用
- **Container Registry**: `asia-northeast1-docker.pkg.dev`

#### Cloud Run サービス
1. **Backend API**
   - サービス名: `conea-backend-api-staging`
   - メモリ: 1Gi
   - CPU: 1 vCPU
   - 最小インスタンス: 0
   - 最大インスタンス: 10

2. **MultiLLM API**
   - サービス名: `conea-multillm-api-staging`
   - メモリ: 2Gi
   - CPU: 2 vCPU
   - 最小インスタンス: 0
   - 最大インスタンス: 20

#### ファイアウォールルール
```bash
# ステージング環境用ファイアウォールルール確認
gcloud compute firewall-rules list --filter="name~staging"

# 必要なポート
# - 80: HTTP
# - 443: HTTPS
# - 8000: Backend API (内部)
# - 6379: Redis (内部)
```

#### Secret Manager
```bash
# シークレット一覧確認
gcloud secrets list --filter="name~staging"

# 主要シークレット
# - staging-database-url
# - staging-redis-url
# - staging-supabase-anon-key
# - staging-firebase-service-account
```

## 🔧 環境変数設定

### Frontend (Firebase Hosting)
```bash
# .env.staging
NEXT_PUBLIC_API_URL=https://conea-backend-api-staging-xxx.a.run.app
NEXT_PUBLIC_SUPABASE_URL=https://conea-staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=conea-integration-staging
NEXT_PUBLIC_ENVIRONMENT=staging
```

### Backend API (Cloud Run)
```bash
# Cloud Run 環境変数
NODE_ENV=staging
REDIS_URL=redis://staging-redis-xxx:6379
DATABASE_URL=postgresql://user:pass@staging-db:5432/conea
SUPABASE_URL=https://conea-staging.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### MultiLLM API (Cloud Run)
```bash
# Cloud Run 環境変数
ENVIRONMENT=staging
REDIS_URL=redis://staging-redis-xxx:6379
DATABASE_URL=postgresql://user:pass@staging-db:5432/conea
OPENAI_API_KEY=sk-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_AI_API_KEY=AIzaSyxxxxx
```

## 🚀 デプロイメント手順

### 1. 前提条件確認
```bash
# 必要なCLIツールの確認
firebase --version
gcloud --version
supabase --version

# 認証確認
firebase login
gcloud auth list
```

### 2. Firebase Hosting デプロイ
```bash
cd frontend-v2
npm run build
firebase target:apply hosting app-staging conea-integration-staging
firebase deploy --only hosting:app-staging
```

### 3. Cloud Run デプロイ
```bash
# Backend API
gcloud run deploy conea-backend-api-staging \
  --source=./backend \
  --platform=managed \
  --region=asia-northeast1 \
  --allow-unauthenticated

# MultiLLM API
gcloud run deploy conea-multillm-api-staging \
  --source=./multiLLM_system \
  --platform=managed \
  --region=asia-northeast1 \
  --allow-unauthenticated
```

## 🔍 ヘルスチェック手順

### Frontend確認
```bash
# Firebase Hosting
curl -f https://app-staging.conea-integration-staging.web.app/

# Health API
curl -f https://app-staging.conea-integration-staging.web.app/api/health
```

### Backend API確認
```bash
# Health check
curl -f https://conea-backend-api-staging-xxx.a.run.app/api/health

# Status check
curl -f https://conea-backend-api-staging-xxx.a.run.app/api/status
```

### MultiLLM API確認
```bash
# Health check
curl -f https://conea-multillm-api-staging-xxx.a.run.app/health

# Models availability
curl -f https://conea-multillm-api-staging-xxx.a.run.app/models
```

### データベース接続確認
```bash
# Supabase接続確認
supabase status --project-ref conea-staging

# PostgreSQL接続確認（Cloud SQL Proxy経由）
psql -h 127.0.0.1 -p 5432 -U postgres -d conea-staging
```

## 🔗 Cloud SQL Proxy セットアップ

ローカル開発環境からステージングDBに接続する際のCloud SQL Proxyセットアップ手順：

### 1. Cloud SQL Proxy インストール
```bash
# macOS (Homebrew)
brew install cloud-sql-proxy

# Linux/Windows
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud_sql_proxy
```

### 2. サービスアカウント認証
```bash
# サービスアカウントキーを使用
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"

# または gcloud認証
gcloud auth application-default login
```

### 3. プロキシ起動
```bash
# ステージング環境DBへの接続
cloud_sql_proxy -instances=conea-integration-staging:asia-northeast1:conea-staging-db=tcp:5432

# バックグラウンド実行
nohup cloud_sql_proxy -instances=conea-integration-staging:asia-northeast1:conea-staging-db=tcp:5432 &
```

### 4. 接続確認
```bash
# 接続テスト
psql -h 127.0.0.1 -p 5432 -U postgres -d conea-staging

# 接続文字列例
DATABASE_URL="postgresql://username:password@127.0.0.1:5432/conea-staging"
```

**詳細ドキュメント**: [Google Cloud SQL Proxy Documentation](https://cloud.google.com/sql/docs/postgres/sql-proxy)

## ⚠️ 注意事項とベストプラクティス

### セキュリティ設定
1. **APIキー管理**: 全てのAPIキーはSecret Managerで管理
2. **CORS設定**: ステージング環境専用のオリジンのみ許可
3. **Rate Limiting**: 開発テスト用に緩い設定
4. **SSL/TLS**: 必須、Let's Encryptまたは Google Managed SSL

### データベース管理
1. **バックアップ**: 日次自動バックアップ有効
2. **マイグレーション**: Alembicで管理
3. **テストデータ**: 本番データは使用禁止
4. **パフォーマンス**: クエリログ監視

### モニタリング
1. **Cloud Monitoring**: サービスレベル指標
2. **Error Reporting**: エラー集約とアラート
3. **Logging**: 構造化ログ出力
4. **Uptime Checks**: エンドポイント監視

### 開発ワークフロー
1. **ブランチ戦略**: `develop` → staging自動デプロイ
2. **テスト**: CI/CDパイプラインで自動実行
3. **Review**: プルリクエスト必須
4. **Rollback**: 問題発生時の即座復旧手順

## 📞 トラブルシューティング

### よくある問題

#### Firebase Hosting 502エラー
```bash
# ビルド成果物確認
ls -la .next/out/

# Firebase設定確認
firebase hosting:channel:list
```

#### Cloud Run デプロイ失敗
```bash
# ログ確認
gcloud run services logs read conea-backend-api-staging

# リビジョン確認
gcloud run revisions list --service=conea-backend-api-staging
```

#### Supabase接続エラー
```bash
# プロジェクト設定確認
supabase projects list

# データベース接続確認
supabase db remote --help
```

### 緊急時対応

#### サービス停止
```bash
# 一時的なメンテナンスページ表示
firebase hosting:channel:deploy maintenance --expires 1h

# サービスのトラフィック停止
gcloud run services update-traffic conea-backend-api-staging --to-revisions=PREVIOUS=100
```

#### データベース問題
```bash
# 最新バックアップからの復元
gcloud sql backups list --instance=conea-staging-db
gcloud sql backups restore [BACKUP_ID] --restore-instance=conea-staging-db
```

## 📝 設定更新手順

環境設定を更新する際は、以下の手順に従ってください：

1. 設定変更のプルリクエスト作成
2. ステージング環境での動作確認
3. セキュリティ影響評価
4. チームレビューと承認
5. 段階的な設定反映
6. ヘルスチェック実行
7. ロールバック手順確認

---

**最終更新**: 2025年6月4日  
**担当者**: DevOps Team  
**レビュー周期**: 月次