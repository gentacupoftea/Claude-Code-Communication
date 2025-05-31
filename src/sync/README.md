# Shopify同期エンジン

このモジュールはShopifyストアのデータを同期するためのエンジンを提供します。既存の同期エンジンアーキテクチャに基づいて、Shopify専用の同期機能を実装しています。

## 機能

- 商品データの同期（Products）
- 注文データの同期（Orders）
- 在庫データの同期（Inventory）
- 顧客データの同期（Customers）
- 複数のShopifyストア対応（組織やDBストア情報に基づく）
- REST APIとGraphQL APIの両方をサポート
- Celeryと統合可能なタスクシステム
- 同期履歴と状態管理

## 利用方法

### 直接利用（同期エンジンの単体利用）

```python
import asyncio
from src.sync.shopify_sync import ShopifySyncEngine
from src.sync.sync_engine.config import SyncConfig

async def main():
    # 同期設定
    config = SyncConfig(
        sync_interval=60 * 30,  # 30分間隔
        batch_size=100,
        sync_products=True,
        sync_orders=True,
        sync_inventory=True,
        sync_customers=True,
        use_graphql=True  # GraphQLを使用
    )
    
    # 同期エンジンの初期化
    sync_engine = ShopifySyncEngine(
        organization_id="your-organization-id",
        store_id="optional-store-id",  # 省略可能
        config=config
    )
    
    # 起動
    await sync_engine.start()
    
    # 商品同期
    product_result = await sync_engine.sync_products()
    print(f"商品同期結果: {product_result.status.value}")
    
    # 全体同期
    all_results = await sync_engine.sync_all()
    
    # 終了
    await sync_engine.stop()

# 非同期メイン関数を実行
asyncio.run(main())
```

### Celeryタスクとして利用

```python
# タスクをキューに追加
from src.sync.tasks.shopify_sync_tasks import run_shopify_sync

# 基本的な同期タスク
task = run_shopify_sync.delay(
    organization_id="your-organization-id",
    store_id="optional-store-id"  # 省略可能
)

# 特定のデータタイプのみ同期
task = run_shopify_sync.delay(
    organization_id="your-organization-id",
    sync_types=["products", "orders"]
)

# 設定をカスタマイズ
task = run_shopify_sync.delay(
    organization_id="your-organization-id",
    config_overrides={
        "batch_size": 50,
        "use_graphql": False,
        "api_rate_limit_shopify": 2.0
    }
)

# タスク結果の取得
result = task.get()
print(result)
```

## アーキテクチャ

### クラス構造

- `ShopifySyncEngine`: メインの同期エンジンクラス
- `SyncConfig`: 同期設定を保持するクラス
- `SyncResult`: 同期結果を表すクラス
- `SyncRecord`: 個別の同期レコードを表すクラス
- `SyncHistory`: 同期履歴を管理するクラス

### データフロー

1. Shopify APIを使用してデータを取得
2. データの検証と変換
3. 内部システムへの統合
4. 結果の記録と履歴管理

### 設定オプション

| オプション | 説明 | デフォルト値 |
|------------|------|------------|
| sync_interval | 同期間隔（秒） | 3600 (1時間) |
| batch_size | 一度に処理するデータ数 | 50 |
| sync_products | 商品同期を有効にする | True |
| sync_orders | 注文同期を有効にする | True |
| sync_inventory | 在庫同期を有効にする | True |
| sync_customers | 顧客同期を有効にする | True |
| use_graphql | GraphQL APIを使用する | True |
| api_rate_limit_shopify | Shopify APIのレート制限（1秒あたりのリクエスト数） | 1.0 |

## 拡張方法

### 新しい同期タイプの追加

1. `SyncType` Enumに新しいタイプを追加
2. 対応する同期メソッドを `ShopifySyncEngine` に実装
3. `sync_all` メソッドに新しいタイプを追加

### 統合先の変更

デフォルトでは、プレースホルダーとして実装されている統合メソッドを実際のシステムと連携するように修正します：

- `_integrate_product`
- `_integrate_order`
- `_integrate_inventory`
- `_integrate_customer`

## エラーハンドリング

同期エンジンは各レベルでのエラーハンドリングを実装しています：

1. 個別レコードレベル：各レコードの処理失敗は記録され、他のレコードの処理は継続
2. 同期タイプレベル：同期タイプ全体の失敗は記録され、他の同期タイプは実行継続
3. エンジンレベル：重大なエラーはロギングされ、エンジンの状態は安全に保持

## ロギング

同期エンジンは詳細なロギングを提供します。ログレベルは設定で調整可能です：

```python
config = SyncConfig(log_level="INFO")  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```