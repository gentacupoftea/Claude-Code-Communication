"""
Rakuten RMS API endpoint definitions
Manages version-specific endpoints and configurations
"""

from enum import Enum
from dataclasses import dataclass
from typing import Dict, Optional


class APIType(Enum):
    """RMS API types with their versions"""
    PRODUCT = "product"
    ORDER = "order"
    INVENTORY = "inventory"
    CATEGORY = "category"
    CUSTOMER = "member"
    REVIEW = "review"
    PAYMENT = "payment"
    SHOP = "shop"


@dataclass
class EndpointConfig:
    """Configuration for an API endpoint"""
    path: str
    version: str
    method: str = "GET"
    requires_auth: bool = True


class RMSEndpoints:
    """
    Rakuten RMS API endpoint definitions
    Manages version-specific endpoints according to actual RMS specifications
    """
    
    # API versions for different services
    API_VERSIONS = {
        APIType.PRODUCT: "es/2.0",
        APIType.ORDER: "es/2.0",
        APIType.INVENTORY: "es/1.0",
        APIType.CATEGORY: "es/1.0",
        APIType.CUSTOMER: "es/2.0",
        APIType.REVIEW: "es/1.0",
        APIType.PAYMENT: "es/2.0",
        APIType.SHOP: "es/1.0",
    }
    
    # Endpoint definitions
    ENDPOINTS = {
        # Auth API
        "auth_token": EndpointConfig(
            path="auth/token",
            version="es/2.0",
            method="POST",
            requires_auth=False
        ),
        # Product API
        "get_product": EndpointConfig(
            path="item/get",
            version=API_VERSIONS[APIType.PRODUCT],
            method="GET"
        ),
        "search_products": EndpointConfig(
            path="item/search",
            version=API_VERSIONS[APIType.PRODUCT],
            method="GET"
        ),
        "create_product": EndpointConfig(
            path="item/insert",
            version=API_VERSIONS[APIType.PRODUCT],
            method="POST"
        ),
        "update_product": EndpointConfig(
            path="item/update",
            version=API_VERSIONS[APIType.PRODUCT],
            method="POST"
        ),
        "delete_product": EndpointConfig(
            path="item/delete",
            version=API_VERSIONS[APIType.PRODUCT],
            method="POST"
        ),
        
        # Order API
        "get_order": EndpointConfig(
            path="order/getOrder",
            version=API_VERSIONS[APIType.ORDER],
            method="GET"
        ),
        "search_orders": EndpointConfig(
            path="order/searchOrder",
            version=API_VERSIONS[APIType.ORDER],
            method="GET"
        ),
        "update_order": EndpointConfig(
            path="order/updateOrder",
            version=API_VERSIONS[APIType.ORDER],
            method="POST"
        ),
        "cancel_order": EndpointConfig(
            path="order/cancel",
            version=API_VERSIONS[APIType.ORDER],
            method="POST"
        ),
        
        # Inventory API (different version)
        "get_inventory": EndpointConfig(
            path="inventory/getInventory",
            version=API_VERSIONS[APIType.INVENTORY],
            method="GET"
        ),
        "update_inventory": EndpointConfig(
            path="inventory/updateInventory",
            version=API_VERSIONS[APIType.INVENTORY],
            method="POST"
        ),
        
        # Category API
        "get_categories": EndpointConfig(
            path="category/getall",
            version=API_VERSIONS[APIType.CATEGORY],
            method="GET"
        ),
        "get_category": EndpointConfig(
            path="category/get",
            version=API_VERSIONS[APIType.CATEGORY],
            method="GET"
        ),
        
        # Customer/Member API
        "get_customer": EndpointConfig(
            path="member/get",
            version=API_VERSIONS[APIType.CUSTOMER],
            method="GET"
        ),
        "search_customers": EndpointConfig(
            path="member/search",
            version=API_VERSIONS[APIType.CUSTOMER],
            method="GET"
        ),
        "update_customer": EndpointConfig(
            path="member/update",
            version=API_VERSIONS[APIType.CUSTOMER],
            method="POST"
        ),
        
        # Review API
        "get_reviews": EndpointConfig(
            path="review/search",
            version=API_VERSIONS[APIType.REVIEW],
            method="GET"
        ),
        
        # Shop API
        "get_shop": EndpointConfig(
            path="shop/get",
            version=API_VERSIONS[APIType.SHOP],
            method="GET"
        ),
    }
    
    @classmethod
    def get_endpoint(cls, endpoint_name: str) -> EndpointConfig:
        """
        Get endpoint configuration by name
        
        Args:
            endpoint_name: Name of the endpoint
            
        Returns:
            EndpointConfig object
            
        Raises:
            KeyError: If endpoint not found
        """
        if endpoint_name not in cls.ENDPOINTS:
            raise KeyError(f"Unknown endpoint: {endpoint_name}")
        return cls.ENDPOINTS[endpoint_name]
    
    @classmethod
    def build_url(cls, endpoint_name: str, **kwargs) -> str:
        """
        Build full URL for an endpoint
        
        Args:
            endpoint_name: Name of the endpoint
            **kwargs: Optional parameters for path formatting
            
        Returns:
            Full URL path
        """
        config = cls.get_endpoint(endpoint_name)
        path = config.path.format(**kwargs) if kwargs else config.path
        return f"/{config.version}/{path}"
    
    @classmethod
    def get_version(cls, api_type: APIType) -> str:
        """
        Get API version for a specific type
        
        Args:
            api_type: Type of API
            
        Returns:
            Version string
        """
        return cls.API_VERSIONS.get(api_type, "es/2.0")