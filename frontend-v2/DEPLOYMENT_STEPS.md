# Conea Staging デプロイ手順

## 現在の状況

### ✅ 完了済み
1. **フロントエンド（Firebase）**
   - URL: https://staging-conea-ai.web.app
   - 状態: デプロイ完了

2. **バックエンド（Cloud Run）**
   - ビルドID: 092f37b3-38ab-4593-87b9-7047ded4d821
   - 状態: ビルド中

## バックエンドビルド完了後の手順

### 1. ビルド状況確認
```bash
gcloud builds list --limit=1
```

### 2. Cloud RunサービスURLを取得
```bash
gcloud run services describe conea-backend-staging \
  --region asia-northeast1 \
  --format 'value(status.url)'
```

### 3. フロントエンド環境変数を更新
`.env.production` ファイルを編集：
```
NEXT_PUBLIC_MULTILLM_API_URL=<取得したCloud RunのURL>
```

### 4. フロントエンドを再ビルド・デプロイ
```bash
cd /Users/mourigenta/projects/conea-staging
npm run build
firebase deploy --only hosting
```

## トラブルシューティング

### ビルドが失敗した場合
1. ビルドログを確認
```bash
gcloud builds log 092f37b3-38ab-4593-87b9-7047ded4d821
```

2. ローカルでDockerビルドをテスト
```bash
cd backend
docker build -t test-backend .
```

### Cloud Runサービスが見つからない場合
```bash
gcloud run services list --region asia-northeast1
```

## 動作確認

### バックエンドAPI
```bash
curl <Cloud RunのURL>/api/health
```

### フロントエンド
1. https://staging-conea-ai.web.app にアクセス
2. ダッシュボードにログイン
3. チャット機能をテスト

## 本番環境へのデプロイ

### カスタムドメイン設定
```bash
gcloud run domain-mappings create \
  --service conea-backend-staging \
  --domain api.staging.conea.ai \
  --region asia-northeast1
```

### SSL証明書
Cloud Runは自動的にSSL証明書を管理します。

## 監視とログ

### Cloud Runログ
```bash
gcloud run services logs read conea-backend-staging \
  --region asia-northeast1 \
  --limit 50
```

### Firebase Hostingログ
Firebase Consoleから確認：
https://console.firebase.google.com/project/conea-48fcf/hosting

## 環境変数の管理

### 開発環境
- `.env` - ローカル開発用

### 本番環境
- `.env.production` - ビルド時の環境変数
- Cloud Run環境変数 - 実行時の環境変数

## セキュリティ推奨事項

1. **APIキーの保護**
   - Secret Managerの使用を推奨
   - 環境変数での直接設定は避ける

2. **CORS設定**
   - 本番ドメインのみ許可
   - ワイルドカード（*）は使用しない

3. **認証・認可**
   - Firebase Authenticationの活用
   - APIエンドポイントの保護

## 更新手順

### フロントエンドの更新
```bash
npm run build
firebase deploy --only hosting
```

### バックエンドの更新
```bash
cd backend
gcloud builds submit --config cloudbuild.yaml
```

または

```bash
cd backend
./deploy.sh
```