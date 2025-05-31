# OptimizedCacheManager 運用ガイドライン

本ドキュメントはOptimizedCacheManagerの日常的な運用、定期メンテナンス、およびインシデント対応のためのガイドラインです。

## 目次

1. [日常運用](#日常運用)
2. [定期メンテナンス](#定期メンテナンス)
3. [キャパシティプランニング](#キャパシティプランニング)
4. [パフォーマンスチューニング](#パフォーマンスチューニング)
5. [インシデント対応](#インシデント対応)
6. [運用コマンドリファレンス](#運用コマンドリファレンス)

## 日常運用

### モニタリングチェック

以下のメトリクスを定期的に確認し、異常がないことを確認してください。

#### 確認頻度: 1日2回（午前/午後）

- **キャッシュヒット率**: 60%以上を維持
  ```bash
  ./scripts/cache-verification/check_metrics.sh --metric=cache_hit_rate --min=60
  ```

- **メモリ使用率**: メモリキャッシュ85%未満、Redis 85%未満
  ```bash
  ./scripts/cache-verification/check_metrics.sh --metric=memory_usage --max=85
  ```

- **エラー発生率**: 1時間あたり5件未満
  ```bash
  ./scripts/cache-verification/check_metrics.sh --metric=error_rate --max=5
  ```

#### 確認頻度: 毎日

- **レスポンス時間**: キャッシュありのレスポンス時間が50ms以下
  ```bash
  ./scripts/cache-verification/check_metrics.sh --metric=response_time --max=50
  ```

- **Redis接続数**: 50未満を維持
  ```bash
  ./scripts/cache-verification/check_metrics.sh --metric=redis_connections --max=50
  ```

### アラート対応

アラートが発生した場合は、以下の手順に従って対応してください。

1. アラートの種類と重要度を確認
2. モニタリングダッシュボードでメトリクスを確認
3. ログファイルを確認
   ```bash
   ./scripts/cache-verification/check_logs.sh --hours=1 --filter="error|exception"
   ```
4. トラブルシューティングガイドに従って対処
5. 必要に応じてエスカレーション

## 定期メンテナンス

### 週次メンテナンス

#### 実施頻度: 毎週（低トラフィック時間帯）

1. **パフォーマンスレポート生成**
   ```bash
   ./scripts/cache-verification/analyze_cache_performance.py --collect --report
   ```

2. **ヒット率の低いキャッシュエントリの確認**
   ```bash
   ./scripts/cache-verification/analyze_hit_rates.sh --min=30
   ```

3. **古いキャッシュエントリのクリーンアップ**
   ```bash
   ./scripts/cache-verification/cleanup_old_entries.sh --days=7
   ```

4. **Redis統計情報の確認**
   ```bash
   ./scripts/cache-verification/check_redis_stats.sh
   ```

### 月次メンテナンス

#### 実施頻度: 毎月（低トラフィック日）

1. **Redis完全クリーンアップ**
   ```bash
   ./scripts/cache-verification/redis_maintenance.sh --full-cleanup
   ```

2. **キャッシュ設定パラメータの見直し**
   ```bash
   ./scripts/cache-verification/review_cache_settings.sh
   ```

3. **月次パフォーマンスレポート生成**
   ```bash
   ./scripts/cache-verification/analyze_cache_performance.py --period=30d --report
   ```

4. **メモリサイズと設定の最適化**
   ```bash
   ./scripts/cache-verification/optimize_memory_settings.sh
   ```

5. **TTL設定の最適化**
   ```bash
   ./scripts/cache-verification/optimize_ttl_settings.sh
   ```

## キャパシティプランニング

### キャパシティ評価

トラフィック増加に伴うキャパシティ要件を評価するためのガイドラインです。

#### メモリ要件計算

1. **1日あたりのキャッシュ操作数を推定**
   ```bash
   ./scripts/cache-verification/estimate_operations.sh --days=30
   ```

2. **平均キャッシュエントリサイズを計算**
   ```bash
   ./scripts/cache-verification/calculate_avg_size.sh
   ```

3. **必要なメモリを予測**
   ```bash
   ./scripts/cache-verification/predict_memory_needs.sh --growth=<予想成長率>
   ```

#### Redis設定

1. **最大メモリ設定**
   ```
   maxmemory <必要メモリ + 20%バッファ>
   ```

2. **接続プールサイズ**
   ```
   接続プールサイズ = max(10, ピーク時リクエスト数 / 10)
   ```

3. **Redisクラスターの検討**
   - 1日あたりの操作数が1000万を超える場合
   - メモリ要件が8GB以上の場合

## パフォーマンスチューニング

### ヒット率の最適化

1. **低ヒット率のキーを特定**
   ```bash
   ./scripts/cache-verification/identify_low_hit_keys.sh
   ```

2. **TTL設定の調整**
   ```bash
   ./scripts/cache-verification/adjust_ttl.sh --pattern=<キーパターン> --multiplier=<乗数>
   ```

3. **キャッシュウォームアップの実装**
   ```bash
   ./scripts/cache-verification/setup_warmup.sh --endpoints=<エンドポイントリスト>
   ```

### メモリ使用量の最適化

1. **大きなエントリを特定**
   ```bash
   ./scripts/cache-verification/identify_large_entries.sh --min-size=100k
   ```

2. **圧縮設定の調整**
   ```bash
   ./scripts/cache-verification/adjust_compression.sh --min-size=10k --algorithm=lz4
   ```

3. **使用頻度の低いエントリの退避ポリシー調整**
   ```bash
   ./scripts/cache-verification/adjust_eviction_policy.sh --access-weight=2 --size-weight=1
   ```

### レスポンス時間の最適化

1. **遅いエンドポイントの特定**
   ```bash
   ./scripts/cache-verification/identify_slow_endpoints.sh
   ```

2. **接続プール設定の調整**
   ```bash
   ./scripts/cache-verification/adjust_pool_settings.sh --min-size=5 --max-size=25
   ```

3. **タイムアウト設定の調整**
   ```bash
   ./scripts/cache-verification/adjust_timeouts.sh --connect=200 --read=500
   ```

## インシデント対応

### レベル1: 軽微な問題

#### 症状:
- キャッシュヒット率が40-60%に低下
- メモリ使用率が75-85%に上昇
- 一時的なエラー増加（5-10/時間）

#### 対応:
1. ログ確認
   ```bash
   ./scripts/cache-verification/check_logs.sh --hours=1
   ```

2. メトリクス詳細確認
   ```bash
   ./scripts/cache-verification/detailed_metrics.sh
   ```

3. 必要に応じてキャッシュパラメータを調整
   ```bash
   ./scripts/cache-verification/adjust_settings.sh --param=<パラメータ> --value=<値>
   ```

### レベル2: 中程度の問題

#### 症状:
- キャッシュヒット率が40%未満に低下
- メモリ使用率が85-95%に上昇
- 持続的なエラー（10-30/時間）
- レスポンス時間が2倍以上に増加

#### 対応:
1. 問題の切り分け
   ```bash
   ./scripts/cache-verification/diagnose_issues.sh
   ```

2. 必要に応じて部分的なキャッシュリセット
   ```bash
   ./scripts/cache-verification/reset_cache.sh --pattern=<問題のキーパターン>
   ```

3. Redis接続とメモリ状態確認
   ```bash
   ./scripts/cache-verification/check_redis_state.sh
   ```

4. キャッシュ設定の一時的な調整
   ```bash
   ./scripts/cache-verification/emergency_adjust.sh
   ```

### レベル3: 重大な問題

#### 症状:
- キャッシュヒット率が20%未満
- メモリ使用率が95%以上
- 多数のエラー（30+/時間）
- レスポンス時間が3倍以上に増加
- アプリケーションの安定性に影響

#### 対応:
1. 緊急キャッシュ無効化
   ```bash
   ./scripts/cache-verification/disable_cache.sh --emergency
   ```

2. アプリケーションの状態確認
   ```bash
   ./scripts/cache-verification/check_app_health.sh
   ```

3. Redisサーバーの再起動検討
   ```bash
   ./scripts/cache-verification/restart_redis.sh
   ```

4. 運用チームとの緊急会議
5. 詳細な分析と根本原因の特定
   ```bash
   ./scripts/cache-verification/root_cause_analysis.sh
   ```

6. 修正と検証後、段階的なキャッシュ再有効化
   ```bash
   ./scripts/cache-verification/reenable_cache.sh --phased
   ```

## 運用コマンドリファレンス

### モニタリングコマンド

| コマンド | 説明 | 使用例 |
|---------|------|-------|
| `start_monitoring.sh` | モニタリングを開始 | `./scripts/cache-verification/start_monitoring.sh` |
| `stop_monitoring.sh` | モニタリングを停止 | `./scripts/cache-verification/stop_monitoring.sh` |
| `check_metrics.sh` | 特定のメトリクスを確認 | `./scripts/cache-verification/check_metrics.sh --metric=cache_hit_rate` |
| `analyze_cache_performance.py` | パフォーマンス分析を実行 | `./scripts/cache-verification/analyze_cache_performance.py --collect --report` |

### 管理コマンド

| コマンド | 説明 | 使用例 |
|---------|------|-------|
| `enable_cache.sh` | キャッシュを有効化 | `./scripts/cache-verification/enable_cache.sh --pattern=<キーパターン>` |
| `disable_cache.sh` | キャッシュを無効化 | `./scripts/cache-verification/disable_cache.sh --pattern=<キーパターン>` |
| `reset_cache.sh` | キャッシュをリセット | `./scripts/cache-verification/reset_cache.sh` |
| `adjust_settings.sh` | キャッシュ設定を調整 | `./scripts/cache-verification/adjust_settings.sh --param=memory_limit --value=256MB` |

### 診断コマンド

| コマンド | 説明 | 使用例 |
|---------|------|-------|
| `check_logs.sh` | ログを確認 | `./scripts/cache-verification/check_logs.sh --hours=2` |
| `diagnose_issues.sh` | 問題の診断 | `./scripts/cache-verification/diagnose_issues.sh` |
| `check_redis_state.sh` | Redis状態の確認 | `./scripts/cache-verification/check_redis_state.sh` |
| `test_cache_operation.sh` | キャッシュ操作のテスト | `./scripts/cache-verification/test_cache_operation.sh --op=get --key=test` |

### 最適化コマンド

| コマンド | 説明 | 使用例 |
|---------|------|-------|
| `optimize_memory_settings.sh` | メモリ設定の最適化 | `./scripts/cache-verification/optimize_memory_settings.sh` |
| `optimize_ttl_settings.sh` | TTL設定の最適化 | `./scripts/cache-verification/optimize_ttl_settings.sh` |
| `adjust_compression.sh` | 圧縮設定の調整 | `./scripts/cache-verification/adjust_compression.sh --algorithm=lz4` |
| `setup_warmup.sh` | ウォームアップの設定 | `./scripts/cache-verification/setup_warmup.sh` |