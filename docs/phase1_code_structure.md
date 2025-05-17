# Phase 1: 推奨コード構造

## プロジェクト構造

```
shopify-mcp-server/
├── src/
│   ├── __init__.py
│   ├── main.py                    # エントリーポイント
│   ├── api/
│   │   ├── __init__.py
│   │   └── shopify_client.py      # Shopify APIクライアント
│   ├── services/
│   │   ├── __init__.py
│   │   ├── analytics.py           # データ分析サービス
│   │   ├── visualization.py       # グラフ生成サービス
│   │   └── inventory.py           # 在庫管理サービス
│   ├── mcp/
│   │   ├── __init__.py
│   │   ├── server.py              # MCPサーバー実装
│   │   └── tools.py               # MCPツール定義
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py             # Pydanticモデル
│   │   └── types.py               # 型定義
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── config.py              # 設定管理
│   │   ├── errors.py              # カスタム例外
│   │   └── logger.py              # ログ設定
│   └── core/
│       ├── __init__.py
│       └── constants.py           # 定数定義
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # pytest設定
│   ├── unit/
│   │   ├── test_shopify_client.py
│   │   ├── test_analytics.py
│   │   └── test_visualization.py
│   ├── integration/
│   │   └── test_mcp_server.py
│   └── fixtures/
│       └── sample_data.json
├── config/
│   ├── default.yaml
│   ├── development.yaml
│   ├── test.yaml
│   └── production.yaml
├── docs/
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── test.txt
├── scripts/
│   ├── setup.sh
│   └── run_tests.sh
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── pyproject.toml
├── setup.py
└── README.md
```

## 主要コンポーネントの実装例

### 1. 設定管理 (utils/config.py)

```python
from typing import Optional
from pydantic import BaseSettings, Field, validator
from pathlib import Path
import yaml

class ShopifySettings(BaseSettings):
    """Shopify API設定"""
    api_version: str = Field(default="2023-10", env="SHOPIFY_API_VERSION")
    api_key: str = Field(..., env="SHOPIFY_API_KEY")
    secret_key: str = Field(..., env="SHOPIFY_SECRET_KEY")
    access_token: str = Field(..., env="SHOPIFY_ACCESS_TOKEN")
    shop_name: str = Field(..., env="SHOPIFY_SHOP_NAME")
    
    @validator("api_key", "secret_key", "access_token", "shop_name")
    def validate_required(cls, v):
        if not v:
            raise ValueError("Required field cannot be empty")
        return v

class ServerSettings(BaseSettings):
    """サーバー設定"""
    host: str = Field(default="localhost", env="SERVER_HOST")
    port: int = Field(default=8000, env="SERVER_PORT")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    environment: str = Field(default="development", env="ENVIRONMENT")

class Settings:
    """アプリケーション設定"""
    def __init__(self):
        self.shopify = ShopifySettings()
        self.server = ServerSettings()
        self._load_yaml_config()
    
    def _load_yaml_config(self):
        """YAML設定ファイルの読み込み"""
        config_path = Path(f"config/{self.server.environment}.yaml")
        if config_path.exists():
            with open(config_path) as f:
                config_data = yaml.safe_load(f)
                # YAMLからの追加設定をここで処理

settings = Settings()
```

### 2. エラーハンドリング (utils/errors.py)

```python
from typing import Optional, Dict, Any
from enum import Enum

class ErrorCode(Enum):
    """エラーコード定義"""
    SHOPIFY_API_ERROR = "SHOPIFY_API_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"

class AppError(Exception):
    """アプリケーション基底例外クラス"""
    def __init__(
        self, 
        message: str, 
        code: ErrorCode, 
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """エラーを辞書形式に変換"""
        return {
            "error": {
                "code": self.code.value,
                "message": self.message,
                "details": self.details
            }
        }

class ShopifyAPIError(AppError):
    """Shopify API関連のエラー"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=ErrorCode.SHOPIFY_API_ERROR,
            status_code=503,
            details=details
        )

class ValidationError(AppError):
    """検証エラー"""
    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(
            message=message,
            code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
            details=details
        )

class RateLimitError(AppError):
    """レート制限エラー"""
    def __init__(self, retry_after: int):
        super().__init__(
            message="Rate limit exceeded",
            code=ErrorCode.RATE_LIMIT_ERROR,
            status_code=429,
            details={"retry_after": retry_after}
        )
```

### 3. ログシステム (utils/logger.py)

```python
import structlog
from structlog.types import EventDict, Processor
from typing import Any, List
import sys

def add_timestamp(_, __, event_dict: EventDict) -> EventDict:
    """タイムスタンプを追加"""
    from datetime import datetime
    event_dict["timestamp"] = datetime.utcnow().isoformat()
    return event_dict

def setup_logging(log_level: str = "INFO") -> None:
    """ログシステムの設定"""
    processors: List[Processor] = [
        structlog.contextvars.merge_contextvars,
        add_timestamp,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.format_exc_info,
    ]
    
    if sys.stderr.isatty():
        # 開発環境向けのカラフルな出力
        processors.append(structlog.dev.ConsoleRenderer())
    else:
        # 本番環境向けのJSON出力
        processors.append(structlog.processors.JSONRenderer())
    
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

def get_logger(name: str) -> Any:
    """ロガーインスタンスを取得"""
    return structlog.get_logger(name)
```

### 4. Shopify APIクライアント (api/shopify_client.py)

