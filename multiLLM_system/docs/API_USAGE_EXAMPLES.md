# MCP Integration System API使用例集 - Phase 3 Complete Edition

🎯 **Production-Ready** MCP統合システムの実践的な使用例とベストプラクティスを紹介します。

## 🌟 Phase 3 主要機能

- ✨ **統一ページネーション**: 全プロバイダーで一貫したページング処理
- 🔐 **OAuth永続化**: 自動トークン管理とリフレッシュ
- 📊 **標準データモデル変換**: プロバイダー間でのシームレスなデータ交換
- 🛡️ **統一エラーハンドリング**: 17種類のエラータイプと自動解決提案
- 🔍 **包括的監視機能**: リアルタイム診断と自動復旧

## 📋 目次

1. [Phase 3 基本的な使い方](#phase-3-基本的な使い方)
2. [OAuth永続化サポート](#oauth永続化サポート)
3. [統一ページネーション](#統一ページネーション)
4. [標準データモデル変換](#標準データモデル変換)
5. [Shopify API (Phase 3対応)](#shopify-api-phase-3対応)
6. [Amazon SP-API (OAuth永続化対応)](#amazon-sp-api-oauth永続化対応)
7. [Facebook Ads API (完全OAuth対応)](#facebook-ads-api-完全oauth対応)
8. [Google Analytics API (統一メトリクス)](#google-analytics-api-統一メトリクス)
9. [Instagram Graph API (標準データモデル)](#instagram-graph-api-標準データモデル)
10. [GitHub API (Repository統一モデル)](#github-api-repository統一モデル)
11. [エラーハンドリングとリカバリー](#エラーハンドリングとリカバリー)
12. [高度な監視と診断機能](#高度な監視と診断機能)
13. [Production環境でのベストプラクティス](#production環境でのベストプラクティス)

## Phase 3 基本的な使い方

### 🚀 Phase 3 対応サービスの初期化

```python
from services.mcp_integration import MCPIntegrationService
from services.persistence import OAuthPersistenceManager
from services.common_data_models import *

# OAuth永続化マネージャーの設定 (NEW!)
persistence_manager = OAuthPersistenceManager(
    storage_path='./oauth_tokens',
    encryption_key='your-secure-encryption-key',  # 本番環境では環境変数から取得
    auto_refresh=True,                            # 自動リフレッシュ有効
    refresh_threshold_minutes=30                  # 30分前に自動リフレッシュ
)

# Phase 3 対応設定
config = {
    'providers': {
        'shopify': {
            'type': 'shopify',
            'apiKey': 'your-api-key',
            'apiSecret': 'your-api-secret',
            'shopDomain': 'your-shop.myshopify.com',
            'accessToken': 'your-access-token'
        },
        'facebook': {
            'type': 'facebook_ads',
            'access_token': 'EAA...', # 自動リフレッシュされます！
            'app_id': '123456789',
            'app_secret': 'xxxxx',
            'oauth_refresh': True     # OAuth自動管理有効 (NEW!)
        },
        'amazon': {
            'type': 'amazon_sp_api',
            'refresh_token': 'Atzr|xxxxx',
            'client_id': 'amzn1.application-oa2-client.xxxxx',
            'client_secret': 'xxxxx',
            'marketplace_id': 'A1VC38T7YXB528',
            'oauth_persistence': True  # OAuth永続化有効 (NEW!)
        },
        'google_analytics': {
            'type': 'google_analytics',
            'credentials_file': 'path/to/credentials.json',
            'property_id': '123456789',
            'oauth_refresh': True      # Google OAuth自動管理 (NEW!)
        }
    },
    
    # Phase 3 グローバル設定 (NEW!)
    'persistence_manager': persistence_manager,
    'enable_unified_pagination': True,     # 統一ページネーション有効
    'enable_standard_conversion': True,    # 標準データモデル変換有効
    'enable_comprehensive_monitoring': True, # 包括的監視有効
    'max_retries': 3,
    'timeout': 30,
    'health_check_interval': 300
}

# サービスの初期化
service = MCPIntegrationService(config)
await service.initialize()

print("🎉 Phase 3 MCP Integration Service initialized successfully!")
print(f"✅ OAuth永続化サポート: {service.oauth_persistence_enabled}")
print(f"✅ 統一ページネーション: {service.unified_pagination_enabled}")
print(f"✅ 標準データモデル変換: {service.standard_conversion_enabled}")
```

### 🔧 Phase 3 エンタープライズワーカーシステム

```python
from services.mcp_integration import MCPWorker

# Phase 3 強化ワーカーの初期化
worker = MCPWorker(
    service, 
    max_concurrent_tasks=10,
    enable_error_analysis=True,          # エラー分析機能有効 (NEW!)
    enable_metrics=True,                 # 詳細メトリクス有効 (NEW!)
    enable_auto_recovery=True,           # 自動復旧機能有効 (NEW!)
    oauth_auto_refresh=True              # OAuth自動リフレッシュ (NEW!)
)
await worker.start()

# Phase 3 機能を使ったタスク送信
task_id = await worker.submit_task(
    "facebook campaigns with insights and pagination",
    {
        'limit': 100,
        'get_all_pages': True,          # 統一ページネーション (NEW!)
        'convert_response': True,       # 標準データモデル変換 (NEW!)
        'oauth_refresh': True,          # OAuth自動リフレッシュ (NEW!)
        'insights_date_range': 'last_30_days'
    },
    'high'  # 高優先度
)

print(f"📋 タスク送信完了: {task_id}")

# エラー分析付き結果取得 (NEW!)
result = await worker.get_task_result(task_id, timeout=60.0)
if result:
    if result['success']:
        campaigns = result['result']['campaigns']  # 標準Campaign型
        print(f"✅ {len(campaigns)} キャンペーンを取得")
        
        # 標準データモデルの活用
        for campaign in campaigns:
            print(f"📊 {campaign.name}: {campaign.budget.amount} {campaign.budget.currency}")
            print(f"📈 ステータス: {campaign.status.value}")
            print(f"🏢 プロバイダー: {campaign.provider}")
    else:
        # Phase 3: 高度なエラー分析 (NEW!)
        error_analysis = worker.analyze_task_error(task_id)
        print(f"❌ エラー分析結果:")
        print(f"   エラーパターン: {error_analysis['error_pattern']}")
        print(f"   解決提案: {error_analysis['resolution_suggestions']}")
        print(f"   自動復旧可能: {error_analysis['auto_recoverable']}")
        
        if error_analysis['auto_recoverable']:
            print("🔄 自動復旧を実行中...")
            recovery_result = await worker.auto_recover_task(task_id)
            print(f"復旧結果: {recovery_result['status']}")

# 詳細統計の取得 (NEW!)
stats = worker.get_comprehensive_statistics()
print(f"📊 ワーカー統計:")
print(f"   処理済みタスク: {stats['tasks_processed']:,}")
print(f"   成功率: {stats['success_rate']:.1%}")
print(f"   平均処理時間: {stats['avg_processing_time']}ms")
print(f"   OAuth自動リフレッシュ回数: {stats['oauth_refreshes']}")

# グレースフルシャットダウン (NEW!)
await worker.stop(graceful=True)
```

## OAuth永続化サポート

### 🔐 自動OAuth管理システム (NEW!)

```python
# OAuth永続化マネージャーの詳細設定
from services.persistence import OAuthPersistenceManager

persistence_manager = OAuthPersistenceManager(
    storage_path='./oauth_tokens',
    encryption_key=os.getenv('OAUTH_ENCRYPTION_KEY'),
    auto_refresh=True,
    refresh_threshold_minutes=30,
    backup_enabled=True,
    backup_path='./oauth_backups'
)

# 手動でのOAuthトークン管理
# Facebook Adsトークンの保存
await persistence_manager.save_token(
    'facebook',
    {
        'access_token': 'EAA...',
        'expires_in': 5184000,  # 60日
        'token_type': 'bearer',
        'scope': 'ads_read,pages_read_engagement'
    }
)

# トークンの自動リフレッシュチェック
refresh_status = await persistence_manager.check_and_refresh_all()
for provider, status in refresh_status.items():
    if status['refreshed']:
        print(f"🔄 {provider}: トークンを自動リフレッシュしました")
    elif status['expires_soon']:
        print(f"⚠️ {provider}: まもなく期限切れ - 手動更新が必要")

# 期限切れトークンの自動クリーンアップ
cleaned = await persistence_manager.cleanup_expired()
print(f"🧽 {cleaned} 個の期限切れトークンをクリーンアップしました")
```

## 統一ページネーション

### 🔄 全プロバイダー統一ページング処理 (NEW!)

```python
# 基本的な統一ページネーション
result = await service.execute_mcp_request(
    'shopify.products.list',
    {
        'limit': 250,                    # プロバイダー最適化サイズ
        'get_all_pages': True,          # 全ページ自動取得
        'max_pages': 20,                # 安全制限
        'page_delay': 0.5,              # ページ間待機時間
        'convert_response': True        # 標準データモデル変換
    }
)

# プロバイダー横断的なページネーション比較
pagination_tasks = [
    service.execute_mcp_request(
        'shopify.products.list',
        {'limit': 100, 'get_all_pages': True, 'convert_response': True}
    ),
    service.execute_mcp_request(
        'amazon.products.list', 
        {'limit': 50, 'get_all_pages': True, 'convert_response': True}
    ),
    service.execute_mcp_request(
        'facebook.campaigns.list',
        {'limit': 200, 'get_all_pages': True, 'convert_response': True}
    )
]

# 並行ページネーション実行
results = await asyncio.gather(*pagination_tasks, return_exceptions=True)

all_products = []
for i, result in enumerate(results):
    if not isinstance(result, Exception) and not result.error:
        if 'products' in result.result:
            all_products.extend(result.result['products'])
        elif 'campaigns' in result.result:
            print(f"取得したキャンペーン数: {len(result.result['campaigns'])}")

print(f"統一ページネーションで取得した全商品数: {len(all_products)}")

# ストリーミングページネーション（メモリ効率的）
async for page_data in service.paginate_request(
    'amazon.orders.list',
    {
        'marketplace_id': 'A1VC38T7YXB528',
        'limit': 100,
        'convert_response': True
    }
):
    orders = page_data['orders']  # 標準Order型
    
    # リアルタイム処理
    for order in orders:
        await process_order_realtime(order)
        
    print(f"📦 ページ処理完了: {len(orders)} 注文, ページ{page_data['page_info']['page']}/{page_data['page_info']['total_pages']}")
    
    # 動的バッチサイズ調整
    if page_data['performance_metrics']['response_time'] > 5000:  # 5秒
        print("⚡ レスポンス時間が長いため、バッチサイズを調整")
        service.adjust_pagination_batch_size('amazon', reduce=True)
```

## 標準データモデル変換

### 📊 プロバイダー間シームレスなデータ交換 (NEW!)

```python
from services.common_data_models import Product, Order, Campaign, Money, ProductStatus

# 複数プロバイダーからの商品データを統一形式で取得
product_sources = [
    ('shopify', 'shopify.products.list', {'limit': 100}),
    ('amazon', 'amazon.products.list', {'marketplace_id': 'A1VC38T7YXB528', 'limit': 50})
]

unified_products = []

for provider, method, params in product_sources:
    params['convert_response'] = True  # 標準データモデル変換有効
    
    result = await service.execute_mcp_request(method, params)
    
    if not result.error:
        products = result.result['products']  # 統一Product型
        unified_products.extend(products)
        
        print(f"📊 {provider}から{len(products)}商品を取得")

# 統一されたProduct型での処理
print(f"\n🎯 統一商品データ分析 (総数: {len(unified_products)})")

active_products = [p for p in unified_products if p.status == ProductStatus.ACTIVE]
price_analysis = {
    'total_products': len(unified_products),
    'active_products': len(active_products),
    'price_ranges': {
        'low': len([p for p in active_products if p.price.amount < 1000]),
        'medium': len([p for p in active_products if 1000 <= p.price.amount < 5000]),
        'high': len([p for p in active_products if p.price.amount >= 5000])
    },
    'currencies': list(set(p.price.currency for p in active_products))
}

print(f"📈 分析結果: {price_analysis}")

# プロバイダー間でのデータ転送例
# Shopifyの商品をAmazonの形式に変換
shopify_products = [p for p in unified_products if p.provider == 'shopify']

for product in shopify_products[:5]:  # 最初の5商品
    # 統一Product型なので、そのまま別プロバイダーでも使用可能
    amazon_format = {
        'title': product.title,
        'description': product.description,
        'price': product.price.amount,
        'currency': product.price.currency,
        'sku': product.id,
        'status': 'Active' if product.status == ProductStatus.ACTIVE else 'Inactive'
    }
    
    print(f"🔄 {product.title}: Shopify → Amazon形式変換完了")
```

## Shopify API (Phase 3対応)

### 🛍️ 商品の取得と管理 - 統一ページネーション対応

```python
# Phase 3: 統一ページネーションと標準データモデルでの商品取得
result = await service.execute_mcp_request(
    'shopify.products.list',
    {
        'limit': 250,                   # Shopify最適化サイズ
        'get_all_pages': True,         # 統一ページネーション (NEW!)
        'max_pages': 50,               # 安全制限
        'convert_response': True,      # 標準Product型に変換 (NEW!)
        'fields': 'id,title,handle,status,created_at,updated_at,variants'
    }
)

if not result.error:
    products = result.result['products']  # 統一Product型のリスト
    
    print(f"✅ Shopify商品を{len(products)}件取得（統一ページネーション使用）")
    
    for product in products[:10]:  # 最初の10商品を表示
        print(f"🛍️ {product.title}:")
        print(f"   価格: {product.price.amount} {product.price.currency}")
        print(f"   ステータス: {product.status.value}")
        print(f"   プロバイダー: {product.provider}")
        print(f"   バリエーション数: {len(product.variants)}")
        print(f"   作成日: {product.created_at}")
        print()
    
    # 統一データモデルを使った分析
    analysis = {
        'total_products': len(products),
        'active_products': len([p for p in products if p.status == ProductStatus.ACTIVE]),
        'avg_price': sum(p.price.amount for p in products) / len(products),
        'price_currencies': list(set(p.price.currency for p in products))
    }
    
    print(f"📊 Shopify商品分析: {analysis}")
else:
    # Phase 3: 統一エラーハンドリング
    error = result.error
    print(f"❌ エラー発生: {error['error_type']} - {error['error_message']}")
    print(f"🔄 リトライ可能: {error['retryable']}")
    for suggestion in error['resolution_suggestions']:
        print(f"💡 解決提案: {suggestion}")

# 商品の個別取得（標準データモデル）
product_result = await service.execute_mcp_request(
    'shopify.products.get',
    {
        'product_id': '123456789',
        'convert_response': True  # Product型で取得
    }
)

if not product_result.error:
    product = product_result.result['product']  # Product型
    
    print(f"📦 商品詳細: {product.title}")
    print(f"💰 価格: {product.price.amount} {product.price.currency}")
    
    # バリエーション情報
    for variant in product.variants:
        print(f"   📋 {variant.title}: {variant.price.amount} {variant.price.currency}")
        print(f"      在庫: {variant.inventory_quantity}")

# 商品の作成（標準データモデル使用）
new_product = Product(
    title="新商品テスト",
    description="Phase 3テスト用商品",
    price=Money(amount=2980, currency='JPY'),
    status=ProductStatus.ACTIVE,
    variants=[
        ProductVariant(
            title="デフォルト",
            price=Money(amount=2980, currency='JPY'),
            inventory_quantity=100
        )
    ],
    tags=['test', 'phase3']
)

create_result = await service.execute_mcp_request(
    'shopify.products.create',
    {
        'product': new_product.to_dict(),  # 標準形式をShopify形式に変換
        'convert_response': True
    }
)

if not create_result.error:
    created_product = create_result.result['product']
    print(f"✅ 商品作成成功: {created_product.title} (ID: {created_product.id})")
```

### 📦 注文管理 - 統一Order型対応

```python
# 統一ページネーションでの注文取得
orders_result = await service.execute_mcp_request(
    'shopify.orders.list',
    {
        'limit': 250,
        'get_all_pages': True,
        'convert_response': True,        # 統一Order型に変換
        'status': 'any',
        'financial_status': 'paid'
    }
)

if not orders_result.error:
    orders = orders_result.result['orders']  # 統一Order型のリスト
    
    print(f"📋 注文データを{len(orders)}件取得")
    
    for order in orders[:5]:  # 最初の5注文
        print(f"📦 注文 {order.order_number}:")
        print(f"   総額: {order.total_amount.amount} {order.total_amount.currency}")
        print(f"   ステータス: {order.status.value}")
        print(f"   支払い状況: {order.payment_status.value}")
        print(f"   商品数: {len(order.line_items)}")
        
        # 配送先住所（統一Address型）
        if order.shipping_address:
            addr = order.shipping_address
            print(f"   配送先: {addr.city}, {addr.province} {addr.zip}")
        print()
    
    # 統一データでの売上分析
    total_revenue = sum(order.total_amount.amount for order in orders)
    avg_order_value = total_revenue / len(orders) if orders else 0
    
    print(f"💰 売上分析:")
    print(f"   総売上: {total_revenue:,} JPY")
    print(f"   平均注文額: {avg_order_value:,.0f} JPY")
    print(f"   注文件数: {len(orders)}")
```

## Amazon SP-API (OAuth永続化対応)

### 📦 Amazon商品・注文管理 - 自動OAuth管理

```python
# OAuth永続化対応Amazon SP-API設定
amazon_result = await service.execute_mcp_request(
    'amazon.products.list',
    {
        'marketplace_id': 'A1VC38T7YXB528',  # 日本マーケットプレイス
        'limit': 50,
        'get_all_pages': True,               # 統一ページネーション
        'convert_response': True,            # 標準Product型に変換
        'oauth_refresh': True,               # OAuth自動リフレッシュ (NEW!)
        'product_types': ['PRODUCT', 'VARIATION_PARENT']
    }
)

if not amazon_result.error:
    products = amazon_result.result['products']  # 統一Product型
    
    print(f"📊 Amazon商品を{len(products)}件取得（OAuth自動管理使用）")
    
    for product in products[:10]:
        print(f"📦 {product.title}:")
        print(f"   ASIN: {product.id}")
        print(f"   価格: {product.price.amount} {product.price.currency}")
        print(f"   ステータス: {product.status.value}")
        print(f"   プロバイダー: {product.provider}")
        
        # Amazon固有の属性にアクセス
        if hasattr(product, 'asin'):
            print(f"   ASIN: {product.asin}")
        print()

# Amazon注文データ（OAuth永続化）
orders_result = await service.execute_mcp_request(
    'amazon.orders.list',
    {
        'marketplace_id': 'A1VC38T7YXB528',
        'order_statuses': ['Shipped', 'Delivered'],
        'get_all_pages': True,
        'convert_response': True,
        'oauth_refresh': True,               # 自動OAuth管理
        'created_after': '2024-01-01T00:00:00Z'
    }
)

if not orders_result.error:
    orders = orders_result.result['orders']  # 統一Order型
    
    print(f"📋 Amazon注文を{len(orders)}件取得")
    
    # プラットフォーム横断売上比較（統一データモデルの威力）
    amazon_total = sum(order.total_amount.amount for order in orders)
    print(f"💰 Amazon売上: {amazon_total:,} JPY")
    
    # Shopifyデータと統合分析が可能
    # （両方とも統一Order型なので、同じロジックで処理可能）
```

## Facebook Ads API (完全OAuth対応)

### 📢 キャンペーン管理 - 統一Campaign型

```python
# Facebook Ads OAuth永続化対応設定
facebook_result = await service.execute_mcp_request(
    'facebook.campaigns.list',
    {
        'account_id': 'act_123456789',
        'limit': 100,
        'get_all_pages': True,
        'convert_response': True,            # 統一Campaign型に変換
        'oauth_refresh': True,               # OAuth自動リフレッシュ
        'fields': ['id', 'name', 'status', 'objective', 'budget_remaining', 'impressions', 'clicks'],
        'effective_status': ['ACTIVE', 'PAUSED']
    }
)

if not facebook_result.error:
    campaigns = facebook_result.result['campaigns']  # 統一Campaign型
    
    print(f"📊 Facebookキャンペーンを{len(campaigns)}件取得")
    
    for campaign in campaigns[:10]:
        print(f"📢 {campaign.name}:")
        print(f"   予算: {campaign.budget.amount} {campaign.budget.currency}")
        print(f"   ステータス: {campaign.status.value}")
        print(f"   目的: {campaign.objective}")
        print(f"   プロバイダー: {campaign.provider}")
        
        # AdSetがある場合
        if campaign.ad_sets:
            print(f"   広告セット数: {len(campaign.ad_sets)}")
        print()
    
    # キャンペーンパフォーマンス分析
    active_campaigns = [c for c in campaigns if c.status == CampaignStatus.ACTIVE]
    total_budget = sum(c.budget.amount for c in active_campaigns if c.budget)
    
    print(f"📈 Facebook Ads分析:")
    print(f"   アクティブキャンペーン: {len(active_campaigns)}")
    print(f"   総予算: {total_budget:,} JPY")

# インサイトデータの取得（統一Analytics型）
insights_result = await service.execute_mcp_request(
    'facebook.campaigns.insights',
    {
        'campaign_ids': [c.id for c in campaigns[:5]],  # 最初の5キャンペーン
        'date_range': 'last_30_days',
        'metrics': ['impressions', 'clicks', 'spend', 'ctr', 'cpm'],
        'convert_response': True,            # 統一Analytics型
        'oauth_refresh': True
    }
)

if not insights_result.error:
    insights = insights_result.result['analytics']  # 統一Analytics型
    
    for insight in insights:
        print(f"📊 キャンペーン {insight.campaign_id} 分析:")
        for metric in insight.metrics:
            print(f"   {metric.name}: {metric.value}")
```

## Google Analytics API (統一メトリクス)

### 📊 アナリティクスデータ - 統一Analytics型

```python
# Google Analytics OAuth永続化対応
ga_result = await service.execute_mcp_request(
    'google_analytics.reports.run',
    {
        'property_id': '123456789',
        'date_range': {
            'start_date': '2024-01-01',
            'end_date': '2024-01-31'
        },
        'metrics': ['sessions', 'pageviews', 'bounceRate', 'avgSessionDuration'],
        'dimensions': ['country', 'deviceCategory'],
        'convert_response': True,            # 統一AnalyticsReport型
        'oauth_refresh': True,               # Google OAuth自動管理
        'limit': 1000,
        'get_all_pages': True
    }
)

if not ga_result.error:
    report = ga_result.result['report']  # 統一AnalyticsReport型
    
    print(f"📈 Google Analytics レポート: {report.report_type}")
    print(f"📅 期間: {report.date_range['start_date']} ～ {report.date_range['end_date']}")
    print(f"📊 メトリクス数: {len(report.metrics)}")
    
    for metric in report.metrics:
        print(f"   📊 {metric.name}: {metric.value:,}")
        if metric.change_percentage:
            change_indicator = "📈" if metric.change_percentage > 0 else "📉"
            print(f"      {change_indicator} 前期比: {metric.change_percentage:+.1f}%")
    
    # ディメンション別データ
    if report.dimensions_data:
        print("\n🌍 国別トップ5:")
        country_data = sorted(
            report.dimensions_data.get('country', []),
            key=lambda x: x['sessions'],
            reverse=True
        )[:5]
        
        for i, country in enumerate(country_data, 1):
            print(f"   {i}. {country['country']}: {country['sessions']:,} セッション")

# リアルタイムデータ
realtime_result = await service.execute_mcp_request(
    'google_analytics.realtime',
    {
        'property_id': '123456789',
        'metrics': ['activeUsers', 'screenPageViews'],
        'convert_response': True,
        'oauth_refresh': True
    }
)

if not realtime_result.error:
    realtime = realtime_result.result['realtime']
    print(f"\n⚡ リアルタイムデータ:")
    print(f"   現在のアクティブユーザー: {realtime['activeUsers']:,}")
    print(f"   現在のページビュー: {realtime['screenPageViews']:,}")
```

## Instagram Graph API (標準データモデル)

### 📸 ソーシャルメディア管理 - 統一SocialMediaPost型

```python
# Instagram Graph API統合
instagram_result = await service.execute_mcp_request(
    'instagram.media.list',
    {
        'user_id': 'your_instagram_user_id',
        'limit': 100,
        'get_all_pages': True,
        'convert_response': True,            # 統一SocialMediaPost型
        'oauth_refresh': True,
        'fields': ['id', 'caption', 'media_type', 'media_url', 'timestamp', 'like_count', 'comments_count']
    }
)

if not instagram_result.error:
    posts = instagram_result.result['posts']  # 統一SocialMediaPost型
    
    print(f"📸 Instagram投稿を{len(posts)}件取得")
    
    for post in posts[:10]:
        print(f"📱 投稿 {post.id}:")
        print(f"   タイプ: {post.media_type.value}")
        print(f"   キャプション: {post.caption[:100]}...")
        print(f"   いいね: {post.engagement.likes_count}")
        print(f"   コメント: {post.engagement.comments_count}")
        print(f"   投稿日時: {post.timestamp}")
        print(f"   プロバイダー: {post.provider}")
        print()
    
    # エンゲージメント分析
    total_likes = sum(post.engagement.likes_count for post in posts)
    total_comments = sum(post.engagement.comments_count for post in posts)
    avg_engagement = (total_likes + total_comments) / len(posts) if posts else 0
    
    print(f"📊 Instagram分析:")
    print(f"   総いいね数: {total_likes:,}")
    print(f"   総コメント数: {total_comments:,}")
    print(f"   平均エンゲージメント: {avg_engagement:.1f}")

# インサイトデータ取得
insights_result = await service.execute_mcp_request(
    'instagram.insights',
    {
        'media_ids': [post.id for post in posts[:20]],  # 最初の20投稿
        'metrics': ['impressions', 'reach', 'saved', 'shares'],
        'convert_response': True,            # 統一SocialMediaInsights型
        'oauth_refresh': True
    }
)

if not insights_result.error:
    insights = insights_result.result['insights']  # 統一SocialMediaInsights型
    
    for insight in insights:
        print(f"📈 投稿 {insight.post_id} インサイト:")
        print(f"   インプレッション: {insight.impressions:,}")
        print(f"   リーチ: {insight.reach:,}")
        print(f"   保存数: {insight.saves}")
        print()
```

## GitHub API (Repository統一モデル)

### 💻 開発プロジェクト管理 - 統一Repository型

```python
# GitHub API統合（Repository統一モデル）
github_result = await service.execute_mcp_request(
    'github.repositories.list',
    {
        'org': 'your-organization',
        'limit': 100,
        'get_all_pages': True,
        'convert_response': True,            # 統一Repository型
        'type': 'all',
        'sort': 'updated'
    }
)

if not github_result.error:
    repositories = github_result.result['repositories']  # 統一Repository型
    
    print(f"💻 GitHubリポジトリを{len(repositories)}件取得")
    
    for repo in repositories[:10]:
        print(f"📂 {repo.full_name}:")
        print(f"   説明: {repo.description}")
        print(f"   言語: {repo.language}")
        print(f"   スター: {repo.stars_count}")
        print(f"   フォーク: {repo.forks_count}")
        print(f"   プライベート: {repo.private}")
        print(f"   デフォルトブランチ: {repo.default_branch}")
        print(f"   プロバイダー: {repo.provider}")
        print()
    
    # リポジトリ分析
    languages = {}
    total_stars = 0
    
    for repo in repositories:
        if repo.language:
            languages[repo.language] = languages.get(repo.language, 0) + 1
        total_stars += repo.stars_count
    
    print(f"📊 GitHub分析:")
    print(f"   総スター数: {total_stars:,}")
    print(f"   主要言語: {sorted(languages.items(), key=lambda x: x[1], reverse=True)[:5]}")

# イシューとプルリクエスト管理
issues_result = await service.execute_mcp_request(
    'github.issues.list',
    {
        'repo': 'your-organization/your-repo',
        'state': 'open',
        'limit': 100,
        'get_all_pages': True,
        'convert_response': True             # 統一Issue型
    }
)

if not issues_result.error:
    issues = issues_result.result['issues']  # 統一Issue型
    
    print(f"🐛 オープンイシューを{len(issues)}件取得")
    
    for issue in issues[:5]:
        print(f"📋 #{issue.number}: {issue.title}")
        print(f"   状態: {issue.status.value}")
        print(f"   担当者: {issue.assignee or '未割り当て'}")
        print(f"   ラベル: {', '.join(issue.labels)}")
        print()
```

## エラーハンドリングとリカバリー

### 🛡️ Phase 3 統一エラーハンドリングシステム

```python
# 包括的エラーハンドリング例
async def robust_api_operation():
    try:
        result = await service.execute_mcp_request(
            'facebook.campaigns.list',
            {
                'account_id': 'act_123456789',
                'get_all_pages': True,
                'convert_response': True,
                'oauth_refresh': True
            }
        )
        
        if result.error:
            # Phase 3: 詳細エラー分析
            error = result.error
            
            print(f"❌ エラー詳細:")
            print(f"   タイプ: {error['error_type']}")
            print(f"   カテゴリ: {error['error_category']}")
            print(f"   メッセージ: {error['error_message']}")
            print(f"   リトライ可能: {error['retryable']}")
            print(f"   プロバイダー: {error['provider']}")
            
            # プロバイダー固有情報
            if 'provider_specific_info' in error:
                print(f"   固有情報: {error['provider_specific_info']}")
            
            # 自動解決提案の実行
            print("\n💡 解決提案:")
            for suggestion in error['resolution_suggestions']:
                print(f"   - {suggestion}")
            
            # リトライ可能なエラーの場合
            if error['retryable']:
                print(f"\n🔄 {error.get('retry_after', 60)}秒後に自動リトライします...")
                
                # インテリジェントリトライ戦略
                retry_strategy = service.get_retry_strategy(error)
                
                for attempt in range(retry_strategy['max_attempts']):
                    wait_time = retry_strategy['base_delay'] * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    
                    retry_result = await service.execute_mcp_request(
                        'facebook.campaigns.list',
                        {
                            'account_id': 'act_123456789',
                            'get_all_pages': True,
                            'convert_response': True
                        }
                    )
                    
                    if not retry_result.error:
                        print("✅ リトライ成功!")
                        return retry_result.result
                    
                    print(f"🔄 リトライ {attempt + 1}/{retry_strategy['max_attempts']} 失敗")
                
                print("❌ 全てのリトライが失敗しました")
            
            # OAuth関連エラーの自動処理
            if error['error_category'] == 'authentication':
                print("🔐 OAuth認証エラーを検出 - 自動リフレッシュを試行")
                refresh_result = await service.refresh_oauth_token('facebook')
                
                if refresh_result['success']:
                    print("✅ OAuth自動リフレッシュ成功 - 再試行中...")
                    return await service.execute_mcp_request(
                        'facebook.campaigns.list',
                        {
                            'account_id': 'act_123456789',
                            'get_all_pages': True,
                            'convert_response': True
                        }
                    )
                else:
                    print(f"❌ OAuth自動リフレッシュ失敗: {refresh_result['error']}")
                    print(f"🔗 手動認証URL: {refresh_result['manual_auth_url']}")
        
        else:
            return result.result
            
    except Exception as e:
        print(f"💥 予期しないエラー: {str(e)}")
        
        # システム診断の実行
        diagnostics = await service.run_system_diagnostics()
        print(f"🔍 システム診断結果:")
        print(f"   全体ヘルススコア: {diagnostics['overall_health_score']}/100")
        
        for issue in diagnostics['issues']:
            print(f"   ⚠️ {issue['severity']}: {issue['description']}")
            if issue['auto_fixable']:
                print(f"   🔧 自動修復を実行中...")
                await service.auto_fix_issue(issue['id'])

# エラー分析とレポート生成
error_analytics = service.get_error_analytics()
print(f"\n📊 エラー分析レポート:")
print(f"   過去24時間のエラー数: {error_analytics['errors_last_24h']}")
print(f"   エラー率: {error_analytics['error_rate']:.2%}")
print(f"   最頻出エラータイプ: {error_analytics['most_common_error_type']}")

# 頻出エラーパターン
for pattern in error_analytics['error_patterns']:
    print(f"   🔍 パターン: {pattern['pattern']} (発生回数: {pattern['count']})")
```

## 高度な監視と診断機能

### 🔍 Production環境での包括的監視

```python
# システム全体のヘルスチェック
health_status = await service.comprehensive_health_check()

print("🏥 システムヘルスチェック結果:")
print(f"   ✅ 正常稼働: {health_status['healthy_providers']}")
print(f"   ⚠️ 部分的問題: {health_status['degraded_providers']}")
print(f"   ❌ 停止中: {health_status['unhealthy_providers']}")
print(f"   🔄 OAuth更新必要: {health_status['oauth_refresh_needed']}")

# プロバイダー別詳細ヘルス情報
for provider, status in health_status['detailed_status'].items():
    print(f"\n🏢 {provider}:")
    print(f"   状態: {status['status']}")
    print(f"   応答時間: {status['response_time']}ms")
    print(f"   エラー率: {status['error_rate']:.1%}")
    
    if status['oauth_info']:
        oauth = status['oauth_info']
        print(f"   🔐 OAuth有効期限: {oauth['expires_in']} 秒")
        
        if oauth['needs_refresh']:
            print("   🔄 自動リフレッシュを実行中...")
            await service.refresh_oauth_token(provider)

# パフォーマンスメトリクスの詳細監視
performance = service.get_comprehensive_statistics()

print(f"\n📊 パフォーマンス統計:")
print(f"   総リクエスト数: {performance['requests_total']:,}")
print(f"   成功率: {performance['success_rate']:.2%}")
print(f"   平均応答時間: {performance['avg_response_time']}ms")
print(f"   スループット: {performance['requests_per_second']:.1f} req/s")
print(f"   OAuth自動リフレッシュ: {performance['oauth_refreshes']} 回")

# プロバイダー別パフォーマンス比較
print(f"\n🏆 プロバイダー別パフォーマンス:")
for provider, metrics in performance['provider_metrics'].items():
    print(f"   {provider}:")
    print(f"     応答時間: {metrics['avg_response_time']}ms")
    print(f"     成功率: {metrics['success_rate']:.1%}")
    print(f"     レート制限使用率: {metrics['rate_limit_utilization']:.1%}")

# リアルタイムアラート設定
service.setup_alerts({
    'error_rate_threshold': 5.0,      # 5%以上のエラー率でアラート
    'response_time_threshold': 3000,  # 3秒以上でアラート  
    'oauth_expiry_warning': 3600,     # 1時間前にOAuth期限切れ警告
    'rate_limit_warning': 80.0        # レート制限80%使用でアラート
})

# 自動診断とレポート生成
diagnostics = await service.run_system_diagnostics()

print(f"\n🔍 システム診断:")
print(f"   総合スコア: {diagnostics['overall_health_score']}/100")

if diagnostics['issues']:
    print("   検出された問題:")
    for issue in diagnostics['issues']:
        severity_icon = "🚨" if issue['severity'] == 'critical' else "⚠️" if issue['severity'] == 'warning' else "ℹ️"
        print(f"   {severity_icon} {issue['description']}")
        print(f"      推奨対応: {issue['recommended_action']}")
        
        if issue['auto_fixable']:
            print("      🔧 自動修復を実行中...")
            await service.auto_fix_issue(issue['id'])

# トレンド分析（過去24時間）
trends = service.get_performance_trends(hours=24)

print(f"\n📈 24時間トレンド:")
print(f"   リクエスト数変化: {trends['request_volume_change']:+.1%}")
print(f"   応答時間変化: {trends['response_time_change']:+.1%}")
print(f"   エラー率変化: {trends['error_rate_change']:+.1%}")

if trends['anomalies']:
    print("   🚨 検出された異常:")
    for anomaly in trends['anomalies']:
        print(f"     {anomaly['timestamp']}: {anomaly['description']}")
```

## Production環境でのベストプラクティス

### 🏭 本番運用における推奨設定

```python
# Production環境での推奨設定
production_config = {
    'providers': {
        'shopify': {
            'type': 'shopify',
            'apiKey': os.getenv('SHOPIFY_API_KEY'),
            'apiSecret': os.getenv('SHOPIFY_API_SECRET'),
            'shopDomain': os.getenv('SHOPIFY_SHOP_DOMAIN'),
            'accessToken': os.getenv('SHOPIFY_ACCESS_TOKEN'),
            'rate_limit_buffer': 0.8,        # レート制限の80%で制御
            'timeout': 30,
            'max_retries': 5
        },
        'facebook': {
            'type': 'facebook_ads',
            'access_token': os.getenv('FACEBOOK_ACCESS_TOKEN'),
            'app_id': os.getenv('FACEBOOK_APP_ID'),
            'app_secret': os.getenv('FACEBOOK_APP_SECRET'),
            'oauth_refresh': True,
            'oauth_refresh_threshold': 1800,  # 30分前にリフレッシュ
            'rate_limit_buffer': 0.75,
            'timeout': 45,
            'max_retries': 3
        }
    },
    
    # Production環境グローバル設定
    'persistence_manager': OAuthPersistenceManager(
        storage_path='/secure/oauth_tokens',
        encryption_key=os.getenv('OAUTH_ENCRYPTION_KEY'),
        auto_refresh=True,
        refresh_threshold_minutes=30,
        backup_enabled=True,
        backup_path='/secure/oauth_backups',
        backup_retention_days=30
    ),
    
    'enable_unified_pagination': True,
    'enable_standard_conversion': True,
    'enable_comprehensive_monitoring': True,
    'enable_performance_optimization': True,
    'enable_automatic_failover': True,
    
    # 高可用性設定
    'health_check_interval': 60,          # 1分間隔でヘルスチェック
    'circuit_breaker_enabled': True,      # サーキットブレーカー有効
    'circuit_breaker_threshold': 50,      # 50%エラー率でブレーカー作動
    'automatic_recovery': True,           # 自動復旧有効
    'performance_alerting': True,         # パフォーマンスアラート有効
    
    # ログとメトリクス
    'structured_logging': True,
    'log_level': 'INFO',
    'metrics_export_interval': 300,       # 5分間隔でメトリクス出力
    'error_sampling_rate': 1.0,          # 全エラーをサンプリング
    
    # セキュリティ設定
    'request_encryption': True,
    'sensitive_data_masking': True,
    'audit_logging': True
}

# Production環境でのサービス初期化
service = MCPIntegrationService(production_config)
await service.initialize()

# Production監視ワーカーの設定
monitoring_worker = MCPWorker(
    service,
    max_concurrent_tasks=20,              # 高スループット設定
    enable_error_analysis=True,
    enable_metrics=True,
    enable_auto_recovery=True,
    oauth_auto_refresh=True,
    performance_monitoring=True,
    resource_monitoring=True
)

# バックグラウンド監視タスクの開始
async def production_monitoring():
    """Production環境での継続的監視"""
    
    while True:
        try:
            # 定期ヘルスチェック
            health = await service.comprehensive_health_check()
            
            if health['critical_issues']:
                # 緊急アラート送信
                await send_emergency_alert(health['critical_issues'])
                
                # 自動復旧試行
                for issue in health['critical_issues']:
                    if issue['auto_recoverable']:
                        await service.auto_recover(issue)
            
            # パフォーマンスメトリクス収集
            metrics = service.get_comprehensive_statistics()
            await export_metrics_to_monitoring_system(metrics)
            
            # OAuth状態チェック
            oauth_status = await service.check_all_oauth_tokens()
            for provider, status in oauth_status.items():
                if status['expires_within_hour']:
                    await send_oauth_expiry_warning(provider, status)
            
            # リソース使用量チェック
            resource_usage = service.get_resource_usage()
            if resource_usage['memory_usage'] > 0.8:  # 80%以上
                await service.optimize_memory_usage()
            
            await asyncio.sleep(60)  # 1分間隔で監視
            
        except Exception as e:
            logger.error(f"監視タスクエラー: {str(e)}")
            await asyncio.sleep(60)

# Production環境での優雅なシャットダウン
async def graceful_shutdown():
    """本番環境での安全なシャットダウン"""
    
    print("🔄 システムの優雅なシャットダウンを開始...")
    
    # 新しいリクエストの受付停止
    service.stop_accepting_requests()
    
    # 進行中のタスクの完了を待機
    await monitoring_worker.stop(graceful=True, timeout=300)  # 5分でタイムアウト
    
    # OAuthトークンの最終保存
    await service.persistence_manager.save_all_tokens()
    
    # システム状態の最終保存
    final_metrics = service.get_comprehensive_statistics()
    await export_final_metrics(final_metrics)
    
    # リソースのクリーンアップ
    await service.cleanup()
    
    print("✅ システムシャットダウン完了")

# Production環境でのエラー通知設定
async def send_emergency_alert(issues):
    """緊急アラートの送信"""
    for issue in issues:
        # Slack通知
        await send_slack_alert(f"🚨 緊急: {issue['description']}")
        
        # メール通知
        await send_email_alert("システム管理者", issue)
        
        # PagerDuty連携
        await trigger_pagerduty_incident(issue)

# Production環境での自動最適化
async def auto_optimization():
    """自動パフォーマンス最適化"""
    
    optimization_report = service.generate_optimization_report()
    
    for provider, recommendations in optimization_report.items():
        if recommendations['efficiency_score'] < 0.8:  # 80%未満の効率
            print(f"⚡ {provider}の最適化を実行中...")
            
            for improvement in recommendations['improvements']:
                if improvement['auto_applicable']:
                    await service.apply_optimization(provider, improvement)
                    print(f"✅ 最適化適用: {improvement['description']}")

print("🎯 Production-Ready MCP Integration System Phase 3 運用開始!")
```

---

## 🎊 Phase 3 完成 - 最終まとめ

このAPI使用例集は、**Production-Ready**なMCP統合システムの威力を実証するものです。

### ✨ Phase 3で実現された価値
- **🔄 統一ページネーション**: 全プロバイダーで一貫した大量データ処理
- **🔐 OAuth永続化**: 中断のない自動認証管理
- **📊 標準データモデル**: プロバイダー間でのシームレスなデータ交換
- **🛡️ 統一エラーハンドリング**: 堅牢で予測可能なエラー処理
- **🔍 包括的監視**: リアルタイムでの運用状況把握と自動復旧

これらの機能により、**エンタープライズグレード**の信頼性と効率性を実現し、商用環境での安定運用が可能になりました。

**🚀 今すぐPhase 3機能を活用して、次世代のMCP統合ソリューションを体験してください！**