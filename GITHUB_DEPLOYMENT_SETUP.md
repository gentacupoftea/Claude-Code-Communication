# Conea GitHub 統合デプロイメント設定

本ドキュメントでは、Coneaプロジェクト（旧Shopify MCP Server）のGitHubベースのデプロイメント設定について説明します。「GitHub からデプロイするのがルール」に従い、以下の設定が完了しました。

## 1. GitHub Actions ワークフロー

以下のGitHub Actionsワークフローを設定しました：

### staging環境デプロイメント（`deploy-staging.yml`）

- **トリガー**: `develop`ブランチへのプッシュまたは手動トリガー
- **主な処理**:
  - フロントエンドとバックエンドのビルドとテスト
  - Dockerイメージのビルドとプッシュ
  - ステージングサーバーへのデプロイ
  - ヘルスチェック
  - Slack通知

### 本番環境デプロイメント（`deploy-production.yml`）

- **トリガー**: `main`ブランチへのプッシュまたは手動トリガー
- **主な処理**:
  - セキュリティスキャン（Trivy）
  - フロントエンドとバックエンドのビルドとテスト
  - Dockerイメージのビルドとプッシュ
  - Blue-Greenデプロイメント
  - ヘルスチェック
  - GitHub Release作成
  - Slack通知

## 2. Docker設定

### staging環境用

- **フロントエンド**: `deployment/staging/frontend.Dockerfile`
  - ビルドステージ: Node.js 18 Alpine
  - 実行ステージ: Nginx 1.21 Alpine
  - React Routerサポート

- **バックエンド**: `deployment/staging/backend.Dockerfile`
  - Node.js 18 Alpineベース
  - TypeScriptのコンパイル

- **docker-compose.yml**: `deployment/staging/docker-compose.yml`
  - フロントエンド、バックエンド、MongoDB、Redis、Nginx

### 本番環境用

- **フロントエンド**: `deployment/production/frontend.Dockerfile`
  - ビルドステージ: Node.js 18 Alpine
  - 実行ステージ: Nginx 1.21 Alpine
  - セキュリティ強化設定
  - 非rootユーザー実行

- **バックエンド**: `deployment/production/backend.Dockerfile`
  - マルチステージビルド（Node.js + Python）
  - セキュリティ強化設定
  - 非rootユーザー実行
  - ヘルスチェック設定

- **docker-compose.yml**: `deployment/production/docker-compose.yml`
  - フロントエンド、バックエンド、MongoDB（認証あり）、Redis（認証あり）
  - 環境変数の外部化
  - ヘルスチェック設定
  - ログローテーション設定

## 3. Nginx設定

- **Nginx設定**: `deployment/production/nginx.conf`
  - セキュリティヘッダー設定
  - キャッシュ設定
  - gzip圧縮
  - WebSocketサポート
  - React SPAサポート

## 4. デプロイスクリプト

- **ステージング**: `deployment/staging/deploy.sh`
  - 自己署名証明書の生成
  - Dockerコンテナのビルドと起動
  - ヘルスチェック

- **本番環境**: `deployment/production/deploy.sh`
  - Blue-Greenデプロイメント
  - 自動ロールバック機能
  - ヘルスチェック
  - デプロイログ記録

## 5. 必要な追加設定

### GitHub Secrets

以下のシークレットをGitHubリポジトリに設定する必要があります：

- **DockerHub認証**:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`

- **ステージングサーバー**:
  - `STAGING_HOST`
  - `STAGING_USERNAME`
  - `STAGING_SSH_KEY`

- **本番サーバー**:
  - `PRODUCTION_HOST`
  - `PRODUCTION_USERNAME`
  - `PRODUCTION_SSH_KEY`

- **通知**:
  - `SLACK_WEBHOOK`

### 環境ファイル

- **ステージング**: `.env.staging`
- **本番環境**: `.env.production`

## 6. デプロイ準備

GitHubベースのデプロイを開始するには：

1. GitHub上にリポジトリを作成: `https://github.com/mourigenta/conea`
2. ローカルリポジトリを初期化して接続:
   ```bash
   cd /Users/mourigenta/shopify-mcp-server
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/mourigenta/conea.git
   git push -u origin main
   ```

3. `develop`ブランチを作成:
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```

4. GitHub Secretsを設定
5. ステージングサーバーと本番サーバーの初期設定を実施

## 7. デプロイフロー

1. 開発者は機能ブランチで作業 (`feature/xxx`)
2. `develop`ブランチにマージすると自動的にステージング環境にデプロイ
3. ステージング環境でテストと検証
4. `main`ブランチにマージすると本番環境へのデプロイを開始（承認後）

---

## 参考ドキュメント

- [ステージングデプロイメントガイド](deployment/staging/README.md)
- [本番環境デプロイメントガイド](deployment/production/README.md)