# キャッシュシステム ドキュメント

本ドキュメントは、Shopify MCP Serverのキャッシュシステムの実装と使用方法について説明します。

## 概要

キャッシュシステムは、API呼び出しや計算結果を一時的に保存することで、アプリケーションのパフォーマンスを向上させます。主な機能は以下の通りです：

1. **LRUキャッシュアルゴリズム**
   - 最近使用されていないエントリを優先的に削除
   - 効率的なメモリ使用を実現

2. **メモリ管理**
   - キャッシュサイズの上限設定
   - メモリ使用量の監視
   - 上限到達時の自動エビクション（古いエントリの削除）

3. **パフォーマンス測定**
   - キャッシュヒット率・ミス率の計測
   - メモリ使用量のモニタリング
   - 処理時間の比較

4. **スレッドセーフ実装**
   - 複数スレッドからの安全なアクセス
   - 競合状態の回避

## キャッシュ実装

Shopify MCP Serverには複数のキャッシュ実装があります：

1. **標準キャッシュ** - 基本的なLRUキャッシュ実装
2. **AnalyticsCache** - 分析データ用の最適化キャッシュ
3. **GraphQLCacheManager** - GraphQL用階層的キャッシュ
4. **OptimizedCacheManager** - 高度な最適化キャッシュ（新機能）

## 最適化キャッシュマネージャー

`OptimizedCacheManager`は以下の高度な機能を提供する最新のキャッシュシステムです：

1. **マルチレイヤーキャッシュ**
   - メモリ（L1）、Redis（L2）の階層的キャッシュ
   - 高速なデータアクセスとより長いデータ保持を両立

2. **スマートTTL管理**
   - データ種類に基づく適応的TTL
   - アクセス頻度に基づくTTL自動調整
   - 揮発性データの自動検出

3. **アダプティブプリフェッチ**
   - 頻繁にアクセスされるデータの事前読み込み
   - 関連データの予測的キャッシング

4. **効率的なメモリ使用**
   - 大きなデータの自動圧縮
   - サイズベースのスマートエビクション戦略
   - キーのハッシュ化による効率的なストレージ

5. **包括的なメトリクス**
   - 詳細なキャッシュパフォーマンス統計
   - データ種類別の使用状況
   - 圧縮率とメモリ節約の測定

6. **非同期処理対応**
   - asyncio互換の完全非同期インターフェース
   - スレッドセーフなオペレーション

## 設定

キャッシュは以下の環境変数で設定できます：

| 環境変数 | 説明 | デフォルト |
|----------|------|------------|
| CACHE_TTL | キャッシュエントリの有効期間（秒） | 300 |
| CACHE_MAX_SIZE | キャッシュの最大エントリ数 | 1000 |
| CACHE_MAX_MEMORY_MB | キャッシュの最大メモリ使用量（MB） | 100 |
| CACHE_STRATEGY | キャッシュ戦略（"lru"または"ttl"） | "lru" |
| CACHE_REDIS_URL | Redisサーバー接続URL（設定時のみRedis使用） | なし |
| CACHE_COMPRESSION | データ圧縮の有効化（"true"または"false"） | "true" |
| CACHE_PREFETCHING | プリフェッチの有効化（"true"または"false"） | "true" |

`.env`ファイルに設定を追加する例：

```
# キャッシュ設定
CACHE_TTL=600
CACHE_MAX_SIZE=2000
CACHE_MAX_MEMORY_MB=200
CACHE_STRATEGY=lru
CACHE_REDIS_URL=redis://localhost:6379/0
CACHE_COMPRESSION=true
CACHE_PREFETCHING=true
```

## 使用方法

### 基本的な使用方法

キャッシュは主に`@memoize`デコレータを通じて使用します：

```python
from utils import memoize

@memoize(ttl=300)  # 5分間キャッシュ
def expensive_function(param1, param2):
    # 時間のかかる処理
    return result
```

### 最適化キャッシュの使用方法

`OptimizedCacheManager`を使用したキャッシュの最適化：

```python
from src.api.shopify.optimized_cache_manager import OptimizedCacheManager, optimized_cache_query
import redis

# Redisクライアントの作成（オプション）
redis_client = redis.Redis.from_url("redis://localhost:6379/0")

# キャッシュマネージャーの初期化
cache_manager = OptimizedCacheManager(
    memory_size=50_000_000,  # 50MB
    memory_ttl=300,          # 5分
    redis_client=redis_client,
    redis_size=500_000_000,  # 500MB
    redis_ttl=3600,          # 1時間
    enable_prefetching=True,
    enable_compression=True
)

# デコレータを使用したキャッシング
class ShopifyClient:
    def __init__(self):
        self.cache_manager = cache_manager
    
    @optimized_cache_query(ttl=300, tags=["product"], data_type="product")
    async def get_products(self, query, variables=None):
        # Shopify APIへのクエリ実行
        return result

# 直接キャッシュ操作
async def fetch_data():
    key = cache_manager.generate_key("my_query", {"variables": "value"})
    
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
            data_type="customer"
        )
    
    return data
```

### キャッシュ統計の取得

キャッシュのパフォーマンス統計を取得できます：

```python
# 基本キャッシュ統計
from utils import cache_manager

stats = cache_manager.get_stats()
print(f"ヒット率: {stats.hit_rate:.2%}")
print(f"メモリ使用量: {stats.memory_usage_mb:.2f} MB")
print(f"エントリ数: {stats.entry_count}")

# 最適化キャッシュ統計
from src.api.shopify.optimized_cache_manager import cache_manager as optimized_cache

stats = await optimized_cache.get_stats()
print(f"全体ヒット率: {stats['overall_hit_rate']:.2%}")
print(f"メモリキャッシュ使用量: {stats['levels'][0]['usage_percent']:.2f}%")
print(f"データ種類別統計: {stats['data_type_stats']}")
print(f"平均圧縮率: {stats['levels'][0]['avg_compression_ratio']:.2f}x")
```

