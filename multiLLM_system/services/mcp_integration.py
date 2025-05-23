"""
MCP (Model Context Protocol) Integration Service
外部ツールやデータソースとの統合を提供
"""

import asyncio
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, asdict
import aiohttp
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


@dataclass
class MCPRequest:
    """MCP リクエスト"""
    id: str
    method: str
    params: Dict[str, Any]
    timestamp: datetime


@dataclass
class MCPResponse:
    """MCP レスポンス"""
    id: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None


class MCPProvider(ABC):
    """MCP プロバイダー基底クラス"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        self.session = None
    
    async def initialize(self):
        """プロバイダー初期化"""
        self.session = aiohttp.ClientSession()
        await self._initialize_provider()
    
    async def shutdown(self):
        """プロバイダー終了"""
        if self.session:
            await self.session.close()
    
    @abstractmethod
    async def _initialize_provider(self):
        """プロバイダー固有の初期化"""
        pass
    
    @abstractmethod
    async def execute_request(self, request: MCPRequest) -> MCPResponse:
        """リクエスト実行"""
        pass
    
    @abstractmethod
    def get_supported_methods(self) -> List[str]:
        """サポートするメソッド一覧"""
        pass


class ShopifyMCPProvider(MCPProvider):
    """Shopify MCP プロバイダー"""
    
    async def _initialize_provider(self):
        """Shopify API初期化"""
        self.api_key = self.config.get('apiKey')
        self.shop_domain = self.config.get('shopDomain')
        self.base_url = f"https://{self.shop_domain}.myshopify.com"
        logger.info(f"✅ Shopify MCP Provider initialized for {self.shop_domain}")
    
    def get_supported_methods(self) -> List[str]:
        return [
            'shopify.products.list',
            'shopify.products.get',
            'shopify.orders.list',
            'shopify.orders.get',
            'shopify.customers.list',
            'shopify.inventory.check',
            'shopify.analytics.sales',
            'shopify.webhooks.create'
        ]
    
    async def execute_request(self, request: MCPRequest) -> MCPResponse:
        """Shopifyリクエスト実行"""
        method = request.method
        params = request.params
        
        try:
            if method == 'shopify.products.list':
                result = await self._list_products(params)
            elif method == 'shopify.products.get':
                result = await self._get_product(params)
            elif method == 'shopify.orders.list':
                result = await self._list_orders(params)
            elif method == 'shopify.orders.get':
                result = await self._get_order(params)
            elif method == 'shopify.customers.list':
                result = await self._list_customers(params)
            elif method == 'shopify.inventory.check':
                result = await self._check_inventory(params)
            elif method == 'shopify.analytics.sales':
                result = await self._get_sales_analytics(params)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return MCPResponse(id=request.id, result=result)
            
        except Exception as e:
            logger.error(f"Shopify MCP error: {e}")
            return MCPResponse(
                id=request.id,
                error={'code': -1, 'message': str(e)}
            )
    
    async def _list_products(self, params: Dict) -> Dict:
        """商品一覧取得"""
        limit = params.get('limit', 50)
        status = params.get('status', 'active')
        
        url = f"{self.base_url}/admin/api/2023-10/products.json"
        headers = {'X-Shopify-Access-Token': self.api_key}
        
        async with self.session.get(url, headers=headers, params={'limit': limit, 'status': status}) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'products': data.get('products', []),
                    'count': len(data.get('products', [])),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                raise Exception(f"Shopify API error: {response.status}")
    
    async def _get_product(self, params: Dict) -> Dict:
        """商品詳細取得"""
        product_id = params.get('product_id')
        if not product_id:
            raise ValueError("product_id is required")
        
        url = f"{self.base_url}/admin/api/2023-10/products/{product_id}.json"
        headers = {'X-Shopify-Access-Token': self.api_key}
        
        async with self.session.get(url, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                return data.get('product', {})
            else:
                raise Exception(f"Product not found: {product_id}")
    
    async def _list_orders(self, params: Dict) -> Dict:
        """注文一覧取得"""
        limit = params.get('limit', 50)
        status = params.get('status', 'any')
        
        url = f"{self.base_url}/admin/api/2023-10/orders.json"
        headers = {'X-Shopify-Access-Token': self.api_key}
        
        async with self.session.get(url, headers=headers, params={'limit': limit, 'status': status}) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'orders': data.get('orders', []),
                    'count': len(data.get('orders', [])),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                raise Exception(f"Orders API error: {response.status}")
    
    async def _get_order(self, params: Dict) -> Dict:
        """注文詳細取得"""
        order_id = params.get('order_id')
        if not order_id:
            raise ValueError("order_id is required")
        
        url = f"{self.base_url}/admin/api/2023-10/orders/{order_id}.json"
        headers = {'X-Shopify-Access-Token': self.api_key}
        
        async with self.session.get(url, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                return data.get('order', {})
            else:
                raise Exception(f"Order not found: {order_id}")
    
    async def _list_customers(self, params: Dict) -> Dict:
        """顧客一覧取得"""
        limit = params.get('limit', 50)
        
        url = f"{self.base_url}/admin/api/2023-10/customers.json"
        headers = {'X-Shopify-Access-Token': self.api_key}
        
        async with self.session.get(url, headers=headers, params={'limit': limit}) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'customers': data.get('customers', []),
                    'count': len(data.get('customers', [])),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                raise Exception(f"Customers API error: {response.status}")
    
    async def _check_inventory(self, params: Dict) -> Dict:
        """在庫確認"""
        variant_id = params.get('variant_id')
        if not variant_id:
            raise ValueError("variant_id is required")
        
        url = f"{self.base_url}/admin/api/2023-10/inventory_levels.json"
        headers = {'X-Shopify-Access-Token': self.api_key}
        
        async with self.session.get(url, headers=headers, params={'inventory_item_ids': variant_id}) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'inventory_levels': data.get('inventory_levels', []),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                raise Exception(f"Inventory API error: {response.status}")
    
    async def _get_sales_analytics(self, params: Dict) -> Dict:
        """売上分析"""
        # 簡略化した実装
        start_date = params.get('start_date', '2024-01-01')
        end_date = params.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        
        # 注文データから売上を計算
        orders = await self._list_orders({'limit': 250, 'status': 'any'})
        
        total_sales = 0
        order_count = 0
        
        for order in orders.get('orders', []):
            if start_date <= order.get('created_at', '')[:10] <= end_date:
                total_sales += float(order.get('total_price', 0))
                order_count += 1
        
        return {
            'period': f"{start_date} to {end_date}",
            'total_sales': total_sales,
            'order_count': order_count,
            'average_order_value': total_sales / max(order_count, 1),
            'timestamp': datetime.now().isoformat()
        }


class GitHubMCPProvider(MCPProvider):
    """GitHub MCP プロバイダー"""
    
    async def _initialize_provider(self):
        """GitHub API初期化"""
        self.token = self.config.get('token')
        self.base_url = "https://api.github.com"
        logger.info("✅ GitHub MCP Provider initialized")
    
    def get_supported_methods(self) -> List[str]:
        return [
            'github.repos.list',
            'github.repo.get',
            'github.issues.list',
            'github.issue.get',
            'github.pulls.list',
            'github.pull.get',
            'github.commits.list',
            'github.releases.list'
        ]
    
    async def execute_request(self, request: MCPRequest) -> MCPResponse:
        """GitHubリクエスト実行"""
        method = request.method
        params = request.params
        
        try:
            if method == 'github.repos.list':
                result = await self._list_repos(params)
            elif method == 'github.repo.get':
                result = await self._get_repo(params)
            elif method == 'github.issues.list':
                result = await self._list_issues(params)
            elif method == 'github.pulls.list':
                result = await self._list_pulls(params)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return MCPResponse(id=request.id, result=result)
            
        except Exception as e:
            logger.error(f"GitHub MCP error: {e}")
            return MCPResponse(
                id=request.id,
                error={'code': -1, 'message': str(e)}
            )
    
    async def _list_repos(self, params: Dict) -> Dict:
        """リポジトリ一覧"""
        org = params.get('org')
        if not org:
            raise ValueError("org parameter is required")
        
        url = f"{self.base_url}/orgs/{org}/repos"
        headers = {'Authorization': f'token {self.token}'}
        
        async with self.session.get(url, headers=headers) as response:
            if response.status == 200:
                repos = await response.json()
                return {
                    'repositories': repos,
                    'count': len(repos),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                raise Exception(f"GitHub API error: {response.status}")
    
    async def _get_repo(self, params: Dict) -> Dict:
        """リポジトリ詳細"""
        owner = params.get('owner')
        repo = params.get('repo')
        
        if not owner or not repo:
            raise ValueError("owner and repo parameters are required")
        
        url = f"{self.base_url}/repos/{owner}/{repo}"
        headers = {'Authorization': f'token {self.token}'}
        
        async with self.session.get(url, headers=headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                raise Exception(f"Repository not found: {owner}/{repo}")
    
    async def _list_issues(self, params: Dict) -> Dict:
        """Issue一覧"""
        owner = params.get('owner')
        repo = params.get('repo')
        state = params.get('state', 'open')
        
        if not owner or not repo:
            raise ValueError("owner and repo parameters are required")
        
        url = f"{self.base_url}/repos/{owner}/{repo}/issues"
        headers = {'Authorization': f'token {self.token}'}
        
        async with self.session.get(url, headers=headers, params={'state': state}) as response:
            if response.status == 200:
                issues = await response.json()
                return {
                    'issues': issues,
                    'count': len(issues),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                raise Exception(f"Issues API error: {response.status}")
    
    async def _list_pulls(self, params: Dict) -> Dict:
        """プルリクエスト一覧"""
        owner = params.get('owner')
        repo = params.get('repo')
        state = params.get('state', 'open')
        
        if not owner or not repo:
            raise ValueError("owner and repo parameters are required")
        
        url = f"{self.base_url}/repos/{owner}/{repo}/pulls"
        headers = {'Authorization': f'token {self.token}'}
        
        async with self.session.get(url, headers=headers, params={'state': state}) as response:
            if response.status == 200:
                pulls = await response.json()
                return {
                    'pull_requests': pulls,
                    'count': len(pulls),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                raise Exception(f"Pull requests API error: {response.status}")


class DatabaseMCPProvider(MCPProvider):
    """データベース MCP プロバイダー"""
    
    async def _initialize_provider(self):
        """データベース接続初期化"""
        # 実際の実装では適切なDBライブラリを使用
        self.connection_string = self.config.get('connectionString')
        logger.info("✅ Database MCP Provider initialized")
    
    def get_supported_methods(self) -> List[str]:
        return [
            'db.query',
            'db.execute',
            'db.schema.get',
            'db.tables.list',
            'db.backup.create'
        ]
    
    async def execute_request(self, request: MCPRequest) -> MCPResponse:
        """データベースリクエスト実行"""
        method = request.method
        params = request.params
        
        try:
            if method == 'db.query':
                result = await self._execute_query(params)
            elif method == 'db.schema.get':
                result = await self._get_schema(params)
            elif method == 'db.tables.list':
                result = await self._list_tables(params)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return MCPResponse(id=request.id, result=result)
            
        except Exception as e:
            logger.error(f"Database MCP error: {e}")
            return MCPResponse(
                id=request.id,
                error={'code': -1, 'message': str(e)}
            )
    
    async def _execute_query(self, params: Dict) -> Dict:
        """クエリ実行（簡略化）"""
        query = params.get('query')
        if not query:
            raise ValueError("query parameter is required")
        
        # セキュリティ: 読み取り専用クエリのみ許可
        if not query.strip().upper().startswith('SELECT'):
            raise ValueError("Only SELECT queries are allowed")
        
        # ダミーデータ（実際の実装ではDBクエリを実行）
        return {
            'rows': [
                {'id': 1, 'name': 'Sample Product', 'price': 29.99},
                {'id': 2, 'name': 'Another Product', 'price': 19.99}
            ],
            'count': 2,
            'query': query,
            'timestamp': datetime.now().isoformat()
        }
    
    async def _get_schema(self, params: Dict) -> Dict:
        """スキーマ取得"""
        table = params.get('table')
        
        # ダミースキーマ
        return {
            'table': table or 'all_tables',
            'schema': {
                'products': {
                    'id': 'INTEGER PRIMARY KEY',
                    'name': 'VARCHAR(255)',
                    'price': 'DECIMAL(10,2)',
                    'created_at': 'TIMESTAMP'
                }
            },
            'timestamp': datetime.now().isoformat()
        }
    
    async def _list_tables(self, params: Dict) -> Dict:
        """テーブル一覧"""
        return {
            'tables': ['products', 'orders', 'customers', 'inventory'],
            'count': 4,
            'timestamp': datetime.now().isoformat()
        }


class MCPIntegrationService:
    """MCP統合サービス"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.providers = {}
        self.request_id_counter = 0
    
    async def initialize(self):
        """サービス初期化"""
        logger.info("🔌 Initializing MCP Integration Service...")
        
        # 設定されたプロバイダーを初期化
        provider_configs = self.config.get('providers', {})
        
        for provider_name, provider_config in provider_configs.items():
            provider_type = provider_config.get('type')
            
            if provider_type == 'shopify':
                provider = ShopifyMCPProvider(provider_name, provider_config)
            elif provider_type == 'github':
                provider = GitHubMCPProvider(provider_name, provider_config)
            elif provider_type == 'database':
                provider = DatabaseMCPProvider(provider_name, provider_config)
            else:
                logger.warning(f"Unknown provider type: {provider_type}")
                continue
            
            await provider.initialize()
            self.providers[provider_name] = provider
            logger.info(f"✅ Initialized {provider_name} provider ({provider_type})")
        
        logger.info(f"✅ MCP Integration Service initialized with {len(self.providers)} providers")
    
    async def shutdown(self):
        """サービス終了"""
        for provider in self.providers.values():
            await provider.shutdown()
    
    def _generate_request_id(self) -> str:
        """リクエストID生成"""
        self.request_id_counter += 1
        return f"mcp_req_{self.request_id_counter}_{int(datetime.now().timestamp())}"
    
    async def execute_mcp_request(self, method: str, params: Dict[str, Any]) -> MCPResponse:
        """MCPリクエスト実行"""
        # メソッドからプロバイダーを特定
        provider_name = method.split('.')[0]
        
        if provider_name not in self.providers:
            return MCPResponse(
                id=self._generate_request_id(),
                error={'code': -32601, 'message': f'Provider not found: {provider_name}'}
            )
        
        provider = self.providers[provider_name]
        
        # サポートメソッドチェック
        if method not in provider.get_supported_methods():
            return MCPResponse(
                id=self._generate_request_id(),
                error={'code': -32601, 'message': f'Method not supported: {method}'}
            )
        
        # リクエスト作成
        request = MCPRequest(
            id=self._generate_request_id(),
            method=method,
            params=params,
            timestamp=datetime.now()
        )
        
        logger.info(f"🔌 Executing MCP request: {method}")
        
        # プロバイダーでリクエスト実行
        response = await provider.execute_request(request)
        
        if response.error:
            logger.error(f"MCP request failed: {response.error}")
        else:
            logger.info(f"✅ MCP request completed: {method}")
        
        return response
    
    def get_available_methods(self) -> Dict[str, List[str]]:
        """利用可能なメソッド一覧"""
        methods = {}
        for provider_name, provider in self.providers.items():
            methods[provider_name] = provider.get_supported_methods()
        return methods
    
    def get_provider_status(self) -> Dict[str, Dict[str, Any]]:
        """プロバイダーステータス"""
        status = {}
        for provider_name, provider in self.providers.items():
            status[provider_name] = {
                'type': provider.__class__.__name__,
                'methods': len(provider.get_supported_methods()),
                'config_keys': list(provider.config.keys())
            }
        return status


