# Conea ステージングデプロイガイド

このガイドは、Coneaプロジェクト（旧Shopify-MCP-Server）のステージング環境への
デプロイプロセスを詳細に解説しています。統合テストの実行からデプロイ検証まで
の一連の手順を含みます。

## 概要

ステージングデプロイは以下のステップで実施します：

1. **統合テスト環境の準備**：リポジトリのクローン、依存関係のインストール
2. **統合テストの実行**：主要機能の検証テスト
3. **デプロイパッケージの構築**：バックエンドとフロントエンドのデプロイ資材作成
4. **データベースマイグレーションの実行**：スキーマ更新とマスターデータのセットアップ
5. **バックエンドデプロイ**：サーバーコンポーネントのデプロイ
6. **フロントエンドデプロイ**：UIコンポーネントのデプロイ
7. **デプロイ検証**：APIエンドポイントと機能の検証

## 前提条件

- Gitがインストールされていること
- Python 3.10以上がインストールされていること
- Node.js 16以上とnpmがインストールされていること
- PostgreSQLクライアントツール（psql、pg_dump）がインストールされていること
- Google Cloud SDKがインストールされていること
- 適切なアクセス権限が付与されていること

## 1. 統合テスト環境の準備

まずは統合テスト専用のブランチを作成します：

```bash
# リポジトリのクローン（すでに存在する場合はスキップ）
git clone https://github.com/conea/conea.git
cd conea

# 最新のmainブランチを取得
git checkout main
git pull origin main

# 統合テスト用ブランチの作成
git checkout -b integration-test-stage

# 仮想環境の作成と有効化
python -m venv venv
source venv/bin/activate  # Linuxの場合
# または venv\Scripts\activate  # Windowsの場合

# 依存関係のインストール
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

## 2. 統合テストの実行

### 2.1 パッケージリネーム検証テスト

パッケージ名の変更（shopify-mcp-server → conea）が正しく行われていることを検証します：

```bash
# リネーム検証テストの実行
pytest tests/rename/test_package_rename.py -v
```

### 2.2 AIプロバイダー連携テスト

AIプロバイダー（OpenAI/Claude/Gemini）との連携が正常に動作することを検証します：

```bash
# AIプロバイダー連携テストの実行
pytest tests/ai/test_provider_integration.py -v
```

### 2.3 データ可視化コンポーネントテスト

Chart.js連携とチャートコマンド解析機能が正常に動作することを検証します：

```bash
# データ可視化コンポーネントテストの実行
pytest tests/charts/test_chart_rendering.py -v
```

### 2.4 APIエンドポイントテスト

主要なAPIエンドポイントが期待通りに動作することを検証します：

```bash
# APIエンドポイントテストの実行
pytest tests/api/ -v
```

### 2.5 全テストの実行

すべてのテストを実行し、コードカバレッジレポートを生成します：

```bash
# 全テストの実行とカバレッジレポート生成
pytest --cov=conea tests/ --cov-report=html
```

カバレッジレポートは `htmlcov/index.html` に生成されます。ブラウザで開いて確認してください。

## 3. デプロイパッケージの構築

ステージング環境用のデプロイパッケージを作成します：

```bash
# バックエンドデプロイパッケージの構築
python scripts/build_deploy_package.py --backend --env=staging

# フロントエンドデプロイパッケージの構築
python scripts/build_deploy_package.py --frontend --env=staging
```

デプロイパッケージは `deploy_artifacts` ディレクトリに生成されます：
- `conea-backend-staging-v0.3.0-*.zip`
- `conea-frontend-staging-v0.3.0-*.zip`

## 4. データベースマイグレーションの実行

ステージング環境のデータベースにマイグレーションを適用します：

```bash
# データベースマイグレーションのドライラン（適用されるマイグレーションの確認）
python scripts/run_migrations.py --env=staging --dry-run

# データベースマイグレーションの実行
python scripts/run_migrations.py --env=staging
```

## 5. バックエンドデプロイ

ステージング環境にバックエンドサービスをデプロイします：

```bash
# デプロイのドライラン（実際の変更は行わない）
python scripts/deploy_backend.py --env=staging --dry-run

# バックエンドのデプロイ実行
python scripts/deploy_backend.py --env=staging
```

デプロイが完了すると、サービスURLが表示されます（例：`https://conea-staging.asia-northeast1.run.app`）。

## 6. フロントエンドデプロイ

ステージング環境にフロントエンドアプリケーションをデプロイします：

```bash
# フロントエンドのデプロイ実行
# （スクリプトが未実装の場合はGitHub Actionsワークフローを使用）
python scripts/deploy_frontend.py --env=staging

# または、GitHub Actionsを使用する場合
# リポジトリのActionsタブから"Deploy Frontend to Staging"ワークフローを実行
```

## 7. デプロイ検証

### 7.1 基本的な到達性テスト

ステージング環境への基本的な接続テストを実行します：

```bash
# ステージング環境の基本検証
python scripts/verify_staging.sh --all
```

### 7.2 APIエンドポイント検証

ステージング環境のAPIエンドポイントを詳細に検証します：

```bash
# APIエンドポイント検証
python scripts/verify_api_endpoints.py --env=staging --verbose
```

### 7.3 総合テスト実行

ステージング環境で総合的なテストスイートを実行します：

```bash
# ステージング環境での総合テスト実行
scripts/run_staging_tests.sh --url=https://conea-staging.asia-northeast1.run.app
```

## 8. フィードバック収集と調整

ステージングデプロイが完了したら、以下の作業を行います：

1. チームメンバーにステージング環境のURLを共有
2. フィードバックの収集と課題のトラッキング
3. 必要に応じて修正とデプロイの繰り返し

## 9. デプロイ報告書の作成

ステージングデプロイの結果を報告書にまとめます：

```bash
# デプロイ報告書テンプレートの生成
python scripts/generate_deploy_report.py --env=staging --output=docs/staging_deploy_report_$(date +%Y%m%d).md
```

報告書には以下の内容を含めます：
- デプロイ日時と実施者
- デプロイしたコンポーネントとバージョン
- テスト結果のサマリー
- 発生した問題と解決策
- 残存している既知の問題
- 推奨される次のステップ

## トラブルシューティング

### データベース接続エラー

データベース接続に問題がある場合は以下を確認してください：

1. `.env.staging` ファイルのデータベース接続情報が正しいか
2. PostgreSQLクライアントが正しくインストールされているか
3. ネットワーク接続やファイアウォール設定に問題がないか

### デプロイ失敗

デプロイが失敗した場合は以下を確認してください：

1. Cloud Runサービスのログを確認
2. サービスアカウントの権限設定を確認
3. 環境変数とシークレットが正しく設定されているか

### APIエンドポイント検証失敗

APIエンドポイントの検証に失敗した場合は以下を確認してください：

1. サービスが完全に起動しているか（数分待つ）
2. バックエンドサービスのログでエラーメッセージを確認
3. テスト用の認証情報が正しいか

## 参考リンク

- [Conea プロジェクトリポジトリ](https://github.com/conea/conea)
- [Google Cloud Run ドキュメント](https://cloud.google.com/run/docs)
- [Firebase Hosting ドキュメント](https://firebase.google.com/docs/hosting)