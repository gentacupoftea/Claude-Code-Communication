# 🚀 Coneaプロジェクト ステージング環境デプロイガイド

## 📖 概要

このガイドでは、Coneaプロジェクトをステージング環境にデプロイする完全な手順を説明します。
ステージング環境は本番環境へのデプロイ前のテストとバリデーションに使用されます。

## 🏗️ アーキテクチャ構成

### インフラストラクチャ
- **フロントエンド**: Firebase Hosting (`stagingapp.conea.ai`)
- **バックエンド**: Google Cloud Run (`staging.conea.ai`)
- **ビルド**: Google Cloud Build
- **コンテナレジストリ**: Google Container Registry (GCR)

### 使用技術スタック
- **フロントエンド**: Next.js 15.3.2 (静的エクスポート)
- **バックエンド**: Node.js 18 (Express.js)
- **データベース**: PostgreSQL (ステージング用)
- **キャッシュ**: Redis (ステージング用)

## 🛠️ 前提条件

### 必要なツール
```bash
# Node.js (v18以降)
node --version

# Google Cloud CLI
gcloud --version

# Firebase CLI
firebase --version

# Docker
docker --version
```

### 認証設定
```bash
# Google Cloud認証
gcloud auth login
gcloud config set project conea-project-staging

# Firebase認証
firebase login
```

## 📁 設定ファイル

### 環境変数 (`.env.staging`)
```bash
# 基本設定
NODE_ENV=staging
PORT=8000
API_HOST=0.0.0.0

# URL設定
FRONTEND_URL=https://stagingapp.conea.ai
BACKEND_URL=https://staging.conea.ai

# データベース設定
DATABASE_URL=postgresql://staging_user:password@staging-db:5432/conea_staging

# その他の設定...
```

### Cloud Build設定 (`cloudbuild.staging.yaml`)
- フロントエンドビルド
- バックエンドコンテナ化
- Cloud Runデプロイ
- Firebase Hostingデプロイ

## 🚀 デプロイ手順

### 1. 事前準備
```bash
# プロジェクトディレクトリに移動
cd /Users/mourigenta/projects/conea-integration/

# 最新のコードを取得
git pull origin main

# デプロイ前チェックリストを確認
cat STAGING_DEPLOYMENT_CHECKLIST.md
```

### 2. 環境変数の確認
```bash
# ステージング環境変数の確認
cat .env.staging

# 必要に応じて編集
vim .env.staging
```

### 3. ローカルビルドテスト
```bash
# フロントエンドのビルドテスト
cd frontend-v2
npm ci
npm run build
cd ..

# バックエンドの依存関係チェック
cd backend
npm ci
cd ..
```

### 4. デプロイ実行
```bash
# デプロイスクリプトの実行
./deploy-staging.sh
```

## 📊 デプロイスクリプトの処理フロー

1. **環境設定**
   - Google Cloudプロジェクトの設定
   - 必要なAPIの有効化
   - 環境変数の読み込み

2. **事前チェック**
   - Git状態の確認
   - 依存関係の確認

3. **ビルド**
   - フロントエンドのビルド
   - バックエンドの準備

4. **デプロイ**
   - Cloud Buildの実行
   - コンテナイメージの作成
   - Cloud Runへのデプロイ
   - Firebase Hostingへのデプロイ

5. **検証**
   - ヘルスチェック
   - アクセス確認

## 🔍 デプロイ後の確認項目

### ヘルスチェック
```bash
# バックエンドAPI
curl https://staging.conea.ai/health

# フロントエンド
curl https://stagingapp.conea.ai
```

### 主要機能の確認
- [ ] ログイン機能
- [ ] ダッシュボード表示
- [ ] API通信
- [ ] データベース接続
- [ ] 認証フロー

## 🚨 トラブルシューティング

### よくある問題

#### 1. ビルドエラー
```bash
# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install

# キャッシュクリア
npm cache clean --force
```

#### 2. 認証エラー
```bash
# Google Cloud再認証
gcloud auth login --update-adc

# Firebase再認証
firebase logout
firebase login
```

#### 3. Cloud Run デプロイエラー
```bash
# サービスログの確認
gcloud logs read "resource.type=cloud_run_revision" --limit=50

# トラフィック配分の確認
gcloud run services describe conea-backend-staging --region=asia-northeast1
```

#### 4. Firebase Hosting エラー
```bash
# Firebase プロジェクト確認
firebase projects:list

# ホスティング状態確認
firebase hosting:sites:list
```

### ログの確認方法

#### Cloud Run ログ
```bash
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=conea-backend-staging" --limit=100
```

#### Cloud Build ログ
```bash
gcloud builds list --limit=10
gcloud builds log BUILD_ID
```

## 🔄 ロールバック手順

### 緊急時の対応

#### Cloud Run ロールバック
```bash
# 前のリビジョンに100%のトラフィックを向ける
gcloud run services update-traffic conea-backend-staging \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1
```

#### Firebase Hosting ロールバック
```bash
# 前のバージョンに戻す
firebase hosting:clone staging-conea-ai:PREVIOUS_VERSION staging-conea-ai:current
```

## 📈 監視とメトリクス

### Cloud Run メトリクス
- リクエスト数
- レスポンス時間
- エラー率
- CPU使用率
- メモリ使用率

### Firebase Hosting メトリクス
- ページビュー
- 読み込み時間
- エラー数

## 🔐 セキュリティ考慮事項

### 環境変数管理
- 本番用のシークレットは使用しない
- テスト用のAPIキーを使用
- データベースは本番とは分離

### アクセス制御
- ステージング環境へのアクセス制限
- 適切なIAM権限の設定
- VPCセキュリティの確保

## 📋 次のステップ

1. **テスト実行**
   - 機能テスト
   - パフォーマンステスト
   - セキュリティテスト

2. **品質確認**
   - ユーザー受け入れテスト (UAT)
   - アクセシビリティテスト
   - クロスブラウザテスト

3. **本番準備**
   - 本番環境設定の確認
   - データ移行計画の策定
   - 監視体制の整備

## 📞 サポート

### 技術的な問題
- **Claude Code Team**: 技術実装に関する問題
- **DevOps Team**: インフラストラクチャに関する問題

### 緊急時の連絡先
- **オンコール**: [緊急連絡先]
- **エスカレーション**: [管理者連絡先]

---

**最終更新**: 2025年5月31日  
**バージョン**: v1.0.0  
**メンテナンス**: Claude Code Team