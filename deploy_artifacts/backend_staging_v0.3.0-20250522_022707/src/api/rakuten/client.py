"""
Rakuten API Client
Main client for interacting with Rakuten RMS API
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional, List
import httpx
import json
import random
from datetime import datetime
from cachetools import TTLCache
import time

from ..abstract.base_client import AbstractEcommerceClient, RateLimitInfo
from .auth import RakutenAuth, RakutenCredentials
from .models.product import RakutenProduct
from .models.order import RakutenOrder
from .models.customer import RakutenCustomer
from .models.category import RakutenCategory
from .security import SecureSanitizer, create_safe_error_message
from .validators import validate_product_data, validate_customer_data
from .rms_endpoints import RMSEndpoints, APIType
from .rms_errors import RMSErrorCodes, RMSErrorHandler
from .rate_limiter import rakuten_rate_limiter, RakutenRateLimiter

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
    
    # デフォルト値はテスト時に環境変数から上書きされる
    BASE_URL = "https://api.rms.rakuten.co.jp"
    API_VERSION = "es/2.0"
    
    def __init__(self, credentials: Dict[str, Any]):
        # 環境変数からBASE_URLを取得して上書き（テスト用）
        base_url_env = os.getenv('RAKUTEN_BASE_URL')
        if base_url_env:
            self.__class__.BASE_URL = base_url_env
            logger.info(f"楽天API BASE_URL: {self.BASE_URL} (環境変数から設定)")
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
        
        # レート制限設定
        self.rate_limiting_enabled = credentials.get('rate_limiting_enabled', True)
        self.rate_limiter = rakuten_rate_limiter
        
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
            # RMSEndpointsを使用してURL構築
            endpoint = RMSEndpoints.build_url("get_shop")
            response = await self._make_request('GET', endpoint)
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
        
    @rakuten_rate_limiter
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
            # 標準化されたURLパス処理 - 相対パスでも絶対URLでも処理可能
            if endpoint.startswith(('http://', 'https://')):
                # 絶対URL - これはテスト環境では避ける
                logger.warning(f"絶対URL '{endpoint}' を使用します。テスト環境ではBASE_URLが正しく設定されているか確認してください。")
                if self.test_mode:
                    # テストモードでは絶対URLのホスト部分を置き換え
                    parsed_url = httpx.URL(endpoint)
                    path = parsed_url.path
                    url = f"{self.BASE_URL}{path}"
                    logger.info(f"テストモードの絶対URL置換: {endpoint} -> {url}")
                else:
                    url = endpoint
            elif endpoint.startswith('/'):
                # 相対パス(先頭が/) - BASE_URLに追加
                url = endpoint
            else:
                # 相対パス(先頭が/なし) - BASE_URLに追加
                url = f'/{endpoint}'
                
            # ベースURLがhttps://api.rms.rakuten.co.jpのままで
            # 本番環境以外の場合は警告を出す（テスト時に役立つ）
            if self.test_mode and self.BASE_URL == "https://api.rms.rakuten.co.jp":
                logger.warning("テストモードで本番URLを使用しています。BASE_URLを確認してください。")
                
            # デバッグ用ログ
            logger.debug(f"Making {method} request to {url} with params={params}")
            
            response = await self.client.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers
            )
            
            # Update rate limit info from headers
            self._update_rate_limit_info(response.headers)
            
            # レート制限情報をレート制限機能に反映
            self.rate_limiter.update_from_headers(response.headers)
            
            # Check for errors
            if response.status_code >= 400:
                error_data = {}
                try:
                    if response.content:
                        error_data = response.json()
                except Exception:
                    # JSONとしてパースできない場合
                    error_data = {'error': {'message': response.text[:200]}}
                
                # Handle RMS-style error response
                if 'error' in error_data:
                    error_code = error_data['error'].get('code', '')
                    error_message = error_data['error'].get('message', 'Unknown error')
                else:
                    # Fallback to previous format
                    errors_list = error_data.get('errors', [{}])
                    error_code = errors_list[0].get('code', '') if errors_list else ''
                    error_message = errors_list[0].get('message', 'Unknown error') if errors_list else 'Unknown error'
                
                # Use RMS error handler for better error messages
                error_context = {
                    'status_code': response.status_code,
                    'endpoint': endpoint,
                    'method': method,
                    'request_id': response.headers.get('X-Request-Id')
                }
                
                error_details = RMSErrorHandler.handle_error(
                    error_code or f"HTTP{response.status_code}",
                    error_message,
                    error_context
                )
                
                # Sanitize error message
                safe_message = SecureSanitizer.sanitize_message(error_details['message'])
                # Prefix all keys in error_details to avoid LogRecord attribute conflicts
                log_extra = {f'error_{k}': v for k, v in error_details.items() if k != 'message'}
                # Don't use the extra parameter to avoid LogRecord conflicts
                logger.error(f"RMS API error: {safe_message} (Code: {error_details.get('code', 'unknown')})")
                
                # Create enhanced error
                api_error = RakutenAPIError(safe_message, code=error_code, response=response)
                api_error.is_retryable = error_details['is_retryable']
                api_error.error_category = error_details['category']
                api_error.error_details = error_details
                
                raise api_error
                
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
        
        # RMSEndpointsを使用してURL構築
        endpoint = RMSEndpoints.build_url("get_product", base_url=self.BASE_URL)
        
        # リクエスト
        response = await self._make_request_with_retry(
            'GET',
            endpoint,
            params={'itemId': product_id}  # RMS uses itemId
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
        
        # RMSEndpointsを使用してURL構築
        endpoint = RMSEndpoints.build_url("search_products", base_url=self.BASE_URL)
            
        response = await self._make_request(
            'GET',
            endpoint,
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
            
            # RMSEndpointsを使用してURL構築
            endpoint = RMSEndpoints.build_url("create_product")
            
            response = await self._make_request_with_retry(
                'POST',
                endpoint,
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
        endpoint = RMSEndpoints.build_url("get_product")
        existing = await self._make_request(
            'GET',
            endpoint,
            params={'itemId': product_id}  # RMS uses itemId
        )
        existing_data = existing.json()
        
        # Merge with updates
        rakuten_product = RakutenProduct.from_platform_format(existing_data)
        rakuten_product.update_from_common_format(product_data)
        platform_data = rakuten_product.to_platform_format()
        
        endpoint = RMSEndpoints.build_url("update_product")
        response = await self._make_request(
            'POST',
            endpoint,
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
            endpoint = RMSEndpoints.build_url("delete_product")
            await self._make_request(
                'POST',
                endpoint,
                data={'itemId': product_id}  # RMS uses itemId
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
        endpoint = RMSEndpoints.build_url("get_order")
        response = await self._make_request(
            'GET',
            endpoint,
            params={'orderId': order_id}
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
            filters: Optional filters (date range, status, etc.)
            
        Returns:
            List of order dictionaries
        """
        params = {
            'limit': min(limit, 100),
            'offset': offset
        }
        
        if filters:
            # Map common filter names to Rakuten-specific names
            if 'start_date' in filters:
                params['startDate'] = filters['start_date']
            if 'end_date' in filters:
                params['endDate'] = filters['end_date']
            if 'status' in filters:
                params['orderStatus'] = filters['status']
                
        endpoint = RMSEndpoints.build_url("search_orders")
        response = await self._make_request(
            'GET',
            endpoint,
            params=params
        )
        
        data = response.json()
        orders = []
        
        for item in data.get('orders', []):
            order = RakutenOrder.from_platform_format(item)
            orders.append(order.to_common_format())
            
        return orders
        
    async def create_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new order (not typically supported for marketplaces)
        
        Args:
            order_data: Order data to create
            
        Returns:
            Created order data
            
        Raises:
            NotImplementedError: Rakuten doesn't support order creation via API
        """
        raise NotImplementedError("Rakuten doesn't support order creation via API")
        
    async def update_order(self, order_id: str, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing order (limited support)
        
        Args:
            order_id: Order identifier
            order_data: Order data to update
            
        Returns:
            Updated order data
        """
        # Rakuten has limited order update capabilities
        # Typically only status updates are allowed
        allowed_updates = {
            'status': order_data.get('status'),
            'tracking_number': order_data.get('tracking_number'),
            'shipping_carrier': order_data.get('shipping_carrier')
        }
        
        # Remove None values
        update_data = {k: v for k, v in allowed_updates.items() if v is not None}
        
        endpoint = RMSEndpoints.build_url("update_order")
        response = await self._make_request(
            'POST',
            endpoint,
            data={
                'orderId': order_id,
                **update_data
            }
        )
        
        updated_data = response.json()
        return RakutenOrder.from_platform_format(updated_data).to_common_format()
        
    async def cancel_order(self, order_id: str, reason: Optional[str] = None) -> bool:
        """
        Cancel an order
        
        Args:
            order_id: Order identifier
            reason: Cancellation reason
            
        Returns:
            True if cancellation successful
        """
        try:
            data = {'orderId': order_id}
            if reason:
                data['cancelReason'] = reason
                
            endpoint = RMSEndpoints.build_url("cancel_order")
            await self._make_request(
                'POST',
                endpoint,
                data=data
            )
            return True
        except RakutenAPIError as e:
            logger.error(f"Failed to cancel order {order_id}: {e}")
            return False
            
    # Customer operations
    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """
        Get a single customer by ID
        
        Args:
            customer_id: Customer identifier
            
        Returns:
            Customer data dictionary
        """
        cache_key = f"customer:{customer_id}"
        
        # Try to get from cache
        if self._cache_enabled and cache_key in self._customer_cache:
            self._cache_stats['hits'] += 1
            logger.debug(f"Cache hit for customer {customer_id}")
            return self._customer_cache[cache_key]
        
        # Cache miss
        self._cache_stats['misses'] += 1
        
        endpoint = RMSEndpoints.build_url("get_customer", base_url=self.BASE_URL)
        response = await self._make_request(
            'GET',
            endpoint,
            params={'memberId': customer_id}
        )
        
        data = response.json()
        result = RakutenCustomer.from_platform_format(data).to_common_format()
        
        # Cache the result
        if self._cache_enabled:
            self._customer_cache[cache_key] = result
            
        return result
        
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
            
        endpoint = RMSEndpoints.build_url("search_customers", base_url=self.BASE_URL)
        response = await self._make_request(
            'GET',
            endpoint,
            params=params
        )
        
        data = response.json()
        customers = []
        
        for item in data.get('members', []):
            try:
                validated_data = validate_customer_data(item)
                customer = RakutenCustomer.from_platform_format(validated_data)
                customers.append(customer.to_common_format())
            except ValueError as e:
                logger.warning(f"Invalid customer data skipped: {e}")
                continue
                
        return customers
        
    async def create_customer(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new customer (not typically supported)
        
        Args:
            customer_data: Customer data to create
            
        Returns:
            Created customer data
            
        Raises:
            NotImplementedError: Rakuten doesn't support customer creation via API
        """
        raise NotImplementedError("Rakuten doesn't support customer creation via API")
        
    async def update_customer(self, customer_id: str, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing customer (limited support)
        
        Args:
            customer_id: Customer identifier
            customer_data: Customer data to update
            
        Returns:
            Updated customer data
        """
        # Rakuten has very limited customer update capabilities
        # Typically only certain fields can be updated
        endpoint = RMSEndpoints.build_url("update_customer", base_url=self.BASE_URL)
        response = await self._make_request(
            'POST',
            endpoint,
            data={
                'memberId': customer_id,
                **customer_data
            }
        )
        
        updated_data = response.json()
        return RakutenCustomer.from_platform_format(updated_data).to_common_format()
        
    async def delete_customer(self, customer_id: str) -> bool:
        """
        Delete a customer (not supported)
        
        Args:
            customer_id: Customer identifier
            
        Returns:
            False (operation not supported)
        """
        logger.warning("Customer deletion is not supported by Rakuten API")
        return False
        
    # Inventory operations - Added for AbstractEcommerceClient compatibility
    async def get_inventory(self, product_id: str) -> Dict[str, Any]:
        """
        Get inventory for a product
        
        Args:
            product_id: Product identifier
            
        Returns:
            Inventory data dictionary
        """
        # Get product data which includes inventory
        product = await self.get_product(product_id)
        
        # Extract inventory information
        inventory_data = {
            'product_id': product_id,
            'quantity': product.get('stockCount', 0),
            'available': product.get('stockCount', 0) > 0,
            'updated_at': product.get('updatedAt')
        }
        
        return inventory_data
    
    async def update_inventory(self, product_id: str, quantity: int, location_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Update inventory quantity
        
        Args:
            product_id: Product identifier
            quantity: New quantity
            location_id: Optional location/warehouse identifier (not used in Rakuten)
            
        Returns:
            Updated inventory data
        """
        # Update product with new inventory
        product_data = {
            'stockCount': quantity
        }
        
        # Use product update endpoint
        updated_product = await self.update_product(product_id, product_data)
        
        # Return inventory view
        return {
            'product_id': product_id,
            'quantity': updated_product.get('stockCount', quantity),
            'available': quantity > 0,
            'updated_at': updated_product.get('updatedAt')
        }
    
    async def update_order_status(self, order_id: str, status: str) -> Dict[str, Any]:
        """
        Update order status
        
        Args:
            order_id: Order identifier
            status: New status
            
        Returns:
            Updated order data
        """
        # Map status to Rakuten-specific status if needed
        rakuten_status = status  # Simplified mapping
        
        # Update order using general update method
        return await self.update_order(order_id, {'status': rakuten_status})
    
    # Platform-specific features
    def get_platform_features(self) -> Dict[str, bool]:
        """
        Get platform-specific feature availability
        
        Returns:
            Dictionary of feature flags
        """
        return {
            'variants': True,         # 商品バリエーション対応
            'bundles': True,          # セット商品対応
            'categories': True,       # カテゴリ管理
            'reviews': True,          # レビュー管理
            'inventory_tracking': True,
            'multi_currency': False,  # 日本円のみ
            'multi_language': True,   # 多言語対応（日本語必須）
            'custom_fields': True,    # カスタムフィールド
            'digital_products': True, # デジタル商品
            'subscriptions': False,   # 定期購買は別API
            'tax_management': True,   # 税込み価格管理
            'shipping_zones': True,   # 配送エリア管理
            'gift_cards': False,      # ギフトカードは別
            'discounts': True,        # クーポン・割引
            'customer_groups': True,  # 会員ランク
            'b2b_features': True,     # B2B機能（楽天B2B）
            'marketplace': True,      # マーケットプレイス
            'dropshipping': False,    # 直送は個別対応
            'pos_integration': False, # POS連携なし
            'social_commerce': True,  # SNS連携
            'mobile_app': True,       # モバイルアプリ対応
            'analytics': True,        # 分析機能
            'seo_tools': True,        # SEOツール
            'email_marketing': False, # メールは別サービス
            'abandoned_cart': True,   # カート放棄対策
            'loyalty_program': True,  # ポイントプログラム
            'wishlist': True,         # お気に入り機能
            'product_questions': True,# 商品Q&A
            'live_chat': False,       # チャットは別
            'ai_recommendations': True,# AI商品推奨
            'bulk_operations': True,  # 一括操作
            'api_rate_limits': True,  # APIレート制限
            'webhooks': False,        # イベント通知APIは別
        }
        
    # Category operations
    async def get_categories(self) -> List[Dict[str, Any]]:
        """
        Get all categories
        
        Returns:
            List of category dictionaries in hierarchical structure
        """
        # RMSEndpointsを使用してURL構築
        endpoint = RMSEndpoints.build_url("get_categories", base_url=self.BASE_URL)
        
        response = await self._make_request_with_retry(
            'GET',
            endpoint
        )
        
        data = response.json()
        categories = []
        
        # Process hierarchical category data
        for category_data in data.get('categories', []):
            category = RakutenCategory.from_platform_format(category_data)
            categories.append(category.to_common_format())
            
        return categories
    
    async def get_category(self, category_id: str) -> Dict[str, Any]:
        """
        Get a single category by ID
        
        Args:
            category_id: Category identifier
            
        Returns:
            Category data dictionary
        """
        endpoint_url = RMSEndpoints.build_url("get_category")
        response = await self._make_request_with_retry(
            'GET',
            endpoint_url,
            params={'categoryId': category_id}
        )
        
        data = response.json()
        category = RakutenCategory.from_platform_format(data)
        return category.to_common_format()
    
    async def get_products_by_category(self, 
                                     category_id: str,
                                     limit: int = 50,
                                     offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get products in a specific category
        
        Args:
            category_id: Category identifier
            limit: Maximum number of products
            offset: Number of products to skip
            
        Returns:
            List of product dictionaries
        """
        # Use product search with category filter
        return await self.get_products(
            limit=limit,
            offset=offset,
            filters={'categoryId': category_id}
        )
    
    async def close(self):
        """Close connections"""
        await self.auth.close()
        await self.client.aclose()
        
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring"""
        total_requests = self._cache_stats['hits'] + self._cache_stats['misses']
        hit_rate = self._cache_stats['hits'] / total_requests if total_requests > 0 else 0
        
        return {
            'enabled': self._cache_enabled,
            'hits': self._cache_stats['hits'],
            'misses': self._cache_stats['misses'],
            'hit_rate': hit_rate,
            'product_cache_size': len(self._product_cache),
            'order_cache_size': len(self._order_cache),
            'customer_cache_size': len(self._customer_cache)
        }
    
    def get_rate_limit_stats(self) -> Dict[str, Any]:
        """Get rate limit statistics"""
        # レート制限情報と組み合わせた統計情報
        stats = self.rate_limiter.get_stats()
        
        # 追加情報
        stats.update({
            'rate_limiting_enabled': self.rate_limiting_enabled,
            'test_mode': self.test_mode,
        })
        
        return stats