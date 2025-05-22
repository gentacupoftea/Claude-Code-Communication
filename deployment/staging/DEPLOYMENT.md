# Conea ステージング環境デプロイガイド

このガイドでは、Conea（旧Shopify-MCP-Server）プロジェクトをステージング環境（staging.conea.ai）にデプロイする方法を説明します。

## 前提条件

- Node.js v16以上
- Python 3（静的サーバー確認用）
- Git

## デプロイ方法

### バックエンドデプロイ

バックエンドはDockerコンテナを使用してデプロイします。以下の手順で実行します：

```bash
# リポジトリのルートディレクトリに移動
cd /Users/mourigenta/shopify-mcp-server

# 必要な環境変数ファイルがあることを確認
ls -la .env*

# デプロイスクリプトを実行
cd deployment/staging
./deploy.sh
```

### フロントエンドデプロイ（手動方法）

環境変数の補間問題を回避するため、フロントエンドは以下の手動プロセスでデプロイします：

```bash
# フロントエンドディレクトリに移動
cd /Users/mourigenta/shopify-mcp-server/frontend

# 環境変数ファイルの準備
# .envファイルが正しく設定されていることを確認
cat .env

# 必要に応じて.envファイルを更新
# REACT_APP_API_URL=https://staging.conea.ai/api
# REACT_APP_WS_URL=wss://staging.conea.ai/ws
# REACT_APP_VERSION=staging

# 静的デプロイを実行
cd /Users/mourigenta/shopify-mcp-server/deployment/staging/static
./deploy-static.sh
```

### フロントエンドビルド（React標準方法 - 問題が解決した場合）

環境変数の補間問題が解決した場合、標準的なReactビルドプロセスも利用可能です：

```bash
# フロントエンドディレクトリに移動
cd /Users/mourigenta/shopify-mcp-server/frontend

# 依存関係のインストール（必要な場合）
npm install

# 本番用ビルドの作成
npm run build

# 環境変数の静的置換（必要な場合）
node env-config.js ./build

# ビルド結果を静的ディレクトリにコピー
cp -R build/* /Users/mourigenta/shopify-mcp-server/deployment/staging/static/public/
```

## 環境変数

以下の環境変数を設定する必要があります：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| REACT_APP_API_URL | バックエンドAPIのURL | https://staging.conea.ai/api |
| REACT_APP_WS_URL | WebSocketエンドポイント | wss://staging.conea.ai/ws |
| REACT_APP_VERSION | アプリケーションバージョン | staging-20250522 |

## デプロイの検証

デプロイが成功したかどうかを確認するには：

1. ブラウザで https://staging.conea.ai にアクセス
2. ページが正しく表示されることを確認
3. 必要に応じて以下のコマンドでログを確認：

```bash
# デプロイログの確認
cat /Users/mourigenta/shopify-mcp-server/deployment/staging/deploy.log

# デプロイ情報の確認
cat /Users/mourigenta/shopify-mcp-server/deployment/staging/static/public/deploy-info.json
```

## トラブルシューティング

### 環境変数の問題

環境変数が正しく設定されていない場合：

1. `.env`ファイルの内容を確認
2. 必要に応じて`env-config.js`スクリプトで静的に置換
3. 手動ビルドの場合はHTMLファイルを直接編集

### ビルドエラー

React Scriptsビルドで問題が発生する場合：

1. Node.jsのバージョンを確認（v16以上推奨）
2. 依存関係を再インストール：`rm -rf node_modules && npm install`
3. 古いビルドをクリア：`rm -rf build`

### 接続エラー

APIやWebSocketに接続できない場合：

1. バックエンドサービスが実行中か確認
2. ネットワーク設定とファイアウォールを確認
3. CORSの設定を確認

## ロールバック手順

問題が発生した場合、以下の手順でロールバックできます：

```bash
# 以前のデプロイに戻す
cd /Users/mourigenta/shopify-mcp-server/deployment/staging
# 前回のデプロイファイルをコピー
cp -R backup/YYYY-MM-DD/* static/public/
```

## 連絡先

デプロイに関する問題は以下に連絡してください：

- エンジニアリングチーム: engineering@conea.ai
- DevOps担当: devops@conea.ai