```python
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

from ..utils.config import settings
from ..utils.errors import ShopifyAPIError, RateLimitError
from ..utils.logger import get_logger
from ..models.schemas import Order, Product, Customer

logger = get_logger(__name__)

class ShopifyClient:
    """Shopify API非同期クライアント"""
    
    def __init__(self):
        self.base_url = (
            f"https://{settings.shopify.shop_name}.myshopify.com"
            f"/admin/api/{settings.shopify.api_version}"
        )
        self.headers = {
            "X-Shopify-Access-Token": settings.shopify.access_token,
            "Content-Type": "application/json"
        }
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """非同期コンテキストマネージャーのエントリー"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """非同期コンテキストマネージャーのイグジット"""
        if self.session:
            await self.session.close()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """APIリクエストの実行"""
        url = f"{self.base_url}{endpoint}"
        
        logger.info(
            "Making Shopify API request",
            method=method,
            url=url,
            params=params
        )
        
        try:
            async with self.session.request(
                method=method,
                url=url,
                headers=self.headers,
                params=params,
                json=json_data
            ) as response:
                if response.status == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    raise RateLimitError(retry_after=retry_after)
                
                if response.status >= 400:
                    error_data = await response.json()
                    raise ShopifyAPIError(
                        message=f"API error: {response.status}",
                        details=error_data
                    )
                
                return await response.json()
                
        except aiohttp.ClientError as e:
            logger.error("Network error", error=str(e))
            raise ShopifyAPIError(
                message="Network error occurred",
                details={"original_error": str(e)}
            )
    
    async def get_orders(
        self, 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: str = "any",
        limit: int = 250
    ) -> List[Order]:
        """注文データの取得"""
        params = {
            "status": status,
            "limit": limit
        }
        
        if start_date:
            params["created_at_min"] = start_date.isoformat()
        if end_date:
            params["created_at_max"] = end_date.isoformat()
        
        data = await self._make_request("GET", "/orders.json", params=params)
        
        return [Order(**order) for order in data.get("orders", [])]
    
    async def get_products(self, limit: int = 250) -> List[Product]:
        """商品データの取得"""
        params = {"limit": limit}
        data = await self._make_request("GET", "/products.json", params=params)
        
        return [Product(**product) for product in data.get("products", [])]
    
    async def get_inventory_levels(
        self, 
        inventory_item_ids: List[int]
    ) -> Dict[int, int]:
        """在庫レベルの取得"""
        params = {
            "inventory_item_ids": ",".join(map(str, inventory_item_ids)),
            "limit": 250
        }
        
        data = await self._make_request(
            "GET", 
            "/inventory_levels.json", 
            params=params
        )
        
        return {
            level["inventory_item_id"]: level["available"]
            for level in data.get("inventory_levels", [])
        }
```

### 5. MCPサーバー実装 (mcp/server.py)

```python
from mcp.server.fastmcp import FastMCP
from mcp.server.stdio import stdio_server
import asyncio

from ..utils.config import settings
from ..utils.logger import setup_logging, get_logger
from .tools import register_tools

logger = get_logger(__name__)

class ShopifyMCPServer:
    """Shopify MCP Server実装"""
    
    def __init__(self):
        setup_logging(settings.server.log_level)
        self.mcp = FastMCP(
            "shopify-mcp-server",
            dependencies=["aiohttp", "pandas", "matplotlib"]
        )
        self._register_tools()
    
    def _register_tools(self):
        """MCPツールの登録"""
        register_tools(self.mcp)
        logger.info("Registered MCP tools", tool_count=len(self.mcp._tools))
    
    async def run(self):
        """サーバーの実行"""
        logger.info(
            "Starting Shopify MCP Server",
            environment=settings.server.environment
        )
        
        async with stdio_server() as server:
            await server.run(self.mcp)

def main():
    """エントリーポイント"""
    server = ShopifyMCPServer()
    asyncio.run(server.run())

if __name__ == "__main__":
    main()
```

## テスト実装例

### ユニットテスト (tests/unit/test_shopify_client.py)

```python
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch
import aiohttp

from src.api.shopify_client import ShopifyClient
from src.utils.errors import ShopifyAPIError, RateLimitError

@pytest.fixture
async def client():
    """テスト用クライアントのフィクスチャ"""
    async with ShopifyClient() as client:
        yield client

@pytest.mark.asyncio
async def test_get_orders_success(client):
    """注文取得の成功テスト"""
    mock_response = {
        "orders": [
            {
                "id": 1,
                "name": "#1001",
                "created_at": "2023-01-01T00:00:00Z",
                "total_price": "1000.00"
            }
        ]
    }
    
    with patch.object(
        client, 
        '_make_request', 
        return_value=mock_response
    ) as mock_request:
        orders = await client.get_orders()
        
        assert len(orders) == 1
        assert orders[0].id == 1
        mock_request.assert_called_once()

@pytest.mark.asyncio
async def test_rate_limit_error(client):
    """レート制限エラーのテスト"""
    mock_response = AsyncMock()
    mock_response.status = 429
    mock_response.headers = {"Retry-After": "60"}
    
    with patch.object(
        client.session, 
        'request',
        return_value=mock_response
    ):
        with pytest.raises(RateLimitError) as exc_info:
            await client._make_request("GET", "/test")
        
        assert exc_info.value.details["retry_after"] == 60
```

### GitHub Actions CI設定 (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements/test.txt
    
    - name: Run linting
      run: |
        ruff check .
        mypy src/
    
    - name: Run tests
      run: |
        pytest tests/ -v --cov=src --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
```

これらの実装例は、Phase 1で推奨されるコード構造と品質基準を示しています。