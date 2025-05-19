# Shopify MCP Server 開発者ガイド

このガイドでは、Shopify MCP Serverの開発に参加する際に必要な詳細情報を提供します。

## 目次

1. [開発環境のセットアップ](#開発環境のセットアップ)
2. [プロジェクト構造](#プロジェクト構造)
3. [コーディング規約](#コーディング規約)
4. [API統合](#api統合)
5. [テスト戦略](#テスト戦略)
6. [パフォーマンス最適化](#パフォーマンス最適化)
7. [セキュリティ考慮事項](#セキュリティ考慮事項)
8. [デバッグとトラブルシューティング](#デバッグとトラブルシューティング)

## 開発環境のセットアップ

### 必要なツール

- Python 3.8+ (推奨: 3.10)
- Git
- Docker (オプション)
- Redis (Google Analytics機能用)
- Virtualenv または pyenv

### 環境構築手順

```bash
# 1. リポジトリのクローン
git clone https://github.com/mourigenta/shopify-mcp-server.git
cd shopify-mcp-server

# 2. Python仮想環境の作成
python -m venv venv
source venv/bin/activate  # Linux/Mac
# または
venv\Scripts\activate  # Windows

# 3. 開発用依存関係のインストール
pip install -r requirements-dev.txt

# 4. 環境変数の設定
cp .env.example .env
# .envファイルを編集し、必要な認証情報を設定

# 5. プレコミットフックの設定
pre-commit install
```

### VSCode設定（推奨）

`.vscode/settings.json`:
```json
{
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black",
    "python.testing.pytestEnabled": true,
    "python.testing.unittestEnabled": false,
    "editor.formatOnSave": true
}
```

## プロジェクト構造

```
shopify-mcp-server/
├── src/
│   ├── __init__.py
│   ├── main.py                    # メインエントリーポイント
│   ├── config.py                  # 設定管理
│   ├── api/
│   │   ├── rest/                  # REST API実装
│   │   ├── graphql/               # GraphQL実装
│   │   └── schemas/               # データスキーマ
│   ├── services/
│   │   ├── shopify_service.py     # Shopify API統合
│   │   ├── analytics_service.py   # 分析サービス
│   │   └── cache_service.py       # キャッシュ管理
│   ├── models/                    # データモデル
│   ├── utils/                     # ユーティリティ関数
│   └── google_analytics/          # GA統合モジュール
├── tests/
│   ├── unit/                      # ユニットテスト
│   ├── integration/               # 統合テスト
│   └── e2e/                       # エンドツーエンドテスト
├── docs/                          # ドキュメント
├── scripts/                       # 開発用スクリプト
├── docker/                        # Docker設定
└── migrations/                    # データベースマイグレーション
```

## コーディング規約

### Pythonスタイルガイド

- PEP 8に準拠
- 最大行長: 88文字（Black標準）
- インポート順序: 標準ライブラリ → サードパーティ → ローカル

### 命名規則

```python
# クラス名: PascalCase
class ShopifyAPIClient:
    pass

# 関数名、変数名: snake_case
def calculate_order_total(order_items):
    total_amount = 0
    return total_amount

# 定数: UPPER_SNAKE_CASE
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT = 30
```

### 型アノテーション

すべての関数に型アノテーションを追加：

```python
from typing import List, Dict, Optional

def fetch_products(
    limit: Optional[int] = None,
    filters: Optional[Dict[str, str]] = None
) -> List[Dict[str, Any]]:
    """商品データを取得する"""
    pass
```

### ドキュメンテーション

Google形式のdocstringを使用：

```python
def process_order(order_id: str) -> OrderResult:
    """注文を処理する

    Args:
        order_id: 処理する注文のID

    Returns:
        OrderResult: 処理結果を含むオブジェクト

    Raises:
        OrderNotFoundError: 注文が見つからない場合
        ProcessingError: 処理中にエラーが発生した場合
    """
    pass
```

## API統合

### Shopify REST API

```python
class ShopifyRESTClient:
    def __init__(self, config: Config):
        self.base_url = f"https://{config.shop_name}.myshopify.com/admin/api/{config.api_version}"
        self.headers = {
            "X-Shopify-Access-Token": config.access_token,
            "Content-Type": "application/json"
        }
    
    async def get_orders(self, **params) -> List[Order]:
        """注文データを取得"""
        response = await self._request("GET", "/orders.json", params=params)
        return [Order.from_dict(order) for order in response["orders"]]
```

### Shopify GraphQL API

```python
class ShopifyGraphQLClient:
    def __init__(self, config: Config):
        self.endpoint = f"https://{config.shop_name}.myshopify.com/admin/api/{config.api_version}/graphql.json"
    
    async def execute_query(self, query: str, variables: Dict = None) -> Dict:
        """GraphQLクエリを実行"""
        response = await self._request(query, variables)
        if "errors" in response:
            raise GraphQLError(response["errors"])
        return response["data"]
```

### エラーハンドリング

```python
class ShopifyAPIError(Exception):
    """Shopify API基本エラークラス"""
    pass

class RateLimitError(ShopifyAPIError):
    """レート制限エラー"""
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded. Retry after {retry_after} seconds")

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(RateLimitError)
)
async def api_call_with_retry(func, *args, **kwargs):
    """リトライ機能付きAPIコール"""
    try:
        return await func(*args, **kwargs)
    except RateLimitError as e:
        await asyncio.sleep(e.retry_after)
        raise
```

## テスト戦略

### ユニットテスト

```python
import pytest
from unittest.mock import Mock, patch

class TestShopifyService:
    @pytest.fixture
    def shopify_service(self):
        config = Mock()
        return ShopifyService(config)
    
    @patch('src.services.shopify_service.aiohttp.ClientSession')
    async def test_get_products(self, mock_session, shopify_service):
        # モックレスポンスの設定
        mock_response = Mock()
        mock_response.json.return_value = {"products": [...]}
        mock_session.get.return_value.__aenter__.return_value = mock_response
        
        # テスト実行
        products = await shopify_service.get_products()
        
        # アサーション
        assert len(products) > 0
        assert all(isinstance(p, Product) for p in products)
```

### 統合テスト

```python
@pytest.mark.integration
class TestShopifyIntegration:
    @pytest.fixture
    async def live_client(self):
        """実際のAPIエンドポイントを使用するクライアント"""
        config = Config.from_env()
        return ShopifyClient(config)
    
    async def test_real_api_call(self, live_client):
        products = await live_client.get_products(limit=1)
        assert len(products) == 1
        assert products[0].id is not None
```

### パフォーマンステスト

```python
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor

class TestPerformance:
    @pytest.mark.performance
    async def test_concurrent_requests(self, shopify_service):
        """並行リクエストのパフォーマンステスト"""
        start_time = time.time()
        
        tasks = []
        for _ in range(10):
            tasks.append(shopify_service.get_products())
        
        results = await asyncio.gather(*tasks)
        
        elapsed_time = time.time() - start_time
        assert elapsed_time < 5.0  # 5秒以内に完了
        assert all(results)  # すべてのリクエストが成功
```

## パフォーマンス最適化

### キャッシング戦略

```python
from functools import lru_cache
import redis
import json

class CacheService:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    async def get_or_set(self, key: str, func, ttl: int = 300):
        """キャッシュから取得、なければ関数を実行してキャッシュ"""
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        
        result = await func()
        self.redis.setex(key, ttl, json.dumps(result))
        return result

# 使用例
async def get_products_cached(cache_service: CacheService):
    return await cache_service.get_or_set(
        "products:all",
        lambda: shopify_client.get_products(),
        ttl=600  # 10分キャッシュ
    )
```

### バッチ処理

```python
from typing import List, Tuple
import asyncio

async def batch_process_orders(
    order_ids: List[str],
    batch_size: int = 50
) -> List[ProcessResult]:
    """注文をバッチで処理"""
    results = []
    
    for i in range(0, len(order_ids), batch_size):
        batch = order_ids[i:i + batch_size]
        
        # 並行処理
        tasks = [process_order(order_id) for order_id in batch]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        results.extend(batch_results)
        
        # レート制限対策
        await asyncio.sleep(1)
    
    return results
```

### 接続プーリング

```python
import aiohttp
from contextlib import asynccontextmanager

class ConnectionPool:
    def __init__(self, size: int = 10):
        self.connector = aiohttp.TCPConnector(limit=size)
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(connector=self.connector)
        return self.session
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.session.close()
```

## セキュリティ考慮事項

### 認証情報の管理

```python
import os
from cryptography.fernet import Fernet

class SecureConfig:
    def __init__(self):
        self.cipher = Fernet(os.environ['ENCRYPTION_KEY'].encode())
    
    def encrypt_token(self, token: str) -> str:
        """トークンを暗号化"""
        return self.cipher.encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """トークンを復号化"""
        return self.cipher.decrypt(encrypted_token.encode()).decode()
```

### 入力検証

```python
from pydantic import BaseModel, validator

class OrderCreateRequest(BaseModel):
    customer_id: str
    items: List[Dict]
    total_amount: float
    
    @validator('customer_id')
    def validate_customer_id(cls, v):
        if not v or len(v) < 5:
            raise ValueError('Invalid customer ID')
        return v
    
    @validator('total_amount')
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError('Total amount must be positive')
        return v
```

### レート制限の実装

```python
import time
from functools import wraps

class RateLimiter:
    def __init__(self, calls: int, period: int):
        self.calls = calls
        self.period = period
        self.timestamps = []
    
    def __call__(self, func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            now = time.time()
            
            # 古いタイムスタンプを削除
            self.timestamps = [ts for ts in self.timestamps if now - ts < self.period]
            
            if len(self.timestamps) >= self.calls:
                raise RateLimitError(f"Rate limit exceeded: {self.calls} calls per {self.period} seconds")
            
            self.timestamps.append(now)
            return await func(*args, **kwargs)
        
        return wrapper

# 使用例
@RateLimiter(calls=100, period=60)  # 1分間に100コール
async def api_endpoint(request):
    pass
```

## デバッグとトラブルシューティング

### ロギング設定

```python
import logging
import sys

def setup_logging(level=logging.INFO):
    """ロギングのセットアップ"""
    logger = logging.getLogger('shopify_mcp')
    logger.setLevel(level)
    
    # コンソールハンドラー
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    # フォーマッター
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    
    return logger

# 使用例
logger = setup_logging()
logger.info("Starting Shopify MCP Server")
```

### デバッグツール

```python
from functools import wraps
import traceback

def debug_exceptions(func):
    """例外の詳細情報をログに記録するデコレーター"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Exception in {func.__name__}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    return wrapper

# 使用例
@debug_exceptions
async def process_webhook(payload: Dict):
    pass
```

### パフォーマンスプロファイリング

```python
import cProfile
import pstats
from contextlib import contextmanager

@contextmanager
def profile_performance(name: str):
    """パフォーマンスプロファイリング用コンテキストマネージャー"""
    profiler = cProfile.Profile()
    profiler.enable()
    
    try:
        yield
    finally:
        profiler.disable()
        stats = pstats.Stats(profiler)
        stats.sort_stats('cumulative')
        
        print(f"\nPerformance profile for {name}:")
        stats.print_stats(20)  # 上位20件を表示

# 使用例
async def analyze_performance():
    with profile_performance("order_processing"):
        await process_large_order_batch()
```

### メモリ使用量の監視

```python
import psutil
import gc

def monitor_memory_usage():
    """メモリ使用量を監視"""
    process = psutil.Process()
    memory_info = process.memory_info()
    
    logger.info(f"Memory usage: {memory_info.rss / 1024 / 1024:.2f} MB")
    logger.info(f"Virtual memory: {memory_info.vms / 1024 / 1024:.2f} MB")
    
    # ガベージコレクション統計
    gc_stats = gc.get_stats()
    logger.info(f"GC stats: {gc_stats}")

# 定期的に実行
import asyncio

async def periodic_monitoring():
    while True:
        monitor_memory_usage()
        await asyncio.sleep(300)  # 5分ごと
```

## 継続的インテグレーション

### GitHub Actions設定

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements-dev.txt
    
    - name: Run tests
      run: |
        pytest tests/ -v --cov=src --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
```

### リリースプロセス

```python
# scripts/release.py
import subprocess
import sys

def create_release(version: str):
    """新しいリリースを作成"""
    # バージョンタグを作成
    subprocess.run(["git", "tag", f"v{version}"], check=True)
    
    # リリースノートを生成
    changelog = generate_changelog(version)
    
    # GitHubにプッシュ
    subprocess.run(["git", "push", "origin", f"v{version}"], check=True)
    
    print(f"Release v{version} created successfully!")
```

## まとめ

このガイドは、Shopify MCP Serverの開発に必要な基本的な情報を提供しています。さらに詳細な情報が必要な場合は、個別のドキュメントファイルを参照するか、開発チームに連絡してください。

継続的な改善と新機能の開発にご協力いただきありがとうございます！