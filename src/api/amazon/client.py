"""
Amazon API Client
Main client for interacting with Amazon Selling Partner API
"""

import os
import logging
import time
import json
import random
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

import httpx
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials

from ..abstract.base_client import AbstractEcommerceClient, RateLimitInfo

logger = logging.getLogger(__name__)


class AmazonAPIError(Exception):
    """Amazon API specific error"""
    
    def __init__(self, message: str, code: Optional[str] = None, response: Optional[httpx.Response] = None):
        super().__init__(message)
        self.code = code
        self.response = response
        self.request_id = None
        
        if response and response.headers:
            self.request_id = response.headers.get('x-amz-request-id')


class AmazonAPIClient(AbstractEcommerceClient):
    """
    Amazon Selling Partner API client
    Implements the AbstractEcommerceClient interface for Amazon
    """
    
    # Default API endpoint
    BASE_URL = "https://sellingpartnerapi-na.amazon.com"
    API_VERSION = "v0"
    
    def __init__(self, credentials: Dict[str, Any]):
        """
        Initialize Amazon API client
        
        Args:
            credentials: Dictionary containing:
                - AWS_ACCESS_KEY_ID: AWS access key
                - AWS_SECRET_ACCESS_KEY: AWS secret key
                - AMAZON_SELLER_ID: Amazon seller ID
                - AMAZON_MARKETPLACE_ID: Amazon marketplace ID
                - AMAZON_APP_CLIENT_ID: Application client ID
                - AMAZON_APP_CLIENT_SECRET: Application client secret
                - AMAZON_API_ENDPOINT: (Optional) API endpoint
                - AMAZON_API_TEST_MODE: (Optional) Test mode flag
                - AMAZON_AUTH_METHOD: (Optional) Authentication method ('client_credentials' or 'authorization_code')
                - AMAZON_REDIRECT_URI: (Optional) Redirect URI for OAuth flow
                - AMAZON_REFRESH_TOKEN: (Optional) Refresh token for OAuth flow
        """
        super().__init__("amazon", credentials)
        
        # Override BASE_URL from environment if provided
        base_url_env = credentials.get('AMAZON_API_ENDPOINT')
        if base_url_env:
            self.__class__.BASE_URL = base_url_env
            logger.info(f"Using custom Amazon API endpoint: {self.BASE_URL}")
        
        # AWS credentials
        self.aws_access_key = credentials.get('AWS_ACCESS_KEY_ID')
        self.aws_secret_key = credentials.get('AWS_SECRET_ACCESS_KEY')
        
        # Amazon credentials
        self.seller_id = credentials.get('AMAZON_SELLER_ID')
        self.marketplace_id = credentials.get('AMAZON_MARKETPLACE_ID')
        self.client_id = credentials.get('AMAZON_APP_CLIENT_ID')
        self.client_secret = credentials.get('AMAZON_APP_CLIENT_SECRET')
        
        # OAuth settings
        self.auth_method = credentials.get('AMAZON_AUTH_METHOD', 'client_credentials')
        self.redirect_uri = credentials.get('AMAZON_REDIRECT_URI')
        self.refresh_token = credentials.get('AMAZON_REFRESH_TOKEN')
        
        # Test mode
        self.test_mode = credentials.get('AMAZON_API_TEST_MODE', 'false') == 'true'
        if self.test_mode:
            logger.info("Running in test mode")
        
        # HTTP client
        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=30.0
        )
        
        # Auth token cache
        self.auth_token = None
        self.token_expiry = None
        
        # Rate limit tracking
        self.rate_limit_info = RateLimitInfo(
            requests_remaining=20,  # Conservative initial value
            requests_limit=20,
            reset_time=None
        )
    
    async def authenticate(self) -> bool:
        """
        Authenticate with Amazon API
        
        Returns:
            True if authentication successful
        """
        try:
            # Check if we have a valid token
            if self.auth_token and self.token_expiry and datetime.now() < self.token_expiry:
                logger.debug("Using cached auth token")
                return True
            
            logger.info(f"Requesting new auth token using {self.auth_method} method")
            
            # Get LWA (Login with Amazon) token
            async with httpx.AsyncClient(timeout=30.0) as client:
                if self.auth_method == 'client_credentials':
                    # Client credentials flow (simplest machine-to-machine auth)
                    response = await client.post(
                        "https://api.amazon.com/auth/o2/token",
                        data={
                            "grant_type": "client_credentials",
                            "client_id": self.client_id,
                            "client_secret": self.client_secret,
                            "scope": "sellingpartnerapi::notifications"
                        },
                        headers={
                            "Content-Type": "application/x-www-form-urlencoded"
                        }
                    )
                elif self.auth_method == 'refresh_token' and self.refresh_token:
                    # Refresh token flow (for OAuth apps)
                    response = await client.post(
                        "https://api.amazon.com/auth/o2/token",
                        data={
                            "grant_type": "refresh_token",
                            "refresh_token": self.refresh_token,
                            "client_id": self.client_id,
                            "client_secret": self.client_secret
                        },
                        headers={
                            "Content-Type": "application/x-www-form-urlencoded"
                        }
                    )
                else:
                    logger.error(f"Unsupported auth method: {self.auth_method}")
                    return False
                
                if response.status_code != 200:
                    logger.error(f"Auth failed: {response.status_code} {response.text}")
                    return False
                
                token_data = response.json()
                self.auth_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", 3600)
                
                # Update refresh token if provided
                if token_data.get("refresh_token"):
                    self.refresh_token = token_data.get("refresh_token")
                    logger.info("Received new refresh token")
                
                # Set expiry time with a buffer of 5 minutes
                self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
                
                logger.info(f"Authentication successful, token expires in {expires_in} seconds")
                return True
        
        except Exception as e:
            logger.exception(f"Authentication error: {e}")
            return False
            
    def get_authorization_url(self) -> str:
        """
        Generate authorization URL for OAuth flow
        
        Returns:
            Authorization URL to redirect user to
        """
        if not self.redirect_uri:
            raise AmazonAPIError("Redirect URI not set")
        
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": "sellingpartnerapi::notifications",
            "state": "state123"  # Should be a random state for security
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"https://sellercentral.amazon.com/apps/authorize?{query_string}"
    
    async def exchange_authorization_code(self, authorization_code: str) -> bool:
        """
        Exchange authorization code for access token
        
        Args:
            authorization_code: Authorization code from redirect
            
        Returns:
            True if exchange successful
        """
        if not self.redirect_uri:
            raise AmazonAPIError("Redirect URI not set")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.amazon.com/auth/o2/token",
                    data={
                        "grant_type": "authorization_code",
                        "code": authorization_code,
                        "redirect_uri": self.redirect_uri,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"Code exchange failed: {response.status_code} {response.text}")
                    return False
                
                token_data = response.json()
                self.auth_token = token_data.get("access_token")
                self.refresh_token = token_data.get("refresh_token")
                expires_in = token_data.get("expires_in", 3600)
                
                # Set expiry time with a buffer of 5 minutes
                self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
                
                # Update auth method to use refresh token flow in the future
                self.auth_method = "refresh_token"
                
                logger.info(f"Authorization code exchange successful, token expires in {expires_in} seconds")
                return True
                
        except Exception as e:
            logger.exception(f"Authorization code exchange error: {e}")
            return False
    
    async def check_connection(self) -> bool:
        """
        Check if the API connection is working
        
        Returns:
            True if connection is healthy
        """
        try:
            # Try a simple authenticated API call as a connection test
            # Use a simpler endpoint that is less likely to have permission issues
            endpoint = f"/notifications/{self.API_VERSION}/destinations"
            
            try:
                response = await self._make_request('GET', endpoint)
                return response.status_code in (200, 403, 404, 429)  # Even auth errors mean connection works
            except AmazonAPIError as e:
                # API errors still indicate a working connection
                if hasattr(e, 'response') and e.response and e.response.status_code:
                    return e.response.status_code in (200, 403, 404, 429)
                return False
        
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
    
    async def _sign_request(self, method: str, url: str, data: Optional[Any] = None) -> Dict[str, str]:
        """
        Sign request with AWS Signature V4
        
        Args:
            method: HTTP method
            url: Full URL
            data: Request body
            
        Returns:
            Dictionary of headers
        """
        # Create AWS credentials
        credentials = Credentials(
            access_key=self.aws_access_key,
            secret_key=self.aws_secret_key
        )
        
        # Parse URL
        url_parts = httpx.URL(url)
        
        # Create AWS request
        request = AWSRequest(
            method=method,
            url=str(url),
            data=json.dumps(data) if data else None
        )
        
        # Add headers correctly based on botocore version
        headers = request.headers
        
        # Check if headers object has add method or uses dict-like interface
        if hasattr(headers, 'add'):
            # Old style
            if data:
                headers.add("Content-Type", "application/json")
            headers.add("Host", url_parts.host)
            headers.add("User-Agent", "Conea/1.0 (Amazon SP API Client)")
            if self.auth_token:
                headers.add("x-amz-access-token", self.auth_token)
        else:
            # New style (dict-like interface)
            if data:
                headers["Content-Type"] = "application/json"
            headers["Host"] = url_parts.host
            headers["User-Agent"] = "Conea/1.0 (Amazon SP API Client)"
            if self.auth_token:
                headers["x-amz-access-token"] = self.auth_token
        
        # Sign the request
        SigV4Auth(credentials, "execute-api", "us-east-1").add_auth(request)
        
        # Convert to dictionary
        return dict(request.headers)
    
    async def _make_request(self,
                           method: str,
                           endpoint: str,
                           data: Optional[Dict[str, Any]] = None,
                           params: Optional[Dict[str, Any]] = None) -> httpx.Response:
        """
        Make authenticated request to Amazon API
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request body data
            params: Query parameters
            
        Returns:
            HTTP response
        """
        # Ensure valid token
        if not await self.authenticate():
            raise AmazonAPIError("Failed to authenticate with Amazon API")
        
        # Prepare URL
        if endpoint.startswith(('http://', 'https://')):
            url = endpoint
        elif endpoint.startswith('/'):
            url = f"{self.BASE_URL}{endpoint}"
        else:
            url = f"{self.BASE_URL}/{endpoint}"
        
        # Sign request
        headers = await self._sign_request(method, url, data)
        
        # Make request
        try:
            logger.debug(f"Making {method} request to {url}")
            
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
                error_data = {}
                try:
                    if response.content:
                        error_data = response.json()
                except Exception:
                    error_data = {'message': response.text}
                
                error_code = str(response.status_code)
                error_message = error_data.get('message', 'Unknown error')
                
                if response.status_code == 429:
                    error_message = "Rate limit exceeded"
                
                logger.error(f"Amazon API error: {error_code} - {error_message}")
                raise AmazonAPIError(error_message, code=error_code, response=response)
            
            return response
        
        except httpx.RequestError as e:
            logger.error(f"Request failed: {e}")
            raise AmazonAPIError(f"Request failed: {e}")
    
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
            
            except AmazonAPIError as e:
                last_exception = e
                
                # Check if it's a rate limit error
                if hasattr(e, 'response') and e.response and e.response.status_code == 429:
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
        # Amazon uses x-amzn-RateLimit-Limit and x-amzn-RateLimit-Remaining
        if 'x-amzn-RateLimit-Limit' in headers:
            self.rate_limit_info.requests_limit = int(float(headers['x-amzn-RateLimit-Limit']))
        
        if 'x-amzn-RateLimit-Remaining' in headers:
            self.rate_limit_info.requests_remaining = int(float(headers['x-amzn-RateLimit-Remaining']))
        
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
            product_id: Product identifier (ASIN)
            
        Returns:
            Product data dictionary
        """
        endpoint = f"/catalog/{self.API_VERSION}/items/{product_id}"
        params = {
            "marketplaceIds": self.marketplace_id,
            "includedData": "attributes,dimensions,identifiers,images,productTypes,relationships,salesRanks"
        }
        
        response = await self._make_request_with_retry('GET', endpoint, params=params)
        data = response.json()
        
        # Transform to common format
        result = {
            "id": product_id,
            "title": data.get("attributes", {}).get("title", {}).get("value", ""),
            "description": data.get("attributes", {}).get("productDescription", {}).get("value", ""),
            "price": None,  # Need separate pricing API call
            "images": [],
            "brand": data.get("attributes", {}).get("brand", {}).get("value", ""),
            "sku": None,  # Need inventory API call
            "created_at": None,
            "updated_at": None,
        }
        
        # Extract images
        images_data = data.get("images", [])
        if images_data:
            for image in images_data:
                result["images"].append({
                    "url": image.get("link", ""),
                    "position": image.get("height", 0),  # Using height as position is not ideal
                    "alt": "",
                })
        
        return result
    
    async def get_products(self,
                         limit: int = 50,
                         offset: int = 0,
                         filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get list of products
        
        Args:
            limit: Maximum number of products
            offset: Number of products to skip
            filters: Optional filters (query, category, etc.)
            
        Returns:
            List of product dictionaries
        """
        endpoint = f"/catalog/{self.API_VERSION}/items"
        
        # Prepare parameters
        params = {
            "marketplaceIds": self.marketplace_id,
            "maxResults": min(limit, 100),  # Amazon caps at 100
            "includedData": "attributes,images,productTypes"
        }
        
        # Add filters if provided
        if filters:
            if "query" in filters:
                params["query"] = filters["query"]
            if "category" in filters:
                params["brandNames"] = filters["category"]
        
        # Handle pagination
        if offset > 0 and filters.get("next_token"):
            params["nextToken"] = filters["next_token"]
        
        response = await self._make_request_with_retry('GET', endpoint, params=params)
        data = response.json()
        
        products = []
        next_token = data.get("nextToken")
        
        for item in data.get("items", []):
            product = {
                "id": item.get("asin", ""),
                "title": item.get("attributes", {}).get("title", {}).get("value", ""),
                "description": item.get("attributes", {}).get("productDescription", {}).get("value", ""),
                "brand": item.get("attributes", {}).get("brand", {}).get("value", ""),
                "images": [],
                "next_token": next_token  # Pass token for pagination
            }
            
            # Extract images
            images_data = item.get("images", [])
            if images_data:
                for image in images_data:
                    product["images"].append({
                        "url": image.get("link", ""),
                        "position": image.get("height", 0),
                        "alt": "",
                    })
            
            products.append(product)
        
        return products
    
    async def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new product (Not supported by Amazon API)
        
        Args:
            product_data: Product data to create
            
        Raises:
            NotImplementedError: Amazon doesn't support product creation via API
        """
        raise NotImplementedError("Amazon SP API doesn't support product creation")
    
    async def update_product(self, product_id: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing product (Limited support in Amazon API)
        
        Args:
            product_id: Product identifier
            product_data: Product data to update
            
        Returns:
            Updated product data
        """
        # Amazon doesn't allow updating product details, only inventory
        # Redirect to inventory update if stock is provided
        if "stock" in product_data:
            await self.update_inventory(
                product_id,
                product_data["stock"],
                product_data.get("sku")
            )
            return await self.get_product(product_id)
        
        raise NotImplementedError("Amazon SP API doesn't support updating product details")
    
    async def delete_product(self, product_id: str) -> bool:
        """
        Delete a product (Not supported by Amazon API)
        
        Args:
            product_id: Product identifier
            
        Raises:
            NotImplementedError: Amazon doesn't support product deletion via API
        """
        raise NotImplementedError("Amazon SP API doesn't support product deletion")
    
    # Order operations
    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """
        Get a single order by ID
        
        Args:
            order_id: Order identifier
            
        Returns:
            Order data dictionary
        """
        endpoint = f"/orders/{self.API_VERSION}/orders/{order_id}"
        
        response = await self._make_request_with_retry('GET', endpoint)
        data = response.json().get("payload", {})
        
        # Transform to common format
        result = {
            "id": order_id,
            "status": data.get("orderStatus", ""),
            "created_at": data.get("purchaseDate", ""),
            "updated_at": data.get("lastUpdateDate", ""),
            "customer": {
                "id": None,  # Amazon doesn't provide customer ID
                "email": data.get("buyerInfo", {}).get("buyerEmail", ""),
                "name": data.get("buyerInfo", {}).get("buyerName", ""),
            },
            "shipping_address": {},
            "items": [],
            "total_price": data.get("orderTotal", {}).get("amount", 0),
            "currency": data.get("orderTotal", {}).get("currencyCode", ""),
        }
        
        # Get order items
        items_endpoint = f"/orders/{self.API_VERSION}/orders/{order_id}/orderItems"
        items_response = await self._make_request_with_retry('GET', items_endpoint)
        items_data = items_response.json().get("payload", {}).get("orderItems", [])
        
        for item in items_data:
            result["items"].append({
                "id": item.get("orderItemId", ""),
                "product_id": item.get("asin", ""),
                "sku": item.get("sellerSku", ""),
                "name": item.get("title", ""),
                "quantity": int(item.get("quantityOrdered", 0)),
                "price": float(item.get("itemPrice", {}).get("amount", 0)),
                "currency": item.get("itemPrice", {}).get("currencyCode", ""),
            })
        
        return result
    
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
        endpoint = f"/orders/{self.API_VERSION}/orders"
        
        # Prepare parameters
        params = {
            "marketplaceIds": self.marketplace_id,
            "maxResultsPerPage": min(limit, 100),  # Amazon caps at 100
        }
        
        # Add filters if provided
        if filters:
            if "created_after" in filters:
                params["createdAfter"] = filters["created_after"]
            if "created_before" in filters:
                params["createdBefore"] = filters["created_before"]
            if "status" in filters:
                params["orderStatuses"] = filters["status"]
            if "next_token" in filters:
                params["nextToken"] = filters["next_token"]
        
        response = await self._make_request_with_retry('GET', endpoint, params=params)
        data = response.json().get("payload", {})
        
        orders = []
        next_token = data.get("nextToken")
        
        for order in data.get("orders", []):
            orders.append({
                "id": order.get("amazonOrderId", ""),
                "status": order.get("orderStatus", ""),
                "created_at": order.get("purchaseDate", ""),
                "updated_at": order.get("lastUpdateDate", ""),
                "total_price": order.get("orderTotal", {}).get("amount", 0),
                "currency": order.get("orderTotal", {}).get("currencyCode", ""),
                "customer_name": order.get("buyerInfo", {}).get("buyerName", ""),
                "next_token": next_token  # Pass token for pagination
            })
        
        return orders
    
    async def create_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new order (Not supported by Amazon API)
        
        Args:
            order_data: Order data to create
            
        Raises:
            NotImplementedError: Amazon doesn't support order creation via API
        """
        raise NotImplementedError("Amazon SP API doesn't support order creation")
    
    async def update_order(self, order_id: str, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing order (Limited support in Amazon API)
        
        Args:
            order_id: Order identifier
            order_data: Order data to update
            
        Returns:
            Updated order data
        """
        # Amazon only allows updating shipment status
        if "status" in order_data and order_data["status"] == "SHIPPED":
            await self._update_shipment_status(order_id, order_data)
            return await self.get_order(order_id)
        
        raise NotImplementedError("Amazon SP API only supports updating shipment status")
    
    async def _update_shipment_status(self, order_id: str, order_data: Dict[str, Any]):
        """
        Update shipment status
        
        Args:
            order_id: Order identifier
            order_data: Shipment data including tracking number
        """
        endpoint = f"/orders/{self.API_VERSION}/orders/{order_id}/shipment"
        
        # Get order items
        items_endpoint = f"/orders/{self.API_VERSION}/orders/{order_id}/orderItems"
        items_response = await self._make_request_with_retry('GET', items_endpoint)
        items_data = items_response.json().get("payload", {}).get("orderItems", [])
        
        item_ids = [item.get("orderItemId") for item in items_data]
        
        # Prepare shipment data
        data = {
            "marketplaceId": self.marketplace_id,
            "shipmentStatus": "SHIPPED",
            "orderItems": [{"orderItemId": item_id, "quantity": 1} for item_id in item_ids]
        }
        
        if "tracking_number" in order_data:
            data["trackingNumber"] = order_data["tracking_number"]
        
        if "carrier_code" in order_data:
            data["carrierCode"] = order_data["carrier_code"]
        
        await self._make_request_with_retry('POST', endpoint, data=data)
    
    async def cancel_order(self, order_id: str, reason: Optional[str] = None) -> bool:
        """
        Cancel an order (Limited support in Amazon API)
        
        Args:
            order_id: Order identifier
            reason: Cancellation reason
            
        Returns:
            True if cancellation successful
        """
        # Most orders can't be cancelled via API once they're in progress
        logger.warning("Amazon SP API has limited support for cancelling orders")
        
        try:
            endpoint = f"/orders/{self.API_VERSION}/orders/{order_id}/cancellation"
            
            data = {
                "cancelReason": reason or "OTHER"
            }
            
            await self._make_request_with_retry('POST', endpoint, data=data)
            return True
        
        except AmazonAPIError as e:
            logger.error(f"Failed to cancel order {order_id}: {e}")
            return False
    
    # Inventory operations
    async def get_inventory(self, product_id: str) -> Dict[str, Any]:
        """
        Get inventory for a product
        
        Args:
            product_id: Product identifier (ASIN) or SKU
            
        Returns:
            Inventory data dictionary
        """
        # Amazon requires SKU for inventory operations
        if len(product_id) != 10:  # Not an ASIN, assuming it's a SKU
            sku = product_id
        else:
            # Need to get SKU from listings
            sku = await self._get_sku_from_asin(product_id)
            if not sku:
                raise AmazonAPIError(f"Could not find SKU for ASIN {product_id}")
        
        endpoint = f"/inventory/{self.API_VERSION}/inventories"
        params = {
            "marketplaceIds": self.marketplace_id,
            "sellerSkus": sku
        }
        
        response = await self._make_request_with_retry('GET', endpoint, params=params)
        data = response.json().get("payload", {}).get("inventories", [])
        
        if not data:
            raise AmazonAPIError(f"No inventory found for SKU {sku}")
        
        inventory = data[0]
        
        return {
            "product_id": product_id,
            "sku": sku,
            "quantity": int(inventory.get("availableQuantity", 0)),
            "available": int(inventory.get("availableQuantity", 0)) > 0,
            "reserved": int(inventory.get("reservedQuantity", 0)),
            "updated_at": datetime.now().isoformat()
        }
    
    async def _get_sku_from_asin(self, asin: str) -> Optional[str]:
        """
        Get seller SKU from ASIN
        
        Args:
            asin: Amazon Standard Identification Number
            
        Returns:
            Seller SKU if found, None otherwise
        """
        endpoint = f"/listings/{self.API_VERSION}/items/{asin}"
        params = {
            "marketplaceIds": self.marketplace_id,
            "includedData": "summaries"
        }
        
        try:
            response = await self._make_request_with_retry('GET', endpoint, params=params)
            data = response.json().get("summaries", [])
            
            if data and len(data) > 0:
                return data[0].get("sellerSku")
            
            return None
        
        except AmazonAPIError:
            return None
    
    async def update_inventory(self, product_id: str, quantity: int, sku: Optional[str] = None) -> Dict[str, Any]:
        """
        Update inventory quantity
        
        Args:
            product_id: Product identifier (ASIN)
            quantity: New quantity
            sku: Optional seller SKU
            
        Returns:
            Updated inventory data
        """
        # Amazon requires SKU for inventory operations
        if not sku:
            if len(product_id) != 10:  # Not an ASIN, assuming it's a SKU
                sku = product_id
            else:
                # Need to get SKU from listings
                sku = await self._get_sku_from_asin(product_id)
                if not sku:
                    raise AmazonAPIError(f"Could not find SKU for ASIN {product_id}")
        
        endpoint = f"/inventory/{self.API_VERSION}/inventories/{sku}"
        data = {
            "inventories": {
                "marketplaceId": self.marketplace_id,
                "availableQuantity": quantity
            }
        }
        
        await self._make_request_with_retry('PUT', endpoint, data=data)
        
        # Get updated inventory
        return await self.get_inventory(sku)
    
    # Customer operations
    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """
        Get a single customer by ID
        
        Args:
            customer_id: Customer identifier
            
        Returns:
            Customer data dictionary
        """
        # Amazon API does not provide direct customer data access
        # Use order data to get customer information
        raise NotImplementedError("Amazon SP API doesn't provide direct customer data access")
    
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
        # Amazon API does not provide direct customer data access
        raise NotImplementedError("Amazon SP API doesn't provide direct customer data access")
    
    async def update_order_status(self, order_id: str, status: str) -> Dict[str, Any]:
        """
        Update order status
        
        Args:
            order_id: Order identifier
            status: New status
            
        Returns:
            Updated order data
        """
        order_data = {"status": status}
        
        # Map to specific update method based on status
        if status.upper() == "SHIPPED":
            await self._update_shipment_status(order_id, order_data)
        elif status.upper() == "CANCELED" or status.upper() == "CANCELLED":
            await self.cancel_order(order_id)
        else:
            raise AmazonAPIError(f"Unsupported order status: {status}")
        
        # Return updated order
        return await self.get_order(order_id)
        
    # Platform-specific features
    def get_platform_features(self) -> Dict[str, bool]:
        """
        Get platform-specific feature availability
        
        Returns:
            Dictionary of feature flags
        """
        return {
            "variants": True,
            "bundles": True,
            "categories": True,
            "reviews": True,
            "inventory_tracking": True,
            "multi_currency": True,
            "multi_language": True,
            "custom_fields": False,
            "digital_products": True,
            "subscriptions": True,
            "tax_management": True,
            "shipping_zones": True,
            "gift_cards": False,
            "discounts": True,
            "customer_groups": False,
            "b2b_features": True,
            "marketplace": True,
            "dropshipping": True,
            "pos_integration": False,
            "social_commerce": False,
            "mobile_app": True,
            "analytics": True,
            "seo_tools": False,
            "email_marketing": False,
            "abandoned_cart": False,
            "loyalty_program": False,
            "wishlist": True,
            "product_questions": True,
            "live_chat": False,
            "ai_recommendations": True,
            "bulk_operations": True,
            "api_rate_limits": True,
            "webhooks": True,
        }
    
    async def close(self):
        """Close connections"""
        await self.client.aclose()