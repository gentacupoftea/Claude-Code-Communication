"""
Factory module for creating cache manager instances.

This module provides a convenient way to create and configure
different cache manager implementations based on configuration.
"""

import logging
import redis
from typing import Dict, Any, Optional, Union, Type

from .cache_manager import CacheManager
from .optimized_cache_manager import OptimizedCacheManager
from .cache_dependency_tracker import CacheDependencyTracker


class CacheFactory:
    """
    Factory for creating and configuring cache managers.
    
    This factory provides methods to create various cache managers
    with appropriate configuration based on the application needs.
    """
    
    @staticmethod
    def create_redis_client(
        host: str = 'localhost',
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        socket_timeout: float = 2.0,
        socket_connect_timeout: float = 2.0,
        connection_pool_size: int = 10,
        **kwargs
    ) -> redis.Redis:
        """
        Create a Redis client with appropriate configuration.
        
        Args:
            host: Redis host address
            port: Redis port
            db: Redis database number
            password: Redis password (if any)
            socket_timeout: Socket timeout in seconds
            socket_connect_timeout: Socket connect timeout in seconds
            connection_pool_size: Maximum connections in the pool
            **kwargs: Additional parameters for Redis client
            
        Returns:
            Configured Redis client
        """
        # Create a connection pool
        pool = redis.ConnectionPool(
            host=host,
            port=port,
            db=db,
            password=password,
            socket_timeout=socket_timeout,
            socket_connect_timeout=socket_connect_timeout,
            max_connections=connection_pool_size,
            **kwargs
        )
        
        # Create Redis client with pool
        return redis.Redis(connection_pool=pool)
    
    @staticmethod
    def create_cache_manager(
        config: Dict[str, Any]
    ) -> Union[CacheManager, OptimizedCacheManager]:
        """
        Create a cache manager based on configuration.
        
        Args:
            config: Configuration dictionary with cache settings
            
        Returns:
            Configured cache manager instance
        """
        cache_type = config.get('type', 'basic').lower()
        
        # Get Redis client config
        redis_config = config.get('redis', {})
        redis_client = CacheFactory.create_redis_client(**redis_config)
        
        # Create appropriate cache manager
        if cache_type == 'optimized':
            return CacheFactory.create_optimized_cache_manager(redis_client, config)
        else:
            return CacheFactory.create_basic_cache_manager(redis_client, config)
    
    @staticmethod
    def create_basic_cache_manager(
        redis_client,
        config: Dict[str, Any]
    ) -> CacheManager:
        """
        Create a basic cache manager.
        
        Args:
            redis_client: Redis client instance
            config: Configuration dictionary
            
        Returns:
            Configured CacheManager instance
        """
        return CacheManager(
            redis_client=redis_client,
            ttl=config.get('ttl', 3600)
        )
    
    @staticmethod
    def create_optimized_cache_manager(
        redis_client,
        config: Dict[str, Any]
    ) -> OptimizedCacheManager:
        """
        Create an optimized cache manager.
        
        Args:
            redis_client: Redis client instance
            config: Configuration dictionary
            
        Returns:
            Configured OptimizedCacheManager instance
        """
        return OptimizedCacheManager(
            redis_client=redis_client,
            memory_cache_size=config.get('memory_cache_size', 10000),
            redis_ttl=config.get('redis_ttl', 3600),
            memory_ttl=config.get('memory_ttl', 300),
            enable_compression=config.get('enable_compression', True),
            compression_min_size=config.get('compression_min_size', 1024),
            compression_level=config.get('compression_level', 6),
            enable_adaptive_ttl=config.get('enable_adaptive_ttl', True),
            ttl_min_factor=config.get('ttl_min_factor', 0.5),
            ttl_max_factor=config.get('ttl_max_factor', 2.0),
            ttl_size_threshold=config.get('ttl_size_threshold', 10000),
            track_metrics=config.get('track_metrics', True)
        )
    
    @staticmethod
    def create_dependency_tracker(
        cache_manager: Union[CacheManager, OptimizedCacheManager],
        config: Dict[str, Any]
    ) -> CacheDependencyTracker:
        """
        Create a cache dependency tracker.
        
        Args:
            cache_manager: Cache manager instance to use
            config: Configuration dictionary
            
        Returns:
            Configured CacheDependencyTracker instance
        """
        return CacheDependencyTracker(
            cache_manager=cache_manager,
            dependency_ttl=config.get('dependency_ttl', 86400),
            max_dependencies_per_key=config.get('max_dependencies_per_key', 1000),
            dependency_cleanup_interval=config.get('dependency_cleanup_interval', 3600),
            enable_auto_cleanup=config.get('enable_auto_cleanup', True)
        )
    
    @staticmethod
    def create_full_cache_system(
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a complete cache system with manager and dependency tracker.
        
        Args:
            config: Configuration dictionary
            
        Returns:
            Dictionary with configured cache components
        """
        cache_manager = CacheFactory.create_cache_manager(config)
        
        # Create dependency tracker if enabled
        dependency_tracker = None
        if config.get('enable_dependency_tracking', True):
            dependency_tracker = CacheFactory.create_dependency_tracker(
                cache_manager,
                config.get('dependency_tracker', {})
            )
        
        return {
            'cache_manager': cache_manager,
            'dependency_tracker': dependency_tracker
        }