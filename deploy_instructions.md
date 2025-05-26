# 🚀 Conea Google Cloud Backend デプロイ手順

## 📋 現在の状況

✅ **フロントエンド**: `https://staging-conea-ai.web.app` - デプロイ済み  
✅ **環境変数**: 既存Google Cloudバックエンド(`https://staging-api.conea.ai`)用に設定済み  
✅ **デプロイパッケージ**: `conea-backend-staging-20250522_125321.zip` 準備済み  
❌ **バックエンド**: Google Cloud認証が必要  

## 🔧 必要な手順

### ステップ1: Google Cloud認証

```bash
# ブラウザでGoogle Cloud認証
gcloud auth login

# 認証後、以下のURLにアクセスして認証コードを入力
# https://accounts.google.com/o/oauth2/auth?...
```

### ステップ2: プロジェクト設定

```bash
cd /Users/mourigenta/shopify-mcp-server

# プロジェクト設定
gcloud config set project conea-staging

# 利用可能なプロジェクト確認
gcloud projects list | grep conea
```

### ステップ3: バックエンドデプロイ

```bash
# 既存のデプロイスクリプトを使用
python3 scripts/deploy_backend.py --env staging

# または手動でシークレット設定してからデプロイ
gcloud secrets create SHOPIFY_API_KEY --data-file=- <<< "your-api-key"
gcloud secrets create SHOPIFY_API_SECRET --data-file=- <<< "your-api-secret"
```

## 🎯 デプロイ後の設定

### Shopify認証情報の設定

ブラウザで設定画面にアクセス:
1. **https://staging-conea-ai.web.app** にログイン
2. **設定** → **API設定**タブ
3. **🛍️ Shopify設定**セクションで認証情報を入力:
   - ストアURL: `your-store.myshopify.com`
   - ストアID: `your-store-id`
   - API Key: `your-api-key`
   - API シークレット: `your-api-secret`
   - アクセストークン: `shpat_xxxxx`

### 接続テスト

```bash
# バックエンドヘルスチェック
curl https://staging-api.conea.ai/health

# Shopify API テスト
curl https://staging-api.conea.ai/api/v1/shopify/stores
```

## 🔍 トラブルシューティング

### バックエンドが応答しない場合

```bash
# Cloud Runサービス状況確認
gcloud run services list --region asia-northeast1

# ログ確認
gcloud run logs tail conea-staging --region asia-northeast1

# サービス再デプロイ
python3 scripts/deploy_backend.py --env staging
```

### フロントエンドAPIエラーの場合

- `frontend/src/services/apiClient.ts` でAPI_BASE_URLを確認
- CORS設定をバックエンドで確認
- 認証トークンの有効性を確認

## 📊 期待される結果

✅ フロントエンド: `https://staging-conea-ai.web.app`  
✅ バックエンド: `https://staging-api.conea.ai`  
✅ Shopify設定画面で5つの認証フィールドが表示  
✅ 実際のShopifyストアとの連携が可能  

---

**次のステップ**: Google Cloud認証を完了後、`python3 scripts/deploy_backend.py --env staging` を実行してください。