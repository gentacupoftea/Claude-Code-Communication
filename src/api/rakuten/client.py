"""
Rakuten API Client
Main client for interacting with Rakuten RMS API
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
import httpx
import json
import random
from datetime import datetime
from cachetools import TTLCache
from typing import Optional

from ..abstract.base_client import AbstractEcommerceClient, RateLimitInfo
from .auth import RakutenAuth, RakutenCredentials
from .models.product import RakutenProduct
from .models.order import RakutenOrder
from .models.customer import RakutenCustomer
from .security import SecureSanitizer, create_safe_error_message
from .validators import validate_product_data, validate_customer_data

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
        
        # Initialize caching
        self._cache_enabled = credentials.get('cache_enabled', True)
        self._product_cache = TTLCache(maxsize=1000, ttl=300)  # 5 minute cache
        self._order_cache = TTLCache(maxsize=500, ttl=60)     # 1 minute cache
        self._customer_cache = TTLCache(maxsize=500, ttl=300) # 5 minute cache
        self._cache_stats = {'hits': 0, 'misses': 0}
        
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
                
                # Sanitize error message
                safe_message = SecureSanitizer.sanitize_message(error_message)
                logger.error(f"API error {response.status_code}: {safe_message}")
                
                raise RakutenAPIError(safe_message, code=error_code, response=response)
                
            return response
            
        except httpx.RequestError as e:
            # Sanitize error message
            safe_error = create_safe_error_message(e, "Request failed")
            logger.error(safe_error)
            raise RakutenAPIError(safe_error)
    
    async def _make_request_with_retry(self,
                                      method: str,
                                      endpoint: str,
                                      data: Optional[Dict[str, Any]] = None,
                                      params: Optional[Dict[str, Any]] = None,
                                      max_retries: int = 3,
                                      base_delay: float = 1.0) -> httpx.Response:
        """
        Make request with exponential backoff retry for rate limits
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request body
            params: Query parameters
            max_retries: Maximum retry attempts
            base_delay: Base delay in seconds
            
        Returns:
            HTTP response
        """
        last_exception = None
        
        for attempt in range(max_retries):
            try:
                return await self._make_request(method, endpoint, data, params)
            except RakutenAPIError as e:
                last_exception = e
                
                # Check if it's a rate limit error
                if hasattr(e, 'response') and e.response:
                    status_code = e.response.status_code
                    if status_code == 429 or (hasattr(e, 'code') and e.code in ['RATE_LIMIT', 'TOO_MANY_REQUESTS']):
                        # Exponential backoff with jitter
                        delay = base_delay * (2 ** attempt) * (0.5 + random.random())
                        
                        # Check for Retry-After header
                        retry_after = e.response.headers.get('Retry-After')
                        if retry_after:
                            try:
                                delay = max(delay, float(retry_after))
                            except ValueError:
                                pass
                        
                        logger.warning(
                            f"Rate limited on attempt {attempt+1}/{max_retries}, "
                            f"retrying in {delay:.2f}s"
                        )
                        
                        # Update rate limit info
                        self.rate_limit_info.requests_remaining = 0
                        
                        await asyncio.sleep(delay)
                        continue
                
                # Not a rate limit error, don't retry
                raise
        
        # Max retries exceeded
        logger.error(f"Max retries ({max_retries}) exceeded")
        raise last_exception
            
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
        cache_key = f"product:{product_id}"
        
        # Try to get from cache
        if self._cache_enabled and cache_key in self._product_cache:
            self._cache_stats['hits'] += 1
            logger.debug(f"Cache hit for product {product_id}")
            return self._product_cache[cache_key]
        
        # Cache miss
        self._cache_stats['misses'] += 1
        logger.debug(f"Cache miss for product {product_id}")
        
        response = await self._make_request(
            'GET',
            f'/{self.API_VERSION}/product/get',
            params={'productId': product_id}
        )
        
        data = response.json()
        result = RakutenProduct.from_platform_format(data).to_common_format()
        
        # Cache the result
        if self._cache_enabled:
            self._product_cache[cache_key] = result
            
        return result
        
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
        try:
            # Validate input data
            validated_data = validate_product_data(product_data, is_update=False)
            
            # Convert common format to Rakuten format
            rakuten_product = RakutenProduct.from_common_format(validated_data)
            platform_data = rakuten_product.to_platform_format()
            
            response = await self._make_request_with_retry(
                'POST',
                f'/{self.API_VERSION}/product/create',
                data=platform_data
            )
            
            created_data = response.json()
            return RakutenProduct.from_platform_format(created_data).to_common_format()
        except ValueError as e:
            # Validation error
            logger.error(f"Product validation error: {e}")
            raise RakutenAPIError(f"Invalid product data: {e}") from e
        
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
        
    def invalidate_cache(self, pattern: str = "*") -> int:
        """
        Invalidate cache entries matching pattern
        
        Args:
            pattern: Cache key pattern to match
            
        Returns:
            Number of entries invalidated
        """
        count = 0
        
        if pattern == "*":
            # Clear all caches
            count += len(self._product_cache)
            count += len(self._order_cache)
            count += len(self._customer_cache)
            self._product_cache.clear()
            self._order_cache.clear()
            self._customer_cache.clear()
        elif pattern.startswith("product:"):
            product_id = pattern.split(":", 1)[1]
            cache_key = f"product:{product_id}"
            if cache_key in self._product_cache:
                del self._product_cache[cache_key]
                count += 1
        elif pattern.startswith("order:"):
            order_id = pattern.split(":", 1)[1]
            cache_key = f"order:{order_id}"
            if cache_key in self._order_cache:
                del self._order_cache[cache_key]
                count += 1
        elif pattern.startswith("customer:"):
            customer_id = pattern.split(":", 1)[1]
            cache_key = f"customer:{customer_id}"
            if cache_key in self._customer_cache:
                del self._customer_cache[cache_key]
                count += 1
        
        logger.info(f"Invalidated {count} cache entries matching {pattern}")
        return count
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Cache statistics dictionary
        """
        total_hits = self._cache_stats['hits']
        total_misses = self._cache_stats['misses']
        total_requests = total_hits + total_misses
        
        return {
            'enabled': self._cache_enabled,
            'stats': self._cache_stats,
            'product_cache_size': len(self._product_cache),
            'order_cache_size': len(self._order_cache), 
            'customer_cache_size': len(self._customer_cache),
            'hit_ratio': total_hits / total_requests if total_requests > 0 else 0
        }
    
    async def close(self):
        """Close connections"""
        await self.auth.close()
        await self.client.aclose()