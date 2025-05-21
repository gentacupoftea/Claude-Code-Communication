# OptimizedCacheManager CI/CD ガイド

このドキュメントでは、OptimizedCacheManagerの継続的インテグレーション（CI）および継続的デリバリー（CD）プロセスについて説明します。

## 目次

1. [概要](#概要)
2. [CI環境](#ci環境)
3. [自動テスト](#自動テスト)
4. [Docker環境](#docker環境)
5. [GitHub Actions](#github-actions)
6. [デプロイメントフロー](#デプロイメントフロー)
7. [リリースプロセス](#リリースプロセス)

## 概要

OptimizedCacheManagerのCI/CDプロセスは以下の目標を達成するために設計されています：

- コードの品質と安定性の確保
- 自動テストの実行
- パフォーマンス特性の検証
- デプロイメントプロセスの簡素化
- リリースの安全性と信頼性の向上

## CI環境

### 必要条件

- Python 3.9以上
- Redis 6以上
- Docker および Docker Compose
- GitHub Actionsを実行するためのGitHubアカウント

### 環境変数

以下の環境変数を設定する必要があります：

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `REDIS_HOST` | Redisサーバーのホスト名 | `localhost` |
| `REDIS_PORT` | Redisサーバーのポート | `6379` |
| `REDIS_PASSWORD` | Redisサーバーのパスワード | *(空白)* |
| `PYTHONPATH` | Pythonパス | プロジェクトルート |

## 自動テスト

自動テストは以下のカテゴリに分類されます：

### 基本機能テスト

基本的なキャッシュ操作（set、get、invalidate）が正しく機能することを確認します。

```bash
cd scripts/cache-verification
python run_cache_tests.py --iterations 100 --value-size 1024
```

### パフォーマンステスト

キャッシュのパフォーマンス特性を検証します。

```bash
cd scripts/cache-verification
python run_cache_tests.py --iterations 10000 --value-size 1024 --concurrency 4
```

### 完全検証

すべてのテスト（基本機能、パフォーマンス、サイズ別、並列処理、負荷、メモリ使用量）を実行します。

```bash
cd scripts/cache-verification
./automated_verification.sh
```

## Docker環境

DockerとDocker Composeを使用して再現可能なテスト環境を提供します。

### Dockerfileの構造

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# 必要なパッケージのインストール
RUN apt-get update && apt-get install -y \
    redis-tools \
    bc \
    curl \
    # その他の必要なパッケージ

# Pythonの依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# 作業ディレクトリを検証スクリプトのディレクトリに変更
WORKDIR /app/scripts/cache-verification

# デフォルトコマンド
CMD ["./automated_verification.sh"]
```

### Docker Composeの構成

```yaml
version: '3.8'

services:
  app:
    build:
      context: ../..
      dockerfile: scripts/cache-verification/Dockerfile
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      
  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
```

### Docker環境でのテスト実行

```bash
cd scripts/cache-verification
./run_docker_tests.sh
```

オプション:
- `--basic-only`: 基本テストのみ実行
- `--skip-performance`: パフォーマンステストをスキップ
- `--skip-full`: 完全検証をスキップ
- `--cleanup-only`: テスト環境のクリーンアップのみ実行

## GitHub Actions

GitHubリポジトリへのPushやPull Requestに応じて自動的にテストを実行します。

### ワークフローの定義

`.github/workflows/cache-verification.yml`ファイルで定義されています：

```yaml
name: OptimizedCacheManager Verification

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'src/api/shopify/optimized_cache_manager.py'
      - 'src/api/shopify/cache_manager.py'
      - 'scripts/cache-verification/**'
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:
    inputs:
      full_test:
        description: 'Run full test suite'
        required: false
        default: 'false'
        type: boolean

jobs:
  verify:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:6-alpine
        ports:
          - 6379:6379
          
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
        
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
        
    - name: Run basic verification tests
      run: |
        cd scripts/cache-verification
        python run_cache_tests.py
```

### 手動実行

GitHubのActionsタブから"OptimizedCacheManager Verification"ワークフローを手動で実行することもできます。

## デプロイメントフロー

OptimizedCacheManagerのデプロイメントフローは以下のステップで構成されます：

1. **開発段階**
   - 機能開発
   - ローカルテスト
   - コードレビュー

2. **CIテスト**
   - Pull Requestの作成
   - GitHub Actionsによる自動テスト
   - パフォーマンス検証

3. **ステージング環境へのデプロイ**
   - `/scripts/cache-verification/deploy.sh --env=staging`
   - モニタリングダッシュボードでの検証
   - 手動テスト

4. **本番環境への段階的デプロイ**
   - フェーズ1: 読み取り専用エンドポイント（10%トラフィック）
     - `/scripts/cache-verification/deploy.sh --env=production --phase=1`
   - フェーズ2: 読み取り専用エンドポイント（100%）+ 書き込みエンドポイント（10%）
     - `/scripts/cache-verification/deploy.sh --env=production --phase=2`
   - フェーズ3: すべてのエンドポイント（100%）
     - `/scripts/cache-verification/deploy.sh --env=production --phase=3`

## リリースプロセス

### リリース前チェックリスト

- [ ] すべての自動テストが成功している
- [ ] パフォーマンス要件を満たしている
- [ ] コードレビューが完了している
- [ ] ドキュメントが更新されている
- [ ] デプロイ計画が承認されている

### リリース手順

1. リリースブランチの作成
   ```bash
   git checkout -b release/v1.x.x
   ```

2. バージョン番号の更新
   ```bash
   # VERSION変数を更新
   vim src/api/shopify/optimized_cache_manager.py
   ```

3. リリースコミットの作成
   ```bash
   git add src/api/shopify/optimized_cache_manager.py
   git commit -m "Release version 1.x.x"
   ```

4. リリースタグの作成
   ```bash
   git tag -a v1.x.x -m "Version 1.x.x"
   ```

5. リリースブランチのマージ
   ```bash
   git checkout main
   git merge release/v1.x.x
   ```

6. リモートリポジトリへのプッシュ
   ```bash
   git push origin main
   git push origin v1.x.x
   ```

7. デプロイスクリプトの実行（段階的デプロイ）

### ロールバック手順

問題が発生した場合は、以下の手順でロールバックします：

1. ロールバックスクリプトの実行
   ```bash
   ./scripts/cache-verification/rollback_cache.sh --phase=<現在のフェーズ>
   ```

2. 前バージョンのタグに戻る
   ```bash
   git checkout v1.x.x-1
   ```

3. 緊急修正が必要な場合は、ホットフィックスブランチを作成
   ```bash
   git checkout -b hotfix/v1.x.x
   ```