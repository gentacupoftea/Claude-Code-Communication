# OptimizedCacheManager インストールガイド

このドキュメントでは、OptimizedCacheManagerの詳細なインストール手順と初期設定について説明します。

## 目次

1. [インストール前の確認](#インストール前の確認)
2. [インストール手順](#インストール手順)
3. [設定ファイルの作成](#設定ファイルの作成)
4. [依存関係のインストール](#依存関係のインストール)
5. [インストール後の検証](#インストール後の検証)
6. [本番環境への導入](#本番環境への導入)
7. [アップグレード手順](#アップグレード手順)
8. [トラブルシューティング](#トラブルシューティング)

## インストール前の確認

### システム要件

- **Python**: 3.9以上
- **OS**: Linux、MacOS、Windows（WSL推奨）
- **メモリ**: 最低4GB RAM（本番環境では8GB以上推奨）
- **ストレージ**: 1GB以上の空き容量
- **Redis**（オプション）: バージョン6.0以上（分散環境で推奨）

### 前提条件の確認

以下のコマンドで環境を確認します：

```bash
# Pythonバージョンの確認
python --version

# Pythonパッケージマネージャの確認
pip --version

# Redisの確認（インストールされている場合）
redis-cli --version
redis-cli ping
```

## インストール手順

### 方法1: リポジトリをクローン

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/shopify-mcp-server.git
cd shopify-mcp-server

# 必要なブランチをチェックアウト
git checkout main  # または特定のバージョン（例：v1.0.0）
```

### 方法2: リリースアーカイブをダウンロード

```bash
# 最新リリースをダウンロード
curl -L https://github.com/yourusername/shopify-mcp-server/archive/refs/tags/v1.0.0.tar.gz -o shopify-mcp-server.tar.gz

# アーカイブを展開
tar -xzf shopify-mcp-server.tar.gz
cd shopify-mcp-server-1.0.0
```

## 設定ファイルの作成

### 基本設定

プロジェクトルートに`config`ディレクトリを作成し、キャッシュ設定ファイルを作成します：

```bash
mkdir -p config
```

`config/cache_config.json`ファイルを作成：

```json
{
  "memory_limit": 268435456,
  "default_ttl": 300,
  "ttl_variation_factor": 0.1,
  "redis_enabled": true,
  "redis_host": "localhost",
  "redis_port": 6379,
  "redis_password": null,
  "compression_enabled": true,
  "compression_min_size": 1024,
  "compression_level": 6
}
```

### Redis設定（オプション）

Redisを使用する場合は、以下の手順に従います：

#### Redisのインストール

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

**CentOS/RHEL**:
```bash
sudo yum install redis
sudo systemctl enable redis
sudo systemctl start redis
```

**MacOS**:
```bash
brew install redis
brew services start redis
```

**Docker**:
```bash
docker run -d -p 6379:6379 --name redis redis:6-alpine
```

#### Redis設定の確認

```bash
redis-cli ping
```

応答として`PONG`が返れば、Redisは正常に動作しています。

#### 高度なRedis設定（オプション）

`/etc/redis/redis.conf`（または相当するファイル）を編集：

```
maxmemory 1gb
maxmemory-policy allkeys-lru
```

## 依存関係のインストール

### 基本的な依存関係

```bash
pip install -r requirements.txt
```

### キャッシュ専用の依存関係

```bash
pip install redis msgpack zlib lz4 prometheus-client psutil
```

### 開発用の依存関係（オプション）

```bash
pip install pytest pytest-cov matplotlib numpy
```

## インストール後の検証

### 基本的な動作検証

Pythonインタープリタで以下のコードを実行：

```python
import sys
sys.path.append("/path/to/shopify-mcp-server")  # プロジェクトルートへのパス

from src.api.shopify.optimized_cache_manager import OptimizedCacheManager

# キャッシュマネージャーの初期化
cache = OptimizedCacheManager()

# バージョンと接続情報の確認
print(f"バージョン: {getattr(cache, 'VERSION', 'unknown')}")
print(f"Redis有効: {getattr(cache, 'redis_enabled', False)}")

# 基本操作のテスト
cache.set("test:key", "test value", 60)
value = cache.get("test:key")
print(f"キャッシュ値: {value}")

# 値を削除
cache.invalidate("test:key")
value = cache.get("test:key")
print(f"削除後の値: {value}")
```

### 自動検証ツールの実行

```bash
# 自動検証の実行
python scripts/cache-verification/run_cache_tests.py --iterations 100
```

## 本番環境への導入

### 本番環境用の設定

本番環境用の設定ファイル`config/cache_config_production.json`を作成：

```json
{
  "memory_limit": 1073741824,
  "default_ttl": 600,
  "ttl_variation_factor": 0.1,
  "redis_enabled": true,
  "redis_host": "your-redis-server",
  "redis_port": 6379,
  "redis_password": "your-strong-password",
  "redis_ssl": true,
  "redis_pool_min_size": 5,
  "redis_pool_max_size": 20,
  "redis_connection_timeout": 2.0,
  "redis_read_timeout": 1.0,
  "redis_retry_on_timeout": true,
  "redis_max_retries": 3,
  "compression_enabled": true,
  "compression_min_size": 1024,
  "compression_level": 6
}
```

### 環境変数の設定

セキュリティを強化するために、機密情報は環境変数として設定することを推奨します：

```bash
export REDIS_PASSWORD="your-strong-password"
export CACHE_MEMORY_LIMIT="1073741824"
```

### モニタリングのセットアップ

```bash
# モニタリングダッシュボードのセットアップ
./scripts/cache-verification/setup_monitoring_dashboard.sh

# モニタリングの開始
./scripts/cache-verification/start_monitoring.sh
```

### HTTPサーバーの設定

APIサーバーを起動：

```bash
python src/api/cache_api.py --port 8000
```

#### systemdサービスとして設定

`/etc/systemd/system/cache-api.service`ファイルを作成：

```
[Unit]
Description=OptimizedCacheManager API Server
After=network.target

[Service]
User=yourusername
WorkingDirectory=/path/to/shopify-mcp-server
ExecStart=/usr/bin/python3 /path/to/shopify-mcp-server/src/api/cache_api.py --port 8000
Restart=on-failure
Environment=PYTHONPATH=/path/to/shopify-mcp-server

[Install]
WantedBy=multi-user.target
```

サービスを有効化して起動：

```bash
sudo systemctl daemon-reload
sudo systemctl enable cache-api
sudo systemctl start cache-api
sudo systemctl status cache-api
```

## アップグレード手順

### バージョンアップの手順

1. 現在の設定のバックアップ：
   ```bash
   cp -r config config.backup
   ```

2. 既存のキャッシュデータのバックアップ（Redis使用時）：
   ```bash
   redis-cli save
   cp /var/lib/redis/dump.rdb /var/lib/redis/dump.rdb.backup
   ```

3. 新バージョンの取得：
   ```bash
   git fetch
   git checkout v1.1.0  # 新バージョンのタグ
   ```

4. 依存関係の更新：
   ```bash
   pip install -r requirements.txt
   ```

5. 設定ファイルのマイグレーション：
   ```bash
   # 新しい設定オプションの確認
   diff -u config.backup/cache_config.json config/cache_config.example.json
   
   # 必要に応じて設定ファイルを更新
   cp config.backup/cache_config.json config/
   ```

6. 検証：
   ```bash
   python scripts/cache-verification/run_cache_tests.py
   ```

7. サービスの再起動：
   ```bash
   sudo systemctl restart cache-api
   ```

## トラブルシューティング

### インストール時の問題

1. **依存関係のインストールに失敗する**
   - 問題: `pip install`コマンドが失敗する
   - 解決策:
     ```bash
     # Pythonの開発パッケージをインストール
     sudo apt install python3-dev build-essential
     
     # pipを更新
     pip install --upgrade pip setuptools wheel
     
     # 依存関係を一つずつインストール
     pip install redis
     pip install msgpack
     # ...など
     ```

2. **Redis接続エラー**
   - 問題: `ConnectionError: Error 111 connecting to localhost:6379`
   - 解決策:
     ```bash
     # Redisサービスの状態を確認
     sudo systemctl status redis
     
     # ファイアウォールの設定を確認
     sudo ufw status
     
     # Redisを再起動
     sudo systemctl restart redis
     ```

3. **インポートエラー**
   - 問題: `ModuleNotFoundError: No module named 'src'`
   - 解決策:
     ```bash
     # PYTHONPATHを設定
     export PYTHONPATH=/path/to/shopify-mcp-server
     
     # または、スクリプト内でパスを追加
     import sys
     sys.path.append("/path/to/shopify-mcp-server")
     ```

### 運用時の問題

詳細なトラブルシューティングは[トラブルシューティングガイド](./docs/OPTIMIZED_CACHE_TROUBLESHOOTING.md)を参照してください。

---

これでOptimizedCacheManagerのインストールは完了です。より詳細な使用方法は[クイックスタートガイド](./docs/OPTIMIZED_CACHE_QUICKSTART.md)を参照してください。