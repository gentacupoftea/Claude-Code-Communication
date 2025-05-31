# ステージング環境へのデプロイ状況レポート

## デプロイ概要

**作成日時**: 2025年5月22日
**デプロイ対象**: Conea フロントエンド（UI）
**デプロイ方法**: Firebase Hosting
**Firebase プロジェクト**: conea-48fcf
**デプロイURL**: https://staging-conea-ai.web.app

## デプロイ対象ファイル

```
/Users/mourigenta/shopify-mcp-server/deployment/staging/static/public/
├── deploy-info.json
└── index.html
```

## Firebase Hosting サイト一覧

| サイト名 | URL | 目的 |
|---------|-----|------|
| conea-48fcf | https://conea-48fcf.web.app | メインサイト（プロダクション） |
| staging-conea | https://staging-conea.web.app | ステージング環境 |
| staging-conea-ai | https://staging-conea-ai.web.app | カスタムドメイン用 |

## カスタムドメイン設定状況

カスタムドメイン「staging.conea.ai」の設定は Firebase Console での操作が必要です。詳細手順は以下のドキュメントに記載されています：

- `/Users/mourigenta/shopify-mcp-server/deployment/staging/CUSTOM-DOMAIN-GUIDE.md`

## デプロイされたコンテンツの情報

```json
{
  "version": "staging-20250522024431",
  "deployedAt": "2025-05-21T17:44:31Z",
  "environment": "staging",
  "apiUrl": "https://staging.conea.ai/api"
}
```

## 環境変数の設定

デプロイされたコンテンツには以下の環境変数が設定されています：

- `REACT_APP_API_URL`: https://staging.conea.ai/api
- `REACT_APP_WS_URL`: wss://staging.conea.ai/ws
- `REACT_APP_VERSION`: staging-20250522

## バージョン履歴

| バージョン | デプロイ日時 | 変更内容 |
|-----------|------------|---------|
| staging-20250522024431 | 2025-05-22 02:44:31 | 初回ステージングデプロイ |

## 次のステップ

1. Firebase Console でカスタムドメイン「staging.conea.ai」を設定
2. DNS設定の完了とSSL証明書のプロビジョニング
3. HTTPS接続の検証
4. GitHub Actions を使用した自動デプロイパイプラインの設定