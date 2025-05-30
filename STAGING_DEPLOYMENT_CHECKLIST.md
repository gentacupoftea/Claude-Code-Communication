# Coneaステージング環境デプロイ前チェックリスト

## 📋 デプロイ前必須チェック項目

### 🔧 環境設定の確認

- [ ] `.env.staging`ファイルが存在し、適切に設定されている
- [ ] Google Cloud プロジェクト `conea-project-staging` にアクセス権限がある
- [ ] Firebase プロジェクト `staging-conea-ai` にアクセス権限がある
- [ ] 必要なGoogle Cloud APIが有効化されている
  - [ ] Cloud Build API
  - [ ] Cloud Run API
  - [ ] Container Registry API
  - [ ] Firebase Hosting API

### 🏗️ ビルド環境の確認

- [ ] Node.js バージョン 18以降がインストールされている
- [ ] npm パッケージの依存関係が最新で問題がない
- [ ] フロントエンド (`frontend-v2`) のビルドが成功する
- [ ] バックエンド (`backend`) の依存関係が正しくインストールされる

### 🔐 認証・セキュリティ設定

- [ ] Google Cloud CLI (`gcloud`) が認証済み
- [ ] Firebase CLI が認証済み（`firebase login`）
- [ ] Docker デーモンが起動している
- [ ] 必要なサービスアカウントキーが設定されている

### 📁 コード品質チェック

- [ ] すべての変更がGitにコミットされている
- [ ] ブランチが最新の状態である
- [ ] TypeScriptエラーがない
- [ ] ESLintエラーがない
- [ ] テストが成功している

### 🌐 ドメイン・ネットワーク設定

- [ ] DNS設定が正しく構成されている
  - [ ] `stagingapp.conea.ai` → Firebase Hosting
  - [ ] `staging.conea.ai` → Cloud Run
- [ ] SSL証明書が有効である
- [ ] CORS設定が適切である

### 📊 監視・ログ設定

- [ ] Cloud Loggingが有効である
- [ ] エラートラッキングが設定されている
- [ ] ヘルスチェックエンドポイントが機能している

## 🚀 デプロイ実行チェック

### デプロイコマンド実行前

- [ ] 現在の作業ディレクトリが `/Users/mourigenta/projects/conea-integration/` である
- [ ] デプロイスクリプトに実行権限がある (`chmod +x deploy-staging.sh`)
- [ ] ネットワーク接続が安定している

### デプロイ中の監視項目

- [ ] Cloud Buildログでエラーがないか確認
- [ ] コンテナイメージのビルドが成功
- [ ] Cloud Runサービスのデプロイが成功
- [ ] Firebase Hostingのデプロイが成功

### デプロイ後の検証項目

- [ ] フロントエンド (`https://stagingapp.conea.ai`) にアクセス可能
- [ ] バックエンド (`https://staging.conea.ai/health`) のヘルスチェックが成功
- [ ] 主要なAPI エンドポイントが機能している
- [ ] 認証フローが正常に動作している
- [ ] データベース接続が正常である

## ⚠️ トラブルシューティング

### よくある問題と対処法

#### ビルドエラー
- **原因**: 依存関係の不整合
- **対処**: `npm ci` の再実行、`node_modules` の削除・再インストール

#### 認証エラー
- **原因**: Google Cloud / Firebase 認証の期限切れ
- **対処**: `gcloud auth login`, `firebase login` の再実行

#### ドメインアクセス問題
- **原因**: DNS設定の反映遅延
- **対処**: TTL待機（通常5-60分）、`nslookup` での確認

#### Container Registry アクセスエラー
- **原因**: 権限不足
- **対処**: サービスアカウントの権限確認・付与

## 🔄 ロールバック手順

デプロイに問題が発生した場合の緊急対応：

1. **前バージョンへのロールバック**
   ```bash
   gcloud run services replace-traffic conea-backend-staging --to-revisions=PREVIOUS_REVISION=100
   ```

2. **Firebase Hosting のロールバック**
   ```bash
   firebase hosting:clone staging-conea-ai:PREVIOUS_VERSION staging-conea-ai:current
   ```

3. **エラーログの確認**
   ```bash
   gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=conea-backend-staging" --limit=50
   ```

## 📝 デプロイ完了後のタスク

- [ ] ステージング環境での機能テスト実施
- [ ] パフォーマンステストの実行
- [ ] セキュリティテストの実行
- [ ] UAT（ユーザー受け入れテスト）の実施
- [ ] プロダクション環境デプロイの準備

## 📞 緊急連絡先

- **技術担当**: Claude Code Team
- **運用担当**: DevOps Team  
- **プロジェクト管理**: PM Team

---

**注意**: このチェックリストは必ず順番通りに実行し、各項目の完了を確認してから次に進んでください。