# Conea Platform API リファレンス v1.1.0

Conea Platformの統合APIエンドポイントの完全なリファレンスドキュメントです。

## 目次

1. [概要](#概要)
2. [認証](#認証)
3. [統合REST API](#統合rest-api)
4. [MultiLLM API](#multillm-api)
5. [EC統合API](#ec統合api)
6. [Analytics API](#analytics-api)
7. [エラーハンドリング](#エラーハンドリング)
8. [レート制限](#レート制限)
9. [レスポンス形式](#レスポンス形式)

## 概要

Conea Platformは、EC事業者向けのAI統合プラットフォームとして、複数のLLMプロバイダー、ECプラットフォーム（Shopify、楽天、Amazon）、Analytics APIへの統一されたアクセスを提供します。

### ベースURL

#### 本番環境
```
API: https://api.conea.ai/v1
WebSocket: wss://api.conea.ai/ws
```

#### ステージング環境
```
API: https://api-staging.conea.ai/v1
WebSocket: wss://api-staging.conea.ai/ws
```

### APIバージョン

現在サポートされているバージョン:
- `v1.1.0` (現在の安定版)
- `v1.0.0` (レガシー)
- `beta` (開発版)

## 認証

### JWT認証

Conea Platformは JWT (JSON Web Token) とFirebase Auth の二重認証システムを採用しています。

```javascript
// リクエストヘッダー例
headers = {
    "Authorization": "Bearer ${jwt_token}",
    "X-Firebase-Token": "${firebase_token}",
    "Content-Type": "application/json",
    "X-API-Version": "v1.1.0"
}
```

### Firebase Auth設定

```javascript
// Firebase設定例
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "conea-platform.firebaseapp.com",
    projectId: "conea-platform",
    storageBucket: "conea-platform.appspot.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 認証
const { user } = await signInWithEmailAndPassword(auth, email, password);
const firebaseToken = await user.getIdToken();
```

### API キー管理

環境変数設定例:
```bash
# .env ファイル
CONEA_API_URL=https://api.conea.ai/v1
CONEA_JWT_SECRET=your-jwt-secret
FIREBASE_PROJECT_ID=conea-platform
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project
```

## 統合REST API

### ヘルスチェック

```bash
GET /health
```

システム全体の稼働状況を確認します。

**レスポンス例:**
```json
{
    "status": "healthy",
    "version": "v1.1.0",
    "timestamp": "2025-05-31T12:00:00Z",
    "services": {
        "database": "healthy",
        "redis": "healthy",
        "llm_providers": {
            "claude": "healthy",
            "openai": "healthy", 
            "gemini": "healthy"
        },
        "ec_apis": {
            "shopify": "healthy",
            "rakuten": "healthy"
        }
    },
    "uptime": 3600
}
```

### システム状態

```bash
GET /status
```

詳細なシステム状態とメトリクスを取得します。

**レスポンス例:**
```json
{
    "system": {
        "cpu_usage": 0.45,
        "memory_usage": 0.62,
        "disk_usage": 0.23
    },
    "api_metrics": {
        "requests_per_minute": 150,
        "average_response_time": 145,
        "error_rate": 0.002
    },
    "active_connections": 45
}
```

## MultiLLM API

### LLMクエリ実行

```bash
POST /llm/query
```

複数のLLMプロバイダーを活用して高度な質問に回答します。

**リクエスト例:**
```json
{
    "question": "過去3年間の季節性を考慮して、来月の売上を予測してください",
    "context": {
        "store_name": "テストストア",
        "period": "2024年1-10月",
        "sales_data": [100, 120, 110, 130, 140, 135, 145, 150, 160, 170]
    },
    "provider_preference": "auto", // "claude", "openai", "gemini", "auto"
    "include_reasoning": true
}
```

**レスポンス例:**
```json
{
    "answer": "データ分析の結果、来月の売上は約175万円と予測されます...",
    "reasoning": "過去3年間のデータから、季節性トレンドと成長率を分析...",
    "provider_used": "claude",
    "confidence_score": 0.85,
    "execution_time": 2.3,
    "sources": ["historical_sales", "seasonal_trends", "market_data"]
}
```

### バッチクエリ実行

```bash
POST /llm/batch-query
```

複数の質問を並列処理で効率的に実行します。

**リクエスト例:**
```json
{
    "queries": [
        {
            "id": "inventory_optimization",
            "question": "在庫最適化の提案をお願いします",
            "context": {"current_stock": 1000, "avg_daily_sales": 25}
        },
        {
            "id": "customer_segmentation", 
            "question": "顧客セグメント分析を実施してください",
            "context": {"total_customers": 50000, "repeat_rate": 0.35}
        }
    ],
    "parallel_execution": true
}
```

### LLMプロバイダー状態

```bash
GET /llm/providers/status
```

各LLMプロバイダーの稼働状況とパフォーマンスを確認します。

**レスポンス例:**
```json
{
    "providers": {
        "claude": {
            "status": "available",
            "response_time": 1.2,
            "rate_limit": {
                "requests_per_minute": 60,
                "used": 25,
                "remaining": 35
            }
        },
        "openai": {
            "status": "available", 
            "response_time": 0.8,
            "rate_limit": {
                "requests_per_minute": 3500,
                "used": 1200,
                "remaining": 2300
            }
        },
        "gemini": {
            "status": "available",
            "response_time": 1.5,
            "rate_limit": {
                "requests_per_minute": 60,
                "used": 10,
                "remaining": 50
            }
        }
    }
}
```

## EC統合API

### Shopify統合

#### 注文 (Orders)

#### 注文一覧の取得

```bash
GET /ec/shopify/orders
```

**クエリパラメータ:**
- `status`: 注文ステータス (`open`, `closed`, `cancelled`, `any`)
- `financial_status`: 支払いステータス (`paid`, `pending`, `refunded`)
- `fulfillment_status`: 配送ステータス (`fulfilled`, `partial`, `unfulfilled`)
- `created_at_min`: 開始日時 (ISO 8601形式)
- `created_at_max`: 終了日時 (ISO 8601形式)
- `limit`: 取得件数 (最大250)

**リクエスト例:**
```bash
GET /ec/shopify/orders?status=open&limit=50&created_at_min=2025-01-01T00:00:00Z
```

**パラメータ:**
- `status`: 注文ステータス (`open`, `closed`, `cancelled`, `any`)
- `financial_status`: 支払いステータス (`paid`, `pending`, `refunded`, etc.)
- `fulfillment_status`: 配送ステータス (`fulfilled`, `partial`, `unfulfilled`)
- `created_at_min`: 開始日時 (ISO 8601形式)
- `created_at_max`: 終了日時 (ISO 8601形式)
- `limit`: 取得件数 (最大250)

**レスポンス例:**
```json
{
    "total_orders": 150,
    "total_revenue": 45000.00,
    "average_order_value": 300.00,
    "currency": "USD",
    "by_status": {
        "open": 10,
        "closed": 140
    },
    "by_financial_status": {
        "paid": 145,
        "pending": 5
    }
}
```

#### 注文詳細の取得

```python
@mcp.tool()
async def get_order_details(order_id: str) -> Order:
    """特定の注文の詳細情報を取得"""
```

**パラメータ:**
- `order_id`: 注文ID

**レスポンス例:**
```json
{
    "id": 1234567890,
    "order_number": "#1001",
    "created_at": "2024-01-15T10:30:00-05:00",
    "total_price": "150.00",
    "currency": "USD",
    "customer": {
        "id": 987654321,
        "email": "customer@example.com",
        "first_name": "John",
        "last_name": "Doe"
    },
    "line_items": [
        {
            "id": 111222333,
            "title": "Product Name",
            "quantity": 2,
            "price": "75.00"
        }
    ]
}
```

### 商品 (Products)

#### 商品一覧の取得

```python
@mcp.tool()
async def get_products(
    limit: Optional[int] = 50,
    collection_id: Optional[str] = None,
    product_type: Optional[str] = None,
    vendor: Optional[str] = None,
    status: Optional[str] = None
) -> List[Product]:
    """商品一覧を取得"""
```

**パラメータ:**
- `limit`: 取得件数
- `collection_id`: コレクションID
- `product_type`: 商品タイプ
- `vendor`: ベンダー名
- `status`: ステータス (`active`, `archived`, `draft`)

**レスポンス例:**
```json
{
    "products": [
        {
            "id": 7654321098,
            "title": "Sample Product",
            "body_html": "<p>Product description</p>",
            "vendor": "Acme Corp",
            "product_type": "Widget",
            "created_at": "2024-01-10T09:00:00-05:00",
            "variants": [
                {
                    "id": 44556677889,
                    "title": "Default",
                    "price": "29.99",
                    "sku": "SAMPLE-001",
                    "inventory_quantity": 100
                }
            ]
        }
    ]
}
```

#### 商品パフォーマンスの取得

```python
@mcp.tool()
async def get_product_performance(
    limit: Optional[int] = 10,
    period: Optional[str] = "30_days"
) -> ProductPerformanceReport:
    """商品のパフォーマンスデータを取得"""
```

**パラメータ:**
- `limit`: 取得する商品数
- `period`: 期間 (`7_days`, `30_days`, `90_days`, `365_days`)

**レスポンス例:**
```json
{
    "period": "30_days",
    "top_products": [
        {
            "product_id": 7654321098,
            "title": "Best Seller",
            "units_sold": 250,
            "revenue": 7500.00,
            "conversion_rate": 0.035
        }
    ],
    "total_revenue": 45000.00,
    "total_units_sold": 1500
}
```

### 顧客 (Customers)

#### 顧客一覧の取得

```python
@mcp.tool()
async def get_customers(
    limit: Optional[int] = 50,
    created_at_min: Optional[str] = None,
    created_at_max: Optional[str] = None,
    updated_at_min: Optional[str] = None
) -> List[Customer]:
    """顧客一覧を取得"""
```

**パラメータ:**
- `limit`: 取得件数
- `created_at_min`: 作成日時の開始
- `created_at_max`: 作成日時の終了
- `updated_at_min`: 更新日時の開始

**レスポンス例:**
```json
{
    "customers": [
        {
            "id": 5555666777,
            "email": "customer@example.com",
            "first_name": "Jane",
            "last_name": "Smith",
            "orders_count": 5,
            "total_spent": "500.00",
            "created_at": "2023-12-01T10:00:00-05:00"
        }
    ]
}
```

## GraphQL API

### ショップ情報の取得

```python
@mcp.tool()
async def get_shop_info_graphql() -> ShopInfo:
    """GraphQLを使用してショップ情報を取得"""
```

**GraphQLクエリ:**
```graphql
query {
    shop {
        id
        name
        email
        currencyCode
        primaryDomain {
            url
            sslEnabled
        }
        plan {
            displayName
            shopifyPlus
        }
        features {
            multiCurrency {
                enabled
            }
            giftCards {
                enabled
            }
        }
    }
}
```

**レスポンス例:**
```json
{
    "shop": {
        "id": "gid://shopify/Shop/123456",
        "name": "My Store",
        "email": "admin@mystore.com",
        "currencyCode": "USD",
        "primaryDomain": {
            "url": "https://mystore.com",
            "sslEnabled": true
        },
        "plan": {
            "displayName": "Shopify Plus",
            "shopifyPlus": true
        }
    }
}
```

### 商品詳細の取得（GraphQL）

```python
@mcp.tool()
async def get_products_graphql(
    first: int = 10,
    query: Optional[str] = None,
    sort_key: Optional[str] = "CREATED_AT"
) -> ProductConnection:
    """GraphQLを使用して商品情報を効率的に取得"""
```

**GraphQLクエリ:**
```graphql
query GetProducts($first: Int!, $query: String, $sortKey: ProductSortKeys) {
    products(first: $first, query: $query, sortKey: $sortKey) {
        edges {
            node {
                id
                title
                descriptionHtml
                vendor
                productType
                tags
                variants(first: 10) {
                    edges {
                        node {
                            id
                            title
                            price
                            sku
                            inventoryQuantity
                        }
                    }
                }
                images(first: 5) {
                    edges {
                        node {
                            originalSrc
                            altText
                        }
                    }
                }
            }
        }
        pageInfo {
            hasNextPage
            endCursor
        }
    }
}
```

### 在庫レベルの取得

```python
@mcp.tool()
async def get_inventory_levels_graphql(
    location_id: Optional[str] = None,
    first: int = 50
) -> InventoryLevelConnection:
    """GraphQLを使用して在庫レベルを取得"""
```

**GraphQLクエリ:**
```graphql
query GetInventoryLevels($locationId: ID, $first: Int!) {
    location(id: $locationId) {
        id
        name
        inventoryLevels(first: $first) {
            edges {
                node {
                    id
                    available
                    incoming
                    item {
                        id
                        sku
                        variant {
                            id
                            title
                            product {
                                id
                                title
                            }
                        }
                    }
                }
            }
        }
    }
}
```

## Google Analytics API

### リアルタイムデータの取得

```python
@mcp.tool()
async def get_realtime_data(
    metrics: List[str] = ["activeUsers"],
    dimensions: Optional[List[str]] = None
) -> RealtimeReport:
    """Google Analyticsのリアルタイムデータを取得"""
```

**パラメータ:**
- `metrics`: 取得するメトリクス（`activeUsers`, `screenPageViews`, etc.）
- `dimensions`: ディメンション（`country`, `deviceCategory`, etc.）

**レスポンス例:**
```json
{
    "dimensionHeaders": [
        {"name": "country"}
    ],
    "metricHeaders": [
        {"name": "activeUsers", "type": "TYPE_INTEGER"}
    ],
    "rows": [
        {
            "dimensionValues": [{"value": "Japan"}],
            "metricValues": [{"value": "156"}]
        },
        {
            "dimensionValues": [{"value": "United States"}],
            "metricValues": [{"value": "89"}]
        }
    ],
    "totalActiveUsers": 245
}
```

### コンバージョンファネルの分析

```python
@mcp.tool()
async def get_conversion_funnel(
    start_date: str,
    end_date: str,
    steps: List[str]
) -> ConversionFunnel:
    """コンバージョンファネルを分析"""
```

**パラメータ:**
- `start_date`: 開始日（YYYY-MM-DD）
- `end_date`: 終了日（YYYY-MM-DD）
- `steps`: ファネルステップのリスト

**レスポンス例:**
```json
{
    "funnel": [
        {
            "step": "page_view",
            "users": 10000,
            "conversion_rate": 1.0
        },
        {
            "step": "add_to_cart",
            "users": 2500,
            "conversion_rate": 0.25
        },
        {
            "step": "begin_checkout",
            "users": 1500,
            "conversion_rate": 0.15
        },
        {
            "step": "purchase",
            "users": 800,
            "conversion_rate": 0.08
        }
    ],
    "overall_conversion_rate": 0.08
}
```

### カスタムレポートの実行

```python
@mcp.tool()
async def run_ga_report(
    start_date: str,
    end_date: str,
    metrics: List[str],
    dimensions: Optional[List[str]] = None,
    filters: Optional[List[Dict]] = None,
    order_by: Optional[List[Dict]] = None,
    limit: int = 10000
) -> AnalyticsReport:
    """カスタムGoogle Analyticsレポートを実行"""
```

**パラメータ:**
- `start_date`: 開始日
- `end_date`: 終了日
- `metrics`: メトリクスのリスト
- `dimensions`: ディメンションのリスト
- `filters`: フィルター条件
- `order_by`: ソート条件
- `limit`: 結果の最大件数

**フィルター例:**
```json
[
    {
        "fieldName": "country",
        "stringFilter": {
            "matchType": "EXACT",
            "value": "Japan"
        }
    }
]
```

## エラーハンドリング

### エラーレスポンス形式

```json
{
    "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "API rate limit exceeded",
        "details": {
            "retry_after": 60,
            "limit": 40,
            "used": 40
        }
    }
}
```

### エラーコード

| コード | 説明 | HTTPステータス |
|-------|------|---------------|
| `AUTHENTICATION_FAILED` | 認証失敗 | 401 |
| `RESOURCE_NOT_FOUND` | リソースが見つからない | 404 |
| `RATE_LIMIT_EXCEEDED` | レート制限超過 | 429 |
| `INVALID_REQUEST` | 無効なリクエスト | 400 |
| `SERVER_ERROR` | サーバーエラー | 500 |

### エラーハンドリング例

```python
try:
    result = await get_orders_summary()
except ShopifyAPIError as e:
    if e.code == "RATE_LIMIT_EXCEEDED":
        # レート制限エラーの処理
        await asyncio.sleep(e.retry_after)
        result = await get_orders_summary()  # リトライ
    else:
        # その他のエラー
        logger.error(f"API error: {e}")
        raise
```

## レート制限

### Shopify API レート制限

- **REST API**: 40リクエスト/秒（burst）
- **GraphQL API**: コスト計算ベース（1000ポイント/秒）

### レート制限ヘッダー

```
X-Shopify-Shop-Api-Call-Limit: 40/40
X-Shopify-Api-Version: 2024-01
Retry-After: 2.0
```

### GraphQLコスト計算

```json
{
    "extensions": {
        "cost": {
            "requestedQueryCost": 752,
            "actualQueryCost": 632,
            "throttleStatus": {
                "maximumAvailable": 1000,
                "currentlyAvailable": 368,
                "restoreRate": 50
            }
        }
    }
}
```

## レスポンス形式

### 成功レスポンス

```json
{
    "success": true,
    "data": {
        // レスポンスデータ
    },
    "metadata": {
        "timestamp": "2024-01-15T12:00:00Z",
        "request_id": "abc-123-def-456",
        "execution_time": 0.145
    }
}
```

### ページネーション

```json
{
    "data": [...],
    "pagination": {
        "has_next_page": true,
        "has_previous_page": false,
        "cursor": "eyJsYXN0X2lkIjoxNDI5NDk1ODEwLCJsY...",
        "total": 150,
        "per_page": 50,
        "current_page": 1
    }
}
```

### データ形式

- 日付時刻: ISO 8601形式 (`2024-01-15T10:30:00-05:00`)
- 金額: 文字列形式 (`"150.00"`)
- 通貨: ISO 4217コード (`USD`, `JPY`, etc.)

## 使用例

### 完全な実装例

```python
import asyncio
from conea import ConeaServer  # v0.3.1以降は 'from conea import ConeaServer' に変更予定

async def analyze_store_performance():
    """ストアのパフォーマンスを分析"""
    server = ConeaServer()  # v0.3.1以降は ConeaServer() に変更予定
    
    # 注文データの取得
    orders = await server.get_orders_summary(
        created_at_min="2024-01-01",
        created_at_max="2024-01-31",
        limit=250
    )
    
    # 商品パフォーマンスの取得
    products = await server.get_product_performance(
        period="30_days",
        limit=20
    )
    
    # GraphQLで詳細データを取得
    shop_info = await server.get_shop_info_graphql()
    
    # Google Analyticsデータの取得
    ga_data = await server.get_realtime_data(
        metrics=["activeUsers", "screenPageViews"],
        dimensions=["country", "deviceCategory"]
    )
    
    return {
        "orders": orders,
        "products": products,
        "shop": shop_info,
        "analytics": ga_data
    }

# 実行
results = asyncio.run(analyze_store_performance())
```

## ベストプラクティス

1. **バッチ処理**: 複数のリクエストをまとめて処理
2. **キャッシング**: 頻繁にアクセスするデータをキャッシュ
3. **エラーハンドリング**: 適切なリトライロジックの実装
4. **フィールド選択**: GraphQLで必要なフィールドのみ取得
5. **非同期処理**: 並行処理で効率化

## サポート

- GitHub Issues: [github.com/mourigenta/conea/issues](https://github.com/mourigenta/conea/issues)
- ドキュメント: [完全なドキュメント](../README.md)
- コミュニティ: [Discord Server](https://discord.gg/conea)