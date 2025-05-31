# OptimizedCacheManager クイックスタートガイド

このガイドでは、OptimizedCacheManagerを素早く導入して効果的に活用するための基本的な手順を説明します。

## 目次

1. [概要](#概要)
2. [インストール](#インストール)
3. [基本的な使用方法](#基本的な使用方法)
4. [設定オプション](#設定オプション)
5. [性能チューニング](#性能チューニング)
6. [モニタリング](#モニタリング)
7. [トラブルシューティング](#トラブルシューティング)
8. [次のステップ](#次のステップ)

## 概要

OptimizedCacheManagerは、以下の特長を持つ高度なキャッシュシステムです：

- **多層キャッシュアーキテクチャ** - メモリとRedisの2層構造
- **適応的なTTL管理** - データ特性に基づく最適な有効期限
- **スマートな圧縮戦略** - データサイズに応じた最適化
- **堅牢なエラー処理** - 一時的な障害からの回復機能
- **詳細なモニタリング** - パフォーマンス指標の可視化

## インストール

### 前提条件

- Python 3.9以上
- Redis 6.0以上（オプション、ただし推奨）

### セットアップ

1. レポジトリをクローン：
   ```bash
   git clone https://github.com/yourusername/shopify-mcp-server.git
   cd shopify-mcp-server
   ```

2. 必要なパッケージをインストール：
   ```bash
   pip install -r requirements.txt
   ```

3. Redis設定（オプション）：
   ```bash
   # Redisがインストールされていない場合（例：MacOS）
   brew install redis
   brew services start redis
   
   # または、Docker
   docker run -d -p 6379:6379 redis:6-alpine
   ```

## 基本的な使用方法

### コードでの使用例

```python
from src.api.shopify.optimized_cache_manager import OptimizedCacheManager

# キャッシュマネージャーのインスタンス化
cache = OptimizedCacheManager()

# キーと値をキャッシュに保存（TTL: 60秒）
cache.set('example:key', {'name': 'Example Value'}, 60)

# キャッシュから値を取得
value = cache.get('example:key')
print(value)  # {'name': 'Example Value'}

# キャッシュからキーを削除
cache.invalidate('example:key')

# すべてのキャッシュをクリア
cache.invalidate()
```

### REST APIを使ったアクセス

1. APIサーバーを起動：
   ```bash
   python src/api/cache_api.py
   ```

2. APIを使用：
   ```bash
   # キャッシュに値を設定
   curl -X POST -H "Content-Type: application/json" \
        -d '{"value": {"name": "Example Value"}, "ttl": 60}' \
        http://localhost:8000/api/cache/key/example:key
   
   # キャッシュから値を取得
   curl http://localhost:8000/api/cache/key/example:key
   
   # キャッシュ統計を取得
   curl http://localhost:8000/api/cache/stats
   
   # キャッシュから値を削除
   curl -X DELETE http://localhost:8000/api/cache/key/example:key
   ```

3. Pythonクライアントでアクセス：
   ```python
   from src.api.cache_client import CacheClient
   
   client = CacheClient("http://localhost:8000")
   client.set("example:key", {"name": "Example Value"}, 60)
   value = client.get("example:key")
   ```

## 設定オプション

OptimizedCacheManagerは以下の設定パラメータをサポートしています：

### 基本設定

```python
cache = OptimizedCacheManager(
    # メモリキャッシュの最大サイズ (バイト)
    memory_limit=256 * 1024 * 1024,  # 256MB
    
    # デフォルトのTTL (秒)
    default_ttl=300,  # 5分
    
    # TTLバリエーション係数 (キャッシュスタンピード防止)
    ttl_variation_factor=0.1,  # ±10%
    
    # Redis接続設定
    redis_enabled=True,
    redis_host="localhost",
    redis_port=6379,
    redis_password=None,
    
    # データ圧縮設定
    compression_enabled=True,
    compression_min_size=1024,  # 1KB以上のデータを圧縮
)
```

### 設定ファイルを使った構成

`config/cache_config.json`：

```json
{
  "memory_limit": 268435456,
  "default_ttl": 300,
  "ttl_variation_factor": 0.1,
  "redis_enabled": true,
  "redis_host": "localhost",
  "redis_port": 6379,
  "compression_enabled": true,
  "compression_min_size": 1024
}
```

設定ファイルの読み込み：

```python
import json

def load_config(config_file):
    with open(config_file, 'r') as f:
        return json.load(f)

config = load_config('config/cache_config.json')
cache = OptimizedCacheManager(**config)
```

## 性能チューニング

### メモリ使用量の最適化

1. メモリ上限の調整：
   ```python
   # 利用可能なメモリの30%をキャッシュに割り当て
   import psutil
   available_memory = psutil.virtual_memory().available
   memory_limit = int(available_memory * 0.3)
   
   cache = OptimizedCacheManager(memory_limit=memory_limit)
   ```

2. 圧縮設定の最適化：
   ```python
   # 大きなデータのみ圧縮（10KB以上）
   cache = OptimizedCacheManager(
       compression_enabled=True,
       compression_min_size=10 * 1024
   )
   ```

### TTL戦略の最適化

1. データ型別のTTL設定：
   - 商品データ（変更頻度が低い）：長いTTL
   - 在庫データ（変更頻度が高い）：短いTTL

2. アクセス頻度に基づくTTL設定：
   - 頻繁にアクセスされるデータ：長いTTL
   - 稀にアクセスされるデータ：短いTTL

3. データサイズに基づくTTL設定：
   - 小さなデータ：長いTTL
   - 大きなデータ：短いTTL

### Redis設定の最適化

```python
cache = OptimizedCacheManager(
    redis_enabled=True,
    redis_pool_min_size=5,
    redis_pool_max_size=20,
    redis_connection_timeout=2.0,
    redis_read_timeout=1.0,
    redis_retry_on_timeout=True,
    redis_max_retries=3
)
```

## モニタリング

### モニタリングダッシュボードの設定

```bash
# モニタリングダッシュボードのセットアップ
./scripts/cache-verification/setup_monitoring_dashboard.sh

# モニタリングの開始
./scripts/cache-verification/start_monitoring.sh
```

ダッシュボードへのアクセス：
- Grafana: http://localhost:3000 (ユーザー: admin, パスワード: conea_cache_admin)
- Prometheus: http://localhost:9090

### パフォーマンス分析

```bash
# メトリクスの収集と分析
python scripts/cache-verification/analyze_cache_performance.py --collect --report

# ベンチマークの実行
python scripts/cache-verification/benchmark.py --iterations 10000 --warmup 1000 --concurrency 8
```

### 負荷テスト

```bash
# APIサーバーの起動
python src/api/cache_api.py

# 負荷テストの実行
python scripts/cache-verification/load_tester.py --workers 8 --duration 300 --ops-per-sec 50
```

## トラブルシューティング

### 一般的な問題

1. **キャッシュヒット率が低い**
   - TTL設定が短すぎないか確認
   - キャッシュキー生成の一貫性を確認
   ```bash
   # ヒット率の確認
   curl http://localhost:8000/api/cache/stats | grep hit_rate
   ```

2. **メモリ使用量が多い**
   - TTL値を短くする
   - 大きなオブジェクトの圧縮設定を確認
   ```bash
   # メモリ使用量の確認
   curl http://localhost:8000/api/cache/stats | grep memory_usage
   ```

3. **Redis接続エラー**
   - Redis設定（ホスト、ポート、認証）を確認
   - Redis稼働状態を確認
   ```bash
   # Redis接続テスト
   redis-cli ping
   ```

4. **キャッシュの整合性問題**
   - 無効化ロジックを確認
   - 依存関係の設定を確認
   - 必要に応じてTTLを短くする

### 詳細な診断

詳細なトラブルシューティングについては[トラブルシューティングガイド](./OPTIMIZED_CACHE_TROUBLESHOOTING.md)を参照してください。

## 次のステップ

1. [詳細なドキュメント](#関連ドキュメント)を確認
2. [CI/CDパイプライン](./OPTIMIZED_CACHE_CI_CD.md)の設定
3. [運用ガイドライン](./OPTIMIZED_CACHE_OPERATIONS.md)の実施

### 関連ドキュメント

- [完全な設計仕様書](./README_OPTIMIZED_CACHE.md)
- [デプロイチェックリスト](./OPTIMIZED_CACHE_DEPLOYMENT_CHECKLIST.md)
- [APIリファレンス](./OPTIMIZED_CACHE_API.md)
- [モニタリングガイド](./OPTIMIZED_CACHE_MONITORING.md)
- [トラブルシューティングガイド](./OPTIMIZED_CACHE_TROUBLESHOOTING.md)
- [CI/CDガイド](./OPTIMIZED_CACHE_CI_CD.md)
- [運用ガイドライン](./OPTIMIZED_CACHE_OPERATIONS.md)