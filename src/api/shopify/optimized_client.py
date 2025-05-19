"""
Optimized Shopify GraphQL Client
Integrates batching, caching, and rate limiting for optimal performance
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional, List, Tuple
import redis
from contextlib import asynccontextmanager

from ..shopify_graphql import ShopifyGraphQLAPI, ShopifyGraphQLError
from .batch_processor import GraphQLBatchProcessor
from .cache_manager import GraphQLCacheManager
from .rate_limiter import AdaptiveRateLimiter

logger = logging.getLogger(__name__)


class OptimizedShopifyGraphQL:
    """
    Optimized Shopify GraphQL client with:
    - Query batching
    - Multi-level caching
    - Adaptive rate limiting
    - Performance monitoring
    """
    
    def __init__(self,
                 shop_url: str,
                 access_token: str,
                 api_version: str = "2025-04",
                 redis_url: Optional[str] = None,
                 enable_batching: bool = True,
                 enable_caching: bool = True,
                 enable_rate_limiting: bool = True):
        """
        Initialize optimized client
        
        Args:
            shop_url: Shopify shop URL
            access_token: API access token
            api_version: API version
            redis_url: Redis connection URL (optional)
            enable_batching: Enable query batching
            enable_caching: Enable result caching
            enable_rate_limiting: Enable enhanced rate limiting
        """
        # Base client
        self.base_client = ShopifyGraphQLAPI(
            shop_url=shop_url,
            access_token=access_token,
            api_version=api_version
        )
        
        # Redis client
        self.redis_client = None
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url)
                logger.info("Connected to Redis for caching")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e}")
        
        # Initialize components
        self.batch_processor = None
        self.cache_manager = None
        self.rate_limiter = None
        
        if enable_batching:
            self.batch_processor = GraphQLBatchProcessor(
                graphql_client=self,
                batch_size=10,
                batch_timeout=0.1,
                max_query_cost=900  # Leave buffer for rate limits
            )
        
        if enable_caching:
            self.cache_manager = GraphQLCacheManager(
                memory_size=10_000_000,  # 10MB
                memory_ttl=300,          # 5 minutes
                redis_client=self.redis_client,
                redis_size=100_000_000,  # 100MB
                redis_ttl=3600          # 1 hour
            )
        
        if enable_rate_limiting:
            self.rate_limiter = AdaptiveRateLimiter(
                initial_limit=1000,
                restore_rate=50,
                bucket_size=1000
            )
        
        # Performance metrics
        self.metrics = {
            'queries_executed': 0,
            'queries_batched': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'total_cost': 0,
            'errors': 0,
        }
    
    async def start(self):
        """Start all optimization components"""
        tasks = []
        
        if self.batch_processor:
            tasks.append(self.batch_processor.start())
        
        if self.rate_limiter:
            tasks.append(self.rate_limiter.start())
        
        if tasks:
            await asyncio.gather(*tasks)
        
        logger.info("Optimized GraphQL client started")
    
    async def stop(self):
        """Stop all optimization components"""
        tasks = []
        
        if self.batch_processor:
            tasks.append(self.batch_processor.stop())
        
        if self.rate_limiter:
            tasks.append(self.rate_limiter.stop())
        
        if tasks:
            await asyncio.gather(*tasks)
        
        # Close base client
        await self.base_client.close()
        
        # Close Redis connection
        if self.redis_client:
            self.redis_client.close()
        
        logger.info("Optimized GraphQL client stopped")
    
    async def execute_query(self,
                          query: str,
                          variables: Optional[Dict[str, Any]] = None,
                          use_cache: bool = True,
                          use_batch: bool = True,
                          priority: int = 5,
                          cache_ttl: Optional[float] = None,
                          cache_tags: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Execute GraphQL query with optimizations
        
        Args:
            query: GraphQL query string
            variables: Query variables
            use_cache: Whether to use caching
            use_batch: Whether to use batching
            priority: Query priority (1=highest)
            cache_ttl: Cache TTL override
            cache_tags: Cache tags for invalidation
            
        Returns:
            Query result
        """
        self.metrics['queries_executed'] += 1
        
        # Try cache first
        if use_cache and self.cache_manager:
            result = await self.cache_manager.get(query, variables)
            if result is not None:
                self.metrics['cache_hits'] += 1
                logger.debug(f"Cache hit for query: {query[:50]}...")
                return result
            self.metrics['cache_misses'] += 1
        
        # Use batching if enabled
        if use_batch and self.batch_processor:
            self.metrics['queries_batched'] += 1
            result = await self.batch_processor.add_query(
                query=query,
                variables=variables,
                priority=priority
            )
        else:
            # Direct execution with rate limiting
            if self.rate_limiter:
                execution = await self.rate_limiter.acquire(
                    query=query,
                    priority=priority
                )
                
                try:
                    result = await self._execute_with_rate_limit(
                        query, variables, execution
                    )
                except Exception as e:
                    execution.success = False
                    execution.error = str(e)
                    raise
                finally:
                    self.rate_limiter.release(
                        execution,
                        actual_cost=getattr(result, 'query_cost', None)
                    )
            else:
                # Direct execution without rate limiting
                result = await self.base_client.execute_query(query, variables)
        
        # Cache result
        if use_cache and self.cache_manager and result:
            await self.cache_manager.set(
                query=query,
                variables=variables,
                result=result,
                ttl=cache_ttl,
                tags=cache_tags
            )
        
        return result
    
    async def _execute_with_rate_limit(self,
                                     query: str,
                                     variables: Optional[Dict[str, Any]],
                                     execution) -> Dict[str, Any]:
        """Execute query with rate limit tracking"""
        try:
            result = await self.base_client.execute_query(query, variables)
            
            # Update rate limits from response
            if hasattr(self.base_client.client, 'last_response'):
                self.rate_limiter.update_limits(
                    self.base_client.client.last_response.headers
                )
            
            execution.success = True
            self.metrics['total_cost'] += execution.estimated_cost
            
            return result
            
        except ShopifyGraphQLError as e:
            self.metrics['errors'] += 1
            
            # Update actual cost if available
            if e.query_cost:
                execution.actual_cost = e.query_cost
                self.metrics['total_cost'] += e.query_cost
            
            raise
    
    # Enhanced query methods with optimization
    async def get_orders_optimized(self,
                                  first: int = 50,
                                  after: Optional[str] = None,
                                  status: Optional[str] = None,
                                  created_at_min: Optional[str] = None,
                                  created_at_max: Optional[str] = None,
                                  fields: Optional[List[str]] = None,
                                  use_cache: bool = True,
                                  cache_ttl: float = 300) -> Dict[str, Any]:
        """Get orders with optimization"""
        # Build query
        query = self._build_orders_query(
            fields or ['lineItems', 'customer', 'totalPrice']
        )
        
        variables = {
            'first': first,
            'after': after,
            'status': status,
            'createdAtMin': created_at_min,
            'createdAtMax': created_at_max,
        }
        
        # Remove None values
        variables = {k: v for k, v in variables.items() if v is not None}
        
        # Cache tags for invalidation
        cache_tags = ['orders']
        if status:
            cache_tags.append(f'status:{status}')
        
        return await self.execute_query(
            query=query,
            variables=variables,
            use_cache=use_cache,
            cache_ttl=cache_ttl,
            cache_tags=cache_tags
        )
    
    async def get_products_optimized(self,
                                   first: int = 50,
                                   after: Optional[str] = None,
                                   fields: Optional[List[str]] = None,
                                   use_cache: bool = True,
                                   cache_ttl: float = 600) -> Dict[str, Any]:
        """Get products with optimization"""
        query = self._build_products_query(
            fields or ['variants', 'images', 'status']
        )
        
        variables = {
            'first': first,
            'after': after,
        }
        
        return await self.execute_query(
            query=query,
            variables=variables,
            use_cache=use_cache,
            cache_ttl=cache_ttl,
            cache_tags=['products']
        )
    
    async def get_customers_optimized(self,
                                    first: int = 50,
                                    after: Optional[str] = None,
                                    fields: Optional[List[str]] = None,
                                    use_cache: bool = True,
                                    cache_ttl: float = 900) -> Dict[str, Any]:
        """Get customers with optimization"""
        query = self._build_customers_query(
            fields or ['addresses', 'orders', 'tags']
        )
        
        variables = {
            'first': first,
            'after': after,
        }
        
        return await self.execute_query(
            query=query,
            variables=variables,
            use_cache=use_cache,
            cache_ttl=cache_ttl,
            cache_tags=['customers']
        )
    
    # Batch operations
    async def get_multiple_orders(self,
                                order_ids: List[str],
                                fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Get multiple orders in batch"""
        if not self.batch_processor:
            # Fallback to sequential execution
            results = []
            for order_id in order_ids:
                query = self._build_order_by_id_query(order_id, fields)
                result = await self.execute_query(query, use_batch=False)
                results.append(result.get('order', {}))
            return results
        
        # Use batching
        tasks = []
        for order_id in order_ids:
            query = self._build_order_by_id_query(order_id, fields)
            task = self.batch_processor.add_query(query)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        return [r.get('order', {}) for r in results]
    
    # Cache management
    async def invalidate_cache(self,
                            tags: Optional[List[str]] = None,
                            pattern: Optional[str] = None):
        """Invalidate cache entries"""
        if self.cache_manager:
            return await self.cache_manager.invalidate(tags=tags, pattern=pattern)
        return 0
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        metrics = {
            'client': self.metrics,
            'components': {}
        }
        
        if self.batch_processor:
            metrics['components']['batch'] = self.batch_processor.get_metrics()
        
        if self.cache_manager:
            metrics['components']['cache'] = self.cache_manager.get_stats()
        
        if self.rate_limiter:
            metrics['components']['rate_limit'] = self.rate_limiter.get_metrics()
        
        return metrics
    
    def get_state(self) -> Dict[str, Any]:
        """Get current system state"""
        state = {}
        
        if self.rate_limiter:
            state['rate_limit'] = self.rate_limiter.get_state()
        
        if self.batch_processor:
            state['batch'] = {
                'queue_size': self.batch_processor.queue.qsize(),
                'pending_requests': len(self.batch_processor.pending_requests),
                'processing': self.batch_processor.processing
            }
        
        return state
    
    # Query builders (simplified for example)
    def _build_orders_query(self, fields: List[str]) -> str:
        fields_str = '\n'.join(fields)
        return f"""
        query GetOrders($first: Int!, $after: String, $status: String,
                       $createdAtMin: String, $createdAtMax: String) {{
          orders(first: $first, after: $after, query: $query) {{
            edges {{
              node {{
                id
                name
                {fields_str}
              }}
            }}
            pageInfo {{
              hasNextPage
              endCursor
            }}
          }}
        }}
        """
    
    def _build_products_query(self, fields: List[str]) -> str:
        fields_str = '\n'.join(fields)
        return f"""
        query GetProducts($first: Int!, $after: String) {{
          products(first: $first, after: $after) {{
            edges {{
              node {{
                id
                title
                {fields_str}
              }}
            }}
            pageInfo {{
              hasNextPage
              endCursor
            }}
          }}
        }}
        """
    
    def _build_customers_query(self, fields: List[str]) -> str:
        fields_str = '\n'.join(fields)
        return f"""
        query GetCustomers($first: Int!, $after: String) {{
          customers(first: $first, after: $after) {{
            edges {{
              node {{
                id
                displayName
                {fields_str}
              }}
            }}
            pageInfo {{
              hasNextPage
              endCursor
            }}
          }}
        }}
        """
    
    def _build_order_by_id_query(self, order_id: str, fields: Optional[List[str]]) -> str:
        fields_str = '\n'.join(fields or ['totalPrice', 'currencyCode'])
        return f"""
        query GetOrder {{
          order(id: "{order_id}") {{
            id
            name
            {fields_str}
          }}
        }}
        """
    
    # Context manager support
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()


# Factory function
def create_optimized_client(shop_url: str,
                          access_token: str,
                          api_version: str = "2025-04",
                          redis_url: Optional[str] = None,
                          **kwargs) -> OptimizedShopifyGraphQL:
    """
    Create an optimized Shopify GraphQL client
    
    Args:
        shop_url: Shopify shop URL
        access_token: API access token
        api_version: API version
        redis_url: Redis connection URL (optional)
        **kwargs: Additional configuration options
        
    Returns:
        OptimizedShopifyGraphQL instance
    """
    # Get configuration from environment if not provided
    if not redis_url:
        redis_url = os.getenv('REDIS_URL')
    
    # Create client with sensible defaults
    return OptimizedShopifyGraphQL(
        shop_url=shop_url,
        access_token=access_token,
        api_version=api_version,
        redis_url=redis_url,
        enable_batching=kwargs.get('enable_batching', True),
        enable_caching=kwargs.get('enable_caching', True),
        enable_rate_limiting=kwargs.get('enable_rate_limiting', True)
    )