# Amazon Selling Partner API 実装

## 概要

このプルリクエストでは、Amazon Selling Partner API（SP-API）との統合実装を追加します。この実装により、Coneaプラットフォームから以下の機能を提供できるようになります：

- Amazon Seller Central APIへの認証
- 商品データの取得と管理
- 注文データの取得と処理
- 在庫情報の取得と更新
- エラーハンドリングとレート制限の適切な処理
- OAuth認証フローのサポート

## 変更内容

### 新規追加ファイル

1. **APIクライアント**
   - `src/api/amazon/client.py`: メインAmazon APIクライアント
   - `src/api/amazon/models.py`: データモデル定義

2. **認証ユーティリティ**
   - `scripts/generate_amazon_auth_urls.py`: OAuth認証URL生成スクリプト
   - `scripts/process_amazon_oauth_callback.py`: OAuth認証コールバック処理スクリプト
   - `scripts/run_amazon_oauth_server.py`: ローカルOAuth認証サーバー
   - `scripts/test_amazon_auth.py`: 認証テストスクリプト

3. **テスト関連**
   - `tests/api/amazon/run_amazon_tests.py`: Amazon API統合テスト
   - `amazon_api_test.env`: テスト環境変数テンプレート

### 主要機能

1. **複数認証方式のサポート**
   - client_credentials: シンプルなAPI認証（デフォルト）
   - authorization_code: OAuth認証フロー
   - refresh_token: 長期間アクセス用トークン更新

2. **共通インターフェース**
   - AbstractEcommerceClientインターフェース実装
   - 他のECプラットフォームと一貫したAPI

3. **強化されたエラーハンドリング**
   - 自動リトライ機構
   - 指数バックオフ
   - エラーコード標準化

4. **レート制限管理**
   - レート制限情報の追跡
   - 制限到達時の適応的バックオフ

## テスト結果

Amazon API統合テストを実行した結果、以下のスコアを達成しました：

- **基本接続テスト**: ✅ 成功
- **エラー処理テスト**: ✅ 成功
- **製品データテスト**: ⚠️ 部分的に成功（API権限の問題）
- **注文データテスト**: ⚠️ 部分的に成功（API権限の問題）

**注**: 製品データテストと注文データテストの一部失敗は、APIキーに必要な権限（scope）が不足していることが原因です。実環境で適切な権限を設定することで解決します。

## 設定方法

1. 以下の環境変数を設定します：
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AMAZON_SELLER_ID=your-seller-id
AMAZON_MARKETPLACE_ID=your-marketplace-id
AMAZON_APP_CLIENT_ID=your-app-client-id
AMAZON_APP_CLIENT_SECRET=your-app-client-secret
AMAZON_API_ENDPOINT=https://sellingpartnerapi-na.amazon.com
```

2. OAuth認証を使用する場合は、以下も設定します：
```
AMAZON_AUTH_METHOD=refresh_token
AMAZON_REDIRECT_URI=your-redirect-uri
AMAZON_REFRESH_TOKEN=your-refresh-token
```

## 使用例

```python
from src.api.amazon.client import AmazonAPIClient

# クライアントの初期化
client = AmazonAPIClient({
    'AWS_ACCESS_KEY_ID': 'your-aws-access-key',
    'AWS_SECRET_ACCESS_KEY': 'your-aws-secret-key',
    'AMAZON_SELLER_ID': 'your-seller-id',
    'AMAZON_MARKETPLACE_ID': 'your-marketplace-id',
    'AMAZON_APP_CLIENT_ID': 'your-app-client-id',
    'AMAZON_APP_CLIENT_SECRET': 'your-app-client-secret'
})

# 認証
await client.authenticate()

# 商品データの取得
products = await client.get_products(limit=10, filters={"query": "wireless"})

# 注文データの取得
orders = await client.get_orders(limit=10)

# 在庫情報の取得
inventory = await client.get_inventory("product_id")
```

## 次のステップ

1. 本番環境での権限設定の最適化
2. 機能テストの完全カバレッジ
3. パフォーマンス改善と最適化

## 関連ドキュメント

詳細は以下のドキュメントを参照してください：
- [AMAZON_IMPLEMENTATION.md](./AMAZON_IMPLEMENTATION.md): 実装の詳細説明
- [Amazon Selling Partner API Documentation](https://developer-docs.amazon.com/sp-api/)