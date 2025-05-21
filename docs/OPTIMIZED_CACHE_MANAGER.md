# OptimizedCacheManager ガイド

このドキュメントでは、OptimizedCacheManagerの機能、設定方法、およびデプロイ手順について説明します。

## 目次

1. [概要](#1-概要)
2. [主要機能](#2-主要機能)
3. [使用方法](#3-使用方法)
4. [設定オプション](#4-設定オプション)
5. [デプロイと検証](#5-デプロイと検証)
6. [モニタリング](#6-モニタリング)
7. [トラブルシューティング](#7-トラブルシューティング)

## 1. 概要

OptimizedCacheManagerは、Shopify MCP Serverのパフォーマンスを大幅に向上させるために設計された、高度なマルチレイヤーキャッシュシステムです。メモリキャッシュとRedisキャッシュを組み合わせ、データ種類に応じた最適なキャッシュ戦略を適用します。

## 2. 主要機能

### マルチレイヤーキャッシュ
- L1: メモリキャッシュ（高速、短いTTL）
- L2: Redisキャッシュ（大容量、長いTTL）

### スマートTTL管理
- データ種類に基づく適応的TTL
- データサイズに基づく動的調整
- キャッシュスタンピード防止のためのTTLジッター

### 高度なメモリ管理
- 大きなデータの自動圧縮
- 複数の圧縮アルゴリズム対応（zlib、LZ4）
- スマートエビクション戦略（アクセス頻度、ヒット率、サイズ、経過時間を考慮）

### 無効化戦略
- キーベースの無効化
- タグベースの無効化
- パターンベースの無効化
- 依存関係ベースの無効化

### 包括的なモニタリング
- キャッシュヒット率
- メモリ使用量
- コンプレッションレシオ
- ホットキーの検出

### 非同期対応
- asyncio互換のインターフェース
- スレッドセーフな操作

## 3. 使用方法

### 基本的な使用方法

```python
from src.api.shopify.optimized_cache_manager import OptimizedCacheManager, optimized_cache_query
import redis

# Redisクライアントの初期化（オプション）
redis_client = redis.Redis.from_url("redis://localhost:6379/0")

# キャッシュマネージャーの初期化
cache_manager = OptimizedCacheManager(
    memory_size=50_000_000,    # 50MB
    memory_ttl=300,            # 5分
    redis_client=redis_client,
    redis_size=500_000_000,    # 500MB
    redis_ttl=3600             # 1時間
)

# デコレータを使用したキャッシング
class ShopifyClient:
    def __init__(self):
        self.cache_manager = cache_manager
    
    @optimized_cache_query(
        ttl=300,
        tags=["product"],
        data_type="product",
        dependencies=["inventory"]
    )
    async def get_products(self, query, variables=None):
        # Shopify APIへのクエリ実行
        return result
```

### 手動キャッシュ操作

```python
# キャッシュから取得
data = await cache_manager.get("my_query", {"variables": "value"})

if data is None:
    # データ取得
    data = fetch_from_source()
    
    # キャッシュに保存
    await cache_manager.set(
        "my_query", 
        {"variables": "value"}, 
        data,
        ttl=600,
        tags=["customer", "important"],
        data_type="customer",
        dependencies=["subscription"]
    )

# キャッシュ無効化
await cache_manager.invalidate(tags=["customer"])
```

### 部分的更新

```python
# 既存のキャッシュエントリを部分的に更新
def update_product_stock(product_data):
    product_data['in_stock'] = False
    return product_data

await cache_manager.update_partial("product_123", update_product_stock)
```

## 4. 設定オプション

### メモリキャッシュ設定

| オプション | 説明 | デフォルト |
|------------|------|------------|
| `memory_size` | メモリキャッシュの最大サイズ（バイト） | 50,000,000 (50MB) |
| `memory_ttl` | メモリキャッシュのデフォルトTTL（秒） | 300 (5分) |
| `enable_compression` | 大きなデータの圧縮を有効化 | `True` |
| `compression_algorithm` | 圧縮アルゴリズム (`zlib`, `lz4`) | `zlib` |

### Redisキャッシュ設定

| オプション | 説明 | デフォルト |
|------------|------|------------|
| `redis_size` | Redisキャッシュの最大サイズ（バイト） | 500,000,000 (500MB) |
| `redis_ttl` | RedisキャッシュのデフォルトTTL（秒） | 3600 (1時間) |
| `redis_pool_size` | Redis接続プールサイズ | 10 |
| `redis_connect_timeout` | Redis接続タイムアウト（秒） | 1.0 |
| `redis_read_timeout` | Redis読み取りタイムアウト（秒） | 0.5 |

### その他の設定

| オプション | 説明 | デフォルト |
|------------|------|------------|
| `enable_prefetching` | 関連データのプリフェッチを有効化 | `True` |
| `ttl_jitter` | TTLのランダム変動係数 | 0.2 (±20%) |

## 5. デプロイと検証

OptimizedCacheManagerの安全なデプロイには、段階的なアプローチを採用しています。詳細な手順は以下のドキュメントを参照してください：

- [デプロイ計画](./OPTIMIZED_CACHE_DEPLOYMENT_PLAN.md)

検証スクリプトを使用して検証を実行する方法：

```bash
# 検証環境のセットアップ
cd ~/shopify-mcp-server/scripts/cache-verification
./setup_verification_env.sh

# ベースラインパフォーマンス測定
cd ~/cache-deploy-verification
./run_verification.sh --phase=baseline --env=staging

# ステージング環境検証
./run_verification.sh --phase=stage --env=staging

# 本番環境デプロイ（フェーズ1〜3）
./run_verification.sh --phase=production-p1 --env=production
# 4時間後：
./run_verification.sh --phase=production-p2 --env=production
# 24時間後：
./run_verification.sh --phase=production-p3 --env=production
```

## 6. モニタリング

### モニタリングメトリクス

OptimizedCacheManagerは以下のメトリクスを提供します：

1. **キャッシュヒット率**
   - 全体ヒット率
   - レベルごとのヒット率
   - データタイプごとのヒット率

2. **メモリ使用量**
   - 総使用量
   - データタイプごとの使用量
   - 圧縮率

3. **パフォーマンスメトリクス**
   - レスポンスタイム
   - API呼び出し削減率
   - プリフェッチヒット率

### モニタリングダッシュボード

モニタリングダッシュボードは以下のコマンドで設定できます：

```bash
./setup-monitoring.sh
```

## 7. トラブルシューティング

### キャッシュヒット率が低い場合

1. キャッシュキー設計の確認
   ```python
   print(cache_manager.generate_key(query, variables))
   ```

2. TTL設定の見直し
   ```python
   # データ種類ごとにTTLを調整
   await cache_manager.set(query, variables, result, ttl=1800, data_type="product")
   ```

3. キャッシュ統計の確認
   ```python
   stats = await cache_manager.get_stats()
   print(f"全体ヒット率: {stats['overall_hit_rate']:.2%}")
   print(f"データタイプ別: {stats['data_type_stats']}")
   ```

### メモリ使用量が高い場合

1. 圧縮の有効化
   ```python
   cache_manager = OptimizedCacheManager(
       enable_compression=True,
       compression_algorithm="lz4"  # より高速な圧縮
   )
   ```

2. サイズベースのTTL調整を活用
   ```python
   # データサイズに応じて自動的にTTLを調整
   # 大きなデータは短いTTL、小さなデータは長いTTL
   ```

3. 不要なデータの無効化
   ```python
   await cache_manager.invalidate(data_type="analytics")
   ```

### 整合性の問題

1. 依存関係ベースの無効化を使用
   ```python
   await cache_manager.set(
       query, variables, result,
       dependencies=["product_123", "inventory_123"]
   )
   
   # product_123が更新されると、この結果も自動的に無効化される
   await cache_manager.invalidate_dependencies("product_123")
   ```

2. タグベースの無効化
   ```python
   await cache_manager.invalidate(tags=["product", "featured"])
   ```

### ロールバック手順

キャッシュに問題が発生した場合は、以下のコマンドでロールバックできます：

```bash
# 現在のフェーズのみロールバック
./rollback_cache.sh --env=production --phase=current

# 完全ロールバック
./rollback_cache.sh --env=production --phase=complete
```