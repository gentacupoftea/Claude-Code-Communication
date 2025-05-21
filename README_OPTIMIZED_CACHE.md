# OptimizedCacheManager 実装・検証・デプロイガイド

本ドキュメントはShopify MCP Server（Conea）における高度なキャッシュシステムであるOptimizedCacheManagerの実装、検証、デプロイに関する包括的なガイドです。

## 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [主要機能](#主要機能)
4. [実装詳細](#実装詳細)
5. [検証プロセス](#検証プロセス)
6. [デプロイ手順](#デプロイ手順)
7. [モニタリング](#モニタリング)
8. [トラブルシューティング](#トラブルシューティング)
9. [関連ドキュメント](#関連ドキュメント)

## 概要

OptimizedCacheManagerは、従来のCacheManagerを拡張し、より高度なキャッシング機能を提供する多層キャッシュシステムです。メモリキャッシュとRedisキャッシュを組み合わせ、データサイズやアクセスパターンに基づいた適応的なキャッシュ管理を実現します。

## アーキテクチャ

OptimizedCacheManagerは以下の多層アーキテクチャで構成されています：

```
┌──────────────────────────────────────────────────────────┐
│                OptimizedCacheManager                     │
│                                                          │
│  ┌─────────────────────┐        ┌─────────────────────┐  │
│  │   メモリキャッシュ     │        │   Redisキャッシュ    │  │
│  │ (SmartCache - L1)   │<------>│ (RedisSmartCache)   │  │
│  └─────────────────────┘        └─────────────────────┘  │
│                  ▲                        ▲              │
└──────────────────┼────────────────────────┼──────────────┘
                   │                        │
┌──────────────────┼────────────────────────┼──────────────┐
│                  │                        │              │
│  ┌───────────────▼────────────┐   ┌───────▼────────────┐ │
│  │      アプリケーション層      │   │    永続化層        │ │
│  └────────────────────────────┘   └────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 主要機能

OptimizedCacheManagerの主要機能は以下の通りです：

### 1. 適応的TTL管理

- **データタイプベース**：商品データ、在庫データなど、データタイプごとに最適なTTLを設定
- **アクセス頻度ベース**：頻繁にアクセスされるデータは長いTTL、稀にアクセスされるデータは短いTTL
- **データサイズベース**：データサイズに応じたTTL調整（小さいデータは長いTTL、大きいデータは短いTTL）
- **ジッターの追加**：キャッシュスタンピードを防ぐためのランダム化されたTTL

### 2. スマート圧縮戦略

- **適応的アルゴリズム選択**：データサイズに基づいて最適な圧縮アルゴリズムを選択
- **圧縮率の監視**：圧縮効率の監視と自動調整
- **圧縮閾値**：特定のサイズを超えるデータのみ圧縮

### 3. 多層キャッシュ

- **L1（メモリ）キャッシュ**：高速アクセスのためのローカルメモリキャッシュ
- **L2（Redis）キャッシュ**：分散環境での永続性と共有のためのRedisキャッシュ
- **階層的読み取り/書き込み**：効率的なキャッシュフロー管理

### 4. スマートなキャッシュ無効化

- **パターンベースの無効化**：関連するキャッシュエントリを効率的に無効化
- **依存関係ベースの無効化**：関連データの変更時に自動的に無効化
- **タグベースの無効化**：関連するキャッシュエントリをグループ化して無効化

### 5. メモリ管理と負荷分散

- **動的メモリ割り当て**：利用可能なメモリに基づくキャッシュサイズの自動調整
- **スマートな退避戦略**：アクセス頻度、サイズ、年齢に基づく最適なエントリの退避
- **負荷監視**：システムリソースの継続的な監視とキャッシュポリシーの調整

### 6. 耐障害性と回復力

- **接続プール管理**：効率的なRedis接続の管理
- **自動再試行メカニズム**：一時的な障害からの回復
- **フォールバック戦略**：Redisが利用できない場合のメモリキャッシュへのフォールバック

### 7. 詳細なメトリクスと監視

- **キャッシュヒット率の追跡**：全体およびキー別のヒット率の測定
- **メモリ使用量の監視**：メモリ使用量とパターンの詳細な追跡
- **レスポンス時間の測定**：キャッシュの有無によるレスポンス時間の比較
- **Prometheusメトリクス**：標準的な監視システムとの統合

## 実装詳細

OptimizedCacheManagerの実装は以下のコンポーネントで構成されています：

### コアクラス

- **OptimizedCacheManager**：メインインターフェースとロジックを提供
- **SmartCache**：メモリ内キャッシュの実装
- **RedisSmartCache**：Redisベースのキャッシュの実装
- **CacheValue**：TTL、サイズ、アクセス統計情報などのメタデータを含むキャッシュ値のラッパー

### 主要メソッド

- **get(key)**: キャッシュからデータを取得
- **set(key, value, ttl)**: データをキャッシュに保存
- **invalidate(key_pattern)**: パターンに一致するキャッシュエントリを無効化
- **_calculate_adaptive_ttl(...)**: データ特性に基づいてTTLを計算
- **_compress_data(...)**: 最適な圧縮を適用
- **_decompress_data(...)**: データを解凍
- **get_memory_usage()**: 現在のメモリ使用量を取得
- **get_hit_rate()**: キャッシュヒット率を取得
- **get_performance_stats()**: パフォーマンス統計を取得

### コード例：適応的TTL計算

```python
def _calculate_adaptive_ttl(self, key: str, data_type: str, base_ttl: float, data_size: int = 0) -> float:
    # データタイプに基づく乗数
    type_multipliers = {
        "product": 1.5,    # 商品データは変更が少ない
        "inventory": 0.5,  # 在庫データは頻繁に変更される
        "customer": 2.0,   # 顧客データはほとんど変更されない
        # ...その他のデータタイプ
    }
    
    # アクセスパターンに基づく乗数
    access_count = self._access_counters.get(key, 0)
    access_multiplier = min(2.0, 1.0 + (access_count / 100) * 0.5)
    
    # サイズベースの乗数
    size_multiplier = 1.0
    if data_size > 0:
        # 大きなデータは短いTTL（逆相関）
        if data_size < 1024:  # < 1KB
            size_multiplier = 1.2
        elif data_size < 10 * 1024:  # 1-10KB
            size_multiplier = 1.0
        elif data_size < 100 * 1024:  # 10-100KB
            size_multiplier = 0.8
        else:  # > 100KB
            size_multiplier = 0.6
    
    # 種類固有の乗数を取得（存在しない場合はデフォルト値を使用）
    type_multiplier = type_multipliers.get(data_type, 1.0)
    
    # 最終的なTTLをランダム化してキャッシュスタンピードを防止
    ttl = base_ttl * type_multiplier * access_multiplier * size_multiplier
    variation = 1.0 + ((hash(key) % 1000) / 1000.0 - 0.5) * 2 * self.ttl_variation_factor
    ttl *= variation
    
    return ttl
```

## 検証プロセス

検証プロセスは以下のステップで実施します：

1. **環境準備**：検証用のセットアップスクリプトを実行
   ```bash
   ./scripts/cache-verification/setup_verification_env.sh
   ```

2. **Redis接続検証**：Redisへの接続と基本操作を検証
   ```bash
   ./scripts/cache-verification/verify_redis_connection.sh
   ```

3. **基本機能テスト**：基本的なキャッシュ操作をテスト
   ```bash
   ./scripts/cache-verification/test_basic_operations.sh
   ```

4. **パフォーマンス測定**：キャッシュなしの場合とキャッシュありの場合のパフォーマンスを比較
   ```bash
   ./scripts/cache-verification/measure_endpoints.sh
   ```

5. **持続的な負荷テスト**：長時間の負荷下でのキャッシュ性能と安定性をテスト
   ```bash
   ./scripts/cache-verification/run_load_test.sh
   ```

6. **結果分析**：パフォーマンスデータを分析し、改善点を特定
   ```bash
   ./scripts/cache-verification/analyze_cache_performance.py
   ```

## デプロイ手順

デプロイは段階的に行い、各段階で問題がないことを確認します。詳細は[デプロイチェックリスト](./docs/OPTIMIZED_CACHE_DEPLOYMENT_CHECKLIST.md)を参照してください。

1. **ステージング環境への展開**：
   ```bash
   ./scripts/cache-verification/deploy.sh --env=staging
   ```

2. **本番環境への部分展開（フェーズ1 - 読み取り専用エンドポイント、10%トラフィック）**：
   ```bash
   ./scripts/cache-verification/deploy.sh --env=production --phase=1
   ```

3. **本番環境への部分展開（フェーズ2 - 読み取り専用100%、書き込み10%）**：
   ```bash
   ./scripts/cache-verification/deploy.sh --env=production --phase=2
   ```

4. **本番環境への完全展開（フェーズ3 - すべて100%）**：
   ```bash
   ./scripts/cache-verification/deploy.sh --env=production --phase=3
   ```

各デプロイフェーズ後は、[モニタリングダッシュボード](#モニタリング)で状況を確認し、問題があれば[ロールバック手順](#ロールバック手順)を実行します。

### ロールバック手順

問題が発生した場合は、以下のコマンドでロールバックします：

```bash
./scripts/cache-verification/rollback_cache.sh --phase=<現在のフェーズ>
```

## モニタリング

モニタリングは以下のツールとスクリプトで行います：

1. **モニタリングのセットアップ**：
   ```bash
   ./scripts/cache-verification/setup_monitoring_dashboard.sh
   ```

2. **モニタリングの開始**：
   ```bash
   ./scripts/cache-verification/start_monitoring.sh
   ```

3. **グラフィカルダッシュボード**：
   - Grafana: http://localhost:3000
   - Prometheus: http://localhost:9090

4. **メトリクス収集と分析**：
   ```bash
   ./scripts/cache-verification/analyze_cache_performance.py --collect --report
   ```

詳細なモニタリング情報は[モニタリングガイド](./docs/OPTIMIZED_CACHE_MONITORING.md)を参照してください。

## トラブルシューティング

発生する可能性のある一般的な問題とその解決策は[トラブルシューティングガイド](./docs/OPTIMIZED_CACHE_TROUBLESHOOTING.md)を参照してください。

### 一般的な問題

1. **キャッシュヒット率が低い**：
   - TTL設定が短すぎないか確認
   - キャッシュキー生成の一貫性を確認
   - キャッシュウォームアップを検討

2. **メモリ使用量が多い**：
   - TTL値を短くする
   - 大きなオブジェクトの圧縮設定を確認
   - キャッシュサイズ上限を調整

3. **Redis接続エラー**：
   - Redis設定（ホスト、ポート、認証）を確認
   - 接続プールの設定を確認
   - ネットワーク接続を確認

4. **キャッシュの整合性問題**：
   - 無効化ロジックを確認
   - 依存関係の設定を確認
   - 必要に応じてTTLを短くする

## 関連ドキュメント

- [OptimizedCacheManager デプロイチェックリスト](./docs/OPTIMIZED_CACHE_DEPLOYMENT_CHECKLIST.md)
- [OptimizedCacheManager モニタリングガイド](./docs/OPTIMIZED_CACHE_MONITORING.md)
- [OptimizedCacheManager トラブルシューティング](./docs/OPTIMIZED_CACHE_TROUBLESHOOTING.md)
- [パフォーマンステスト結果](./docs/OPTIMIZED_CACHE_PERFORMANCE_RESULTS.md)