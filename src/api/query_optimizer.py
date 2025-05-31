"""
GraphQL Query Optimizer
Optimizations for efficient GraphQL queries and caching
"""

import hashlib
import json
from typing import Dict, List, Any, Optional, Set
from functools import lru_cache
from dataclasses import dataclass
import asyncio
from datetime import datetime, timedelta

from ..utils import memoize


@dataclass
class QueryPlan:
    """Represents an optimized query execution plan"""
    queries: List[Dict[str, Any]]
    dependencies: Dict[str, List[str]]
    estimated_cost: int
    cache_keys: List[str]


class GraphQLQueryOptimizer:
    """
    Query optimizer for GraphQL operations
    Implements query batching, field selection optimization, and caching strategies
    """
    
    def __init__(self, cache_ttl: int = 3600):
        self.cache_ttl = cache_ttl
        self.field_usage_stats = {}
        self.query_cost_history = {}
        
    @lru_cache(maxsize=1000)
    def optimize_field_selection(self, entity_type: str, requested_fields: List[str],
                               usage_context: str = "default") -> List[str]:
        """
        Optimize field selection based on usage patterns
        Removes redundant fields and adds commonly used related fields
        """
        # Track field usage for future optimization
        self._track_field_usage(entity_type, requested_fields, usage_context)
        
        # Base fields that should always be included
        base_fields = {
            'Order': ['id', 'name', 'createdAt'],
            'Product': ['id', 'title', 'handle'],
            'Customer': ['id', 'email', 'displayName']
        }
        
        # Commonly accessed together fields
        field_groups = {
            'Order': {
                'financial': ['totalPrice', 'currencyCode', 'taxLines'],
                'fulfillment': ['fulfillmentStatus', 'shippingAddress'],
                'items': ['lineItems', 'discountCodes']
            },
            'Product': {
                'inventory': ['variants', 'inventoryQuantity'],
                'media': ['images', 'featuredImage'],
                'categorization': ['productType', 'vendor', 'tags']
            },
            'Customer': {
                'contact': ['phone', 'addresses'],
                'analytics': ['ordersCount', 'totalSpent', 'averageOrderAmount']
            }
        }
        
        optimized_fields = set(base_fields.get(entity_type, []))
        optimized_fields.update(requested_fields)
        
        # Add related fields if any field from a group is requested
        entity_groups = field_groups.get(entity_type, {})
        for group_name, group_fields in entity_groups.items():
            if any(field in requested_fields for field in group_fields):
                optimized_fields.update(group_fields)
        
        return list(optimized_fields)
    
    def _track_field_usage(self, entity_type: str, fields: List[str], context: str):
        """Track field usage patterns for optimization"""
        key = f"{entity_type}:{context}"
        if key not in self.field_usage_stats:
            self.field_usage_stats[key] = {}
        
        for field in fields:
            self.field_usage_stats[key][field] = \
                self.field_usage_stats[key].get(field, 0) + 1
    
    def batch_queries(self, queries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Batch multiple queries into efficient groups
        Combines queries that can be executed together
        """
        # Group queries by type and similar parameters
        query_groups = {}
        
        for query in queries:
            query_type = query.get('type')  # orders, products, customers
            params_key = self._get_params_key(query.get('params', {}))
            group_key = f"{query_type}:{params_key}"
            
            if group_key not in query_groups:
                query_groups[group_key] = []
            query_groups[group_key].append(query)
        
        # Create batched queries
        batched_queries = []
        
        for group_key, group_queries in query_groups.items():
            if len(group_queries) > 1:
                # Merge similar queries
                merged_query = self._merge_queries(group_queries)
                batched_queries.append(merged_query)
            else:
                batched_queries.extend(group_queries)
        
        return batched_queries
    
    def _get_params_key(self, params: Dict[str, Any]) -> str:
        """Generate a key for query parameters"""
        # Exclude pagination params for grouping
        filtered_params = {k: v for k, v in params.items() 
                          if k not in ['first', 'after', 'last', 'before']}
        return hashlib.md5(json.dumps(filtered_params, sort_keys=True).encode()).hexdigest()[:8]
    
    def _merge_queries(self, queries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge similar queries into a single optimized query"""
        if not queries:
            return {}
        
        # Take the first query as base
        merged = queries[0].copy()
        
        # Merge fields from all queries
        all_fields = set()
        for query in queries:
            all_fields.update(query.get('fields', []))
        
        merged['fields'] = list(all_fields)
        
        # Adjust pagination params
        max_first = max(q.get('params', {}).get('first', 50) for q in queries)
        merged['params']['first'] = min(max_first, 250)  # Respect API limits
        
        return merged
    
    @memoize(ttl=300)  # Cache for 5 minutes
    def estimate_query_cost(self, query: Dict[str, Any]) -> int:
        """
        Estimate the cost of a GraphQL query
        Used for rate limiting and optimization decisions
        """
        base_costs = {
            'orders': 30,
            'products': 20,
            'customers': 20,
            'inventory': 25,
            'locations': 10
        }
        
        query_type = query.get('type', 'unknown')
        base_cost = base_costs.get(query_type, 50)
        
        # Factor in requested fields
        fields = query.get('fields', [])
        field_cost = len(fields) * 2
        
        # Factor in pagination
        first = query.get('params', {}).get('first', 50)
        pagination_cost = first // 10
        
        # Nested fields cost more
        nested_cost = sum(5 for field in fields if field in 
                         ['lineItems', 'variants', 'images', 'addresses'])
        
        total_cost = base_cost + field_cost + pagination_cost + nested_cost
        
        # Track historical costs for better estimation
        self.query_cost_history[query_type] = total_cost
        
        return total_cost
    
    def create_query_plan(self, requested_operations: List[Dict[str, Any]]) -> QueryPlan:
        """
        Create an optimized query execution plan
        Considers dependencies, batching, and caching
        """
        # Optimize field selections
        for op in requested_operations:
            if 'fields' in op:
                op['fields'] = self.optimize_field_selection(
                    op['type'],
                    op['fields'],
                    op.get('context', 'default')
                )
        
        # Batch queries
        batched_queries = self.batch_queries(requested_operations)
        
        # Determine dependencies (queries that must run in sequence)
        dependencies = self._analyze_dependencies(batched_queries)
        
        # Estimate total cost
        total_cost = sum(self.estimate_query_cost(q) for q in batched_queries)
        
        # Generate cache keys
        cache_keys = [self._generate_cache_key(q) for q in batched_queries]
        
        return QueryPlan(
            queries=batched_queries,
            dependencies=dependencies,
            estimated_cost=total_cost,
            cache_keys=cache_keys
        )
    
    def _analyze_dependencies(self, queries: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """Analyze query dependencies for execution ordering"""
        dependencies = {}
        
        # Simple dependency analysis based on query types
        # Orders might depend on customer data, etc.
        query_ids = {i: q for i, q in enumerate(queries)}
        
        for i, query in enumerate(queries):
            deps = []
            
            # Example: Orders depend on customers if customer data is requested
            if query.get('type') == 'orders' and 'customer' in query.get('fields', []):
                for j, other in enumerate(queries):
                    if other.get('type') == 'customers' and j != i:
                        deps.append(str(j))
            
            dependencies[str(i)] = deps
        
        return dependencies
    
    def _generate_cache_key(self, query: Dict[str, Any]) -> str:
        """Generate a cache key for a query"""
        key_data = {
            'type': query.get('type'),
            'fields': sorted(query.get('fields', [])),
            'params': query.get('params', {})
        }
        return hashlib.sha256(json.dumps(key_data, sort_keys=True).encode()).hexdigest()
    
    def should_use_cache(self, cache_key: str, max_age: Optional[int] = None) -> bool:
        """Determine if cached data should be used"""
        # Implementation would check cache timestamp and validity
        # For now, return False to always fetch fresh data
        return False
    
    def get_optimal_batch_size(self, query_type: str, available_cost: int) -> int:
        """
        Determine optimal batch size based on available rate limit
        """
        cost_per_item = {
            'orders': 3,
            'products': 2,
            'customers': 2,
            'inventory': 2
        }
        
        item_cost = cost_per_item.get(query_type, 3)
        max_batch = available_cost // item_cost
        
        # Respect API limits
        api_limits = {
            'orders': 250,
            'products': 250,
            'customers': 250,
            'inventory': 100
        }
        
        limit = api_limits.get(query_type, 50)
        return min(max_batch, limit)


class QueryCache:
    """
    Intelligent caching for GraphQL queries
    Implements TTL, LRU, and invalidation strategies
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache = {}
        self.access_times = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0
        }
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached query result"""
        if key in self.cache:
            entry = self.cache[key]
            if self._is_valid(entry):
                self.cache_stats['hits'] += 1
                self.access_times[key] = datetime.now()
                return entry['data']
            else:
                # Remove expired entry
                del self.cache[key]
                del self.access_times[key]
        
        self.cache_stats['misses'] += 1
        return None
    
    def set(self, key: str, data: Any, ttl: Optional[int] = None):
        """Cache query result"""
        # Evict old entries if needed
        if len(self.cache) >= self.max_size:
            self._evict_lru()
        
        self.cache[key] = {
            'data': data,
            'timestamp': datetime.now(),
            'ttl': ttl or self.default_ttl
        }
        self.access_times[key] = datetime.now()
    
    def _is_valid(self, entry: Dict[str, Any]) -> bool:
        """Check if cache entry is still valid"""
        age = (datetime.now() - entry['timestamp']).total_seconds()
        return age < entry['ttl']
    
    def _evict_lru(self):
        """Evict least recently used entry"""
        if not self.access_times:
            return
        
        lru_key = min(self.access_times.items(), key=lambda x: x[1])[0]
        del self.cache[lru_key]
        del self.access_times[lru_key]
        self.cache_stats['evictions'] += 1
    
    def invalidate(self, pattern: Optional[str] = None):
        """Invalidate cache entries matching pattern"""
        if pattern is None:
            # Clear all
            self.cache.clear()
            self.access_times.clear()
        else:
            # Clear matching entries
            keys_to_remove = [k for k in self.cache.keys() if pattern in k]
            for key in keys_to_remove:
                del self.cache[key]
                if key in self.access_times:
                    del self.access_times[key]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
        hit_rate = (self.cache_stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self.cache_stats,
            'hit_rate': hit_rate,
            'size': len(self.cache),
            'total_requests': total_requests
        }