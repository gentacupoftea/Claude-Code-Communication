"""
Shopify Client - API client for Shopify operations.

This module provides a client for interacting with the Shopify API,
implementing the operations needed for data synchronization.
"""

import logging
import time
import json
import requests
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from urllib.parse import urljoin


class ShopifyClient:
    """
    Client for interacting with the Shopify API.
    
    This client provides methods for retrieving, creating, and updating 
    various Shopify resources, with support for rate limiting and pagination.
    """
    
    def __init__(
        self,
        shop_url: str,
        api_key: str,
        api_password: str,
        api_version: str = "2023-10",
        rate_limit_delay: float = 0.5,
        max_retries: int = 3,
        timeout: int = 30
    ):
        """
        Initialize the Shopify client.
        
        Args:
            shop_url: URL of the Shopify shop (e.g., "my-shop.myshopify.com")
            api_key: Shopify API key
            api_password: Shopify API password
            api_version: Shopify API version
            rate_limit_delay: Delay between API calls to respect rate limits
            max_retries: Maximum number of retry attempts for failed requests
            timeout: Request timeout in seconds
        """
        # Ensure shop URL is properly formatted
        if not shop_url.startswith("http"):
            shop_url = f"https://{shop_url}"
        
        self.shop_url = shop_url
        self.api_key = api_key
        self.api_password = api_password
        self.api_version = api_version
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self.timeout = timeout
        
        # Build base API URL
        self.base_url = f"{shop_url}/admin/api/{api_version}/"
        
        # Session for connection pooling
        self.session = requests.Session()
        self.session.auth = (api_key, api_password)
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
        
        # Rate limiting tracking
        self.last_request_time = 0
        
        # Setup logging
        self.logger = logging.getLogger("ShopifyClient")
    
    def __del__(self):
        """Clean up resources when the client is garbage collected."""
        if hasattr(self, 'session'):
            self.session.close()
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Make a request to the Shopify API with rate limiting and retries.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            params: Query parameters
            data: Request body data
            headers: Additional headers
            
        Returns:
            API response as a dictionary
            
        Raises:
            requests.RequestException: If the request fails after all retries
        """
        # Respect rate limits
        self._respect_rate_limit()
        
        # Build full URL
        url = urljoin(self.base_url, endpoint)
        
        # Prepare headers
        request_headers = {}
        if headers:
            request_headers.update(headers)
        
        # Serialize data if provided
        json_data = json.dumps(data) if data else None
        
        # Execute request with retries
        for attempt in range(self.max_retries):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    data=json_data,
                    headers=request_headers,
                    timeout=self.timeout
                )
                
                # Update rate limit tracking
                self.last_request_time = time.time()
                
                # Handle rate limiting (429 Too Many Requests)
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 10))
                    self.logger.warning(f"Rate limited. Retrying after {retry_after} seconds")
                    time.sleep(retry_after)
                    continue
                
                # Raise for other error status codes
                response.raise_for_status()
                
                # Parse and return JSON response
                return response.json()
                
            except requests.RequestException as e:
                self.logger.warning(f"Request failed (attempt {attempt+1}/{self.max_retries}): {e}")
                
                if attempt < self.max_retries - 1:
                    # Wait before retry with exponential backoff
                    backoff = 2 ** attempt * self.rate_limit_delay
                    time.sleep(backoff)
                else:
                    # Last attempt failed, raise the exception
                    raise
    
    def _respect_rate_limit(self) -> None:
        """
        Ensure we respect Shopify's rate limits by adding delay if needed.
        """
        if self.last_request_time > 0:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.rate_limit_delay:
                time.sleep(self.rate_limit_delay - elapsed)
    
    def _get_all_paginated(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all items from a paginated API endpoint.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            
        Returns:
            List of all items from all pages
        """
        all_items = []
        params = params or {}
        
        # Set page parameters if not provided
        if "limit" not in params:
            params["limit"] = 250  # Maximum allowed by Shopify
        
        # Handle pagination using Shopify's Link headers
        next_url = None
        
        while True:
            # If we have a next URL from a previous response, use that
            if next_url:
                try:
                    response = self.session.get(next_url, timeout=self.timeout)
                    response.raise_for_status()
                    response_data = response.json()
                except requests.RequestException as e:
                    self.logger.error(f"Error fetching paginated results: {e}")
                    break
            else:
                # First page, use the endpoint and params
                try:
                    response_data = self._make_request("GET", endpoint, params=params)
                except requests.RequestException as e:
                    self.logger.error(f"Error fetching paginated results: {e}")
                    break
            
            # Extract the resource type from the response
            resource = None
            for key in response_data:
                if isinstance(response_data[key], list):
                    resource = key
                    break
            
            if not resource:
                self.logger.warning("Could not identify resource in response")
                break
            
            # Add items from this page
            items = response_data[resource]
            all_items.extend(items)
            
            # Check for a 'next' Link header
            try:
                link_header = self.session.headers.get("Link")
                if not link_header:
                    break
                
                links = link_header.split(",")
                next_link = None
                
                for link in links:
                    if 'rel="next"' in link:
                        next_link = link.split(";")[0].strip("<>")
                        break
                
                if not next_link:
                    break
                
                next_url = next_link
                
            except Exception as e:
                self.logger.error(f"Error parsing pagination links: {e}")
                break
            
            # Respect rate limits
            self._respect_rate_limit()
        
        return all_items
    
    def get_products(self, **params) -> List[Dict[str, Any]]:
        """
        Get products from Shopify.
        
        Args:
            **params: Filter parameters for products
            
        Returns:
            List of product objects
        """
        endpoint = "products.json"
        return self._get_all_paginated(endpoint, params)
    
    def get_product(self, product_id: Union[str, int]) -> Optional[Dict[str, Any]]:
        """
        Get a single product by ID.
        
        Args:
            product_id: ID of the product
            
        Returns:
            Product object or None if not found
        """
        endpoint = f"products/{product_id}.json"
        try:
            response = self._make_request("GET", endpoint)
            return response.get("product")
        except requests.RequestException as e:
            self.logger.error(f"Error getting product {product_id}: {e}")
            return None
    
    def create_product(self, product_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new product in Shopify.
        
        Args:
            product_data: Product data
            
        Returns:
            Created product object or None on failure
        """
        endpoint = "products.json"
        data = {"product": product_data}
        
        try:
            response = self._make_request("POST", endpoint, data=data)
            return response.get("product")
        except requests.RequestException as e:
            self.logger.error(f"Error creating product: {e}")
            return None
    
    def update_product(self, product_id: Union[str, int], product_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an existing product in Shopify.
        
        Args:
            product_id: ID of the product to update
            product_data: Updated product data
            
        Returns:
            Updated product object or None on failure
        """
        endpoint = f"products/{product_id}.json"
        data = {"product": product_data}
        
        try:
            response = self._make_request("PUT", endpoint, data=data)
            return response.get("product")
        except requests.RequestException as e:
            self.logger.error(f"Error updating product {product_id}: {e}")
            return None
    
    def create_or_update_product(self, product_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new product or update an existing one.
        
        Args:
            product_data: Product data
            
        Returns:
            Created or updated product object or None on failure
        """
        # Check if product has an ID
        product_id = product_data.get("id")
        
        if product_id:
            # Try to update existing product
            return self.update_product(product_id, product_data)
        else:
            # Create new product
            return self.create_product(product_data)
    
    def delete_product(self, product_id: Union[str, int]) -> bool:
        """
        Delete a product from Shopify.
        
        Args:
            product_id: ID of the product to delete
            
        Returns:
            True if successful, False otherwise
        """
        endpoint = f"products/{product_id}.json"
        
        try:
            self._make_request("DELETE", endpoint)
            return True
        except requests.RequestException as e:
            self.logger.error(f"Error deleting product {product_id}: {e}")
            return False
    
    def get_orders(self, **params) -> List[Dict[str, Any]]:
        """
        Get orders from Shopify.
        
        Args:
            **params: Filter parameters for orders
            
        Returns:
            List of order objects
        """
        endpoint = "orders.json"
        return self._get_all_paginated(endpoint, params)
    
    def get_order(self, order_id: Union[str, int]) -> Optional[Dict[str, Any]]:
        """
        Get a single order by ID.
        
        Args:
            order_id: ID of the order
            
        Returns:
            Order object or None if not found
        """
        endpoint = f"orders/{order_id}.json"
        try:
            response = self._make_request("GET", endpoint)
            return response.get("order")
        except requests.RequestException as e:
            self.logger.error(f"Error getting order {order_id}: {e}")
            return None
    
    def update_order(self, order_id: Union[str, int], order_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an existing order in Shopify.
        
        Args:
            order_id: ID of the order to update
            order_data: Updated order data
            
        Returns:
            Updated order object or None on failure
        """
        endpoint = f"orders/{order_id}.json"
        data = {"order": order_data}
        
        try:
            response = self._make_request("PUT", endpoint, data=data)
            return response.get("order")
        except requests.RequestException as e:
            self.logger.error(f"Error updating order {order_id}: {e}")
            return None
    
    def get_customers(self, **params) -> List[Dict[str, Any]]:
        """
        Get customers from Shopify.
        
        Args:
            **params: Filter parameters for customers
            
        Returns:
            List of customer objects
        """
        endpoint = "customers.json"
        return self._get_all_paginated(endpoint, params)
    
    def get_customer(self, customer_id: Union[str, int]) -> Optional[Dict[str, Any]]:
        """
        Get a single customer by ID.
        
        Args:
            customer_id: ID of the customer
            
        Returns:
            Customer object or None if not found
        """
        endpoint = f"customers/{customer_id}.json"
        try:
            response = self._make_request("GET", endpoint)
            return response.get("customer")
        except requests.RequestException as e:
            self.logger.error(f"Error getting customer {customer_id}: {e}")
            return None
    
    def create_customer(self, customer_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new customer in Shopify.
        
        Args:
            customer_data: Customer data
            
        Returns:
            Created customer object or None on failure
        """
        endpoint = "customers.json"
        data = {"customer": customer_data}
        
        try:
            response = self._make_request("POST", endpoint, data=data)
            return response.get("customer")
        except requests.RequestException as e:
            self.logger.error(f"Error creating customer: {e}")
            return None
    
    def update_customer(self, customer_id: Union[str, int], customer_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an existing customer in Shopify.
        
        Args:
            customer_id: ID of the customer to update
            customer_data: Updated customer data
            
        Returns:
            Updated customer object or None on failure
        """
        endpoint = f"customers/{customer_id}.json"
        data = {"customer": customer_data}
        
        try:
            response = self._make_request("PUT", endpoint, data=data)
            return response.get("customer")
        except requests.RequestException as e:
            self.logger.error(f"Error updating customer {customer_id}: {e}")
            return None
    
    def create_or_update_customer(self, customer_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new customer or update an existing one.
        
        Args:
            customer_data: Customer data
            
        Returns:
            Created or updated customer object or None on failure
        """
        # Check if customer has an ID
        customer_id = customer_data.get("id")
        
        if customer_id:
            # Try to update existing customer
            return self.update_customer(customer_id, customer_data)
        else:
            # Create new customer
            return self.create_customer(customer_data)
    
    def get_inventory_levels(self, **params) -> List[Dict[str, Any]]:
        """
        Get inventory levels from Shopify.
        
        Args:
            **params: Filter parameters for inventory levels
            
        Returns:
            List of inventory level objects
        """
        endpoint = "inventory_levels.json"
        return self._get_all_paginated(endpoint, params)
    
    def set_inventory_level(
        self,
        inventory_item_id: Union[str, int],
        location_id: Union[str, int],
        available: int
    ) -> Optional[Dict[str, Any]]:
        """
        Set inventory level for an item at a location.
        
        Args:
            inventory_item_id: ID of the inventory item
            location_id: ID of the location
            available: Available quantity
            
        Returns:
            Updated inventory level object or None on failure
        """
        endpoint = "inventory_levels/set.json"
        data = {
            "inventory_item_id": inventory_item_id,
            "location_id": location_id,
            "available": available
        }
        
        try:
            response = self._make_request("POST", endpoint, data=data)
            return response.get("inventory_level")
        except requests.RequestException as e:
            self.logger.error(f"Error setting inventory level: {e}")
            return None