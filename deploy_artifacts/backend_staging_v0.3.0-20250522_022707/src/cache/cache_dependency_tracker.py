"""
Cache dependency tracking module for intelligent cache invalidation.

This module provides a way to track dependencies between cache keys,
allowing for more granular and efficient cache invalidation when data changes.
"""

import logging
import time
from typing import Dict, List, Set, Any, Optional, Tuple


class CacheDependencyTracker:
    """
    Tracks dependencies between cache keys for intelligent invalidation.
    
    This tracker maintains relationships between cache keys and their dependencies,
    allowing the system to invalidate all dependent keys when a key changes.
    """
    
    def __init__(
        self,
        cache_manager,
        dependency_ttl: int = 86400,  # Default: 1 day
        max_dependencies_per_key: int = 1000,
        dependency_cleanup_interval: int = 3600,  # Default: 1 hour
        enable_auto_cleanup: bool = True
    ):
        """
        Initialize the dependency tracker.
        
        Args:
            cache_manager: The cache manager instance to use for operations
            dependency_ttl: Time-to-live for dependency tracking in seconds
            max_dependencies_per_key: Maximum number of dependencies to track per key
            dependency_cleanup_interval: How often to clean up expired dependencies
            enable_auto_cleanup: Whether to automatically clean up expired dependencies
        """
        self.cache_manager = cache_manager
        self.dependency_ttl = dependency_ttl
        self.max_dependencies_per_key = max_dependencies_per_key
        self.dependency_cleanup_interval = dependency_cleanup_interval
        self.enable_auto_cleanup = enable_auto_cleanup
        
        # Store last cleanup time
        self.last_cleanup_time = time.time()
        
        # Logging
        self.logger = logging.getLogger("CacheDependencyTracker")
    
    def register_dependency(
        self,
        key: str,
        depends_on_key: str,
        namespace: str = "",
        depends_on_namespace: str = "",
        ttl: Optional[int] = None
    ) -> bool:
        """
        Register a dependency between two cache keys.
        
        Args:
            key: The dependent cache key
            depends_on_key: The key that it depends on
            namespace: Namespace for the dependent key
            depends_on_namespace: Namespace for the dependency key
            ttl: Optional custom TTL for this dependency
            
        Returns:
            bool: True if the dependency was registered, False otherwise
        """
        full_key = self._get_full_key(key, namespace)
        full_depends_on_key = self._get_full_key(depends_on_key, depends_on_namespace)
        
        # Get the current dependencies map for the key that is depended on
        dependencies_key = self._get_dependencies_key(full_depends_on_key)
        dependencies = self._get_dependencies(dependencies_key) or {}
        
        # Add the new dependency
        if full_key not in dependencies:
            dependencies[full_key] = time.time() + (ttl or self.dependency_ttl)
            
            # Limit the number of dependencies to prevent memory issues
            if len(dependencies) > self.max_dependencies_per_key:
                # Remove the oldest dependency
                oldest_key = min(dependencies.items(), key=lambda x: x[1])[0]
                del dependencies[oldest_key]
                self.logger.warning(
                    f"Max dependencies exceeded for {full_depends_on_key}. Removed oldest: {oldest_key}"
                )
        else:
            # Update the expiration time
            dependencies[full_key] = time.time() + (ttl or self.dependency_ttl)
        
        # Store the updated dependencies map
        return self._store_dependencies(dependencies_key, dependencies)
    
    def register_multiple_dependencies(
        self,
        key: str,
        depends_on_keys: List[str],
        namespace: str = "",
        depends_on_namespace: str = "",
        ttl: Optional[int] = None
    ) -> bool:
        """
        Register dependencies between a key and multiple other keys.
        
        Args:
            key: The dependent cache key
            depends_on_keys: List of keys that it depends on
            namespace: Namespace for the dependent key
            depends_on_namespace: Namespace for the dependency keys
            ttl: Optional custom TTL for these dependencies
            
        Returns:
            bool: True if all dependencies were registered, False otherwise
        """
        success = True
        for depends_on_key in depends_on_keys:
            result = self.register_dependency(
                key, depends_on_key, namespace, depends_on_namespace, ttl
            )
            success = success and result
        return success
    
    def get_dependencies(
        self,
        key: str,
        namespace: str = ""
    ) -> List[str]:
        """
        Get all keys that depend on the specified key.
        
        Args:
            key: The key to get dependencies for
            namespace: Namespace for the key
            
        Returns:
            List of dependent keys
        """
        full_key = self._get_full_key(key, namespace)
        dependencies_key = self._get_dependencies_key(full_key)
        dependencies = self._get_dependencies(dependencies_key) or {}
        
        # Filter out expired dependencies
        current_time = time.time()
        active_dependencies = {
            k: v for k, v in dependencies.items() 
            if v > current_time
        }
        
        # If we filtered some items, update the stored dependencies
        if len(active_dependencies) < len(dependencies):
            self._store_dependencies(dependencies_key, active_dependencies)
        
        return list(active_dependencies.keys())
    
    def invalidate_with_dependencies(
        self,
        key: str,
        namespace: str = ""
    ) -> int:
        """
        Invalidate a key and all keys that depend on it.
        
        Args:
            key: The key to invalidate
            namespace: Namespace for the key
            
        Returns:
            The number of keys invalidated
        """
        full_key = self._get_full_key(key, namespace)
        dependencies = self.get_dependencies(key, namespace)
        count = 0
        
        # Invalidate the key itself
        self.cache_manager.invalidate(key, namespace)
        count += 1
        
        # Invalidate all dependencies
        for dep_key in dependencies:
            # The dependency key already includes namespace
            self.cache_manager.invalidate(dep_key)
            count += 1
            
            # Recursively invalidate dependencies of dependencies
            # This ensures we catch all cascading dependencies
            dep_dependencies = self.get_dependencies(dep_key)
            for dep_dep_key in dep_dependencies:
                self.cache_manager.invalidate(dep_dep_key)
                count += 1
        
        # Clean up the dependency tracking data
        dependencies_key = self._get_dependencies_key(full_key)
        self.cache_manager.invalidate(dependencies_key)
        
        # Check if it's time to clean up expired dependencies
        if self.enable_auto_cleanup:
            self._maybe_cleanup_expired_dependencies()
            
        return count
    
    def invalidate_keys_with_dependencies(
        self,
        keys: List[str],
        namespace: str = ""
    ) -> int:
        """
        Invalidate multiple keys and all keys that depend on them.
        
        Args:
            keys: The keys to invalidate
            namespace: Namespace for the keys
            
        Returns:
            The number of keys invalidated
        """
        total_count = 0
        for key in keys:
            count = self.invalidate_with_dependencies(key, namespace)
            total_count += count
        return total_count
    
    def cleanup_expired_dependencies(self) -> int:
        """
        Clean up expired dependency relationships.
        
        Returns:
            The number of expired dependencies removed
        """
        current_time = time.time()
        total_removed = 0
        
        # Find all dependency keys in the cache
        dependency_pattern = "dependency:*"
        dependency_keys = []
        
        # Scan for dependency keys
        for key in self.cache_manager.scan_pattern(dependency_pattern):
            dependency_keys.append(key)
        
        # Process each dependency set
        for dep_key in dependency_keys:
            dependencies = self._get_dependencies(dep_key) or {}
            original_count = len(dependencies)
            
            # Filter out expired dependencies
            active_dependencies = {
                k: v for k, v in dependencies.items() 
                if v > current_time
            }
            
            # If we have expired dependencies, update the stored dependencies
            if len(active_dependencies) < original_count:
                removed = original_count - len(active_dependencies)
                total_removed += removed
                
                if len(active_dependencies) > 0:
                    self._store_dependencies(dep_key, active_dependencies)
                else:
                    # If no active dependencies remain, remove the entry
                    self.cache_manager.invalidate(dep_key)
        
        # Update last cleanup time
        self.last_cleanup_time = current_time
        
        return total_removed
    
    def _get_dependencies_key(self, key: str) -> str:
        """
        Generate a key for storing dependencies.
        
        Args:
            key: The base key
            
        Returns:
            The dependencies key
        """
        return f"dependency:{key}"
    
    def _get_dependencies(self, dependencies_key: str) -> Dict[str, float]:
        """
        Get the dependencies map for a key.
        
        Args:
            dependencies_key: The key where dependencies are stored
            
        Returns:
            Dictionary mapping dependent keys to expiration times
        """
        return self.cache_manager.get(dependencies_key) or {}
    
    def _store_dependencies(self, dependencies_key: str, dependencies: Dict[str, float]) -> bool:
        """
        Store the dependencies map for a key.
        
        Args:
            dependencies_key: The key where dependencies are stored
            dependencies: Dictionary mapping dependent keys to expiration times
            
        Returns:
            True if successful, False otherwise
        """
        return self.cache_manager.set(
            dependencies_key, 
            dependencies,
            ttl=self.dependency_ttl
        )
    
    def _get_full_key(self, key: str, namespace: str = "") -> str:
        """
        Generate a full cache key by combining namespace and key.
        
        Args:
            key: The base key
            namespace: Optional namespace
            
        Returns:
            The full cache key
        """
        if namespace:
            return f"{namespace}:{key}"
        return key
    
    def _maybe_cleanup_expired_dependencies(self) -> None:
        """
        Clean up expired dependencies if enough time has passed.
        """
        current_time = time.time()
        if current_time - self.last_cleanup_time > self.dependency_cleanup_interval:
            self.cleanup_expired_dependencies()