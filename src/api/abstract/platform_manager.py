"""
Platform Manager for handling multiple e-commerce platform integrations
"""

import logging
from typing import Dict, Any, Optional, Type, List
from enum import Enum
import asyncio

from .base_client import AbstractEcommerceClient
from .base_models import BaseProduct, BaseOrder, BaseCustomer

logger = logging.getLogger(__name__)


class PlatformType(Enum):
    """Supported e-commerce platforms"""
    SHOPIFY = "shopify"
    RAKUTEN = "rakuten"
    AMAZON = "amazon"
    NEXT_ENGINE = "next_engine"
    SMAREGI = "smaregi"


class PlatformManager:
    """
    Manages multiple e-commerce platform integrations
    Provides unified interface for cross-platform operations
    """
    
    def __init__(self):
        """Initialize platform manager"""
        self.platforms: Dict[PlatformType, AbstractEcommerceClient] = {}
        self.platform_classes: Dict[PlatformType, Type[AbstractEcommerceClient]] = {}
        self.logger = logger
        
    def register_platform(self, 
                         platform_type: PlatformType,
                         client_class: Type[AbstractEcommerceClient]):
        """
        Register a platform client class
        
        Args:
            platform_type: Platform identifier
            client_class: Client class that extends AbstractEcommerceClient
        """
        self.platform_classes[platform_type] = client_class
        self.logger.info(f"Registered platform: {platform_type.value}")
        
    async def initialize_platform(self,
                                platform_type: PlatformType,
                                credentials: Dict[str, Any]) -> bool:
        """
        Initialize a platform with credentials
        
        Args:
            platform_type: Platform to initialize
            credentials: Platform-specific credentials
            
        Returns:
            True if initialization successful
        """
        try:
            if platform_type not in self.platform_classes:
                raise ValueError(f"Platform {platform_type.value} not registered")
                
            client_class = self.platform_classes[platform_type]
            client = client_class(platform_type.value, credentials)
            
            # Authenticate
            if await client.authenticate():
                self.platforms[platform_type] = client
                self.logger.info(f"Initialized platform: {platform_type.value}")
                return True
            else:
                self.logger.error(f"Failed to authenticate platform: {platform_type.value}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error initializing platform {platform_type.value}: {e}")
            return False
            
    def get_platform(self, platform_type: PlatformType) -> Optional[AbstractEcommerceClient]:
        """
        Get initialized platform client
        
        Args:
            platform_type: Platform to retrieve
            
        Returns:
            Platform client or None if not initialized
        """
        return self.platforms.get(platform_type)
        
    def get_active_platforms(self) -> List[PlatformType]:
        """
        Get list of active platforms
        
        Returns:
            List of initialized platform types
        """
        return list(self.platforms.keys())
        
    async def check_all_connections(self) -> Dict[PlatformType, bool]:
        """
        Check connection status for all platforms
        
        Returns:
            Dictionary of platform to connection status
        """
        results = {}
        
        tasks = []
        platforms = []
        
        for platform_type, client in self.platforms.items():
            tasks.append(client.check_connection())
            platforms.append(platform_type)
            
        if tasks:
            statuses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for platform, status in zip(platforms, statuses):
                if isinstance(status, Exception):
                    results[platform] = False
                    self.logger.error(f"Connection check failed for {platform.value}: {status}")
                else:
                    results[platform] = status
                    
        return results
        
    # Unified operations across platforms
    async def get_product_from_all(self, product_id: str) -> Dict[PlatformType, Dict[str, Any]]:
        """
        Get product from all active platforms
        
        Args:
            product_id: Product identifier
            
        Returns:
            Dictionary of platform to product data
        """
        results = {}
        
        tasks = []
        platforms = []
        
        for platform_type, client in self.platforms.items():
            tasks.append(client.get_product(product_id))
            platforms.append(platform_type)
            
        if tasks:
            products = await asyncio.gather(*tasks, return_exceptions=True)
            
            for platform, product in zip(platforms, products):
                if isinstance(product, Exception):
                    self.logger.error(f"Failed to get product from {platform.value}: {product}")
                    results[platform] = None
                else:
                    results[platform] = product
                    
        return results
        
    async def sync_product_across_platforms(self,
                                          source_platform: PlatformType,
                                          product_id: str,
                                          target_platforms: Optional[List[PlatformType]] = None) -> Dict[PlatformType, bool]:
        """
        Sync product from source platform to target platforms
        
        Args:
            source_platform: Platform to sync from
            product_id: Product to sync
            target_platforms: Platforms to sync to (all if None)
            
        Returns:
            Dictionary of platform to sync status
        """
        results = {}
        
        # Get source product
        source_client = self.get_platform(source_platform)
        if not source_client:
            self.logger.error(f"Source platform {source_platform.value} not initialized")
            return results
            
        try:
            source_product = await source_client.get_product(product_id)
        except Exception as e:
            self.logger.error(f"Failed to get product from source: {e}")
            return results
            
        # Determine target platforms
        if target_platforms is None:
            target_platforms = [p for p in self.platforms.keys() if p != source_platform]
        else:
            target_platforms = [p for p in target_platforms if p in self.platforms and p != source_platform]
            
        # Sync to each target
        tasks = []
        platforms = []
        
        for platform in target_platforms:
            client = self.platforms[platform]
            # Convert to target platform format
            # This would need platform-specific conversion logic
            tasks.append(self._sync_product_to_platform(source_product, platform, client))
            platforms.append(platform)
            
        if tasks:
            statuses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for platform, status in zip(platforms, statuses):
                if isinstance(status, Exception):
                    results[platform] = False
                    self.logger.error(f"Failed to sync to {platform.value}: {status}")
                else:
                    results[platform] = status
                    
        return results
        
    async def _sync_product_to_platform(self,
                                      product_data: Dict[str, Any],
                                      platform: PlatformType,
                                      client: AbstractEcommerceClient) -> bool:
        """
        Sync single product to platform
        
        Args:
            product_data: Product data to sync
            platform: Target platform
            client: Target platform client
            
        Returns:
            True if sync successful
        """
        try:
            # Check if product exists
            existing = None
            try:
                # Use SKU or other identifier to check
                sku = product_data.get('sku')
                if sku:
                    # Would need platform-specific search implementation
                    pass
            except:
                pass
                
            if existing:
                # Update existing product
                result = await client.update_product(existing['id'], product_data)
            else:
                # Create new product
                result = await client.create_product(product_data)
                
            return bool(result)
            
        except Exception as e:
            self.logger.error(f"Error syncing product to {platform.value}: {e}")
            return False
            
    # Inventory management
    async def sync_inventory_across_platforms(self,
                                            product_id: str,
                                            quantity: int,
                                            location_id: Optional[str] = None) -> Dict[PlatformType, bool]:
        """
        Sync inventory across all platforms
        
        Args:
            product_id: Product identifier
            quantity: New inventory quantity
            location_id: Optional location/warehouse ID
            
        Returns:
            Dictionary of platform to sync status
        """
        results = {}
        
        tasks = []
        platforms = []
        
        for platform_type, client in self.platforms.items():
            tasks.append(client.update_inventory(product_id, quantity, location_id))
            platforms.append(platform_type)
            
        if tasks:
            statuses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for platform, status in zip(platforms, statuses):
                if isinstance(status, Exception):
                    results[platform] = False
                    self.logger.error(f"Failed to sync inventory on {platform.value}: {status}")
                else:
                    results[platform] = bool(status)
                    
        return results
        
    # Platform capabilities
    def get_platform_capabilities(self) -> Dict[PlatformType, Dict[str, bool]]:
        """
        Get capabilities for all active platforms
        
        Returns:
            Dictionary of platform to capabilities
        """
        capabilities = {}
        
        for platform_type, client in self.platforms.items():
            capabilities[platform_type] = client.get_platform_capabilities()
            
        return capabilities
        
    def supports_feature(self, feature: str) -> List[PlatformType]:
        """
        Get platforms that support a specific feature
        
        Args:
            feature: Feature to check
            
        Returns:
            List of platforms supporting the feature
        """
        supporting_platforms = []
        
        for platform_type, client in self.platforms.items():
            capabilities = client.get_platform_capabilities()
            if capabilities.get(feature, False):
                supporting_platforms.append(platform_type)
                
        return supporting_platforms


# Singleton instance
platform_manager = PlatformManager()