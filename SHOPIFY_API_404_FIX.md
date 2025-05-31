# Shopify API 404エラー修正ガイド

## 問題の概要
- **エラー**: AxiosError: Request failed with status code 404
- **環境**: https://shopify-mcp-server-dpxbjge33a-an.a.run.app
- **原因**: Shopify APIエンドポイントのURL形式が正しくない

## 修正内容

### 1. 新規作成ファイル

#### `/backend/src/config/shopify.js`
- Shopify API設定の一元管理
- 正しいURL形式の自動構築
- 環境変数の検証

#### `/backend/src/services/shopifyClient.js`
- Axiosを使用したAPIクライアント
- デバッグ用インターセプター
- 詳細なエラーログ出力

#### `/backend/src/routes/shopify.js`
- 接続テストエンドポイント: `/api/shopify/test-connection`
- デバッグ用設定確認: `/api/shopify/debug/config`
- 基本的なCRUD操作エンドポイント

### 2. 更新ファイル

#### `/backend/server.js`
- Shopifyルーターの追加
- エラーハンドリングの改善

## 環境変数の設定

### 正しい設定例
```bash
# ストア名のみ（.myshopify.comは不要）
SHOPIFY_STORE_DOMAIN=mystore

# Private Appのアクセストークン
SHOPIFY_ACCESS_TOKEN=shppa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# APIバージョン（推奨）
SHOPIFY_API_VERSION=2024-01
```

### よくある間違い
- ❌ `SHOPIFY_STORE_DOMAIN=mystore.myshopify.com`
- ❌ `SHOPIFY_STORE_DOMAIN=https://mystore.myshopify.com`
- ✅ `SHOPIFY_STORE_DOMAIN=mystore`

## ローカルテスト手順

1. **環境変数の設定**
```bash
cd backend/
cp .env.shopify.example .env
# .envファイルを編集して実際の値を設定
```

2. **接続テストの実行**
```bash
# スタンドアロンテスト
node test-shopify-connection.js

# サーバー起動してテスト
npm run dev
curl http://localhost:8000/api/shopify/test-connection
```

## Cloud Runへのデプロイ

### 1. 環境変数の更新
```bash
gcloud run services update shopify-mcp-server \
  --region=asia-northeast1 \
  --update-env-vars="SHOPIFY_STORE_DOMAIN=your-store-name" \
  --update-env-vars="SHOPIFY_ACCESS_TOKEN=your-token" \
  --update-env-vars="SHOPIFY_API_VERSION=2024-01"
```

### 2. 新しいコードのデプロイ
```bash
cd backend/

# Cloud Buildを使用
gcloud builds submit --config=cloudbuild.yaml

# または直接デプロイ
gcloud run deploy shopify-mcp-server \
  --source . \
  --region=asia-northeast1 \
  --platform=managed \
  --port=8000 \
  --allow-unauthenticated
```

### 3. デプロイ後の確認
```bash
# 接続テスト
curl https://shopify-mcp-server-dpxbjge33a-an.a.run.app/api/shopify/test-connection

# 設定確認（デバッグ用）
curl https://shopify-mcp-server-dpxbjge33a-an.a.run.app/api/shopify/debug/config
```

## トラブルシューティング

### 404エラーが続く場合

1. **環境変数の確認**
```bash
gcloud run services describe shopify-mcp-server \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[].name,spec.template.spec.containers[0].env[].value)"
```

2. **ログの確認**
```bash
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=shopify-mcp-server \
  AND (textPayload:'Shopify' OR textPayload:'404')" \
  --limit=50 \
  --format=json | jq -r '.[] | .textPayload'
```

3. **アクセストークンの検証**
- Shopify管理画面でPrivate Appの設定を確認
- 必要なスコープが付与されているか確認
- トークンが有効期限内か確認

### デバッグモード
```bash
# 詳細ログを有効化
gcloud run services update shopify-mcp-server \
  --region=asia-northeast1 \
  --update-env-vars="DEBUG=shopify:*"
```

## 期待される成功レスポンス

```json
{
  "status": "connected",
  "shop": {
    "id": 123456789,
    "name": "Your Store Name",
    "email": "store@example.com",
    "domain": "your-store.myshopify.com",
    "created_at": "2023-01-01T00:00:00-00:00",
    "currency": "JPY"
  },
  "apiVersion": "2024-01",
  "endpoint": "https://your-store.myshopify.com/admin/api/2024-01",
  "message": "Shopify API connection successful"
}
```

## 次のステップ

1. GraphQL APIの統合
2. Webhookの設定
3. レート制限の実装
4. キャッシュ戦略の最適化
5. エラーリトライロジックの改善