## 実装詳細

### スマートキャッシュのコア機能

最適化キャッシュは以下の高度なメカニズムを使用しています：

#### 1. 適応的TTL

データの種類と使用パターンに基づいてTTLを動的に調整します：

```python
def _calculate_adaptive_ttl(self, key: str, data_type: str, base_ttl: float) -> float:
    """Calculate adaptive TTL based on data type and access patterns"""
    # 異なるデータ種類に対するベース乗数
    type_multipliers = {
        "product": 1.5,      # 商品データは変更頻度が低い
        "inventory": 0.5,    # 在庫データは頻繁に変更される
        "customer": 2.0,     # 顧客データはほとんど変更されない
        "order": 1.0,        # 注文データは中程度の安定性
        "analytics": 3.0,    # 分析データは非常に安定
        "settings": 0.3,     # 設定は頻繁に変更される可能性がある
    }
    
    # 種類の乗数を取得（不明な場合は1.0）
    type_multiplier = type_multipliers.get(data_type, 1.0)
    
    # アクセス頻度に基づいて調整
    access_count = self.access_patterns.get(key, 0)
    access_multiplier = min(2.0, 1.0 + (access_count / 50.0))
    
    # 最終的なTTLを計算
    return base_ttl * type_multiplier * access_multiplier
```

#### 2. スマートエビクション

単純なLRUではなく、複数の要素を考慮したスコアリングアルゴリズムを使用します：

```python
# エントリのスコア = (アクセス回数 * ヒット率) / (サイズ * 経過時間)
# これにより、小さくて頻繁にアクセスされる高ヒット率のアイテムが保持されます
score = (metadata.access_count * hit_ratio) / (value.get_size() * age_factor)
```

#### 3. データ圧縮

大きなデータは自動的に圧縮され、メモリ使用量を削減します：

```python
def set_value(self, value: Any, compress: bool = False, compress_threshold: int = 1024):
    """Set or update the cached value with optional compression"""
    # データをシリアライズ
    if isinstance(value, (dict, list, tuple)):
        serialized = pickle.dumps(value)
    elif isinstance(value, str):
        serialized = value.encode('utf-8')
    elif isinstance(value, bytes):
        serialized = value
    else:
        serialized = pickle.dumps(value)
    
    self.original_size = len(serialized)
    
    # 必要に応じて圧縮
    if compress and self.original_size >= compress_threshold:
        self._value = zlib.compress(serialized)
        self.compressed = True
    else:
        self._value = serialized
        self.compressed = False
```

### Redis統合

Redisキャッシュはメモリキャッシュを補完し、より大きなデータセットと長いTTLをサポートします：

```python
def set(self, key: str, value: Any, ttl: Optional[float] = None,
        data_type: str = "unknown", compress: bool = True,
        tags: Optional[List[str]] = None) -> bool:
    """Set value in Redis with metadata"""
    redis_key = f"{self.prefix}{key}"
    meta_key = f"{self.metadata_prefix}{key}"
    
    # データとメタデータをトランザクションで保存
    pipeline = self.redis.pipeline()
    pipeline.setex(redis_key, int(ttl or self.default_ttl), data)
    pipeline.setex(meta_key, int(ttl or self.default_ttl), json.dumps(metadata))
    
    # タグへの参照を保存
    if tags:
        for tag in tags:
            tag_key = f"{self.tag_prefix}{tag}"
            pipeline.sadd(tag_key, key)
            pipeline.expire(tag_key, int(ttl or self.default_ttl))
    
    pipeline.execute()
```

## パフォーマンス最適化のヒント

1. **適切なデータ種類の指定**
   - 正確なデータ種類を指定して適切なTTLとキャッシュ戦略を適用
   - 例：`data_type="product"`（商品）、`data_type="inventory"`（在庫）など

2. **効果的なタグの使用**
   - 関連するデータをタグでグループ化して効率的にインバリデート
   - 例：`tags=["user_123", "dashboard"]`

3. **キャッシュウォームアップ**
   - アプリケーション起動時に頻繁にアクセスされるデータをプリロード
   ```python
   await cache_manager.warm_up(common_queries, fetcher_function)
   ```

4. **圧縮とプリフェッチの調整**
   - 大きなデータセットを処理する場合は圧縮を有効化
   - 予測可能なアクセスパターンがある場合はプリフェッチを有効化

5. **定期的な監視**
   - `get_stats()`を使用してパフォーマンスを定期的に監視
   - ヒット率、メモリ使用量、エビクション数などの指標を追跡

## テスト

キャッシュのパフォーマンスをテストするには：

```bash
# 標準キャッシュテスト
python test_cache_performance.py

# 最適化キャッシュテスト
pytest tests/api/shopify/test_optimized_cache_manager.py
```

## 将来の拡張

1. **AIベースの予測的キャッシング**
   - 使用パターンを学習し、必要なデータを予測的にキャッシュ

2. **分散コンセンサスプロトコル**
   - 複数インスタンス間でのキャッシュ整合性を確保

3. **キャッシュアナライザー**
   - キャッシュパフォーマンスを分析し、最適化の提案を生成するツール

4. **カスタムシリアライザ**
   - データ種類ごとに最適化されたシリアライゼーション方式