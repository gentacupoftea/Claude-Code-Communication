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

from ..shopify_graphql import ShopifyGraphQLAPI
from ..errors import ShopifyAPIError, ShopifyGraphQLError, ShopifyRateLimitError
from .batch_processor import GraphQLBatchProcessor
from .cache_manager import GraphQLCacheManager
from .rate_limiter import AdaptiveRateLimiter
from .fragment_library import fragment_library
from .query_optimizer import query_optimizer

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
        
        # Query optimization components
        self.fragment_library = fragment_library
        self.query_optimizer = query_optimizer
        
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
                          cache_tags: Optional[List[str]] = None,
                          optimize_query: bool = True) -> Dict[str, Any]:
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
        
        # Optimize query if enabled
        original_query = query
        if optimize_query and self.query_optimizer:
            try:
                optimization_result = self.query_optimizer.optimize(query)
                if optimization_result.optimized_query != query:
                    query = optimization_result.optimized_query
                    logger.debug(
                        f"Query optimized: {optimization_result.estimated_cost_original} -> "
                        f"{optimization_result.estimated_cost_optimized} cost "
                        f"({optimization_result.optimization_ratio:.1%} savings)"
                    )
                    
                    if optimization_result.fragments_added:
                        logger.debug(f"Added fragments: {', '.join(optimization_result.fragments_added)}")
            except Exception as e:
                logger.warning(f"Query optimization failed: {e}")
                # Fall back to original query
                query = original_query
        
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
            if hasattr(e, 'query_cost') and e.query_cost:
                execution.actual_cost = e.query_cost
                self.metrics['total_cost'] += e.query_cost
            
            raise
        except ShopifyRateLimitError as e:
            self.metrics['errors'] += 1
            
            # Update rate limiter state
            if e.retry_after and self.rate_limiter:
                self.rate_limiter.state.cost_available = 0
                
            # Apply backoff for rate limit errors
            execution.actual_cost = execution.estimated_cost
            execution.error = str(e)
                
            raise
        except ShopifyAPIError as e:
            self.metrics['errors'] += 1
            execution.error = str(e)
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
        # Use fragment library to build query
        fragment_name = "OrderWithLineItems"
        if fields and "customer" in fields and "lineItems" not in fields:
            fragment_name = "OrderWithCustomer"
        elif fields and "fulfillments" in fields:
            fragment_name = "OrderWithFulfillments"
        
        pagination = {
            "first": first,
            "after": after
        }
        
        # Build optimized query with appropriate fragment
        query = self.fragment_library.build_optimized_query(
            operation_type="query",
            entity_type="Order",
            fragment_name=fragment_name,
            pagination=pagination
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
            cache_tags=cache_tags,
            optimize_query=True
        )
    
    async def get_products_optimized(self,
                                   first: int = 50,
                                   after: Optional[str] = None,
                                   fields: Optional[List[str]] = None,
                                   use_cache: bool = True,
                                   cache_ttl: float = 600) -> Dict[str, Any]:
        """Get products with optimization"""
        # Use fragment library to build query
        fragment_name = "ProductWithVariants"
        if fields and "images" in fields and "variants" not in fields:
            fragment_name = "ProductWithImages"
        
        pagination = {
            "first": first,
            "after": after
        }
        
        # Build optimized query with appropriate fragment
        query = self.fragment_library.build_optimized_query(
            operation_type="query",
            entity_type="Product",
            fragment_name=fragment_name,
            pagination=pagination
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
            cache_tags=['products'],
            optimize_query=True
        )
    
    async def get_customers_optimized(self,
                                    first: int = 50,
                                    after: Optional[str] = None,
                                    fields: Optional[List[str]] = None,
                                    use_cache: bool = True,
                                    cache_ttl: float = 900) -> Dict[str, Any]:
        """Get customers with optimization"""
        # Use fragment library to build query
        fragment_name = "CoreCustomerFields"
        if fields and "addresses" in fields:
            fragment_name = "CustomerWithAddresses"
        elif fields and "orders" in fields:
            fragment_name = "CustomerWithOrders"
        
        pagination = {
            "first": first,
            "after": after
        }
        
        # Build optimized query with appropriate fragment
        query = self.fragment_library.build_optimized_query(
            operation_type="query",
            entity_type="Customer",
            fragment_name=fragment_name,
            pagination=pagination
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
            cache_tags=['customers'],
            optimize_query=True
        )
    
    # Batch operations
    async def get_multiple_orders(self,
                                order_ids: List[str],
                                fields: Optional[List[str]] = None,
                                fragment_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get multiple orders in batch using intelligent batching"""
        if not order_ids:
            return []
            
        # Determine fragment to use
        if not fragment_name:
            fragment_name = "CoreOrderFields"
            if fields:
                if "lineItems" in fields:
                    fragment_name = "OrderWithLineItems"
                elif "customer" in fields:
                    fragment_name = "OrderWithCustomer"
                elif "fulfillments" in fields:
                    fragment_name = "OrderWithFulfillments"
        
        # Prepare queries
        queries = []
        for order_id in order_ids:
            query = f"""
            query GetOrder{{order_id}} {{  
              order(id: "{order_id}") {{  
                ...{fragment_name}  
              }}  
            }}  
            """
            queries.append(query)
        
        # Check if we should use batch processor
        if not self.batch_processor or len(order_ids) <= 3:
            # For small batches, use query optimizer directly
            combined_query, query_map = self.query_optimizer.combine_queries(queries)
            
            # Add the fragment definition
            fragment = self.fragment_library.get_fragment("Order", fragment_name)
            if fragment:
                combined_query = f"{fragment}\n\n{combined_query}"
            
            # Execute combined query
            combined_result = await self.execute_query(
                query=combined_query,
                use_batch=False,
                use_cache=True,
                cache_tags=["orders"],
                optimize_query=False  # Already optimized
            )
            
            # Extract results
            results = []
            for i, order_id in enumerate(order_ids):
                alias = f"q{i}"
                if alias in combined_result:
                    results.append(combined_result[alias].get('order', {}))
                else:
                    results.append({})
                    
            return results
        
        # Otherwise use batch processor for large batches
        tasks = []
        for i, order_id in enumerate(order_ids):
            # Create optimized query with fragment
            query = f"""
            {self.fragment_library.get_fragment("Order", fragment_name)}
            
            query GetOrder {{  
              order(id: "{order_id}") {{  
                ...{fragment_name}  
              }}  
            }}  
            """
            
            # Add to batch processor with priority
            priority = 5  # Default priority
            task = self.batch_processor.add_query(query, priority=priority)
            tasks.append(task)
        
        # Execute all tasks concurrently
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
    
    # Batch operations for other entity types
    async def get_multiple_products(self, 
                                  product_ids: List[str],
                                  fields: Optional[List[str]] = None,
                                  fragment_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get multiple products in batch"""
        if not product_ids:
            return []
            
        # Determine fragment to use
        if not fragment_name:
            fragment_name = "CoreProductFields"
            if fields:
                if "variants" in fields:
                    fragment_name = "ProductWithVariants"
                elif "images" in fields:
                    fragment_name = "ProductWithImages"
        
        # Create tasks
        tasks = []
        for product_id in product_ids:
            query = f"""
            {self.fragment_library.get_fragment("Product", fragment_name)}
            
            query GetProduct {{  
              product(id: "{product_id}") {{  
                ...{fragment_name}  
              }}  
            }}  
            """
            
            # Add to batch processor
            if self.batch_processor:
                task = self.batch_processor.add_query(query)
            else:
                task = self.execute_query(query, use_batch=False)
                
            tasks.append(task)
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks)
        return [r.get('product', {}) for r in results]
    
    async def get_multiple_customers(self,
                                    customer_ids: List[str],
                                    fields: Optional[List[str]] = None,
                                    fragment_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get multiple customers in batch"""
        if not customer_ids:
            return []
            
        # Determine fragment to use
        if not fragment_name:
            fragment_name = "CoreCustomerFields"
            if fields:
                if "addresses" in fields:
                    fragment_name = "CustomerWithAddresses"
                elif "orders" in fields:
                    fragment_name = "CustomerWithOrders"
        
        # Create tasks
        tasks = []
        for customer_id in customer_ids:
            query = f"""
            {self.fragment_library.get_fragment("Customer", fragment_name)}
            
            query GetCustomer {{  
              customer(id: "{customer_id}") {{  
                ...{fragment_name}  
              }}  
            }}  
            """
            
            # Add to batch processor
            if self.batch_processor:
                task = self.batch_processor.add_query(query)
            else:
                task = self.execute_query(query, use_batch=False)
                
            tasks.append(task)
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks)
        return [r.get('customer', {}) for r in results]
    
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