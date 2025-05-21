# OptimizedCacheManager トラブルシューティングガイド

このドキュメントでは、OptimizedCacheManagerの導入・運用時に発生する可能性のある問題と、その解決方法について説明します。

## 目次

1. [キャッシュヒット率が低い](#1-キャッシュヒット率が低い)
2. [メモリ使用量の問題](#2-メモリ使用量の問題)
3. [Redis接続問題](#3-redis接続問題)
4. [キャッシュ整合性の問題](#4-キャッシュ整合性の問題)
5. [パフォーマンス低下](#5-パフォーマンス低下)
6. [エラーログと診断](#6-エラーログと診断)
7. [ロールバック手順](#7-ロールバック手順)

## 1. キャッシュヒット率が低い

### 症状
- キャッシュヒット率が40%未満
- リクエスト応答時間に改善が見られない
- API呼び出し削減率が低い

### 原因と診断
1. **TTL設定が短すぎる**
   ```bash
   # キャッシュ設定を確認
   curl -s -X GET "$API_URL/api/admin/cache/status" | jq .
   ```

2. **キー生成戦略の問題**
   ```bash
   # キャッシュキーの生成ログを確認
   curl -s -X GET "$API_URL/api/admin/logs/search?pattern=cache_key&hours=1" | jq .
   ```

3. **不適切なキャッシュ無効化**
   ```bash
   # キャッシュ無効化回数を確認
   curl -s -X GET "$API_URL/api/admin/cache/stats" | jq '.metrics.cache_invalidations'
   ```

### 解決策

1. **TTL設定の調整**
   ```bash
   # データ種類ごとのTTLを延長
   cat > cache_config.json << EOF
   {
     "enabled": true,
     "log_level": "debug",
     "endpoints": "all",
     "memory_settings": {
       "memory_size": 50000000,
       "memory_ttl": 600,
       "enable_compression": true
     },
     "redis_settings": {
       "redis_size": 500000000,
       "redis_ttl": 7200
     }
   }
   EOF
   
   curl -s -X POST "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @cache_config.json
   ```

2. **キャッシュウォームアップの実施**
   ```python
   # よく使われるクエリのウォームアップスクリプト例
   import asyncio
   from src.api.shopify.optimized_cache_manager import cache_manager
   from src.api.shopify.client import fetch_data

   async def warm_up_cache():
       common_queries = [
           ("query { products(first: 10) { edges { node { id title } } } }", {}),
           ("query { orders(first: 10) { edges { node { id orderNumber } } } }", {}),
           # その他の一般的なクエリ
       ]
       await cache_manager.warm_up(common_queries, fetch_data)

   asyncio.run(warm_up_cache())
   ```

3. **不適切な無効化の特定と修正**
   ```bash
   # 無効化パターンの見直し
   grep -r "invalidate" --include="*.py" /path/to/codebase
   
   # より粒度の細かい無効化戦略の実装例
   await cache_manager.invalidate(tags=["specific-product-123"])  # 広範囲な無効化を避ける
   ```

## 2. メモリ使用量の問題

### 症状
- メモリ使用率が90%以上
- OOMエラーが発生
- キャッシュエビクションが頻繁に発生

### 原因と診断

1. **キャッシュサイズの上限が小さすぎる/大きすぎる**
   ```bash
   # メモリ使用状況を確認
   curl -s -X GET "$API_URL/api/admin/resources/memory" | jq .
   
   # キャッシュメモリ使用状況を確認
   curl -s -X GET "$API_URL/api/admin/cache/stats" | jq '.levels[] | select(.name=="memory")'
   ```

2. **大きなオブジェクトが多すぎる**
   ```bash
   # キャッシュエントリサイズ分布を確認
   curl -s -X GET "$API_URL/api/admin/cache/stats/detailed" | jq '.size_distribution'
   ```

3. **圧縮が効いていない**
   ```bash
   # 圧縮率を確認
   curl -s -X GET "$API_URL/api/admin/cache/stats" | jq '.levels[].avg_compression_ratio'
   ```

### 解決策

1. **キャッシュサイズの調整**
   ```bash
   # メモリキャッシュサイズを調整（システムメモリの20%程度を目安に）
   cat > cache_size_update.json << EOF
   {
     "memory_settings": {
       "memory_size": 100000000
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @cache_size_update.json
   ```

2. **大きなオブジェクトのTTL短縮**
   ```bash
   # データサイズに基づくTTL調整を有効化
   cat > size_based_ttl.json << EOF
   {
     "features": {
       "size_based_ttl": true,
       "size_ttl_factor": 0.7
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @size_based_ttl.json
   ```

3. **圧縮設定の改善**
   ```bash
   # 圧縮設定を最適化
   cat > compression_config.json << EOF
   {
     "memory_settings": {
       "enable_compression": true,
       "compression_algorithm": "lz4",
       "compression_threshold": 512
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @compression_config.json
   ```

4. **不要なデータのキャッシュ除外**
   ```bash
   # 特定のデータ種類をキャッシュから除外
   cat > cache_exclusions.json << EOF
   {
     "exclude_patterns": [
       "large_analytics_report",
       "historical_data_dump"
     ]
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @cache_exclusions.json
   ```

## 3. Redis接続問題

### 症状
- Redis接続エラーログが発生
- L2キャッシュ（Redis）からのデータ取得失敗
- 接続プールが枯渇している

### 原因と診断

1. **Redis接続数が上限に達している**
   ```bash
   # Redis接続情報を確認
   curl -s -X GET "$API_URL/api/admin/redis/info" | jq '.["connected_clients"], .["maxclients"]'
   ```

2. **接続タイムアウト問題**
   ```bash
   # タイムアウトに関するエラーログを確認
   curl -s -X GET "$API_URL/api/admin/logs/search?pattern=redis.*timeout&hours=1" | jq .
   ```

3. **Redis認証問題**
   ```bash
   # 認証に関するエラーログを確認
   curl -s -X GET "$API_URL/api/admin/logs/search?pattern=redis.*auth&hours=1" | jq .
   ```

### 解決策

1. **接続プール設定の調整**
   ```bash
   # Redis接続プール設定を調整
   cat > redis_pool_config.json << EOF
   {
     "redis_settings": {
       "redis_pool_size": 20,
       "redis_connect_timeout": 1.5,
       "redis_read_timeout": 1.0,
       "redis_retry_count": 3,
       "redis_retry_backoff": 0.1
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @redis_pool_config.json
   ```

2. **接続エラー処理の改善**
   ```python
   # 接続エラー処理の実装例
   try:
       result = await cache_manager.get("key", {})
   except ConnectionError:
       # メモリキャッシュにフォールバック
       result = await memory_only_cache.get("key", {})
   ```

3. **Redis設定の検証**
   ```bash
   # Redisサーバー設定を確認
   redis-cli -h $REDIS_HOST -p $REDIS_PORT INFO | grep maxclients
   redis-cli -h $REDIS_HOST -p $REDIS_PORT CONFIG GET timeout
   ```

4. **接続タイムアウト検証**
   ```bash
   # タイムアウト問題の検証
   ./verify_redis_connection.sh --env=production
   ```

## 4. キャッシュ整合性の問題

### 症状
- キャッシュからの古いデータの取得
- APIレスポンスとキャッシュデータの不一致
- キャッシュ更新後も古いデータが残る

### 原因と診断

1. **キャッシュ無効化が適切に行われていない**
   ```bash
   # キャッシュ無効化ログを確認
   curl -s -X GET "$API_URL/api/admin/logs/search?pattern=cache_invalidate&hours=1" | jq .
   ```

2. **依存関係ベースの無効化が設定されていない**
   ```bash
   # 依存関係設定を確認
   curl -s -X GET "$API_URL/api/admin/cache/config" | jq '.features.dependency_tracking'
   ```

3. **更新トリガーが発生していない**
   ```bash
   # 更新イベントログを確認
   curl -s -X GET "$API_URL/api/admin/logs/search?pattern=update_event&hours=1" | jq .
   ```

### 解決策

1. **依存関係ベースの無効化を有効化**
   ```bash
   # 依存関係トラッキングを有効化
   cat > dependency_config.json << EOF
   {
     "features": {
       "dependency_tracking": true
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @dependency_config.json
   ```

2. **明示的な関連キャッシュ無効化の追加**
   ```python
   # 関連データの無効化実装例
   async def update_product(product_id, data):
       # 製品の更新
       result = await api.update_product(product_id, data)
       
       # 関連キャッシュの無効化
       await cache_manager.invalidate(tags=[f"product-{product_id}"])
       await cache_manager.invalidate(tags=["product-list"])
       await cache_manager.invalidate(tags=[f"inventory-{product_id}"])
       
       return result
   ```

3. **TTLの短縮（一時的解決策）**
   ```bash
   # TTLを短縮して強制的に更新を促進
   cat > shorter_ttl.json << EOF
   {
     "memory_settings": {
       "memory_ttl": 120
     },
     "redis_settings": {
       "redis_ttl": 600
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @shorter_ttl.json
   ```

4. **キャッシュクリア**
   ```bash
   # 特定のパターンのキャッシュをクリア
   curl -s -X POST "$API_URL/api/admin/cache/clear?pattern=product*"
   
   # すべてのキャッシュをクリア（緊急時のみ）
   curl -s -X POST "$API_URL/api/admin/cache/clear/all"
   ```

## 5. パフォーマンス低下

### 症状
- キャッシュヒット率は高いのにレスポンスタイムが改善しない
- キャッシュ操作自体が遅い
- 特定のエンドポイントでのみパフォーマンスが低下

### 原因と診断

1. **キャッシュキーの衝突**
   ```bash
   # キャッシュキー分布を確認
   curl -s -X GET "$API_URL/api/admin/cache/stats/detailed" | jq '.key_distribution'
   ```

2. **圧縮/解凍のオーバーヘッド**
   ```bash
   # 圧縮統計を確認
   curl -s -X GET "$API_URL/api/admin/cache/stats" | jq '.compression_stats'
   ```

3. **Redisレイテンシの問題**
   ```bash
   # Redisレイテンシを確認
   redis-cli -h $REDIS_HOST -p $REDIS_PORT --latency
   ```

### 解決策

1. **キャッシュ戦略の最適化**
   ```bash
   # データ種類に基づくキャッシュ層の最適化
   cat > cache_strategy.json << EOF
   {
     "type_strategy": {
       "product": {"use_memory": true, "use_redis": true},
       "inventory": {"use_memory": true, "use_redis": false},
       "analytics": {"use_memory": false, "use_redis": true}
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @cache_strategy.json
   ```

2. **圧縮設定の最適化**
   ```bash
   # データサイズに基づく圧縮アルゴリズム選択
   cat > compression_optimize.json << EOF
   {
     "compression_settings": {
       "small_data": {"enabled": false},
       "medium_data": {"enabled": true, "algorithm": "lz4"},
       "large_data": {"enabled": true, "algorithm": "zlib"}
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @compression_optimize.json
   ```

3. **レイテンシの高いキャッシュ層の無効化**
   ```bash
   # Redis接続に問題がある場合、一時的にメモリキャッシュのみに切り替え
   cat > memory_only.json << EOF
   {
     "redis_settings": {
       "enabled": false
     },
     "memory_settings": {
       "memory_size": 100000000,
       "memory_ttl": 600
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @memory_only.json
   ```

4. **インデックスベースアクセスの実装**
   ```python
   # インデックスベースアクセスの実装例
   async def get_products_by_collection(collection_id):
       # コレクションインデックスキーを取得
       index_key = f"collection_products_index:{collection_id}"
       product_ids = await cache_manager.get(index_key, {})
       
       if not product_ids:
           # インデックスがキャッシュにない場合は取得してキャッシュ
           product_ids = await fetch_product_ids_for_collection(collection_id)
           await cache_manager.set(index_key, {}, product_ids, 
                                  ttl=3600, tags=[f"collection-{collection_id}"])
       
       # インデックスを使用して個別の製品データを取得
       products = []
       for pid in product_ids:
           product = await get_product(pid)
           products.append(product)
       
       return products
   ```

## 6. エラーログと診断

### 一般的なエラーログと対処法

1. **`RedisConnectionError`**
   
   原因: Redisサーバーへの接続ができない
   
   対処法:
   ```bash
   # Redis接続を確認
   ./verify_redis_connection.sh --env=production
   
   # 接続設定を調整
   cat > redis_connection_fix.json << EOF
   {
     "redis_settings": {
       "redis_connect_timeout": 2.0,
       "redis_retry_count": 5
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @redis_connection_fix.json
   ```

2. **`MemoryError` または `OutOfMemoryError`**
   
   原因: キャッシュが多くのメモリを消費している
   
   対処法:
   ```bash
   # メモリキャッシュサイズを削減
   cat > reduce_memory.json << EOF
   {
     "memory_settings": {
       "memory_size": 25000000,
       "aggressive_eviction": true
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @reduce_memory.json
   ```

3. **`CacheSerializationError`**
   
   原因: オブジェクトをシリアライズできない
   
   対処法:
   ```bash
   # シリアライズ設定を調整
   cat > serialization_fix.json << EOF
   {
     "features": {
       "fallback_serialization": true,
       "skip_unserializable": true
     }
   }
   EOF
   
   curl -s -X PATCH "$API_URL/api/admin/cache/config" -H "Content-Type: application/json" -d @serialization_fix.json
   ```

### 診断ツール

1. **キャッシュ統計ダンプ**
   ```bash
   # 詳細なキャッシュ統計を収集
   curl -s -X GET "$API_URL/api/admin/cache/stats/detailed" > cache_stats_$(date +%Y%m%d_%H%M%S).json
   
   # 統計分析
   jq '.levels[].hit_rate, .levels[].usage_percent, .data_type_stats' cache_stats_*.json
   ```

2. **キャッシュアクセスパターン分析**
   ```bash
   # ホットキーを特定
   curl -s -X GET "$API_URL/api/admin/cache/stats" | jq '.levels[].hot_keys'
   
   # アクセスパターン分析
   curl -s -X GET "$API_URL/api/admin/cache/stats/detailed" | jq '.access_patterns'
   ```

3. **メモリプロファイリング**
   ```bash
   # メモリ使用状況の詳細を確認
   curl -s -X GET "$API_URL/api/admin/diagnostics/memory" > memory_profile_$(date +%Y%m%d_%H%M%S).json
   ```

## 7. ロールバック手順

### 完全ロールバック手順

キャッシュ機能に重大な問題が発生した場合は、以下の手順でロールバックを実施します：

```bash
# 1. キャッシュシステムの状態をスナップショット（分析用）
curl -s -X GET "$API_URL/api/admin/cache/stats" > cache_stats_before_rollback_$(date +%Y%m%d_%H%M%S).json

# 2. キャッシュを完全に無効化
./rollback_cache.sh --env=production --phase=complete

# 3. システム健全性を確認
./verify_system_health.sh --env=production --components=all

# 4. ログに記録
echo "キャッシュシステムを $(date) にロールバックしました。理由: [問題の詳細]" >> cache_rollback_history.log
```

### フェーズ単位ロールバック

特定のフェーズでのみ問題が発生した場合は、そのフェーズのみロールバックします：

```bash
# 現在のフェーズを検出してロールバック
./rollback_cache.sh --env=production --phase=current

# システム健全性を確認
./verify_system_health.sh --env=production --components=all
```

### 緊急時のキャッシュクリア

キャッシュデータの整合性に問題があるが、機能自体は維持したい場合：

```bash
# キャッシュデータのみをクリア
curl -s -X POST "$API_URL/api/admin/cache/clear/all"

# または特定の種類のキャッシュのみをクリア
curl -s -X POST "$API_URL/api/admin/cache/clear?data_type=product"
```

---

このトラブルシューティングガイドを参照することで、OptimizedCacheManagerの運用時に発生する可能性のある問題に対処できます。問題が解決しない場合は、詳細なログとシステム状態を収集し、開発チームに報告してください。