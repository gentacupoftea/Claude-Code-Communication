# Migration Guide: v1.x to v2.0

## 概要

v2.0はメジャーアップデートのため、いくつかの破壊的変更が含まれています。

## 主な変更点

### 1. プロジェクト名の変更
- 旧: Shopify MCP Server
- 新: Conea Integration Platform

### 2. 環境変数

以下の環境変数名が変更されました：

| 旧名称 | 新名称 |
|--------|--------|
| SHOPIFY_MCP_API_KEY | CONEA_API_KEY |
| SHOPIFY_MCP_SECRET | CONEA_API_SECRET |
| MCP_DATABASE_URL | DATABASE_URL |

### 3. APIエンドポイント

すべてのエンドポイントが `/api/v2/` プレフィックスを使用するようになりました：

- 旧: `/shopify/products`
- 新: `/api/v2/shopify/products`

### 4. データベーススキーマ

新しいテーブルが追加されました：
- `persona_analysis`
- `rag_embeddings`
- `rakuten_products`

既存のテーブルにも変更があります。マイグレーションスクリプトを実行してください：

```bash
npm run migrate:v2
```

### 5. 認証

JWTトークンの形式が変更されました。すべてのクライアントで再認証が必要です。

## 移行手順

1. データベースのバックアップ
2. 環境変数の更新
3. マイグレーションスクリプトの実行
4. 新しいコードのデプロイ
5. 動作確認

## サポート

移行に関する質問は support@cupoftea.inc までお問い合わせください。