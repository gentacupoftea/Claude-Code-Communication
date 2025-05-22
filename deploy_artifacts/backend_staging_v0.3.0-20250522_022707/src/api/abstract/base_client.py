"""
Abstract base client for e-commerce platform APIs
Provides common interface for all platform integrations
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class RateLimitInfo:
    """Rate limit information"""
    requests_remaining: int
    requests_limit: int
    reset_time: Optional[float] = None
    usage_percentage: float = 0.0
    
    def __post_init__(self):
        if self.requests_limit > 0:
            self.usage_percentage = (self.requests_limit - self.requests_remaining) / self.requests_limit


class AbstractEcommerceClient(ABC):
    """
    Abstract base class for e-commerce platform clients
    Defines the interface that all platform clients must implement
    """
    
    def __init__(self, platform_name: str, api_credentials: Dict[str, Any]):
        """
        Initialize the client
        
        Args:
            platform_name: Name of the platform (shopify, rakuten, amazon, etc.)
            api_credentials: Platform-specific credentials
        """
        self.platform_name = platform_name
        self.credentials = api_credentials
        self.logger = logging.getLogger(f"{__name__}.{platform_name}")
        
    @abstractmethod
    async def authenticate(self) -> bool:
        """
        Authenticate with the platform API
        
        Returns:
            True if authentication successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def check_connection(self) -> bool:
        """
        Check if the API connection is working
        
        Returns:
            True if connection is healthy, False otherwise
        """
        pass
    
    @abstractmethod
    def get_rate_limit_info(self) -> RateLimitInfo:
        """
        Get current rate limit information
        
        Returns:
            RateLimitInfo object with current limits
        """
        pass
    
    # Product operations
    @abstractmethod
    async def get_product(self, product_id: str) -> Dict[str, Any]:
        """
        Get a single product by ID
        
        Args:
            product_id: Product identifier
            
        Returns:
            Product data dictionary
        """
        pass
    
    @abstractmethod
    async def get_products(self, 
                          limit: int = 50,
                          offset: int = 0,
                          filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get list of products
        
        Args:
            limit: Maximum number of products to return
            offset: Number of products to skip
            filters: Platform-specific filters
            
        Returns:
            List of product dictionaries
        """
        pass
    
    @abstractmethod
    async def create_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new product
        
        Args:
            product_data: Product data to create
            
        Returns:
            Created product data
        """
        pass
    
    @abstractmethod
    async def update_product(self, product_id: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing product
        
        Args:
            product_id: Product identifier
            product_data: Product data to update
            
        Returns:
            Updated product data
        """
        pass
    
    @abstractmethod
    async def delete_product(self, product_id: str) -> bool:
        """
        Delete a product
        
        Args:
            product_id: Product identifier
            
        Returns:
            True if deletion successful
        """
        pass
    
    # Order operations
    @abstractmethod
    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """
        Get a single order by ID
        
        Args:
            order_id: Order identifier
            
        Returns:
            Order data dictionary
        """
        pass
    
    @abstractmethod
    async def get_orders(self,
                        limit: int = 50,
                        offset: int = 0,
                        filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get list of orders
        
        Args:
            limit: Maximum number of orders to return
            offset: Number of orders to skip
            filters: Platform-specific filters
            
        Returns:
            List of order dictionaries
        """
        pass
    
    @abstractmethod
    async def update_order_status(self, order_id: str, status: str) -> Dict[str, Any]:
        """
        Update order status
        
        Args:
            order_id: Order identifier
            status: New status
            
        Returns:
            Updated order data
        """
        pass
    
    # Customer operations
    @abstractmethod
    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """
        Get a single customer by ID
        
        Args:
            customer_id: Customer identifier
            
        Returns:
            Customer data dictionary
        """
        pass
    
    @abstractmethod
    async def get_customers(self,
                          limit: int = 50,
                          offset: int = 0,
                          filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get list of customers
        
        Args:
            limit: Maximum number of customers to return
            offset: Number of customers to skip
            filters: Platform-specific filters
            
        Returns:
            List of customer dictionaries
        """
        pass
    
    # Inventory operations
    @abstractmethod
    async def get_inventory(self, product_id: str) -> Dict[str, Any]:
        """
        Get inventory for a product
        
        Args:
            product_id: Product identifier
            
        Returns:
            Inventory data dictionary
        """
        pass
    
    @abstractmethod
    async def update_inventory(self, product_id: str, quantity: int, location_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Update inventory quantity
        
        Args:
            product_id: Product identifier
            quantity: New quantity
            location_id: Optional location/warehouse identifier
            
        Returns:
            Updated inventory data
        """
        pass
    
    # Platform-specific features
    def get_platform_capabilities(self) -> Dict[str, bool]:
        """
        Get platform-specific capabilities
        Override in subclasses to indicate special features
        
        Returns:
            Dictionary of capability flags
        """
        return {
            'multi_warehouse': False,
            'multi_currency': False,
            'gift_wrapping': False,
            'tax_calculation': False,
            'shipping_integration': False,
            'loyalty_points': False,
            'marketplace': False
        }
    
    # Helper methods
    def format_error(self, error: Exception, context: str = "") -> str:
        """
        Format error message consistently
        
        Args:
            error: The exception
            context: Additional context
            
        Returns:
            Formatted error message
        """
        error_msg = f"[{self.platform_name}] {context}: {str(error)}"
        self.logger.error(error_msg)
        return error_msg