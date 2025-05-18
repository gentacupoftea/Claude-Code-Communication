# Docker化テスト環境

このディレクトリには、Conea（Shopify-MCP-Server）プロジェクトのDocker化されたテスト環境が含まれています。この環境は、すべての依存関係を含む完全に隔離されたテスト環境を提供し、環境依存性の問題を解決します。

## 構成要素

- **PostgreSQL 14**: テスト用データベース
- **Redis**: キャッシュサーバー
- **Mock Shopify API**: Shopify APIのモックサーバー
- **Mock Google Analytics API**: Google Analytics APIのモックサーバー
- **Test Application**: テスト実行用のコンテナ

## 使用方法

### 環境変数の設定

```bash
cp .env.example .env
```

必要に応じて`.env`ファイルを編集してください。

### 全テストの実行

```bash
docker-compose up --build
```

### 特定のテストタイプの実行

```bash
# ユニットテストのみ
docker-compose run test-app unit

# 統合テストのみ
docker-compose run test-app integration

# E2Eテストのみ
docker-compose run test-app e2e

# すべてのテスト
docker-compose run test-app all

# 並列実行（高速化）
docker-compose run test-app all --parallel

# 依存関係のインストールをスキップ
docker-compose run test-app all --skip-install
```

### クリーンアップ

```bash
docker-compose down -v
```

### トラブルシューティング

#### pip install pytest が失敗する場合

新しいテストランナーは自動的に依存関係をインストールします。手動でインストールする必要がある場合：

```bash
docker-compose run test-app pip install -r requirements-test.txt
```

#### 環境変数エラーが発生する場合

run_e2e_tests.py は自動的にデフォルト値を設定しますが、カスタム値が必要な場合は docker-compose.yml で設定してください。

## ファイル構造

```
docker-test/
├── docker-compose.yml       # マルチコンテナ定義
├── Dockerfile.test          # メインテスト環境用Dockerfile
├── .env.example             # 環境変数テンプレート
├── mock-services/           # モックAPIサービス
│   ├── Dockerfile.mock-shopify
│   ├── Dockerfile.mock-ga
│   ├── mock-shopify/        # Shopify APIモックサーバー実装
│   └── mock-ga/             # GA APIモックサーバー実装
├── scripts/
│   ├── run_tests.sh         # テスト実行スクリプト
│   ├── setup_test_db.sh     # テストDB初期化スクリプト
│   └── wait-for-it.sh       # サービス待機スクリプト
└── test-data/               # テスト用初期データ
```

## モックサービス

### Mock Shopify API

- ポート: 8080
- エンドポイント:
  - `/health`: ヘルスチェック
  - `/graphql`: GraphQL API
  - `/admin/api/2024-01/products.json`: 商品一覧
  - `/admin/api/2024-01/orders.json`: 注文一覧
  - `/admin/api/2024-01/customers.json`: 顧客一覧

### Mock Google Analytics API

- ポート: 8081
- エンドポイント:
  - `/health`: ヘルスチェック
  - `/management/properties`: プロパティ一覧
  - `/data:runReport`: レポート実行
  - `/data:runRealtimeReport`: リアルタイムレポート
  - `/token`: OAuth2トークン取得

## CI/CD統合

GitHub ActionsとCircleCIの設定ファイルが含まれています：

- `.github/workflows/docker-tests.yml`: GitHub Actions設定
- 全テストと個別テストタイプの並列実行
- テスト結果のアーティファクト保存

## トラブルシューティング

### ポート競合

他のサービスがポートを使用している場合は、`docker-compose.yml`でポートを変更してください。

### メモリ不足

E2Eテストでメモリ不足が発生する場合は、Dockerのメモリ割り当てを増やしてください。

### ネットワークエラー

```bash
docker network prune
docker-compose up --build --force-recreate
```

## 開発者向け

### 新しいモックエンドポイントの追加

1. `mock-services/mock-shopify/server.js` または `mock-services/mock-ga/server.py` を編集
2. 必要なレスポンスデータを追加
3. コンテナを再ビルド: `docker-compose build`

### テストデータの追加

1. `test-data/` ディレクトリに新しいJSONファイルを追加
2. `setup_test_db.sh` スクリプトを更新して新しいデータを読み込む
3. テストコードでデータを参照

## セキュリティ

- テスト環境のみで使用してください
- プロダクション環境では使用しないでください
- テスト用の認証情報はすべてモックされています