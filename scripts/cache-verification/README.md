# OptimizedCacheManager 検証ツール

このディレクトリには、OptimizedCacheManagerの検証、テスト、デプロイ、モニタリングのためのスクリプトとツールが含まれています。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [ディレクトリ構造](#ディレクトリ構造)
4. [使用方法](#使用方法)
5. [Docker環境](#docker環境)
6. [CI/CD統合](#cicd統合)
7. [トラブルシューティング](#トラブルシューティング)

## 概要

OptimizedCacheManagerは高度なキャッシュ管理システムであり、これらのツールはその機能と性能を確実にするために設計されています。主な機能は：

- 機能テスト：基本的なキャッシュ操作の検証
- パフォーマンステスト：レスポンス時間、メモリ使用量、スケーラビリティの測定
- モニタリング：リアルタイムメトリクスの収集と視覚化
- デプロイ：段階的な本番環境へのロールアウト

## 前提条件

- Python 3.9以上
- Redis 6.0以上（テストと本番環境用）
- Docker & Docker Compose（コンテナ化テスト用）
- matplotlib, numpy（グラフ生成用）
- prometheus-client, psutil（メトリクス収集用）

## ディレクトリ構造

```
scripts/cache-verification/
├── automated_verification.sh        # 完全な自動検証スクリプト
├── run_cache_tests.py               # キャッシュテストスイート
├── analyze_cache_performance.py     # パフォーマンス分析ツール
├── run_docker_tests.sh              # Docker環境でのテストツール
├── setup_monitoring_dashboard.sh    # モニタリングダッシュボード設定
├── deploy.sh                        # デプロイスクリプト
├── rollback_cache.sh                # ロールバックスクリプト
├── prepare_metrics_collection.py    # メトリクス収集準備
├── Dockerfile                       # テスト用Dockerfile
├── docker-compose.yml               # Docker Compose設定
├── logs/                            # ログファイル保存ディレクトリ
└── test_results/                    # テスト結果保存ディレクトリ
```

## 使用方法

### 基本テスト

基本的なキャッシュ機能をテストします。

```bash
# 基本的な機能テスト
python run_cache_tests.py --iterations 100 --value-size 1024

# パフォーマンステスト
python run_cache_tests.py --iterations 10000 --value-size 1024 --concurrency 4
```

### 完全な検証

すべてのテストを実行し、包括的な検証を行います。

```bash
./automated_verification.sh
```

### パフォーマンス分析

キャッシュのパフォーマンスメトリクスを収集・分析します。

```bash
# メトリクスの収集と分析
python analyze_cache_performance.py --collect --report

# 特定の期間のメトリクス収集
python analyze_cache_performance.py --period 24h --step 5m --report

# 既存データの視覚化
python analyze_cache_performance.py --visualize test_results/prometheus_metrics_20240520_120000.json
```

### モニタリングの設定

パフォーマンスモニタリングダッシュボードを設定します。

```bash
# モニタリングダッシュボードのセットアップ
./setup_monitoring_dashboard.sh

# モニタリングの開始
./scripts/cache-verification/start_monitoring.sh

# モニタリングの停止
./scripts/cache-verification/stop_monitoring.sh
```

### デプロイ

段階的にキャッシュをデプロイします。

```bash
# ステージング環境へのデプロイ
./deploy.sh --env=staging

# 本番環境への段階的デプロイ
./deploy.sh --env=production --phase=1  # フェーズ1
./deploy.sh --env=production --phase=2  # フェーズ2
./deploy.sh --env=production --phase=3  # フェーズ3

# ロールバック
./rollback_cache.sh --phase=2  # フェーズ2へのロールバック
```

## Docker環境

Docker環境でテストを実行するための方法です。

```bash
# Docker環境でのテスト
./run_docker_tests.sh

# 基本テストのみ実行
./run_docker_tests.sh --basic-only

# パフォーマンステストをスキップ
./run_docker_tests.sh --skip-performance

# Docker環境のクリーンアップ
./run_docker_tests.sh --cleanup-only
```

## CI/CD統合

GitHub Actionsを使用した継続的インテグレーションと継続的デプロイメントの設定です。

```yaml
# GitHub Actions設定ファイル
.github/workflows/cache-verification.yml
```

詳細な設定と使用方法については[CI/CDガイド](/docs/OPTIMIZED_CACHE_CI_CD.md)を参照してください。

## トラブルシューティング

### 一般的な問題

1. **ImportError: OptimizedCacheManagerが見つかりません**
   - プロジェクトルートが環境変数`PYTHONPATH`に含まれていることを確認
   - `src/api/shopify/optimized_cache_manager.py`ファイルが存在することを確認

2. **Redis接続エラー**
   - Redisサーバーが実行中か確認
   - 接続設定（ホスト、ポート、パスワード）が正しいか確認
   - `redis-cli ping`で接続テスト

3. **テスト失敗**
   - ログファイル（`logs/verification.log`）を確認
   - 特定のテストを個別に実行して問題を切り分け

4. **グラフ生成エラー**
   - Python環境に`matplotlib`と`numpy`がインストールされているか確認
   - `pip install matplotlib numpy`で必要なパッケージをインストール

### サポート

詳細なトラブルシューティングについては、[トラブルシューティングガイド](/docs/OPTIMIZED_CACHE_TROUBLESHOOTING.md)を参照してください。