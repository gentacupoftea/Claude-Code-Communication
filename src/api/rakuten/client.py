"""
Rakuten API Client
Main client for interacting with Rakuten RMS API
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
import httpx
import json
from datetime import datetime

from ..abstract.base_client import AbstractEcommerceClient, RateLimitInfo
from .auth import RakutenAuth, RakutenCredentials
from .models.product import RakutenProduct
from .models.order import RakutenOrder
from .models.customer import RakutenCustomer

logger = logging.getLogger(__name__)


class RakutenAPIError(Exception):
    """Rakuten API specific error"""
    
    def __init__(self, message: str, code: Optional[str] = None, response: Optional[httpx.Response] = None):
        super().__init__(message)
        self.code = code
        self.response = response
        self.request_id = None
        
        if response and response.headers:
            self.request_id = response.headers.get('X-Request-Id')


class RakutenAPIClient(AbstractEcommerceClient):
    """
    Rakuten RMS API client
    Implements the AbstractEcommerceClient interface for Rakuten
    """
    
    BASE_URL = "https://api.rms.rakuten.co.jp"
    API_VERSION = "es/2.0"
    
    def __init__(self, credentials: Dict[str, Any]):
        """
        Initialize Rakuten API client
        
        Args:
            credentials: Dictionary containing:
                - service_secret: サービスシークレット
                - license_key: ライセンスキー  
                - shop_id: 店舗ID
                - test_mode: テストモード（オプション）
        """
        super().__init__("rakuten", credentials)
        
        # Create auth manager
        self.auth = RakutenAuth(RakutenCredentials(
            service_secret=credentials['service_secret'],
            license_key=credentials['license_key'],
            shop_id=credentials['shop_id']
        ))
        
        # HTTP client
        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=30.0
        )
        
        # Test mode
        self.test_mode = credentials.get('test_mode', False)
        if self.test_mode:
            logger.info("Running in test mode")
            
        # Rate limit tracking
        self.rate_limit_info = RateLimitInfo(
            requests_remaining=30,
            requests_limit=30,
            reset_time=None
        )
        
        # Shop ID
        self.shop_id = credentials['shop_id']
        
    async def authenticate(self) -> bool:
        """
        Authenticate with Rakuten API
        
        Returns:
            True if authentication successful
        """
        return await self.auth.authenticate()
        
    async def check_connection(self) -> bool:
        """
        Check if the API connection is working
        
        Returns:
            True if connection is healthy
        """
        try:
            # Try to get shop info as connection test
            response = await self._make_request('GET', f'/{self.API_VERSION}/shop/get')
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Connection check failed: {e}")
            return False
            
    def get_rate_limit_info(self) -> RateLimitInfo:
        """
        Get current rate limit information
        
        Returns:
            RateLimitInfo object
        """
        return self.rate_limit_info
        
    async def _make_request(self,
                          method: str,
                          endpoint: str,
                          data: Optional[Dict[str, Any]] = None,
                          params: Optional[Dict[str, Any]] = None) -> httpx.Response:
        """
        Make authenticated request to Rakuten API
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request body data
            params: Query parameters
            
        Returns:
            HTTP response
        """
        # Ensure valid token
        if not await self.auth.ensure_valid_token():
            raise RakutenAPIError("Failed to authenticate")
            
        # Prepare headers
        headers = self.auth.get_auth_header()
        headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
        # Make request
        try:
            url = endpoint if endpoint.startswith('/') else f'/{endpoint}'
            
            response = await self.client.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers
            )
            
            # Update rate limit info from headers
            self._update_rate_limit_info(response.headers)
            
            # Check for errors
            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                error_message = error_data.get('errors', [{}])[0].get('message', 'Unknown error')
                error_code = error_data.get('errors', [{}])[0].get('code')
                
                raise RakutenAPIError(error_message, code=error_code, response=response)
                
            return response
            
        except httpx.RequestError as e:
            logger.error(f"Request error: {e}")
            raise RakutenAPIError(f"Request failed: {e}")
            
    def _update_rate_limit_info(self, headers: Dict[str, str]):
        """Update rate limit info from response headers"""
        # Rakuten uses different header names
        if 'X-RateLimit-Limit' in headers:
            self.rate_limit_info.requests_limit = int(headers['X-RateLimit-Limit'])
        if 'X-RateLimit-Remaining' in headers:
            self.rate_limit_info.requests_remaining = int(headers['X-RateLimit-Remaining'])
        if 'X-RateLimit-Reset' in headers:
            self.rate_limit_info.reset_time = float(headers['X-RateLimit-Reset'])
            
        # Calculate usage percentage
        if self.rate_limit_info.requests_limit > 0:
            self.rate_limit_info.usage_percentage = (
                (self.rate_limit_info.requests_limit - self.rate_limit_info.requests_remaining) 
                / self.rate_limit_info.requests_limit
            )
            
    # Product operations
    async def get_product(self, product_id: str) -> Dict[str, Any]:
        """
        Get a single product by ID
        
        Args:
            product_id: Product identifier (商品管理番号)
            
        Returns:
            Product data dictionary
        """
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/product/get',
            params={'productId': product_id}
        )
        
        data = response.json()
        return RakutenProduct.from_platform_format(data).to_common_format()
        
    async def get_products(self,
                          limit: int = 50,
                          offset: int = 0,
                          filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get list of products
        
        Args:
            limit: Maximum number of products (max 100)
            offset: Number of products to skip
            filters: Optional filters (category, status, etc.)
            
        Returns:
            List of product dictionaries
        """
        params = {
            'limit': min(limit, 100),
            'offset': offset
        }
        
        if filters:
            params.update(filters)
            
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/products/search',
            params=params
        )
        
        data = response.json()
        products = []
        
        for item in data.get('products', []):
            product = RakutenProduct.from_platform_format(item)
            products.append(product.to_common_format())
            
        return products
        
    async def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new product
        
        Args:
            product_data: Product data to create
            
        Returns:
            Created product data
        """
        # Convert common format to Rakuten format
        rakuten_product = RakutenProduct.from_common_format(product_data)
        platform_data = rakuten_product.to_platform_format()
        
        response = await self._make_request(
            'POST',
            f'/{self.API_VERSION}/product/create',
            data=platform_data
        )
        
        created_data = response.json()
        return RakutenProduct.from_platform_format(created_data).to_common_format()
        
    async def update_product(self, product_id: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing product
        
        Args:
            product_id: Product identifier
            product_data: Product data to update
            
        Returns:
            Updated product data
        """
        # Get existing product first
        existing = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/product/get',
            params={'productId': product_id}
        )
        existing_data = existing.json()
        
        # Merge with updates
        rakuten_product = RakutenProduct.from_platform_format(existing_data)
        rakuten_product.update_from_common_format(product_data)
        platform_data = rakuten_product.to_platform_format()
        
        response = await self._make_request(
            'POST',
            f'/{self.API_VERSION}/product/update',
            data=platform_data
        )
        
        updated_data = response.json()
        return RakutenProduct.from_platform_format(updated_data).to_common_format()
        
    async def delete_product(self, product_id: str) -> bool:
        """
        Delete a product
        
        Args:
            product_id: Product identifier
            
        Returns:
            True if deletion successful
        """
        try:
            await self._make_request(
                'POST',
                f'/{self.API_VERSION}/product/delete',
                data={'productId': product_id}
            )
            return True
        except RakutenAPIError as e:
            logger.error(f"Failed to delete product {product_id}: {e}")
            return False
            
    # Order operations
    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """
        Get a single order by ID
        
        Args:
            order_id: Order identifier (注文番号)
            
        Returns:
            Order data dictionary
        """
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/order/get',
            params={'orderNumber': order_id}
        )
        
        data = response.json()
        return RakutenOrder.from_platform_format(data).to_common_format()
        
    async def get_orders(self,
                        limit: int = 50,
                        offset: int = 0,
                        filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get list of orders
        
        Args:
            limit: Maximum number of orders
            offset: Number of orders to skip
            filters: Optional filters (status, date range, etc.)
            
        Returns:
            List of order dictionaries
        """
        params = {
            'limit': min(limit, 100),
            'offset': offset
        }
        
        if filters:
            # Convert common filters to Rakuten format
            if 'status' in filters:
                params['orderStatus'] = self._convert_order_status(filters['status'])
            if 'created_after' in filters:
                params['orderDateFrom'] = filters['created_after']
            if 'created_before' in filters:
                params['orderDateTo'] = filters['created_before']
                
            params.update(filters)
            
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/orders/search',
            params=params
        )
        
        data = response.json()
        orders = []
        
        for item in data.get('orders', []):
            order = RakutenOrder.from_platform_format(item)
            orders.append(order.to_common_format())
            
        return orders
        
    async def update_order_status(self, order_id: str, status: str) -> Dict[str, Any]:
        """
        Update order status
        
        Args:
            order_id: Order identifier
            status: New status
            
        Returns:
            Updated order data
        """
        rakuten_status = self._convert_order_status(status)
        
        response = await self._make_request(
            'POST',
            f'/{self.API_VERSION}/order/update',
            data={
                'orderNumber': order_id,
                'orderStatus': rakuten_status
            }
        )
        
        updated_data = response.json()
        return RakutenOrder.from_platform_format(updated_data).to_common_format()
        
    def _convert_order_status(self, status: str) -> int:
        """Convert common status to Rakuten status code"""
        status_map = {
            'pending': 100,     # 注文確認待ち
            'processing': 200,  # 処理中
            'shipped': 400,     # 発送済み
            'delivered': 500,   # 配達完了
            'cancelled': 600,   # キャンセル
            'refunded': 700,    # 返金済み
        }
        return status_map.get(status, 100)
        
    # Customer operations
    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """
        Get a single customer by ID
        
        Args:
            customer_id: Customer identifier
            
        Returns:
            Customer data dictionary
        """
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/member/get',
            params={'memberId': customer_id}
        )
        
        data = response.json()
        return RakutenCustomer.from_platform_format(data).to_common_format()
        
    async def get_customers(self,
                          limit: int = 50,
                          offset: int = 0,
                          filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get list of customers
        
        Args:
            limit: Maximum number of customers
            offset: Number of customers to skip
            filters: Optional filters
            
        Returns:
            List of customer dictionaries
        """
        params = {
            'limit': min(limit, 100),
            'offset': offset
        }
        
        if filters:
            params.update(filters)
            
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/members/search',
            params=params
        )
        
        data = response.json()
        customers = []
        
        for item in data.get('members', []):
            customer = RakutenCustomer.from_platform_format(item)
            customers.append(customer.to_common_format())
            
        return customers
        
    # Inventory operations
    async def get_inventory(self, product_id: str) -> Dict[str, Any]:
        """
        Get inventory for a product
        
        Args:
            product_id: Product identifier
            
        Returns:
            Inventory data dictionary
        """
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/inventory/get',
            params={'productId': product_id}
        )
        
        data = response.json()
        return {
            'product_id': product_id,
            'quantity': data.get('quantity', 0),
            'locations': data.get('locations', [])
        }
        
    async def update_inventory(self, 
                             product_id: str, 
                             quantity: int,
                             location_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Update inventory quantity
        
        Args:
            product_id: Product identifier
            quantity: New quantity
            location_id: Optional warehouse ID
            
        Returns:
            Updated inventory data
        """
        data = {
            'productId': product_id,
            'quantity': quantity
        }
        
        if location_id:
            data['warehouseId'] = location_id
            
        response = await self._make_request(
            'POST',
            f'/{self.API_VERSION}/inventory/update',
            data=data
        )
        
        updated_data = response.json()
        return {
            'product_id': product_id,
            'quantity': updated_data.get('quantity', quantity),
            'location_id': location_id
        }
        
    # Platform-specific features
    def get_platform_capabilities(self) -> Dict[str, bool]:
        """
        Get Rakuten-specific capabilities
        
        Returns:
            Dictionary of capability flags
        """
        return {
            'multi_warehouse': True,
            'multi_currency': False,  # 楽天は日本円のみ
            'gift_wrapping': True,
            'tax_calculation': True,
            'shipping_integration': True,
            'loyalty_points': True,   # 楽天ポイント
            'marketplace': True,
            'product_variants': True,
            'bulk_operations': True,
            'webhooks': False,        # イベント通知APIは別
        }
        
    async def close(self):
        """Close connections"""
        await self.auth.close()
        await self.client.aclose()