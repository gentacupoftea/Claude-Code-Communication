"""
Shopify API Client for Conea Integration
Provides comprehensive REST and GraphQL API client with rate limiting, caching, and error handling
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from urllib.parse import urljoin, urlencode
from decimal import Decimal

import aiohttp
import asyncio
from aiohttp import ClientSession, ClientTimeout, ClientError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .models import (
    ShopifyProduct, ShopifyOrder, ShopifyCustomer, ShopifyVariant,
    ShopifyStoreConnection, ShopifyAPIResponse, PaginatedResponse,
    SyncStatus, WebhookEvent
)
from ..cache.cache_manager import CacheManager
from ..utils.logger import get_logger

logger = get_logger(__name__)


class ShopifyRateLimitError(Exception):
    """Raised when Shopify API rate limit is exceeded"""
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded. Retry after {retry_after} seconds")


class ShopifyAPIError(Exception):
    """Base exception for Shopify API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(message)


class ShopifyAuthError(ShopifyAPIError):
    """Raised when authentication fails"""
    pass


class ShopifyClient:
    """
    Advanced Shopify API client with comprehensive features:
    - REST and GraphQL API support
    - Rate limiting and backoff
    - Intelligent caching
    - Batch operations
    - Real-time webhook processing
    """
    
    def __init__(
        self,
        store_connection: ShopifyStoreConnection,
        cache_manager: Optional[CacheManager] = None,
        max_retries: int = 3,
        timeout: int = 30,
        rate_limit_buffer: float = 0.5
    ):
        self.store_connection = store_connection
        self.cache_manager = cache_manager or CacheManager()
        self.max_retries = max_retries
        self.timeout = ClientTimeout(total=timeout)
        self.rate_limit_buffer = rate_limit_buffer
        
        # API endpoints
        self.base_url = f"https://{store_connection.shop_domain}.myshopify.com"
        self.rest_api_base = f"{self.base_url}/admin/api/2024-01"
        self.graphql_endpoint = f"{self.rest_api_base}/graphql.json"
        
        # Rate limiting
        self.rate_limit_remaining = 40  # Shopify REST API bucket size
        self.rate_limit_reset = datetime.utcnow()
        self.call_limit = 40
        self.call_limit_reset = datetime.utcnow()
        
        # Session management
        self._session: Optional[ClientSession] = None
        self._lock = asyncio.Lock()
        
        logger.info(f"Initialized Shopify client for store: {store_connection.shop_domain}")

    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    async def _ensure_session(self):
        """Ensure HTTP session is available"""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,
                limit_per_host=20,
                ttl_dns_cache=300,
                use_dns_cache=True,
            )
            self._session = ClientSession(
                connector=connector,
                timeout=self.timeout,
                headers={
                    'X-Shopify-Access-Token': self.store_connection.access_token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Conea-Integration/1.0'
                }
            )

    async def close(self):
        """Close HTTP session"""
        if self._session and not self._session.closed:
            await self._session.close()

    def _get_headers(self, additional_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Get request headers with authentication"""
        headers = {
            'X-Shopify-Access-Token': self.store_connection.access_token,
            'Content-Type': 'application/json',
            'User-Agent': 'Conea-Integration/1.0',
            'Accept': 'application/json'
        }
        
        if additional_headers:
            headers.update(additional_headers)
            
        return headers

    async def _handle_rate_limiting(self, response_headers: Dict[str, str]):
        """Handle rate limiting based on response headers"""
        # REST API rate limiting
        if 'X-Shopify-Shop-Api-Call-Limit' in response_headers:
            call_limit_header = response_headers['X-Shopify-Shop-Api-Call-Limit']
            current_calls, max_calls = map(int, call_limit_header.split('/'))
            
            self.call_limit = max_calls
            remaining_calls = max_calls - current_calls
            
            # If approaching limit, add delay
            if remaining_calls <= (max_calls * self.rate_limit_buffer):
                delay = 1.0  # 1 second delay when approaching limit
                logger.warning(f"Approaching rate limit: {current_calls}/{max_calls}. Adding {delay}s delay")
                await asyncio.sleep(delay)
        
        # GraphQL API rate limiting
        if 'X-Shopify-Shop-Api-Call-Limit' in response_headers:
            throttle_status = response_headers.get('X-Shopify-API-Call-Limit-Status')
            if throttle_status and float(throttle_status) > 0.8:
                delay = 2.0  # 2 second delay for GraphQL throttling
                logger.warning(f"GraphQL API throttling detected: {throttle_status}. Adding {delay}s delay")
                await asyncio.sleep(delay)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((aiohttp.ClientError, ShopifyRateLimitError))
    )
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        headers: Optional[Dict] = None
    ) -> Tuple[Dict, int]:
        """Make HTTP request with retries and rate limiting"""
        await self._ensure_session()
        
        url = urljoin(self.rest_api_base, endpoint.lstrip('/'))
        request_headers = self._get_headers(headers)
        
        async with self._lock:
            try:
                logger.debug(f"Making {method} request to {url}")
                
                if method.upper() == 'GET':
                    response = await self._session.get(url, params=params, headers=request_headers)
                elif method.upper() == 'POST':
                    response = await self._session.post(url, json=data, headers=request_headers)
                elif method.upper() == 'PUT':
                    response = await self._session.put(url, json=data, headers=request_headers)
                elif method.upper() == 'DELETE':
                    response = await self._session.delete(url, headers=request_headers)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                # Handle rate limiting
                await self._handle_rate_limiting(dict(response.headers))
                
                # Handle various response codes
                if response.status == 429:
                    retry_after = int(response.headers.get('Retry-After', 2))
                    raise ShopifyRateLimitError(retry_after)
                elif response.status == 401:
                    raise ShopifyAuthError("Authentication failed. Check access token.")
                elif response.status == 402:
                    raise ShopifyAPIError("Payment required. Check Shopify plan limits.")
                elif response.status == 403:
                    raise ShopifyAPIError("Forbidden. Check API permissions.")
                elif response.status == 404:
                    raise ShopifyAPIError("Resource not found.")
                elif response.status >= 500:
                    raise ShopifyAPIError(f"Server error: {response.status}")
                
                # Parse response
                if response.content_type == 'application/json':
                    response_data = await response.json()
                else:
                    response_data = {'message': await response.text()}
                
                if not response.ok:
                    error_message = response_data.get('errors', response_data.get('error', 'Unknown error'))
                    raise ShopifyAPIError(
                        f"API request failed: {error_message}",
                        response.status,
                        response_data
                    )
                
                return response_data, response.status
                
            except ClientError as e:
                logger.error(f"HTTP client error: {e}")
                raise ShopifyAPIError(f"Network error: {e}")

    # ================================
    # Product Operations
    # ================================

    async def get_products(
        self,
        limit: int = 50,
        page_info: Optional[str] = None,
        fields: Optional[List[str]] = None,
        **filters
    ) -> PaginatedResponse:
        """
        Get products with pagination and filtering
        
        Args:
            limit: Number of products to return (max 250)
            page_info: Pagination cursor
            fields: Specific fields to return
            **filters: Additional filters (status, vendor, product_type, etc.)
        """
        cache_key = f"products:{self.store_connection.store_id}:{limit}:{page_info}:{hash(str(filters))}"
        
        # Check cache first
        if cached := await self.cache_manager.get(cache_key):
            logger.debug("Returning cached products")
            return PaginatedResponse.parse_obj(cached)
        
        params = {'limit': min(limit, 250)}
        
        if page_info:
            params['page_info'] = page_info
        if fields:
            params['fields'] = ','.join(fields)
        
        # Add filters
        for key, value in filters.items():
            params[key] = value
        
        response_data, status_code = await self._make_request('GET', '/products.json', params=params)
        
        products_data = response_data.get('products', [])
        products = [ShopifyProduct.parse_obj(product) for product in products_data]
        
        # Extract pagination info from Link header (if available)
        # Shopify uses Link header for pagination
        has_next = len(products) == limit
        
        result = PaginatedResponse(
            items=products,
            total_count=len(products),  # Note: Shopify doesn't provide total count
            page=1,  # Cursor-based pagination doesn't use page numbers
            per_page=limit,
            has_next=has_next,
            has_previous=bool(page_info),
            next_page_info=None,  # Would be extracted from Link header
            previous_page_info=None
        )
        
        # Cache result for 5 minutes
        await self.cache_manager.set(cache_key, result.dict(), expire=300)
        
        return result

    async def get_product(self, product_id: int, fields: Optional[List[str]] = None) -> ShopifyProduct:
        """Get a single product by ID"""
        cache_key = f"product:{self.store_connection.store_id}:{product_id}"
        
        if cached := await self.cache_manager.get(cache_key):
            return ShopifyProduct.parse_obj(cached)
        
        params = {}
        if fields:
            params['fields'] = ','.join(fields)
        
        response_data, _ = await self._make_request('GET', f'/products/{product_id}.json', params=params)
        product_data = response_data.get('product')
        
        if not product_data:
            raise ShopifyAPIError(f"Product {product_id} not found")
        
        product = ShopifyProduct.parse_obj(product_data)
        
        # Cache for 10 minutes
        await self.cache_manager.set(cache_key, product.dict(), expire=600)
        
        return product

    async def create_product(self, product: ShopifyProduct) -> ShopifyProduct:
        """Create a new product"""
        product_data = product.dict(exclude_unset=True, exclude_none=True)
        
        response_data, _ = await self._make_request(
            'POST',
            '/products.json',
            data={'product': product_data}
        )
        
        created_product = ShopifyProduct.parse_obj(response_data['product'])
        
        # Invalidate cache
        await self._invalidate_products_cache()
        
        logger.info(f"Created product: {created_product.id} - {created_product.title}")
        return created_product

    async def update_product(self, product_id: int, updates: Dict[str, Any]) -> ShopifyProduct:
        """Update an existing product"""
        response_data, _ = await self._make_request(
            'PUT',
            f'/products/{product_id}.json',
            data={'product': updates}
        )
        
        updated_product = ShopifyProduct.parse_obj(response_data['product'])
        
        # Update cache
        cache_key = f"product:{self.store_connection.store_id}:{product_id}"
        await self.cache_manager.set(cache_key, updated_product.dict(), expire=600)
        
        # Invalidate products list cache
        await self._invalidate_products_cache()
        
        logger.info(f"Updated product: {product_id}")
        return updated_product

    async def delete_product(self, product_id: int) -> bool:
        """Delete a product"""
        try:
            await self._make_request('DELETE', f'/products/{product_id}.json')
            
            # Remove from cache
            cache_key = f"product:{self.store_connection.store_id}:{product_id}"
            await self.cache_manager.delete(cache_key)
            
            # Invalidate products list cache
            await self._invalidate_products_cache()
            
            logger.info(f"Deleted product: {product_id}")
            return True
        except ShopifyAPIError:
            return False

    # ================================
    # Order Operations
    # ================================

    async def get_orders(
        self,
        limit: int = 50,
        page_info: Optional[str] = None,
        status: str = 'any',
        created_at_min: Optional[datetime] = None,
        created_at_max: Optional[datetime] = None,
        **filters
    ) -> PaginatedResponse:
        """Get orders with filtering and pagination"""
        params = {
            'limit': min(limit, 250),
            'status': status
        }
        
        if page_info:
            params['page_info'] = page_info
        if created_at_min:
            params['created_at_min'] = created_at_min.isoformat()
        if created_at_max:
            params['created_at_max'] = created_at_max.isoformat()
        
        # Add additional filters
        for key, value in filters.items():
            params[key] = value
        
        response_data, _ = await self._make_request('GET', '/orders.json', params=params)
        
        orders_data = response_data.get('orders', [])
        orders = [ShopifyOrder.parse_obj(order) for order in orders_data]
        
        has_next = len(orders) == limit
        
        return PaginatedResponse(
            items=orders,
            total_count=len(orders),
            page=1,
            per_page=limit,
            has_next=has_next,
            has_previous=bool(page_info)
        )

    async def get_order(self, order_id: int) -> ShopifyOrder:
        """Get a single order by ID"""
        cache_key = f"order:{self.store_connection.store_id}:{order_id}"
        
        if cached := await self.cache_manager.get(cache_key):
            return ShopifyOrder.parse_obj(cached)
        
        response_data, _ = await self._make_request('GET', f'/orders/{order_id}.json')
        order_data = response_data.get('order')
        
        if not order_data:
            raise ShopifyAPIError(f"Order {order_id} not found")
        
        order = ShopifyOrder.parse_obj(order_data)
        
        # Cache for 5 minutes (orders change frequently)
        await self.cache_manager.set(cache_key, order.dict(), expire=300)
        
        return order

    # ================================
    # Customer Operations
    # ================================

    async def get_customers(
        self,
        limit: int = 50,
        page_info: Optional[str] = None,
        **filters
    ) -> PaginatedResponse:
        """Get customers with pagination and filtering"""
        params = {'limit': min(limit, 250)}
        
        if page_info:
            params['page_info'] = page_info
        
        for key, value in filters.items():
            params[key] = value
        
        response_data, _ = await self._make_request('GET', '/customers.json', params=params)
        
        customers_data = response_data.get('customers', [])
        customers = [ShopifyCustomer.parse_obj(customer) for customer in customers_data]
        
        has_next = len(customers) == limit
        
        return PaginatedResponse(
            items=customers,
            total_count=len(customers),
            page=1,
            per_page=limit,
            has_next=has_next,
            has_previous=bool(page_info)
        )

    async def get_customer(self, customer_id: int) -> ShopifyCustomer:
        """Get a single customer by ID"""
        cache_key = f"customer:{self.store_connection.store_id}:{customer_id}"
        
        if cached := await self.cache_manager.get(cache_key):
            return ShopifyCustomer.parse_obj(cached)
        
        response_data, _ = await self._make_request('GET', f'/customers/{customer_id}.json')
        customer_data = response_data.get('customer')
        
        if not customer_data:
            raise ShopifyAPIError(f"Customer {customer_id} not found")
        
        customer = ShopifyCustomer.parse_obj(customer_data)
        
        # Cache for 15 minutes
        await self.cache_manager.set(cache_key, customer.dict(), expire=900)
        
        return customer

    # ================================
    # GraphQL Operations
    # ================================

    async def execute_graphql(self, query: str, variables: Optional[Dict] = None) -> Dict[str, Any]:
        """Execute GraphQL query"""
        await self._ensure_session()
        
        payload = {'query': query}
        if variables:
            payload['variables'] = variables
        
        headers = self._get_headers()
        
        async with self._session.post(self.graphql_endpoint, json=payload, headers=headers) as response:
            await self._handle_rate_limiting(dict(response.headers))
            
            if response.status == 429:
                retry_after = int(response.headers.get('Retry-After', 2))
                raise ShopifyRateLimitError(retry_after)
            
            response_data = await response.json()
            
            if 'errors' in response_data:
                error_messages = [error.get('message', 'Unknown error') for error in response_data['errors']]
                raise ShopifyAPIError(f"GraphQL errors: {', '.join(error_messages)}")
            
            return response_data.get('data', {})

    async def bulk_operation_status(self, operation_id: str) -> Dict[str, Any]:
        """Check status of bulk operation"""
        query = """
        query getBulkOperation($id: ID!) {
          node(id: $id) {
            ... on BulkOperation {
              id
              status
              errorCode
              createdAt
              completedAt
              objectCount
              fileSize
              url
              partialDataUrl
            }
          }
        }
        """
        
        return await self.execute_graphql(query, {'id': operation_id})

    # ================================
    # Webhook Operations
    # ================================

    async def list_webhooks(self) -> List[Dict[str, Any]]:
        """List all webhooks"""
        response_data, _ = await self._make_request('GET', '/webhooks.json')
        return response_data.get('webhooks', [])

    async def create_webhook(self, topic: str, address: str, format: str = 'json') -> Dict[str, Any]:
        """Create a new webhook"""
        webhook_data = {
            'webhook': {
                'topic': topic,
                'address': address,
                'format': format
            }
        }
        
        response_data, _ = await self._make_request('POST', '/webhooks.json', data=webhook_data)
        return response_data.get('webhook')

    async def delete_webhook(self, webhook_id: int) -> bool:
        """Delete a webhook"""
        try:
            await self._make_request('DELETE', f'/webhooks/{webhook_id}.json')
            return True
        except ShopifyAPIError:
            return False

    # ================================
    # Batch Operations
    # ================================

    async def batch_get_products(self, product_ids: List[int]) -> List[ShopifyProduct]:
        """Get multiple products in batch"""
        semaphore = asyncio.Semaphore(10)  # Limit concurrent requests
        
        async def get_single_product(product_id: int) -> Optional[ShopifyProduct]:
            async with semaphore:
                try:
                    return await self.get_product(product_id)
                except ShopifyAPIError as e:
                    logger.warning(f"Failed to get product {product_id}: {e}")
                    return None
        
        tasks = [get_single_product(pid) for pid in product_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out None results and exceptions
        products = [result for result in results if isinstance(result, ShopifyProduct)]
        
        return products

    async def batch_update_inventory(self, updates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch update inventory levels using GraphQL"""
        mutation = """
        mutation inventoryBulkAdjustQuantityAtLocation($inventoryItemAdjustments: [InventoryAdjustItemInput!]!, $locationId: ID!) {
          inventoryBulkAdjustQuantityAtLocation(inventoryItemAdjustments: $inventoryItemAdjustments, locationId: $locationId) {
            inventoryLevels {
              available
              inventoryItem {
                id
              }
              location {
                id
              }
            }
            userErrors {
              field
              message
            }
          }
        }
        """
        
        # Group updates by location
        updates_by_location = {}
        for update in updates:
            location_id = update['location_id']
            if location_id not in updates_by_location:
                updates_by_location[location_id] = []
            updates_by_location[location_id].append(update)
        
        results = []
        for location_id, location_updates in updates_by_location.items():
            adjustments = [
                {
                    'inventoryItemId': update['inventory_item_id'],
                    'availableDelta': update['available_delta']
                }
                for update in location_updates
            ]
            
            variables = {
                'inventoryItemAdjustments': adjustments,
                'locationId': f"gid://shopify/Location/{location_id}"
            }
            
            result = await self.execute_graphql(mutation, variables)
            results.append(result)
        
        return results

    # ================================
    # Cache Management
    # ================================

    async def _invalidate_products_cache(self):
        """Invalidate products-related cache entries"""
        pattern = f"products:{self.store_connection.store_id}:*"
        await self.cache_manager.delete_pattern(pattern)

    async def _invalidate_orders_cache(self):
        """Invalidate orders-related cache entries"""
        pattern = f"orders:{self.store_connection.store_id}:*"
        await self.cache_manager.delete_pattern(pattern)

    async def clear_cache(self):
        """Clear all cache for this store"""
        patterns = [
            f"product:{self.store_connection.store_id}:*",
            f"products:{self.store_connection.store_id}:*",
            f"order:{self.store_connection.store_id}:*",
            f"orders:{self.store_connection.store_id}:*",
            f"customer:{self.store_connection.store_id}:*",
            f"customers:{self.store_connection.store_id}:*"
        ]
        
        for pattern in patterns:
            await self.cache_manager.delete_pattern(pattern)

    # ================================
    # Health & Status
    # ================================

    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on Shopify API"""
        try:
            start_time = datetime.utcnow()
            
            # Simple API call to check connectivity
            response_data, status_code = await self._make_request('GET', '/shop.json')
            
            end_time = datetime.utcnow()
            response_time = (end_time - start_time).total_seconds()
            
            return {
                'status': 'healthy',
                'response_time': response_time,
                'api_version': '2024-01',
                'store_info': response_data.get('shop', {}),
                'rate_limit_remaining': self.rate_limit_remaining,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def get_sync_status(self) -> SyncStatus:
        """Get current sync status for the store"""
        # This would typically be stored in database
        # For now, return basic status
        return SyncStatus(
            store_id=self.store_connection.store_id,
            last_sync=self.store_connection.last_sync,
            sync_in_progress=False,  # Would check actual sync status
            webhook_status="active",  # Would check webhook health
            api_health="healthy"  # Would use health_check result
        )