# Shopify MCP Server - API仕様書

## 概要

Shopify MCP Serverは、Model Context Protocol (MCP) を使用して以下のツールを提供します。

## ツール一覧

### 1. get_orders_summary

注文の概要を取得します。

**パラメータ:**
```json
{
  "start_date": "string (YYYY-MM-DD)",  // 開始日
  "end_date": "string (YYYY-MM-DD)"     // 終了日
}
```

**レスポンス:**
```json
{
  "period": "2024-01-01 to 2024-01-31",
  "total_orders": 150,
  "total_revenue": "¥1,500,000",
  "average_order_value": "¥10,000",
  "currency": "JPY",
  "top_products": [
    {
      "title": "商品A",
      "units_sold": 50,
      "revenue": "¥500,000"
    }
  ],
  "visualization": "base64_encoded_image"
}
```

### 2. get_sales_analytics

売上分析データを取得します。

**パラメータ:**
```json
{
  "days": 30  // 分析期間（デフォルト: 30日）
}
```

**レスポンス:**
```json
{
  "period": "Last 30 days",
  "total_sales": "¥3,000,000",
  "order_count": 300,
  "sales_trend": [
    {
      "date": "2024-01-01",
      "sales": "¥100,000",
      "orders": 10
    }
  ],
  "best_day": {
    "date": "2024-01-15",
    "sales": "¥200,000"
  },
  "visualization": "base64_encoded_image"
}
```

### 3. get_product_performance

商品パフォーマンスを分析します。

**パラメータ:**
```json
{
  "limit": 10  // 取得する商品数（デフォルト: 10）
}
```

**レスポンス:**
```json
{
  "top_products": [
    {
      "id": "123456",
      "title": "商品A",
      "total_sales": "¥1,000,000",
      "units_sold": 100,
      "average_price": "¥10,000",
      "inventory_level": 50
    }
  ],
  "visualization": "base64_encoded_image"
}
```

## エラーレスポンス

**認証エラー:**
```json
{
  "error": "Authentication failed",
  "message": "Invalid access token",
  "code": "UNAUTHORIZED"
}
```

**APIレート制限:**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests",
  "retry_after": 60
}
```

**パラメータエラー:**
```json
{
  "error": "Invalid parameters",
  "message": "start_date must be before end_date",
  "code": "INVALID_PARAMS"
}
```

## Shopify API エンドポイント

内部的に使用されるShopify APIエンドポイント：

1. **注文データ:**
   - GET `/admin/api/2023-10/orders.json`
   - パラメータ: status, created_at_min, created_at_max, limit

2. **商品データ:**
   - GET `/admin/api/2023-10/products.json`
   - パラメータ: limit, fields

3. **在庫データ:**
   - GET `/admin/api/2023-10/inventory_levels.json`
   - パラメータ: inventory_item_ids

## 認証

すべてのリクエストには以下のヘッダーが必要です：

```
X-Shopify-Access-Token: YOUR_ACCESS_TOKEN
Content-Type: application/json
```

## レート制限

Shopify APIのレート制限に準拠：
- 基本制限: 2リクエスト/秒
- バースト制限: 40リクエスト
- リトライ: Retry-Afterヘッダーに従う

## データ形式

- 日付: ISO 8601形式 (YYYY-MM-DD)
- 通貨: 店舗の基本通貨で表示
- 画像: Base64エンコードされたPNG形式