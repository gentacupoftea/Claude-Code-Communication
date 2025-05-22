"""
Enhanced Shopify API client with GraphQL support
Based on PR #7 compatibility approach - extends existing API to support both REST and GraphQL
Includes data validation and GA4 integration
"""

import asyncio
import logging
import os
from typing import Optional, Dict, Any, List, Tuple
import requests
import pandas as pd
from functools import lru_cache
from datetime import datetime

from .shopify_graphql import ShopifyGraphQLAPI
# from .errors import ShopifyRESTError, handle_rest_error
# from ..utils import memoize, optimize_dataframe_dtypes
from ..data_integration.validation.data_validator import DataValidator, ValidationError
from ..data_integration.ga4.ga4_mapper import GA4Mapper

# 一時的なモック
class ShopifyRESTError(Exception):
    pass

def handle_rest_error(response):
    if response.status_code != 200:
        raise ShopifyRESTError(f"API Error: {response.status_code}")

def memoize(ttl=None):
    """Simple memoize decorator with optional TTL support"""
    def decorator(func):
        return lru_cache(maxsize=128)(func)
    return decorator

def optimize_dataframe_dtypes(df):
    """Placeholder for dataframe optimization"""
    return df

logger = logging.getLogger(__name__)


class ShopifyAPI:
    """
    Main Shopify API client supporting both REST and GraphQL
    PR #7の互換性アプローチを採用 - 既存のREST APIにGraphQLサポートを追加
    """
    
    def __init__(self, 
                 shop_url: Optional[str] = None,
                 access_token: Optional[str] = None,
                 api_version: Optional[str] = None,
                 use_graphql: bool = False):
        """
        Initialize Shopify API client with optional GraphQL support
        
        Args:
            shop_url: Shop URL (defaults to env var SHOPIFY_SHOP_NAME)
            access_token: Access token (defaults to env var SHOPIFY_ACCESS_TOKEN)
            api_version: API version (defaults to env var SHOPIFY_API_VERSION)
            use_graphql: Enable GraphQL mode (default: False for backward compatibility)
        """
        # Use environment variables as defaults
        self.shop_url = shop_url or f"https://{os.getenv('SHOPIFY_SHOP_NAME')}.myshopify.com"
        self.access_token = access_token or os.getenv('SHOPIFY_ACCESS_TOKEN')
        self.api_version = api_version or os.getenv('SHOPIFY_API_VERSION', '2025-04')
        
        # Backward compatibility flag
        self.use_graphql = use_graphql
        
        # REST configuration
        self.base_url = f"{self.shop_url}/admin/api/{self.api_version}"
        self.headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json"
        }
        
        # GraphQL client initialization (lazy)
        self._graphql_client = None
        self._graphql_event_loop = None
        
        if self.use_graphql:
            self._init_graphql_client()
    
    def _init_graphql_client(self):
        """Initialize GraphQL client when needed"""
        if not self._graphql_client:
            self._graphql_client = ShopifyGraphQLAPI(
                shop_url=self.shop_url,
                access_token=self.access_token,
                api_version=self.api_version
            )
            # Create or get event loop for async operations
            try:
                self._graphql_event_loop = asyncio.get_event_loop()
            except RuntimeError:
                self._graphql_event_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self._graphql_event_loop)
    
    def _run_async(self, coro):
        """Helper to run async GraphQL operations in sync context"""
        if not self._graphql_event_loop:
            self._graphql_event_loop = asyncio.new_event_loop()
        
        if self._graphql_event_loop.is_running():
            # If we're already in an async context, create a task
            task = asyncio.create_task(coro)
            return asyncio.run_until_complete(task)
        else:
            # If not in async context, run directly
            return self._graphql_event_loop.run_until_complete(coro)
    
    # REST API methods (original implementation)
    
    def _make_request(self, method: str, endpoint: str, params=None, data=None):
        """Make a REST API request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                params=params,
                json=data
            )
            
            # Handle errors
            handle_rest_error(response)
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            raise ShopifyRESTError(f"Request failed: {e}", status_code=500)
    
    # Unified API methods with GraphQL support
    
    @memoize(ttl=300)  # 5分間キャッシュ
    def get_orders(self, 
                   start_date: Optional[str] = None,
                   end_date: Optional[str] = None,
                   status: Optional[str] = None,
                   limit: int = 250,
                   fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Get orders using either REST or GraphQL
        
        Args:
            start_date: Start date for filtering (ISO format)
            end_date: End date for filtering (ISO format)
            status: Order status filter
            limit: Maximum number of orders to retrieve
            fields: Specific fields to include (GraphQL only)
            
        Returns:
            List of order dictionaries
        """
        if self.use_graphql and self._graphql_client:
            # Use GraphQL
            return self._get_orders_graphql(
                start_date=start_date,
                end_date=end_date,
                status=status,
                limit=limit,
                fields=fields
            )
        else:
            # Use REST (original implementation)
            return self._get_orders_rest(
                start_date=start_date,
                end_date=end_date,
                status=status,
                limit=limit
            )
    
    def _get_orders_rest(self, start_date=None, end_date=None, status=None, limit=250):
        """Original REST implementation for orders"""
        params = {
            'limit': min(limit, 250),  # Shopify REST API limit
            'status': status or 'any'
        }
        
        if start_date:
            params['created_at_min'] = start_date
        if end_date:
            params['created_at_max'] = end_date
        
        orders = []
        page_info = None
        
        while True:
            if page_info:
                params['page_info'] = page_info
            
            response = self._make_request('GET', 'orders.json', params=params)
            
            if 'orders' in response:
                orders.extend(response['orders'])
            
            # Check for pagination
            link_header = response.headers.get('Link', '')
            if 'rel="next"' in link_header:
                # Extract page_info from Link header
                import re
                match = re.search(r'page_info=([^&>]+)', link_header)
                if match:
                    page_info = match.group(1)
                else:
                    break
            else:
                break
            
            if len(orders) >= limit:
                break
        
        return orders[:limit]
    
    def _get_orders_graphql(self, start_date=None, end_date=None, status=None, limit=250, fields=None):
        """GraphQL implementation for orders"""
        async def fetch_orders():
            all_orders = []
            cursor = None
            
            while len(all_orders) < limit:
                # Determine how many to fetch in this batch
                batch_size = min(50, limit - len(all_orders))
                
                result = await self._graphql_client.get_orders(
                    first=batch_size,
                    after=cursor,
                    status=status,
                    created_at_min=start_date,
                    created_at_max=end_date,
                    fields=fields
                )
                
                # Extract orders from GraphQL response
                orders_data = result.get('orders', {})
                edges = orders_data.get('edges', [])
                
                # Convert GraphQL format to REST format for compatibility
                for edge in edges:
                    order = edge.get('node', {})
                    # Transform GraphQL order to REST format
                    all_orders.append(self._transform_graphql_order(order))
                
                # Check pagination
                page_info = orders_data.get('pageInfo', {})
                if not page_info.get('hasNextPage') or len(all_orders) >= limit:
                    break
                
                cursor = page_info.get('endCursor')
            
            return all_orders[:limit]
        
        return self._run_async(fetch_orders())
    
    @memoize(ttl=300)
    def get_products(self, limit: int = 250, fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Get products using either REST or GraphQL"""
        if self.use_graphql and self._graphql_client:
            return self._get_products_graphql(limit=limit, fields=fields)
        else:
            return self._get_products_rest(limit=limit)
    
    def _get_products_rest(self, limit=250):
        """Original REST implementation for products"""
        params = {'limit': min(limit, 250)}
        products = []
        page_info = None
        
        while True:
            if page_info:
                params['page_info'] = page_info
            
            response = self._make_request('GET', 'products.json', params=params)
            
            if 'products' in response:
                products.extend(response['products'])
            
            # Check for pagination (similar to orders)
            link_header = response.headers.get('Link', '')
            if 'rel="next"' in link_header:
                import re
                match = re.search(r'page_info=([^&>]+)', link_header)
                if match:
                    page_info = match.group(1)
                else:
                    break
            else:
                break
            
            if len(products) >= limit:
                break
        
        return products[:limit]
    
    def _get_products_graphql(self, limit=250, fields=None):
        """GraphQL implementation for products"""
        async def fetch_products():
            all_products = []
            cursor = None
            
            while len(all_products) < limit:
                batch_size = min(50, limit - len(all_products))
                
                result = await self._graphql_client.get_products(
                    first=batch_size,
                    after=cursor,
                    fields=fields
                )
                
                products_data = result.get('products', {})
                edges = products_data.get('edges', [])
                
                for edge in edges:
                    product = edge.get('node', {})
                    all_products.append(self._transform_graphql_product(product))
                
                page_info = products_data.get('pageInfo', {})
                if not page_info.get('hasNextPage') or len(all_products) >= limit:
                    break
                
                cursor = page_info.get('endCursor')
            
            return all_products[:limit]
        
        return self._run_async(fetch_products())
    
    @memoize(ttl=300)
    def get_customers(self, limit: int = 250, fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Get customers using either REST or GraphQL"""
        if self.use_graphql and self._graphql_client:
            return self._get_customers_graphql(limit=limit, fields=fields)
        else:
            return self._get_customers_rest(limit=limit)
    
    def _get_customers_rest(self, limit=250):
        """Original REST implementation for customers"""
        params = {'limit': min(limit, 250)}
        response = self._make_request('GET', 'customers.json', params=params)
        return response.get('customers', [])
    
    def _get_customers_graphql(self, limit=250, fields=None):
        """GraphQL implementation for customers"""
        async def fetch_customers():
            all_customers = []
            cursor = None
            
            while len(all_customers) < limit:
                batch_size = min(50, limit - len(all_customers))
                
                result = await self._graphql_client.get_customers(
                    first=batch_size,
                    after=cursor,
                    fields=fields
                )
                
                customers_data = result.get('customers', {})
                edges = customers_data.get('edges', [])
                
                for edge in edges:
                    customer = edge.get('node', {})
                    all_customers.append(self._transform_graphql_customer(customer))
                
                page_info = customers_data.get('pageInfo', {})
                if not page_info.get('hasNextPage') or len(all_customers) >= limit:
                    break
                
                cursor = page_info.get('endCursor')
            
            return all_customers[:limit]
        
        return self._run_async(fetch_customers())
    
    # GraphQL to REST format transformers
    
    def _transform_graphql_order(self, graphql_order: Dict[str, Any]) -> Dict[str, Any]:
        """Transform GraphQL order format to REST format for backward compatibility"""
        # Extract line items
        line_items = []
        if 'lineItems' in graphql_order:
            for edge in graphql_order['lineItems'].get('edges', []):
                item = edge.get('node', {})
                line_items.append({
                    'id': item.get('id'),
                    'title': item.get('title'),
                    'quantity': item.get('quantity'),
                    'price': item.get('price'),
                    'product_id': item.get('product', {}).get('id')
                })
        
        # Transform to REST format
        return {
            'id': graphql_order.get('id'),
            'name': graphql_order.get('name'),
            'total_price': graphql_order.get('totalPrice'),
            'created_at': graphql_order.get('createdAt'),
            'currency': graphql_order.get('currencyCode'),
            'line_items': line_items,
            'customer': graphql_order.get('customer')
        }
    
    def _transform_graphql_product(self, graphql_product: Dict[str, Any]) -> Dict[str, Any]:
        """Transform GraphQL product format to REST format"""
        # Extract variants
        variants = []
        if 'variants' in graphql_product:
            for edge in graphql_product['variants'].get('edges', []):
                variant = edge.get('node', {})
                variants.append({
                    'id': variant.get('id'),
                    'title': variant.get('title'),
                    'price': variant.get('price'),
                    'available': variant.get('availableForSale'),
                    'inventory_quantity': variant.get('inventoryQuantity')
                })
        
        # Extract images
        images = []
        if 'images' in graphql_product:
            for edge in graphql_product['images'].get('edges', []):
                image = edge.get('node', {})
                images.append({
                    'id': image.get('id'),
                    'src': image.get('url'),
                    'alt': image.get('altText')
                })
        
        return {
            'id': graphql_product.get('id'),
            'title': graphql_product.get('title'),
            'handle': graphql_product.get('handle'),
            'created_at': graphql_product.get('createdAt'),
            'status': graphql_product.get('status'),
            'vendor': graphql_product.get('vendor'),
            'variants': variants,
            'images': images
        }
    
    def _transform_graphql_customer(self, graphql_customer: Dict[str, Any]) -> Dict[str, Any]:
        """Transform GraphQL customer format to REST format"""
        # Extract addresses
        addresses = []
        if 'addresses' in graphql_customer:
            for edge in graphql_customer['addresses'].get('edges', []):
                address = edge.get('node', {})
                addresses.append({
                    'id': address.get('id'),
                    'address1': address.get('address1'),
                    'city': address.get('city'),
                    'province': address.get('province'),
                    'country': address.get('country')
                })
        
        return {
            'id': graphql_customer.get('id'),
            'email': graphql_customer.get('email'),
            'display_name': graphql_customer.get('displayName'),
            'created_at': graphql_customer.get('createdAt'),
            'tags': graphql_customer.get('tags', []),
            'addresses': addresses
        }
    
    def close(self):
        """Clean up resources"""
        if self._graphql_client:
            self._run_async(self._graphql_client.close())
    
    # Backward compatibility methods
    
    def set_graphql_mode(self, enabled: bool = True):
        """Enable or disable GraphQL mode after initialization"""
        self.use_graphql = enabled
        if enabled and not self._graphql_client:
            self._init_graphql_client()
    
    def is_graphql_enabled(self) -> bool:
        """Check if GraphQL mode is enabled"""
        return self.use_graphql and self._graphql_client is not None
        
    
    def validate_order(self, order: Dict[str, Any], strict: bool = False) -> bool:
        """
        Validate an order against the common data model.
        
        Args:
            order: The order data to validate.
            strict: If True, validation failures will raise exceptions.
                   If False, validation failures will be logged as warnings.
                   
        Returns:
            True if the order is valid, False otherwise.
            
        Raises:
            ValidationError: If strict mode is enabled and validation fails.
        """
        validator = DataValidator(strict=strict)
        return validator.validate_order(order)
    
    def validate_orders(self, orders: List[Dict[str, Any]], strict: bool = False) -> List[Dict[str, Any]]:
        """
        Validate multiple orders against the common data model.
        
        Args:
            orders: The list of order data to validate.
            strict: If True, validation failures will raise exceptions.
                   If False, validation failures will be logged as warnings.
                   
        Returns:
            List of valid orders.
        """
        validator = DataValidator(strict=strict)
        valid_orders = []
        
        for order in orders:
            if validator.validate_order(order):
                valid_orders.append(order)
        
        return valid_orders
    
    def validate_product(self, product: Dict[str, Any], strict: bool = False) -> bool:
        """
        Validate a product against the common data model.
        
        Args:
            product: The product data to validate.
            strict: If True, validation failures will raise exceptions.
                   If False, validation failures will be logged as warnings.
                   
        Returns:
            True if the product is valid, False otherwise.
            
        Raises:
            ValidationError: If strict mode is enabled and validation fails.
        """
        validator = DataValidator(strict=strict)
        return validator.validate_product(product)
    
    def validate_products(self, products: List[Dict[str, Any]], strict: bool = False) -> List[Dict[str, Any]]:
        """
        Validate multiple products against the common data model.
        
        Args:
            products: The list of product data to validate.
            strict: If True, validation failures will raise exceptions.
                   If False, validation failures will be logged as warnings.
                   
        Returns:
            List of valid products.
        """
        validator = DataValidator(strict=strict)
        valid_products = []
        
        for product in products:
            if validator.validate_product(product):
                valid_products.append(product)
        
        return valid_products
    
    
    def map_order_to_ga4(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map a Shopify order to GA4 format.
        
        Args:
            order: The Shopify order data.
            
        Returns:
            The order data in GA4 format.
        """
        return GA4Mapper.map_order_to_ga4(order)
    
    def map_orders_to_ga4(self, orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Map multiple Shopify orders to GA4 format.
        
        Args:
            orders: The list of Shopify order data.
            
        Returns:
            The list of order data in GA4 format.
        """
        return GA4Mapper.map_orders_to_ga4(orders)
    
    def orders_to_ga4_dataframe(self, orders: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Convert Shopify orders to a GA4 format DataFrame.
        
        Args:
            orders: The list of Shopify order data.
            
        Returns:
            DataFrame with orders in GA4 format.
        """
        return GA4Mapper.orders_to_ga4_dataframe(orders)
    
    def map_product_to_ga4(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map a Shopify product to GA4 format.
        
        Args:
            product: The Shopify product data.
            
        Returns:
            The product data in GA4 format.
        """
        return GA4Mapper.map_product_to_ga4(product)
    
    def map_products_to_ga4(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Map multiple Shopify products to GA4 format.
        
        Args:
            products: The list of Shopify product data.
            
        Returns:
            The list of product data in GA4 format.
        """
        return GA4Mapper.map_products_to_ga4(products)
