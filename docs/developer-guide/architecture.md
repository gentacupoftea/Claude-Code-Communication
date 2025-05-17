# Shopify MCP Server - システムアーキテクチャ

## 概要

Shopify MCP Serverは、Model Context Protocol (MCP)を使用してShopify APIとClaude Desktopを統合するサーバーです。

## アーキテクチャ図

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Claude Desktop │◄────┤  MCP Server      │────►│  Shopify API    │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        ▲                        │                        ▲
        │                        ▼                        │
        │               ┌──────────────────┐              │
        │               │                  │              │
        └───────────────┤  Data Processing │──────────────┘
                        │  & Visualization │
                        └──────────────────┘
```

## コンポーネント

### 1. MCP Server Core
- **FastMCP**: MCPサーバーのコアフレームワーク
- **stdio_server**: Claude Desktopとの通信インターフェース
- **非同期処理**: asyncioベースの非同期実行

### 2. Shopify API Client
- **REST API連携**: Shopify Admin APIとの通信
- **認証**: Access Tokenベースの認証
- **エラーハンドリング**: リトライ機構と例外処理

### 3. データ処理層
- **Pandas**: データの集計と変換
- **Matplotlib**: データビジュアライゼーション
- **通貨処理**: 多通貨対応（JPY含む）

### 4. ツール層
各機能は独立したツールとして実装：
- `get_orders_summary`: 注文集計
- `get_sales_analytics`: 売上分析
- `get_product_performance`: 商品パフォーマンス

## データフロー

1. **リクエスト受信**
   - Claude Desktop → MCP Server (JSON-RPC)
   
2. **API呼び出し**
   - MCP Server → Shopify API (HTTPS)
   
3. **データ処理**
   - データ取得 → 集計 → ビジュアライゼーション
   
4. **レスポンス返却**
   - MCP Server → Claude Desktop (結果＋画像)

## セキュリティ

- **認証**: Shopify Access Token（環境変数）
- **SSL/TLS**: HTTPS通信の暗号化
- **環境変数**: 機密情報の分離

## スケーラビリティ

- **非同期処理**: 複数リクエストの並行処理
- **キャッシング**: 将来的な実装予定
- **レート制限**: Shopify APIの制限に準拠

## エラーハンドリング

1. **API errors**: 適切なエラーメッセージとリトライ
2. **Data errors**: データ検証とフォールバック
3. **System errors**: ログ記録と graceful degradation