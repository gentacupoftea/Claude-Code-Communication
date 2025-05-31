# Shopify MCP Server

OpenAIのModel Context Protocol (MCP)仕様に基づくShopify統合サーバー。このサーバーを使用することで、AIアシスタント（Claude Code、GitHub Copilotなど）がShopifyストアのデータにアクセスし、操作することができます。

**バージョン**: v0.3.0 (Analytics Edition)  
**ステータス**: 本番環境対応  
**ドキュメント**: [完全なドキュメント](docs/README.md)

## 🚀 v0.3.0の新機能

- **Google Analytics統合**: リアルタイムデータ付きのGA4 API完全サポート
- **高度な分析**: コンバージョンファネル、ユーザーセグメント、カスタムメトリクス
- **インテリジェントキャッシング**: パフォーマンス向上のためのRedisベースキャッシング
- **拡張APIサポート**: 分析用のRESTとGraphQLエンドポイント

### 以前のアップデート (v0.2.0)
- **GraphQL APIサポート**: 最大70%少ないAPIコールで効率的なデータ取得
- **強化されたテスト**: カバレッジレポート付きの包括的なテストスイート
- **柔軟な依存関係**: バージョン範囲との互換性向上
- **ネットワーク耐性**: 制限されたネットワーク環境での処理改善

## ✨ 機能

### コア機能
- 🛍️ リアルタイム注文データ集計
- 📊 売上分析と可視化
- 📈 インタラクティブな分析ダッシュボード
- 💰 通貨対応レポート（マルチ通貨対応）
- 🔒 セキュアなAPI統合
- 📈 商品パフォーマンス追跡
- 🌐 GraphQLとREST APIサポート
- 📊 Google Analytics統合 (v0.3.0で新規追加)

### 技術的機能
- 🚄 高性能キャッシング
- 🧪 包括的なテストカバレッジ
- 🐳 Dockerサポート
- 📝 詳細なドキュメント
- 🔄 CI/CD対応
- 🛡️ ネットワーク耐性のあるインストール
- 🔐 Google Analytics用のRedisベースキャッシング

## 📚 クイックスタート

### 前提条件
- Python 3.8以上
- APIアクセス権限を持つShopifyストア
- Claude Desktopアプリケーション
- Google Analyticsプロパティ（GA統合用）

### インストール

#### 標準インストール

```bash
# 1. リポジトリをクローン
git clone https://github.com/mourigenta/shopify-mcp-server.git
cd shopify-mcp-server

# 2. ネットワーク耐性のある環境セットアップ
./setup_test_env.sh
# カスタムオプション付き:
# INSTALL_TIMEOUT=300 INSTALL_RETRY=5 ./setup_test_env.sh

# 3. Shopify認証情報を設定
cp .env.example .env
# .envファイルに認証情報を編集
```

#### 制限されたネットワークでのインストール

```bash
# ネットワーク制限のある環境向け:

# 1. プロキシ経由
export PIP_PROXY=http://your-proxy:port
./setup_test_env.sh

# 2. 限定的なネットワーク接続
INSTALL_TIMEOUT=300 INSTALL_RETRY=10 ./setup_test_env.sh

# 3. オフラインインストール
# まず、接続されたマシンでパッケージをダウンロード:
pip download -r requirements.txt -d vendor/
# その後、ターゲットマシンで:
OFFLINE_MODE=1 ./setup_test_env.sh

# 4. 最小限のインストール（コア機能のみ）
INSTALL_OPTIONAL=0 INSTALL_DEV=0 ./setup_test_env.sh
```

### 設定

`.env`ファイルでShopify認証情報とGoogle Analytics設定を行います：

```bash
# Shopify設定
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2024-01

# Google Analytics設定
GA_CREDENTIALS_PATH=/path/to/service-account.json
GA_PROPERTY_ID=123456789
```

詳細な手順については[環境設定ガイド](docs/configuration/environment.md)を参照してください。

## 🛠️ 利用可能なツール

