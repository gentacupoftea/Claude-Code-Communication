"""
Rakuten RMS Client - API client for Rakuten RMS operations.

This module provides a client for interacting with the Rakuten RMS API,
implementing the operations needed for data synchronization with Shopify.
"""

import logging
import time
import json
import base64
import hmac
import hashlib
import urllib.parse
import requests
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime, timedelta


class RakutenClient:
    """
    Client for interacting with the Rakuten RMS API.
    
    This client provides methods for retrieving, creating, and updating
    various Rakuten resources, with support for authentication, rate limiting,
    and pagination.
    """
    
    def __init__(
        self,
        service_secret: str,
        license_key: str,
        shop_url: str,
        rate_limit_delay: float = 1.0,
        max_retries: int = 3,
        timeout: int = 30
    ):
        """
        Initialize the Rakuten RMS client.
        
        Args:
            service_secret: Rakuten RMS service secret
            license_key: Rakuten RMS license key
            shop_url: URL of the Rakuten shop
            rate_limit_delay: Delay between API calls to respect rate limits
            max_retries: Maximum number of retry attempts for failed requests
            timeout: Request timeout in seconds
        """
        self.service_secret = service_secret
        self.license_key = license_key
        self.shop_url = shop_url
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self.timeout = timeout
        
        # Define API endpoints
        self.rest_base_url = "https://api.rms.rakuten.co.jp/es/1.0/"
        self.inventory_base_url = "https://api.rms.rakuten.co.jp/inventoryapi/1.0/"
        self.order_base_url = "https://api.rms.rakuten.co.jp/OrderAPI/1.0/"
        
        # Session for connection pooling
        self.session = requests.Session()
        
        # Rate limiting tracking
        self.last_request_time = 0
        
        # Setup logging
        self.logger = logging.getLogger("RakutenClient")
    
    def __del__(self):
        """Clean up resources when the client is garbage collected."""
        if hasattr(self, 'session'):
            self.session.close()
    
    def _generate_authentication_header(self) -> Dict[str, str]:
        """
        Generate authentication headers for Rakuten API.
        
        Returns:
            Dictionary of authentication headers
        """
        return {
            "Authorization": f"ESA {self.license_key}:{self.service_secret}"
        }
    
    def _make_request(
        self,
        method: str,
        base_url: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Make a request to the Rakuten API with rate limiting and retries.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            base_url: Base URL for the API
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
        url = base_url + endpoint
        
        # Prepare headers
        request_headers = self._generate_authentication_header()
        request_headers["Content-Type"] = "application/json"
        
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
                
                # Raise for error status codes
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
        Ensure we respect Rakuten's rate limits by adding delay if needed.
        """
        if self.last_request_time > 0:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.rate_limit_delay:
                time.sleep(self.rate_limit_delay - elapsed)
    
    def get_products(self, **params) -> List[Dict[str, Any]]:
        """
        Get products from Rakuten.
        
        Args:
            **params: Filter parameters for products
            
        Returns:
            List of product objects
        """
        all_items = []
        page = 1
        page_size = params.get("page_size", 100)
        
        while True:
            # Prepare query parameters
            query_params = {
                "offset": (page - 1) * page_size,
                "limit": page_size
            }
            
            # Add additional parameters
            for key, value in params.items():
                if key != "page_size":
                    query_params[key] = value
            
            # Make request
            endpoint = "item/search"
            try:
                response = self._make_request("GET", self.rest_base_url, endpoint, params=query_params)
                
                # Extract items
                items = response.get("items", [])
                all_items.extend(items)
                
                # Check if we've received all pages
                total_count = response.get("totalCount", 0)
                if len(all_items) >= total_count or not items:
                    break
                
                # Move to next page
                page += 1
                
            except requests.RequestException as e:
                self.logger.error(f"Error getting products from Rakuten: {e}")
                break
        
        # Transform to a more consistent format
        transformed_items = []
        for item in all_items:
            # Extract main product data
            product = {
                "id": item.get("itemUrl"),
                "title": item.get("itemName", ""),
                "description": item.get("itemDescription", ""),
                "price": item.get("itemPrice", 0),
                "sku": item.get("itemCode", ""),
                "status": item.get("itemStatus", ""),
                "updated_at": item.get("lastUpdateDate"),
                "created_at": item.get("registDate"),
                "images": [],
                "variants": []
            }
            
            # Extract inventory
            product["inventory"] = item.get("inventoryCount", 0)
            
            # Extract images
            if "mediumImageUrls" in item:
                for img_url in item["mediumImageUrls"]:
                    product["images"].append({
                        "url": img_url,
                        "position": len(product["images"]) + 1
                    })
            
            # Extract variants
            if "options" in item:
                for option in item["options"]:
                    variant = {
                        "option_name": option.get("optionName", ""),
                        "option_values": option.get("optionValues", [])
                    }
                    product["variants"].append(variant)
            
            transformed_items.append(product)
        
        return transformed_items
    
    def get_product(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single product by ID.
        
        Args:
            product_id: ID or item URL of the product
            
        Returns:
            Product object or None if not found
        """
        endpoint = "item/get"
        try:
            response = self._make_request(
                "GET", 
                self.rest_base_url, 
                endpoint, 
                params={"itemUrl": product_id}
            )
            
            item = response.get("item", {})
            if not item:
                return None
            
            # Transform to a more consistent format
            product = {
                "id": item.get("itemUrl"),
                "title": item.get("itemName", ""),
                "description": item.get("itemDescription", ""),
                "price": item.get("itemPrice", 0),
                "sku": item.get("itemCode", ""),
                "status": item.get("itemStatus", ""),
                "updated_at": item.get("lastUpdateDate"),
                "created_at": item.get("registDate"),
                "images": [],
                "variants": []
            }
            
            # Extract inventory
            product["inventory"] = item.get("inventoryCount", 0)
            
            # Extract images
            if "mediumImageUrls" in item:
                for img_url in item["mediumImageUrls"]:
                    product["images"].append({
                        "url": img_url,
                        "position": len(product["images"]) + 1
                    })
            
            # Extract variants
            if "options" in item:
                for option in item["options"]:
                    variant = {
                        "option_name": option.get("optionName", ""),
                        "option_values": option.get("optionValues", [])
                    }
                    product["variants"].append(variant)
            
            return product
            
        except requests.RequestException as e:
            self.logger.error(f"Error getting product {product_id} from Rakuten: {e}")
            return None
    
    def update_product(self, product_id: str, product_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an existing product in Rakuten.
        
        Args:
            product_id: ID or item URL of the product to update
            product_data: Updated product data
            
        Returns:
            Updated product object or None on failure
        """
        endpoint = "item/update"
        
        # Transform to Rakuten format
        rakuten_item = {
            "itemUrl": product_id,
            "itemName": product_data.get("title", ""),
            "itemDescription": product_data.get("description", ""),
            "itemPrice": product_data.get("price", 0)
        }
        
        # Add inventory if provided
        if "inventory" in product_data:
            rakuten_item["inventoryCount"] = product_data["inventory"]
        
        # Add images if provided
        if "images" in product_data and product_data["images"]:
            rakuten_item["mediumImageUrls"] = [
                img["url"] for img in product_data["images"]
            ]
        
        # Add variants if provided
        if "variants" in product_data and product_data["variants"]:
            rakuten_item["options"] = []
            for variant in product_data["variants"]:
                option = {
                    "optionName": variant.get("option_name", ""),
                    "optionValues": variant.get("option_values", [])
                }
                rakuten_item["options"].append(option)
        
        try:
            response = self._make_request(
                "POST",
                self.rest_base_url,
                endpoint,
                data={"item": rakuten_item}
            )
            
            # Check for success
            if response.get("status") == "OK":
                # Fetch the updated product to return
                return self.get_product(product_id)
            else:
                self.logger.error(f"Error updating product {product_id}: {response.get('error')}")
                return None
                
        except requests.RequestException as e:
            self.logger.error(f"Error updating product {product_id}: {e}")
            return None
    
    def create_product(self, product_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new product in Rakuten.
        
        Args:
            product_data: Product data
            
        Returns:
            Created product object or None on failure
        """
        endpoint = "item/insert"
        
        # Transform to Rakuten format
        rakuten_item = {
            "itemName": product_data.get("title", ""),
            "itemDescription": product_data.get("description", ""),
            "itemPrice": product_data.get("price", 0),
            "itemCode": product_data.get("sku", "")
        }
        
        # Generate item URL if not provided
        if "id" in product_data:
            rakuten_item["itemUrl"] = product_data["id"]
        else:
            # Generate a URL slug from the title
            title_slug = product_data.get("title", "").lower().replace(" ", "-")
            rakuten_item["itemUrl"] = f"{title_slug}-{int(time.time())}"
        
        # Add inventory if provided
        if "inventory" in product_data:
            rakuten_item["inventoryCount"] = product_data["inventory"]
        
        # Add images if provided
        if "images" in product_data and product_data["images"]:
            rakuten_item["mediumImageUrls"] = [
                img["url"] for img in product_data["images"]
            ]
        
        # Add variants if provided
        if "variants" in product_data and product_data["variants"]:
            rakuten_item["options"] = []
            for variant in product_data["variants"]:
                option = {
                    "optionName": variant.get("option_name", ""),
                    "optionValues": variant.get("option_values", [])
                }
                rakuten_item["options"].append(option)
        
        try:
            response = self._make_request(
                "POST",
                self.rest_base_url,
                endpoint,
                data={"item": rakuten_item}
            )
            
            # Check for success
            if response.get("status") == "OK":
                # Return the created product with the assigned itemUrl
                return self.get_product(rakuten_item["itemUrl"])
            else:
                self.logger.error(f"Error creating product: {response.get('error')}")
                return None
                
        except requests.RequestException as e:
            self.logger.error(f"Error creating product: {e}")
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
            # First try to get the product to see if it exists
            existing_product = self.get_product(product_id)
            
            if existing_product:
                # Update existing product
                return self.update_product(product_id, product_data)
            else:
                # Create new product with specified ID
                return self.create_product(product_data)
        else:
            # Create new product with generated ID
            return self.create_product(product_data)
    
    def delete_product(self, product_id: str) -> bool:
        """
        Delete a product from Rakuten.
        
        Args:
            product_id: ID or item URL of the product to delete
            
        Returns:
            True if successful, False otherwise
        """
        endpoint = "item/delete"
        
        try:
            response = self._make_request(
                "POST",
                self.rest_base_url,
                endpoint,
                data={"itemUrl": product_id}
            )
            
            # Check for success
            return response.get("status") == "OK"
                
        except requests.RequestException as e:
            self.logger.error(f"Error deleting product {product_id}: {e}")
            return False
    
    def get_orders(self, **params) -> List[Dict[str, Any]]:
        """
        Get orders from Rakuten.
        
        Args:
            **params: Filter parameters for orders
            
        Returns:
            List of order objects
        """
        endpoint = "order/searchOrder"
        
        # Prepare query parameters
        query_params = {}
        
        # Add date range if provided
        if "dateType" in params:
            query_params["dateType"] = params["dateType"]
        else:
            query_params["dateType"] = "1"  # Order date
        
        if "startDatetime" in params:
            query_params["startDatetime"] = params["startDatetime"]
        
        if "endDatetime" in params:
            query_params["endDatetime"] = params["endDatetime"]
        elif "startDatetime" in query_params:
            # If only start date is provided, default to current time for end date
            query_params["endDatetime"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Add order parameters
        for key in ["orderProgressList", "shopStatus", "ordererName"]:
            if key in params:
                query_params[key] = params[key]
        
        # Handle pagination
        page_size = params.get("page_size", 100)
        query_params["maxResults"] = page_size
        
        all_orders = []
        page_number = 1
        
        while True:
            query_params["page"] = page_number
            
            try:
                response = self._make_request(
                    "GET",
                    self.order_base_url,
                    endpoint,
                    params=query_params
                )
                
                # Extract orders
                orders = response.get("orderSearchResult", {}).get("orderInfo", [])
                
                if not orders:
                    break
                
                # Process and transform orders
                transformed_orders = []
                for order in orders:
                    transformed_order = self._transform_rakuten_order(order)
                    transformed_orders.append(transformed_order)
                
                all_orders.extend(transformed_orders)
                
                # Check if we need to fetch more pages
                if len(orders) < page_size:
                    break
                
                page_number += 1
                
            except requests.RequestException as e:
                self.logger.error(f"Error getting orders from Rakuten: {e}")
                break
        
        return all_orders
    
    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single order by ID.
        
        Args:
            order_id: ID of the order
            
        Returns:
            Order object or None if not found
        """
        endpoint = "order/getOrder"
        
        try:
            response = self._make_request(
                "GET",
                self.order_base_url,
                endpoint,
                params={"orderNumber": order_id}
            )
            
            # Extract order
            order = response.get("orderModel")
            if not order:
                return None
            
            # Transform order
            return self._transform_rakuten_order(order)
            
        except requests.RequestException as e:
            self.logger.error(f"Error getting order {order_id} from Rakuten: {e}")
            return None
    
    def update_order(self, order_id: str, order_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an existing order in Rakuten.
        
        Args:
            order_id: ID of the order to update
            order_data: Updated order data
            
        Returns:
            Updated order object or None on failure
        """
        endpoint = "order/updateOrder"
        
        # Transform to Rakuten format
        rakuten_order = {
            "orderNumber": order_id,
            "status": order_data.get("status")
        }
        
        # Add shipping info if provided
        if "shipping" in order_data:
            rakuten_order["shippingInfo"] = {
                "deliveryName": order_data["shipping"].get("name"),
                "deliveryZipCode": order_data["shipping"].get("postal_code"),
                "deliveryAddress1": order_data["shipping"].get("address1"),
                "deliveryAddress2": order_data["shipping"].get("address2")
            }
        
        # Add other fields as needed for the update
        for field in ["paymentAmount", "goodsPrice", "goodsTax", "shippingFee"]:
            if field in order_data:
                rakuten_order[field] = order_data[field]
        
        try:
            response = self._make_request(
                "POST",
                self.order_base_url,
                endpoint,
                data={"orderModel": rakuten_order}
            )
            
            # Check for success
            if response.get("status") == "OK":
                # Fetch the updated order to return
                return self.get_order(order_id)
            else:
                self.logger.error(f"Error updating order {order_id}: {response.get('error')}")
                return None
                
        except requests.RequestException as e:
            self.logger.error(f"Error updating order {order_id}: {e}")
            return None
    
    def get_inventory_levels(self, **params) -> List[Dict[str, Any]]:
        """
        Get inventory levels from Rakuten.
        
        Args:
            **params: Filter parameters for inventory levels
            
        Returns:
            List of inventory level objects
        """
        endpoint = "inventory/search"
        
        try:
            response = self._make_request(
                "GET",
                self.inventory_base_url,
                endpoint,
                params=params
            )
            
            # Extract inventory items
            inventory_items = response.get("inventories", [])
            
            # Transform to a more consistent format
            transformed_items = []
            for item in inventory_items:
                inventory = {
                    "inventory_item_id": item.get("itemUrl"),
                    "quantity": item.get("inventoryCount", 0),
                    "updated_at": item.get("lastUpdateDate")
                }
                transformed_items.append(inventory)
            
            return transformed_items
            
        except requests.RequestException as e:
            self.logger.error(f"Error getting inventory levels from Rakuten: {e}")
            return []
    
    def set_inventory_level(
        self,
        inventory_item_id: str,
        location_id: Optional[str] = None,
        available: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Set inventory level for an item.
        
        Args:
            inventory_item_id: ID of the inventory item (itemUrl in Rakuten)
            location_id: Ignored for Rakuten (all inventory is per shop)
            available: Available quantity
            
        Returns:
            Updated inventory level object or None on failure
        """
        endpoint = "inventory/update"
        
        # Prepare inventory data
        inventory_data = {
            "itemUrl": inventory_item_id,
            "inventoryCount": available
        }
        
        try:
            response = self._make_request(
                "POST",
                self.inventory_base_url,
                endpoint,
                data={"inventoryUpdateRequest": {"inventories": [inventory_data]}}
            )
            
            # Check for success
            if response.get("status") == "OK":
                # Return a normalized inventory level object
                return {
                    "inventory_item_id": inventory_item_id,
                    "quantity": available,
                    "updated_at": datetime.now().isoformat()
                }
            else:
                self.logger.error(f"Error setting inventory level: {response.get('error')}")
                return None
                
        except requests.RequestException as e:
            self.logger.error(f"Error setting inventory level: {e}")
            return None
    
    def _transform_rakuten_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a Rakuten order to a standardized format.
        
        Args:
            order: Rakuten order data
            
        Returns:
            Transformed order in standardized format
        """
        # Extract basic order information
        transformed_order = {
            "id": order.get("orderNumber"),
            "created_at": order.get("orderDateTime"),
            "updated_at": order.get("lastUpdateDateTime"),
            "status": order.get("status"),
            "total_price": order.get("paymentAmount", 0),
            "subtotal_price": order.get("goodsPrice", 0),
            "total_tax": order.get("goodsTax", 0),
            "shipping_price": order.get("shippingFee", 0),
            "currency": "JPY",
            "line_items": []
        }
        
        # Extract customer information
        if "ordererModel" in order:
            orderer = order["ordererModel"]
            transformed_order["customer"] = {
                "email": orderer.get("emailAddress"),
                "first_name": orderer.get("firstName"),
                "last_name": orderer.get("lastName"),
                "phone": orderer.get("phoneNumber")
            }
        
        # Extract shipping information
        if "deliveryModel" in order:
            delivery = order["deliveryModel"]
            transformed_order["shipping_address"] = {
                "first_name": delivery.get("deliveryFirstName"),
                "last_name": delivery.get("deliveryLastName"),
                "address1": delivery.get("deliveryAddress1"),
                "address2": delivery.get("deliveryAddress2"),
                "city": delivery.get("deliveryCity"),
                "zip": delivery.get("deliveryZipCode"),
                "country": "JP",
                "phone": delivery.get("deliveryPhoneNumber")
            }
        
        # Extract line items
        if "packageModel" in order and "basketItemModelList" in order["packageModel"]:
            for item in order["packageModel"]["basketItemModelList"]:
                line_item = {
                    "id": item.get("itemId"),
                    "title": item.get("itemName", ""),
                    "sku": item.get("itemCode", ""),
                    "quantity": item.get("itemEoCount", 0),
                    "price": item.get("itemPrice", 0),
                    "total_price": item.get("itemEoPrice", 0)
                }
                transformed_order["line_items"].append(line_item)
        
        return transformed_order