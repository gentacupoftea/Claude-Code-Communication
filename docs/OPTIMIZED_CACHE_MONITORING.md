# OptimizedCacheManager モニタリングガイド

このドキュメントでは、OptimizedCacheManagerのパフォーマンスと健全性を監視するためのツールと手順について説明します。

## 目次

1. [モニタリング設定](#モニタリング設定)
2. [主要メトリクス](#主要メトリクス)
3. [ダッシュボードの見方](#ダッシュボードの見方)
4. [アラート設定](#アラート設定)
5. [トラブルシューティング](#トラブルシューティング)
6. [メトリクス収集の仕組み](#メトリクス収集の仕組み)

## モニタリング設定

### 前提条件

- Docker
- Docker Compose

### セットアップ手順

```bash
# モニタリングダッシュボードのセットアップ
./scripts/cache-verification/setup_monitoring_dashboard.sh

# モニタリングの開始
./scripts/cache-verification/start_monitoring.sh

# モニタリングの停止
./scripts/cache-verification/stop_monitoring.sh
```

### アクセス情報

- **Grafana**: http://localhost:3000 
  - ユーザー名: `admin`
  - パスワード: `conea_cache_admin`
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## 主要メトリクス

以下の主要なメトリクスを監視しています：

### パフォーマンスメトリクス

| メトリクス名 | 説明 | 最適値 | 警告レベル | クリティカルレベル |
|-------------|------|--------|-----------|---------------|
| `cache_hit_rate` | キャッシュヒット率 (%) | > 80% | < 60% | < 40% |
| `cache_response_time` | キャッシュ使用時のレスポンス時間 (ms) | < 50ms | > 100ms | > 200ms |
| `uncached_response_time` | キャッシュなしのレスポンス時間 (ms) | < 500ms | > 1000ms | > 2000ms |

### リソース使用量メトリクス

| メトリクス名 | 説明 | 最適値 | 警告レベル | クリティカルレベル |
|-------------|------|--------|-----------|---------------|
| `cache_memory_usage` | メモリキャッシュ使用量 (MB) | < 70% | > 85% | > 95% |
| `redis_memory_used` | Redis使用メモリ (MB) | < 70% | > 85% | > 95% |
| `redis_connections` | Redis接続数 | < 30 | > 50 | > 80 |

### オペレーションメトリクス

| メトリクス名 | 説明 | 参考情報 |
|-------------|------|---------|
| `cache_operations_total{operation="get"}` | GETオペレーションの合計数 | トラフィックパターンの分析に使用 |
| `cache_operations_total{operation="set"}` | SETオペレーションの合計数 | 書き込み負荷の分析に使用 |
| `cache_operations_total{operation="invalidate"}` | 無効化オペレーションの合計数 | キャッシュ無効化頻度の監視に使用 |
| `cache_error_count` | キャッシュエラーの合計数 | エラー傾向の監視に使用 |

## ダッシュボードの見方

### キャッシュヒット率パネル

- **正常**: 80%以上の安定したヒット率は最適
- **調査が必要**: 60%未満の場合、以下を確認：
  - TTL設定が適切か
  - キャッシュキー生成が一貫しているか
  - 無効化が適切に行われているか

### レスポンス時間パネル

- **キャッシュあり/なしの比較**: キャッシュ使用時のレスポンス時間は、キャッシュなしの場合と比較して大幅に短くなるはずです
- **調査が必要**: キャッシュありの時間が100ms以上、または急激な増加が見られる場合
  - Redis接続の状態
  - ネットワークレイテンシ
  - データサイズの問題

### メモリ使用量パネル

- **使用率の監視**: メモリ使用量と設定された上限を比較
- **調査が必要**: 85%以上の場合
  - キャッシュサイズ設定の見直し
  - TTLの短縮を検討
  - 大きなオブジェクトのキャッシング戦略を見直し

### Redisメモリパネル

- **使用率の監視**: Redis使用メモリと最大メモリを比較
- **調査が必要**: 85%以上の場合
  - `maxmemory` 設定の増加
  - 削除ポリシーの見直し

### キャッシュ操作数パネル

- **操作バランス**: GET/SET/INVALIDATE操作の比率を確認
- **パターン分析**: 時間帯による変化やスパイクの確認

### エラー数パネル

- **エラートレンド**: エラー数の急増は問題の兆候
- **調査が必要**: 短時間での多数のエラー発生時

## アラート設定

以下のアラートが設定されています：

### LowCacheHitRate

- **条件**: キャッシュヒット率が60%未満
- **期間**: 5分間
- **重要度**: 警告
- **対応策**:
  1. TTL設定を確認
  2. キャッシュの暖機を検討
  3. 無効化ロジックを見直し

### HighMemoryUsage

- **条件**: メモリキャッシュ使用率が85%以上
- **期間**: 5分間
- **重要度**: 警告
- **対応策**:
  1. キャッシュサイズを増加
  2. TTL値を短縮
  3. 優先度の低いデータのキャッシュを制限

### HighRedisMemoryUsage

- **条件**: Redisメモリ使用率が85%以上
- **期間**: 5分間
- **重要度**: 警告
- **対応策**:
  1. Redisの`maxmemory`設定を増加
  2. 削除ポリシーを調整 (例: `volatile-lru`)
  3. キーの有効期限を短縮

### CacheErrorSpike

- **条件**: 5分間のエラー発生率が5以上
- **期間**: 1分間
- **重要度**: クリティカル
- **対応策**:
  1. ログを詳細に確認
  2. Redis接続状態を確認
  3. メモリ圧迫や接続タイムアウトの可能性を調査

### RedisConnectionsHigh

- **条件**: Redis接続数が50を超える
- **期間**: 5分間
- **重要度**: 警告
- **対応策**:
  1. 接続プール設定を確認
  2. 接続リークの可能性を調査
  3. コネクション再利用を確認

### SlowCacheResponse

- **条件**: キャッシュ使用時のレスポンス時間が100msを超える
- **期間**: 5分間
- **重要度**: 警告
- **対応策**:
  1. Redisレイテンシを確認
  2. ネットワーク負荷を確認
  3. データサイズとシリアライズ方法を見直し

## トラブルシューティング

### ダッシュボードが表示されない

1. Docker コンテナが実行中か確認:
   ```bash
   docker ps | grep conea
   ```

2. ログを確認:
   ```bash
   docker logs conea-grafana
   docker logs conea-prometheus
   ```

3. ネットワーク接続を確認:
   ```bash
   curl -I http://localhost:3000
   curl -I http://localhost:9090
   ```

### メトリクスが表示されない

1. OptimizedCacheManagerのexporterが正しく設定されているか確認
2. アプリケーションサーバーの起動ログでエクスポーター初期化を確認
3. Prometheusターゲットの状態を確認:
   ```
   http://localhost:9090/targets
   ```

### アラートが機能しない

1. Alertmanagerの設定を確認
2. Prometheusアラートルールの状態を確認:
   ```
   http://localhost:9090/alerts
   ```
3. 通知先（メール、Slack等）の設定を確認

## メトリクス収集の仕組み

### アーキテクチャ

```
┌─────────────────┐      ┌─────────────┐      ┌────────────┐
│ OptimizedCache  │──┬──>│ Prometheus  │─────>│  Grafana   │
│    Manager      │  │   │             │      │            │
└─────────────────┘  │   └─────────────┘      └────────────┘
                     │          │                    │
                     │          V                    │
                     │   ┌─────────────┐             │
                     └──>│AlertManager │<────────────┘
                         └─────────────┘
```

### メトリクスエクスポーター

`CacheMetricsExporter`クラスは以下の機能を提供します：

1. OptimizedCacheManagerからメトリクスを収集
2. PrometheusでHTTPエンドポイント（`/metrics`）を公開
3. GET/SET/INVALIDATE操作の追跡
4. エラー発生の記録

### 統合方法

アプリケーションの起動時に以下のようにメトリクスエクスポーターを設定します：

```python
from src.api.shopify.optimized_cache_manager import OptimizedCacheManager
from src.metrics.prometheus_exporter import CacheMetricsExporter

# キャッシュマネージャーのインスタンス
cache_manager = OptimizedCacheManager()

# メトリクスエクスポーターを初期化して開始
metrics = CacheMetricsExporter(
    cache_manager=cache_manager,
    port=8000
)
metrics.start()
```

さらに詳細な統合方法については、`cache_metrics_integration.py`サンプルファイルを参照してください。