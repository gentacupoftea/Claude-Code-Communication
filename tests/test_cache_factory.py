"""
Tests for the CacheFactory module.
"""

import unittest
import sys
import os
from unittest import mock

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Mock redis module
sys.modules['redis'] = mock.MagicMock()

from src.cache.cache_factory import CacheFactory
from src.cache.cache_manager import CacheManager
from src.cache.optimized_cache_manager import OptimizedCacheManager
from src.cache.cache_dependency_tracker import CacheDependencyTracker


class TestCacheFactory(unittest.TestCase):
    """Test functionality of CacheFactory."""

    def setUp(self):
        """Set up test environment before each test."""
        # Mock redis module
        self.redis_mock = mock.MagicMock()
        
        # Mock ConnectionPool and Redis classes
        self.pool_mock = mock.MagicMock()
        self.redis_client_mock = mock.MagicMock()
        
        # Patch the redis module
        patcher = mock.patch('src.cache.cache_factory.redis')
        self.redis_module_mock = patcher.start()
        self.redis_module_mock.ConnectionPool.return_value = self.pool_mock
        self.redis_module_mock.Redis.return_value = self.redis_client_mock
        self.addCleanup(patcher.stop)

    def test_create_redis_client(self):
        """Test creating a Redis client."""
        # Create Redis client
        redis_client = CacheFactory.create_redis_client(
            host='redis.example.com',
            port=6380,
            db=1,
            password='secret',
            socket_timeout=5.0,
            socket_connect_timeout=3.0,
            connection_pool_size=20
        )
        
        # Verify ConnectionPool was created with correct parameters
        self.redis_module_mock.ConnectionPool.assert_called_once_with(
            host='redis.example.com',
            port=6380,
            db=1,
            password='secret',
            socket_timeout=5.0,
            socket_connect_timeout=3.0,
            max_connections=20
        )
        
        # Verify Redis client was created with the pool
        self.redis_module_mock.Redis.assert_called_once_with(
            connection_pool=self.pool_mock
        )
        
        # Verify the returned client
        self.assertEqual(redis_client, self.redis_client_mock)
    
    def test_create_basic_cache_manager(self):
        """Test creating a basic cache manager."""
        # Create basic cache manager
        cache_manager = CacheFactory.create_basic_cache_manager(
            redis_client=self.redis_client_mock,
            config={'ttl': 7200}
        )
        
        # Verify type and configuration
        self.assertIsInstance(cache_manager, CacheManager)
        self.assertEqual(cache_manager.ttl, 7200)
        self.assertEqual(cache_manager.redis_client, self.redis_client_mock)
    
    def test_create_optimized_cache_manager(self):
        """Test creating an optimized cache manager."""
        # Create optimized cache manager
        cache_manager = CacheFactory.create_optimized_cache_manager(
            redis_client=self.redis_client_mock,
            config={
                'memory_cache_size': 5000,
                'redis_ttl': 7200,
                'memory_ttl': 600,
                'enable_compression': False,
                'compression_min_size': 2048
            }
        )
        
        # Verify type and configuration
        self.assertIsInstance(cache_manager, OptimizedCacheManager)
        self.assertEqual(cache_manager.memory_cache_size, 5000)
        self.assertEqual(cache_manager.redis_ttl, 7200)
        self.assertEqual(cache_manager.memory_ttl, 600)
        self.assertEqual(cache_manager.enable_compression, False)
        self.assertEqual(cache_manager.compression_min_size, 2048)
        self.assertEqual(cache_manager.redis_client, self.redis_client_mock)
    
    def test_create_dependency_tracker(self):
        """Test creating a dependency tracker."""
        # Create cache manager mock
        cache_manager_mock = mock.MagicMock()
        
        # Create dependency tracker
        dependency_tracker = CacheFactory.create_dependency_tracker(
            cache_manager=cache_manager_mock,
            config={
                'dependency_ttl': 172800,
                'max_dependencies_per_key': 500,
                'dependency_cleanup_interval': 7200,
                'enable_auto_cleanup': False
            }
        )
        
        # Verify type and configuration
        self.assertIsInstance(dependency_tracker, CacheDependencyTracker)
        self.assertEqual(dependency_tracker.dependency_ttl, 172800)
        self.assertEqual(dependency_tracker.max_dependencies_per_key, 500)
        self.assertEqual(dependency_tracker.dependency_cleanup_interval, 7200)
        self.assertEqual(dependency_tracker.enable_auto_cleanup, False)
        self.assertEqual(dependency_tracker.cache_manager, cache_manager_mock)
    
    def test_create_cache_manager_basic(self):
        """Test creating a cache manager with 'basic' type."""
        # Mock create methods
        original_create_basic = CacheFactory.create_basic_cache_manager
        original_create_redis = CacheFactory.create_redis_client
        
        CacheFactory.create_basic_cache_manager = mock.MagicMock(return_value=mock.MagicMock())
        CacheFactory.create_redis_client = mock.MagicMock(return_value=self.redis_client_mock)
        
        try:
            # Create cache manager
            config = {
                'type': 'basic',
                'ttl': 3600,
                'redis': {
                    'host': 'redis.example.com',
                    'port': 6379
                }
            }
            
            cache_manager = CacheFactory.create_cache_manager(config)
            
            # Verify Redis client was created
            CacheFactory.create_redis_client.assert_called_once_with(
                host='redis.example.com',
                port=6379
            )
            
            # Verify basic cache manager was created
            CacheFactory.create_basic_cache_manager.assert_called_once_with(
                self.redis_client_mock, config
            )
            
            # Verify correct manager was returned
            self.assertEqual(cache_manager, CacheFactory.create_basic_cache_manager.return_value)
        finally:
            # Restore original methods
            CacheFactory.create_basic_cache_manager = original_create_basic
            CacheFactory.create_redis_client = original_create_redis
    
    def test_create_cache_manager_optimized(self):
        """Test creating a cache manager with 'optimized' type."""
        # Mock create methods
        original_create_optimized = CacheFactory.create_optimized_cache_manager
        original_create_redis = CacheFactory.create_redis_client
        
        CacheFactory.create_optimized_cache_manager = mock.MagicMock(return_value=mock.MagicMock())
        CacheFactory.create_redis_client = mock.MagicMock(return_value=self.redis_client_mock)
        
        try:
            # Create cache manager
            config = {
                'type': 'optimized',
                'memory_cache_size': 10000,
                'redis_ttl': 3600,
                'redis': {
                    'host': 'redis.example.com',
                    'port': 6379
                }
            }
            
            cache_manager = CacheFactory.create_cache_manager(config)
            
            # Verify Redis client was created
            CacheFactory.create_redis_client.assert_called_once_with(
                host='redis.example.com',
                port=6379
            )
            
            # Verify optimized cache manager was created
            CacheFactory.create_optimized_cache_manager.assert_called_once_with(
                self.redis_client_mock, config
            )
            
            # Verify correct manager was returned
            self.assertEqual(cache_manager, CacheFactory.create_optimized_cache_manager.return_value)
        finally:
            # Restore original methods
            CacheFactory.create_optimized_cache_manager = original_create_optimized
            CacheFactory.create_redis_client = original_create_redis
    
    def test_create_full_cache_system_with_dependency_tracking(self):
        """Test creating a full cache system with dependency tracking enabled."""
        # Mock create methods
        original_create_cache_manager = CacheFactory.create_cache_manager
        original_create_dependency_tracker = CacheFactory.create_dependency_tracker
        
        cache_manager_mock = mock.MagicMock()
        dependency_tracker_mock = mock.MagicMock()
        
        CacheFactory.create_cache_manager = mock.MagicMock(return_value=cache_manager_mock)
        CacheFactory.create_dependency_tracker = mock.MagicMock(return_value=dependency_tracker_mock)
        
        try:
            # Create full cache system
            config = {
                'type': 'optimized',
                'memory_cache_size': 10000,
                'enable_dependency_tracking': True,
                'dependency_tracker': {
                    'dependency_ttl': 86400
                }
            }
            
            cache_system = CacheFactory.create_full_cache_system(config)
            
            # Verify cache manager was created
            CacheFactory.create_cache_manager.assert_called_once_with(config)
            
            # Verify dependency tracker was created
            CacheFactory.create_dependency_tracker.assert_called_once_with(
                cache_manager_mock, config.get('dependency_tracker', {})
            )
            
            # Verify returned system
            self.assertEqual(cache_system['cache_manager'], cache_manager_mock)
            self.assertEqual(cache_system['dependency_tracker'], dependency_tracker_mock)
        finally:
            # Restore original methods
            CacheFactory.create_cache_manager = original_create_cache_manager
            CacheFactory.create_dependency_tracker = original_create_dependency_tracker
    
    def test_create_full_cache_system_without_dependency_tracking(self):
        """Test creating a full cache system with dependency tracking disabled."""
        # Mock create methods
        original_create_cache_manager = CacheFactory.create_cache_manager
        original_create_dependency_tracker = CacheFactory.create_dependency_tracker
        
        cache_manager_mock = mock.MagicMock()
        
        CacheFactory.create_cache_manager = mock.MagicMock(return_value=cache_manager_mock)
        CacheFactory.create_dependency_tracker = mock.MagicMock()
        
        try:
            # Create full cache system
            config = {
                'type': 'basic',
                'ttl': 3600,
                'enable_dependency_tracking': False
            }
            
            cache_system = CacheFactory.create_full_cache_system(config)
            
            # Verify cache manager was created
            CacheFactory.create_cache_manager.assert_called_once_with(config)
            
            # Verify dependency tracker was not created
            CacheFactory.create_dependency_tracker.assert_not_called()
            
            # Verify returned system
            self.assertEqual(cache_system['cache_manager'], cache_manager_mock)
            self.assertIsNone(cache_system['dependency_tracker'])
        finally:
            # Restore original methods
            CacheFactory.create_cache_manager = original_create_cache_manager
            CacheFactory.create_dependency_tracker = original_create_dependency_tracker


if __name__ == '__main__':
    unittest.main()