### REST APIツール
- `get_orders_summary`: 注文統計と収益
- `get_sales_analytics`: 売上トレンドと分析
- `get_product_performance`: トップパフォーマンス商品

### GraphQL APIツール
- `get_shop_info_graphql`: 包括的なショップ情報
- `get_products_graphql`: 効率的な商品データ取得
- `get_inventory_levels_graphql`: ロケーション対応の在庫追跡

### Google Analytics APIツール (v0.3.0以降)
- `run_ga_report`: Google Analyticsレポートの実行
- `get_realtime_data`: リアルタイム訪問者分析
- `get_conversion_funnel`: コンバージョンパスの分析
- `get_user_segments`: ユーザーセグメントの比較

### どれを使用すべきか？

**GraphQLを使用する場合:**
- 関連データを含む複雑なクエリ
- 帯域幅制限のあるモバイルアプリ
- 選択的なフィールド取得

**RESTを使用する場合:**
- シンプルなCRUD操作
- キャッシュされたコンテンツ
- レガシー統合

詳細な比較については[GraphQL vs RESTガイド](docs/user-guide/graphql-vs-rest.md)を参照してください。

## 🧪 テスト

テスト環境を準備してテストスイートを実行：

```bash
# テスト用の例変数をコピー
cp .env.test.example .env.test
# virtualenvに依存関係をインストール
./setup_test_env.sh

# 自動依存関係検出ですべてのテストを実行
python run_adaptive_tests.py

# カバレッジレポート付きで実行
./run_tests.sh --coverage

# 特定のテストファイルを実行
python -m pytest test_graphql_client.py

# 環境と依存関係をチェック
python test_imports.py
```

## 🐳 Dockerサポート

Dockerでデプロイ：

```bash
# ビルドして実行
docker-compose up

# 本番環境へのデプロイ
docker-compose -f docker-compose.prod.yml up
```

詳細は[Docker設定](docs/configuration/docker.md)を参照してください。

## 📊 Google Analytics統合

### セットアップ
1. `.env`でGA認証情報を設定:
```bash
GA_CREDENTIALS_PATH=/path/to/service-account.json
GA_PROPERTY_ID=123456789
```

2. キャッシング用のRedisを起動:
```bash
docker-compose -f docker-compose.ga.yml up redis
```

3. GAサーバーを実行:
```bash
python -m src.google_analytics.main
```

### 機能
- リアルタイム訪問者追跡
- カスタムレポート生成
- コンバージョンファネル分析
- マルチプロパティサポート
- Redisによるインテリジェントキャッシング

詳細なドキュメントは[Google Analyticsガイド](docs/GOOGLE_ANALYTICS_GUIDE.md)を参照してください。

## 🤝 コントリビューション

貢献を歓迎します！以下の[コントリビューションガイド](docs/contributing/README.md)を参照してください：

- 開発ワークフロー
- コードスタイルガイドライン
- プルリクエストプロセス
- リリース手順

## 📊 パフォーマンス

v0.2.0で大幅なパフォーマンス改善を実現：

- 複雑なクエリのAPIコール**70%削減**（GraphQL）
- マルチリソース取得の応答時間**40%高速化**
- 選択的フィールドクエリで帯域幅使用量**50%削減**
- **ネットワーク耐性のある**インストールプロセス

## 🔐 セキュリティ

- 環境ベースの設定
- セキュアなトークン保存
- レート制限への対応
- SSL/TLSサポート

## 📄 ライセンス

MITライセンス - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

このプロジェクトをより良くするために協力してくださったすべての貢献者に感謝します！

## 📞 サポート

- 📖 [ドキュメント](docs/README.md)
- 💬 [ディスカッション](https://github.com/gentacupoftea/shopify-mcp-server/discussions)
- 🐛 [イシュートラッカー](https://github.com/gentacupoftea/shopify-mcp-server/issues)
- 📧 メール: support@example.com

---

<p align="center">
  Shopify MCP Serverチームによって❤️を込めて作成
</p>