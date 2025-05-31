# Shopify MCP Server チュートリアル

このチュートリアルでは、Shopify MCP Serverを使用して実際のタスクを実行する方法を順を追って説明します。

## 目次

1. [インストールと初期設定](#インストールと初期設定)
2. [基本的な使い方](#基本的な使い方)
3. [注文データの分析](#注文データの分析)
4. [商品管理](#商品管理)
5. [カスタマーインサイト](#カスタマーインサイト)
6. [Google Analytics統合](#google-analytics統合)
7. [高度な使用例](#高度な使用例)
8. [トラブルシューティング](#トラブルシューティング)

## インストールと初期設定

### ステップ1: プロジェクトのセットアップ

```bash
# プロジェクトディレクトリの作成
mkdir my-shopify-project
cd my-shopify-project

# Shopify MCP Serverのクローン
git clone https://github.com/mourigenta/shopify-mcp-server.git
cd shopify-mcp-server
```

### ステップ2: 環境設定

```bash
# Python仮想環境の作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係のインストール
pip install -r requirements.txt

# 環境変数ファイルの作成
cp .env.example .env
```

### ステップ3: Shopify認証情報の設定

1. Shopify管理画面にログイン
2. `設定` > `アプリと販売チャネル` > `開発アプリ` へ移動
3. 新しいプライベートアプリを作成
4. 必要な権限を付与：
   - 読み取り: 注文、商品、顧客、在庫
   - 書き込み: 注文、商品（必要に応じて）

5. `.env`ファイルを編集：

```bash
SHOPIFY_ACCESS_TOKEN=shppa_xxxxxxxxxxxxxxxxxx
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_API_VERSION=2024-01
```

### ステップ4: 動作確認

```python
# test_connection.py
import asyncio
from src.main import ShopifyMCPServer

async def test_connection():
    server = ShopifyMCPServer()
    
    try:
        # ショップ情報を取得
        shop_info = await server.get_shop_info_graphql()
        print(f"接続成功！ショップ名: {shop_info['name']}")
    except Exception as e:
        print(f"エラー: {e}")

asyncio.run(test_connection())
```

```bash
python test_connection.py
```

## 基本的な使い方

### MCPツールの基本構造

```python
from mcp.server import Server
from mcp.types import Tool
import asyncio

# MCPサーバーのインスタンス化
server = Server("shopify-mcp")

# ツールの定義
@server.tool()
async def get_shop_analytics():
    """ショップの分析データを取得"""
    # 実装
    pass

# サーバーの起動
if __name__ == "__main__":
    asyncio.run(server.serve())
```

### Claude Desktopとの統合

`claude.json`に以下を追加：

```json
{
  "mcpServers": {
    "shopify": {
      "command": "python",
      "args": ["/path/to/shopify-mcp-server/main.py"],
      "env": {
        "SHOPIFY_ACCESS_TOKEN": "${SHOPIFY_ACCESS_TOKEN}",
        "SHOPIFY_SHOP_NAME": "${SHOPIFY_SHOP_NAME}"
      }
    }
  }
}
```

## 注文データの分析

### 例1: 月次売上レポートの生成

```python
import asyncio
from datetime import datetime, timedelta
from src.tools.analytics import get_sales_analytics

async def generate_monthly_report():
    """先月の売上レポートを生成"""
    
    # 日付範囲の計算
    today = datetime.now()
    first_day_of_month = today.replace(day=1)
    last_day_of_month = first_day_of_month - timedelta(days=1)
    first_day_of_last_month = last_day_of_month.replace(day=1)
    
    # 売上データの取得
    sales_data = await get_sales_analytics(
        start_date=first_day_of_last_month.isoformat(),
        end_date=last_day_of_month.isoformat(),
        granularity="day"
    )
    
    # レポートの生成
    report = {
        "period": f"{first_day_of_last_month.strftime('%Y-%m')}",
        "total_revenue": sales_data['total_revenue'],
        "total_orders": sales_data['total_orders'],
        "average_order_value": sales_data['average_order_value'],
        "top_selling_products": sales_data['top_products'][:5],
        "daily_breakdown": sales_data['daily_sales']
    }
    
    return report

# 実行
report = asyncio.run(generate_monthly_report())
print(f"月次レポート: {report}")
```

### 例2: 注文ステータスの追跡

```python
async def track_order_status():
    """注文ステータスの分布を追跡"""
    
    # さまざまなステータスの注文を取得
    statuses = ['open', 'closed', 'cancelled']
    order_summary = {}
    
    for status in statuses:
        summary = await get_orders_summary(
            status=status,
            created_at_min=(datetime.now() - timedelta(days=30)).isoformat()
        )
        order_summary[status] = {
            'count': summary['total_orders'],
            'revenue': summary['total_revenue']
        }
    
    # 配送ステータスの分析
    fulfillment_summary = await get_orders_summary(
        fulfillment_status='unfulfilled',
        created_at_min=(datetime.now() - timedelta(days=7)).isoformat()
    )
    
    return {
        'order_status': order_summary,
        'unfulfilled_orders': fulfillment_summary['total_orders'],
        'pending_revenue': fulfillment_summary['total_revenue']
    }
```

## 商品管理

### 例3: 在庫レベルの監視

```python
async def monitor_inventory():
    """低在庫商品を監視"""
    
    # 在庫レベルの取得（GraphQL使用）
    inventory_data = await get_inventory_levels_graphql(
        first=100  # 最初の100件を取得
    )
    
    # 低在庫商品のフィルタリング
    low_stock_items = []
    for edge in inventory_data['edges']:
        level = edge['node']
        if level['available'] < 10:  # 在庫10個未満
            low_stock_items.append({
                'sku': level['item']['sku'],
                'product': level['item']['variant']['product']['title'],
                'variant': level['item']['variant']['title'],
                'available': level['available'],
                'incoming': level['incoming']
            })
    
    return low_stock_items

# アラート送信
async def send_inventory_alerts():
    low_stock = await monitor_inventory()
    if low_stock:
        print(f"警告: {len(low_stock)}個の商品が低在庫です")
        for item in low_stock:
            print(f"- {item['product']} ({item['variant']}): 残り{item['available']}個")
```

### 例4: 商品パフォーマンスの分析

```python
async def analyze_product_performance():
    """商品のパフォーマンスを分析"""
    
    # 過去30日間のトップ商品
    performance_data = await get_product_performance(
        period="30_days",
        limit=20
    )
    
    # カテゴリ別の分析
    products = await get_products_graphql(
        first=50,
        sort_key="BEST_SELLING"
    )
    
    category_performance = {}
    for product in products['edges']:
        product_type = product['node']['productType']
        if product_type not in category_performance:
            category_performance[product_type] = {
                'count': 0,
                'total_revenue': 0
            }
        
        # パフォーマンスデータと結合
        for perf in performance_data['top_products']:
            if perf['product_id'] == product['node']['id']:
                category_performance[product_type]['count'] += 1
                category_performance[product_type]['total_revenue'] += perf['revenue']
    
    return {
        'top_products': performance_data['top_products'][:10],
        'category_analysis': category_performance
    }
```

## カスタマーインサイト

### 例5: 顧客セグメント分析

```python
async def analyze_customer_segments():
    """顧客をセグメントに分類"""
    
    # 顧客データの取得
    customers = await get_customers(
        limit=250,
        created_at_min=(datetime.now() - timedelta(days=365)).isoformat()
    )
    
    # セグメント分類
    segments = {
        'new': [],        # 初回購入客
        'regular': [],    # リピーター（2-5回）
        'vip': [],        # VIP（6回以上）
        'dormant': []     # 休眠客（90日以上購入なし）
    }
    
    for customer in customers:
        orders_count = customer['orders_count']
        last_order_date = datetime.fromisoformat(customer.get('last_order_date', ''))
        days_since_last_order = (datetime.now() - last_order_date).days
        
        if orders_count == 1:
            segments['new'].append(customer)
        elif orders_count >= 6:
            segments['vip'].append(customer)
        elif days_since_last_order > 90:
            segments['dormant'].append(customer)
        else:
            segments['regular'].append(customer)
    
    # 各セグメントの分析
    segment_analysis = {}
    for segment_name, segment_customers in segments.items():
        if segment_customers:
            total_spent = sum(float(c['total_spent']) for c in segment_customers)
            avg_spent = total_spent / len(segment_customers)
            
            segment_analysis[segment_name] = {
                'count': len(segment_customers),
                'total_revenue': total_spent,
                'average_lifetime_value': avg_spent,
                'percentage': len(segment_customers) / len(customers) * 100
            }
    
    return segment_analysis
```

### 例6: 顧客生涯価値（LTV）の計算

```python
async def calculate_customer_ltv():
    """顧客生涯価値を計算"""
    
    # 過去1年間の顧客データ
    customers = await get_customers(
        limit=500,
        created_at_min=(datetime.now() - timedelta(days=365)).isoformat()
    )
    
    # LTV計算
    ltv_data = []
    for customer in customers:
        first_order_date = datetime.fromisoformat(customer['created_at'])
        customer_age_days = (datetime.now() - first_order_date).days
        
        if customer_age_days > 0:
            ltv = float(customer['total_spent'])
            monthly_value = ltv / (customer_age_days / 30)
            
            ltv_data.append({
                'customer_id': customer['id'],
                'email': customer['email'],
                'lifetime_value': ltv,
                'orders_count': customer['orders_count'],
                'average_order_value': ltv / customer['orders_count'] if customer['orders_count'] > 0 else 0,
                'monthly_value': monthly_value,
                'customer_age_days': customer_age_days
            })
    
    # 上位顧客の特定
    ltv_data.sort(key=lambda x: x['lifetime_value'], reverse=True)
    
    return {
        'top_customers': ltv_data[:20],
        'average_ltv': sum(c['lifetime_value'] for c in ltv_data) / len(ltv_data),
        'total_customer_value': sum(c['lifetime_value'] for c in ltv_data)
    }
```

## Google Analytics統合

### 例7: Eコマースファネル分析

```python
from src.google_analytics.client import GoogleAnalyticsClient

async def analyze_ecommerce_funnel():
    """Eコマースファネルを分析"""
    
    ga_client = GoogleAnalyticsClient()
    
    # ファネルステップの定義
    funnel_steps = [
        'page_view',
        'view_item',
        'add_to_cart',
        'begin_checkout',
        'purchase'
    ]
    
    # ファネルデータの取得
    funnel_data = await ga_client.get_conversion_funnel(
        start_date=(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
        end_date=datetime.now().strftime('%Y-%m-%d'),
        steps=funnel_steps
    )
    
    # ドロップオフ率の計算
    dropoff_analysis = []
    for i in range(1, len(funnel_data['funnel'])):
        prev_step = funnel_data['funnel'][i-1]
        curr_step = funnel_data['funnel'][i]
        
        dropoff_rate = 1 - (curr_step['users'] / prev_step['users'])
        dropoff_analysis.append({
            'from_step': prev_step['step'],
            'to_step': curr_step['step'],
            'dropoff_rate': dropoff_rate,
            'users_lost': prev_step['users'] - curr_step['users']
        })
    
    return {
        'funnel': funnel_data['funnel'],
        'dropoff_analysis': dropoff_analysis,
        'overall_conversion': funnel_data['overall_conversion_rate']
    }
```

### 例8: リアルタイム訪問者モニタリング

```python
async def monitor_realtime_visitors():
    """リアルタイム訪問者をモニタリング"""
    
    ga_client = GoogleAnalyticsClient()
    
    # リアルタイムデータの取得
    realtime_data = await ga_client.get_realtime_data(
        metrics=['activeUsers', 'screenPageViews'],
        dimensions=['country', 'deviceCategory', 'pagePath']
    )
    
    # データの整理
    visitor_summary = {
        'total_active_users': realtime_data['totalActiveUsers'],
        'by_country': {},
        'by_device': {},
        'top_pages': []
    }
    
    for row in realtime_data['rows']:
        country = row['dimensionValues'][0]['value']
        device = row['dimensionValues'][1]['value']
        page = row['dimensionValues'][2]['value']
        users = int(row['metricValues'][0]['value'])
        
        # 国別集計
        if country not in visitor_summary['by_country']:
            visitor_summary['by_country'][country] = 0
        visitor_summary['by_country'][country] += users
        
        # デバイス別集計
        if device not in visitor_summary['by_device']:
            visitor_summary['by_device'][device] = 0
        visitor_summary['by_device'][device] += users
        
        # トップページ
        visitor_summary['top_pages'].append({
            'path': page,
            'users': users
        })
    
    # トップページをソート
    visitor_summary['top_pages'].sort(key=lambda x: x['users'], reverse=True)
    visitor_summary['top_pages'] = visitor_summary['top_pages'][:10]
    
    return visitor_summary
```

## 高度な使用例

### 例9: 自動在庫補充提案

```python
async def generate_restock_recommendations():
    """在庫補充の推奨を生成"""
    
    # 商品の売上速度を計算
    sales_velocity = {}
    
    # 過去30日の注文データ
    orders = await get_orders_summary(
        created_at_min=(datetime.now() - timedelta(days=30)).isoformat()
    )
    
    # 各商品の売上速度を計算
    for order in orders['orders']:
        for line_item in order['line_items']:
            product_id = line_item['product_id']
            quantity = line_item['quantity']
            
            if product_id not in sales_velocity:
                sales_velocity[product_id] = 0
            sales_velocity[product_id] += quantity
    
    # 日次売上速度
    for product_id in sales_velocity:
        sales_velocity[product_id] /= 30
    
    # 現在の在庫レベルを取得
    inventory_levels = await get_inventory_levels_graphql()
    
    # 補充推奨を生成
    restock_recommendations = []
    
    for item in inventory_levels['edges']:
        product_id = item['node']['item']['variant']['product']['id']
        current_stock = item['node']['available']
        incoming = item['node']['incoming']
        
        if product_id in sales_velocity:
            daily_velocity = sales_velocity[product_id]
            days_of_stock = current_stock / daily_velocity if daily_velocity > 0 else float('inf')
            
            # 30日分の在庫を維持
            recommended_stock = daily_velocity * 30
            reorder_quantity = max(0, recommended_stock - current_stock - incoming)
            
            if reorder_quantity > 0:
                restock_recommendations.append({
                    'product': item['node']['item']['variant']['product']['title'],
                    'variant': item['node']['item']['variant']['title'],
                    'current_stock': current_stock,
                    'incoming': incoming,
                    'daily_velocity': round(daily_velocity, 2),
                    'days_of_stock': round(days_of_stock, 1),
                    'recommended_reorder': round(reorder_quantity)
                })
    
    # 緊急度でソート
    restock_recommendations.sort(key=lambda x: x['days_of_stock'])
    
    return restock_recommendations
```

### 例10: 価格最適化分析

```python
async def analyze_price_optimization():
    """価格最適化の機会を分析"""
    
    # 商品データと売上データを結合
    products = await get_products_graphql(first=100)
    performance = await get_product_performance(limit=100, period="90_days")
    
    price_analysis = []
    
    for product in products['edges']:
        product_node = product['node']
        product_id = product_node['id']
        
        # パフォーマンスデータを検索
        perf_data = next((p for p in performance['top_products'] if p['product_id'] == product_id), None)
        
        if perf_data:
            for variant in product_node['variants']['edges']:
                variant_node = variant['node']
                price = float(variant_node['price'])
                
                # 価格弾力性の推定（簡略化）
                if perf_data['units_sold'] > 0:
                    revenue_per_unit = perf_data['revenue'] / perf_data['units_sold']
                    price_difference = abs(price - revenue_per_unit)
                    
                    if price_difference > price * 0.1:  # 10%以上の差
                        price_analysis.append({
                            'product': product_node['title'],
                            'variant': variant_node['title'],
                            'current_price': price,
                            'average_selling_price': round(revenue_per_unit, 2),
                            'units_sold': perf_data['units_sold'],
                            'revenue': perf_data['revenue'],
                            'price_difference': round(price_difference, 2),
                            'recommendation': 'increase' if revenue_per_unit > price else 'decrease'
                        })
    
    return price_analysis
```

## トラブルシューティング

### 一般的な問題と解決策

#### 1. API認証エラー

```python
# エラー: Invalid API key or access token
# 解決策:
async def test_auth():
    try:
        shop_info = await get_shop_info_graphql()
        print("認証成功")
    except Exception as e:
        if "Invalid API key" in str(e):
            print("エラー: アクセストークンが無効です")
            print("解決策:")
            print("1. Shopify管理画面でアプリの権限を確認")
            print("2. 新しいアクセストークンを生成")
            print("3. .envファイルのトークンを更新")
```

#### 2. レート制限エラー

```python
# エラー: 429 Too Many Requests
# 解決策:
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def safe_api_call(func, *args, **kwargs):
    try:
        return await func(*args, **kwargs)
    except RateLimitError as e:
        print(f"レート制限に達しました。{e.retry_after}秒後に再試行します")
        await asyncio.sleep(e.retry_after)
        raise
```

#### 3. GraphQLクエリエラー

```python
# エラー: Query complexity is too high
# 解決策:
async def optimized_graphql_query():
    # クエリを分割
    query_parts = [
        """
        query GetProductsPart1 {
            products(first: 10) {
                edges {
                    node {
                        id
                        title
                    }
                }
            }
        }
        """,
        """
        query GetProductsPart2 {
            products(first: 10, after: $cursor) {
                edges {
                    node {
                        variants(first: 5) {
                            edges {
                                node {
                                    id
                                    price
                                }
                            }
                        }
                    }
                }
            }
        }
        """
    ]
    
    results = []
    for query in query_parts:
        result = await execute_graphql_query(query)
        results.append(result)
    
    return merge_results(results)
```

#### 4. タイムアウトエラー

```python
# エラー: Request timeout
# 解決策:
import aiohttp

async def create_session_with_timeout():
    timeout = aiohttp.ClientTimeout(total=60)  # 60秒のタイムアウト
    connector = aiohttp.TCPConnector(limit=10)  # 接続プール
    
    return aiohttp.ClientSession(
        timeout=timeout,
        connector=connector
    )
```

### デバッグのヒント

1. **詳細なログを有効化**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

2. **APIレスポンスの確認**:
```python
async def debug_api_response():
    response = await raw_api_call("/admin/api/2024-01/shop.json")
    print(f"Status: {response.status}")
    print(f"Headers: {response.headers}")
    print(f"Body: {await response.text()}")
```

3. **環境変数の確認**:
```python
import os
print(f"Shop: {os.getenv('SHOPIFY_SHOP_NAME')}")
print(f"Token: {os.getenv('SHOPIFY_ACCESS_TOKEN')[:10]}...")
```

## まとめ

このチュートリアルでは、Shopify MCP Serverの基本的な使い方から高度な分析まで、実践的な例を通じて学びました。主なポイント：

1. **適切な認証設定**が成功の鍵
2. **エラーハンドリング**を適切に実装
3. **レート制限**を考慮した実装
4. **GraphQLとREST**を使い分ける
5. **キャッシング**でパフォーマンス向上

さらに詳しい情報は、[APIリファレンス](API_REFERENCE.md)や[開発者ガイド](DEVELOPER_GUIDE.md)を参照してください。