# MCP Worker: Orchestratorから呼び出されるWorker
class MCPWorker:
    """MCP統合Worker"""
    
    def __init__(self, mcp_service: MCPIntegrationService):
        self.mcp_service = mcp_service
    
    async def process_mcp_task(self, task_description: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """MCPタスクを処理"""
        # タスク内容からMCPメソッドとパラメータを抽出
        mcp_request = self._parse_task_description(task_description, context)
        
        if not mcp_request:
            return {
                'error': 'Could not parse MCP request from task description',
                'task': task_description
            }
        
        # MCPリクエスト実行
        response = await self.mcp_service.execute_mcp_request(
            mcp_request['method'],
            mcp_request['params']
        )
        
        if response.error:
            return {
                'error': response.error,
                'method': mcp_request['method']
            }
        
        return {
            'success': True,
            'method': mcp_request['method'],
            'result': response.result,
            'timestamp': datetime.now().isoformat()
        }
    
    def _parse_task_description(self, description: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """タスク説明からMCPリクエストを解析"""
        # 簡略化した実装：キーワードベースの解析
        
        if 'shopify' in description.lower():
            if 'products' in description.lower():
                return {
                    'method': 'shopify.products.list',
                    'params': {'limit': 10}
                }
            elif 'orders' in description.lower():
                return {
                    'method': 'shopify.orders.list',
                    'params': {'limit': 10}
                }
        
        elif 'github' in description.lower():
            if 'issues' in description.lower():
                return {
                    'method': 'github.issues.list',
                    'params': {
                        'owner': context.get('github_owner', 'example'),
                        'repo': context.get('github_repo', 'repo')
                    }
                }
        
        elif 'database' in description.lower() or 'query' in description.lower():
            return {
                'method': 'db.tables.list',
                'params': {}
            }
        
        return None


# 使用例
async def main():
    # MCP設定
    config = {
        'providers': {
            'shopify': {
                'type': 'shopify',
                'apiKey': 'your-shopify-api-key',
                'shopDomain': 'your-shop'
            },
            'github': {
                'type': 'github',
                'token': 'your-github-token'
            },
            'database': {
                'type': 'database',
                'connectionString': 'postgresql://user:pass@localhost/db'
            }
        }
    }
    
    # MCPサービス初期化
    mcp_service = MCPIntegrationService(config)
    await mcp_service.initialize()
    
    # テストリクエスト
    response = await mcp_service.execute_mcp_request(
        'shopify.products.list',
        {'limit': 5}
    )
    
    if response.result:
        print(f"✅ Products: {len(response.result.get('products', []))}")
    else:
        print(f"❌ Error: {response.error}")
    
    # 利用可能メソッド表示
    methods = mcp_service.get_available_methods()
    print("\n📋 Available Methods:")
    for provider, method_list in methods.items():
        print(f"  {provider}: {len(method_list)} methods")
    
    await mcp_service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())