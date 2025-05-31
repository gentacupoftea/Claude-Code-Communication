# 🚀 自動デプロイメント設定ガイド

このドキュメントでは、メインブランチへのマージ時に自動的にFirebase Hostingにデプロイされるように設定する方法を説明します。

## 📋 必要なシークレットと環境変数

### GitHub Secrets（必須）

以下のシークレットをGitHubリポジトリに設定する必要があります：

#### 1. `FIREBASE_SERVICE_ACCOUNT_CONEA_48FCF`
- **目的**: Firebase Hostingへのデプロイ認証
- **取得方法**:
  1. [Firebase Console](https://console.firebase.google.com/) にアクセス
  2. プロジェクト設定 → サービスアカウント
  3. 「新しい秘密鍵の生成」をクリック
  4. ダウンロードしたJSONファイルの内容をコピー

#### 2. `NEXT_PUBLIC_API_BASE_URL`
- **目的**: APIエンドポイントの設定
- **設定値**: `https://api.staging.conea.ai` （ステージング環境）

### 環境変数ファイル

本番環境での動的な設定のため、`.env.production`ファイルを作成：

```bash
# API設定
NEXT_PUBLIC_API_BASE_URL=https://api.staging.conea.ai

# Firebase設定
NEXT_PUBLIC_FIREBASE_PROJECT_ID=conea-48fcf
NEXT_PUBLIC_FIREBASE_HOSTING_SITE=staging-conea-ai
```

## 🔧 設定手順

### 1. GitHubシークレットの設定

```bash
# GitHub CLIを使用してシークレットを設定
gh secret set FIREBASE_SERVICE_ACCOUNT_CONEA_48FCF < firebase-service-account.json
gh secret set NEXT_PUBLIC_API_BASE_URL --body "https://api.staging.conea.ai"
```

### 2. Firebase設定の確認

```bash
# Firebase CLIでプロジェクトを確認
firebase projects:list

# ホスティングサイトを確認
firebase hosting:sites:list
```

### 3. デプロイメントテスト

```bash
# ローカルでビルドテスト
npm run build

# 手動デプロイテスト
firebase deploy --only hosting:staging-conea-ai
```

## 📁 デプロイメント設定ファイル

### `.github/workflows/deploy.yml`
```yaml
name: 🚀 Auto Deploy to Firebase Hosting

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend-v2/package-lock.json
      
      - name: Install dependencies
        working-directory: frontend-v2
        run: npm ci
      
      - name: Run security audit
        working-directory: frontend-v2
        run: npm audit --omit=dev
      
      - name: Lint code
        working-directory: frontend-v2
        run: npm run lint
      
      - name: Type check
        working-directory: frontend-v2
        run: npx tsc --noEmit
      
      - name: Build project
        working-directory: frontend-v2
        run: npm run build
        env:
          NEXT_PUBLIC_API_BASE_URL: ${{ secrets.NEXT_PUBLIC_API_BASE_URL }}
      
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_CONEA_48FCF }}
          projectId: conea-48fcf
          channelId: live
          entryPoint: frontend-v2
```

### `firebase.json`
```json
{
  "hosting": {
    "site": "staging-conea-ai",
    "public": "out",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "cleanUrls": true,
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

### `next.config.ts`
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // スタティックエクスポート用
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  skipTrailingSlashRedirect: true
};

export default nextConfig;
```

## 🚀 デプロイメントフロー

### メインブランチへのプッシュ時:
1. **コードチェック**: ESLint、TypeScript型チェック
2. **セキュリティ監査**: npm audit実行
3. **ビルド**: Next.jsの静的エクスポート
4. **デプロイ**: Firebase Hostingへの自動デプロイ
5. **通知**: デプロイ完了の通知

### プルリクエスト時:
1. **プレビューデプロイ**: 一時的なプレビューURLを生成
2. **コードレビュー**: 自動チェックとレビュー
3. **マージ**: 承認後にメインブランチにマージ

## 📊 デプロイメント監視

### Firebase Console
- [https://console.firebase.google.com/project/conea-48fcf/hosting](https://console.firebase.google.com/project/conea-48fcf/hosting)

### GitHub Actions
- リポジトリの「Actions」タブでデプロイメント状況を監視

### ライブサイト
- [https://stagingapp.conea.ai](https://stagingapp.conea.ai)

## 🔍 トラブルシューティング

### デプロイが失敗する場合:

1. **シークレットの確認**:
   ```bash
   gh secret list
   ```

2. **Firebase権限の確認**:
   ```bash
   firebase login
   firebase projects:list
   ```

3. **ビルドエラーの確認**:
   ```bash
   npm run build
   ```

4. **ローカルテスト**:
   ```bash
   npm run dev
   ```

### よくあるエラー:

- **Firebase Service Account エラー**: JSONファイルの形式を確認
- **API接続エラー**: `NEXT_PUBLIC_API_BASE_URL`の設定を確認
- **ビルドエラー**: TypeScriptエラーを修正

## 📝 メンテナンス

### 定期的な確認事項:
- [ ] Firebase Service Accountの有効期限
- [ ] 依存関係のセキュリティアップデート
- [ ] デプロイメント成功率の監視
- [ ] パフォーマンス指標の確認

---

**注意**: このドキュメントは定期的に更新してください。特にAPI URLやFirebase設定の変更時は必ず反映してください。