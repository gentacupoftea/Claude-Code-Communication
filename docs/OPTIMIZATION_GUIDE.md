# Shopify Data Integration Optimization Guide

## Introduction

This guide provides detailed optimization strategies for the Shopify Data Integration module. Following these recommendations will help achieve optimal performance, reduce resource consumption, and improve system reliability.

## Table of Contents

1. [API Optimization](#api-optimization)
2. [Caching Strategies](#caching-strategies)
3. [Database Optimization](#database-optimization)
4. [Memory Management](#memory-management)
5. [Network Optimization](#network-optimization)
6. [Concurrency Tuning](#concurrency-tuning)
7. [Monitoring and Profiling](#monitoring-and-profiling)

## API Optimization

### 1. Request Batching

```python
# Instead of individual requests
for product_id in product_ids:
    product = shopify_client.get_product(product_id)
    process_product(product)

# Use batch requests
products = shopify_client.get_products_batch(product_ids)
for product in products:
    process_product(product)
```

### 2. Field Selection

```python
# Only request needed fields
products = shopify_client.get_products(
    fields=['id', 'title', 'price', 'inventory_quantity']
)
```

### 3. Pagination Optimization

```python
# Use cursor-based pagination for large datasets
async def fetch_all_products():
    cursor = None
    while True:
        response = await shopify_client.get_products(
            limit=250,  # Maximum allowed
            cursor=cursor
        )
        
        yield response.products
        
        if not response.has_next:
            break
        cursor = response.next_cursor
```

### 4. Rate Limit Management

```python
class RateLimitManager:
    def __init__(self, requests_per_second=2):
        self.rate_limiter = RateLimiter(requests_per_second)
        self.retry_after = None
    
    async def make_request(self, request_fn, *args, **kwargs):
        while True:
            if self.retry_after:
                await asyncio.sleep(self.retry_after)
                self.retry_after = None
            
            try:
                async with self.rate_limiter:
                    return await request_fn(*args, **kwargs)
            except RateLimitExceeded as e:
                self.retry_after = e.retry_after
```

## Caching Strategies

### 1. Multi-Level Caching

```python
class MultiLevelCache:
    def __init__(self):
        self.l1_cache = MemoryCache(max_size=1000)  # Fast, small
        self.l2_cache = RedisCache()  # Slower, larger
    
    async def get(self, key):
        # Check L1 first
        value = self.l1_cache.get(key)
        if value is not None:
            return value
        
        # Check L2
        value = await self.l2_cache.get(key)
        if value is not None:
            # Promote to L1
            self.l1_cache.set(key, value)
            return value
        
        return None
```

### 2. Cache Warming

```python
async def warm_cache():
    # Pre-load frequently accessed data
    popular_products = await get_popular_products()
    for product in popular_products:
        await cache.set(f"product:{product.id}", product)
    
    # Pre-compute expensive aggregations
    daily_stats = await compute_daily_stats()
    await cache.set("stats:daily", daily_stats, ttl=3600)
```

### 3. Smart Cache Invalidation

```python
class SmartCache:
    def __init__(self):
        self.cache = {}
        self.dependencies = {}  # Track dependencies
    
    def set(self, key, value, depends_on=None):
        self.cache[key] = value
        if depends_on:
            for dep in depends_on:
                if dep not in self.dependencies:
                    self.dependencies[dep] = set()
                self.dependencies[dep].add(key)
    
    def invalidate(self, key):
        # Invalidate key and all dependents
        if key in self.cache:
            del self.cache[key]
        
        if key in self.dependencies:
            for dependent in self.dependencies[key]:
                self.invalidate(dependent)
```

## Database Optimization

### 1. Connection Pooling

```python
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=40,
    pool_timeout=30,
    pool_recycle=3600
)
```

### 2. Query Optimization

```python
# Use joins instead of N+1 queries
orders = session.query(Order)\
    .options(joinedload(Order.line_items))\
    .options(joinedload(Order.customer))\
    .filter(Order.created_at >= start_date)\
    .all()

# Use bulk operations
session.bulk_insert_mappings(Product, product_data)
session.bulk_update_mappings(Inventory, inventory_updates)
```

### 3. Index Optimization

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_orders_customer_date 
    ON orders(customer_id, created_at DESC);

CREATE INDEX idx_products_category_status 
    ON products(category_id, status)
    WHERE status = 'active';

-- Add partial indexes for filtered queries
CREATE INDEX idx_orders_pending 
    ON orders(created_at) 
    WHERE status = 'pending';
```

## Memory Management

### 1. Stream Processing

```python
def process_large_dataset(dataset):
    # Process in chunks to avoid memory overflow
    chunk_size = 1000
    
    for chunk in iter_chunks(dataset, chunk_size):
        results = process_chunk(chunk)
        yield from results
        
        # Force garbage collection if needed
        if get_memory_usage() > MEMORY_THRESHOLD:
            gc.collect()
```

### 2. Object Pooling

```python
class ConnectionPool:
    def __init__(self, factory, max_size=10):
        self.factory = factory
        self.pool = Queue(maxsize=max_size)
        self.size = 0
        self.max_size = max_size
    
    async def acquire(self):
        if self.pool.empty() and self.size < self.max_size:
            conn = await self.factory()
            self.size += 1
        else:
            conn = await self.pool.get()
        
        return conn
    
    async def release(self, conn):
        await self.pool.put(conn)
```

### 3. Memory Profiling

```python
import memory_profiler
import tracemalloc

@memory_profiler.profile
def memory_intensive_operation():
    # Your code here
    pass

# Track memory allocations
tracemalloc.start()
# ... your code ...
current, peak = tracemalloc.get_traced_memory()
print(f"Current memory usage: {current / 10**6:.1f} MB")
print(f"Peak memory usage: {peak / 10**6:.1f} MB")
tracemalloc.stop()
```

## Network Optimization

### 1. Connection Reuse

```python
# Use session for connection reuse
session = aiohttp.ClientSession(
    connector=aiohttp.TCPConnector(
        limit=100,
        ttl_dns_cache=300,
        enable_cleanup_closed=True
    )
)

# Reuse session for multiple requests
async with session.get(url1) as resp:
    data1 = await resp.json()

async with session.get(url2) as resp:
    data2 = await resp.json()
```

### 2. Compression

```python
# Enable compression for requests
headers = {
    'Accept-Encoding': 'gzip, deflate',
    'Content-Encoding': 'gzip'
}

# Compress request body
import gzip
compressed_data = gzip.compress(json.dumps(data).encode())

response = await session.post(
    url,
    data=compressed_data,
    headers=headers
)
```

### 3. Request Prioritization

```python
class PriorityRequestQueue:
    def __init__(self):
        self.queues = {
            'high': asyncio.Queue(),
            'medium': asyncio.Queue(),
            'low': asyncio.Queue()
        }
    
    async def process_requests(self):
        while True:
            # Process high priority first
            for priority in ['high', 'medium', 'low']:
                queue = self.queues[priority]
                if not queue.empty():
                    request = await queue.get()
                    await self.execute_request(request)
                    break
            else:
                await asyncio.sleep(0.1)
```

## Concurrency Tuning

### 1. Optimal Worker Count

```python
import multiprocessing

# CPU-bound tasks
optimal_workers = multiprocessing.cpu_count()

# I/O-bound tasks
optimal_workers = multiprocessing.cpu_count() * 2

# For mixed workloads
optimal_workers = int(multiprocessing.cpu_count() * 1.5)
```

### 2. Semaphore Control

```python
class ConcurrencyController:
    def __init__(self, max_concurrent=10):
        self.semaphore = asyncio.Semaphore(max_concurrent)
    
    async def run_task(self, task_fn, *args, **kwargs):
        async with self.semaphore:
            return await task_fn(*args, **kwargs)
```

### 3. Dynamic Scaling

```python
class DynamicWorkerPool:
    def __init__(self, min_workers=2, max_workers=10):
        self.min_workers = min_workers
        self.max_workers = max_workers
        self.current_workers = min_workers
        self.queue_size = 0
    
    def adjust_workers(self):
        # Scale up if queue is growing
        if self.queue_size > self.current_workers * 10:
            self.current_workers = min(
                self.current_workers + 1,
                self.max_workers
            )
        # Scale down if queue is small
        elif self.queue_size < self.current_workers * 2:
            self.current_workers = max(
                self.current_workers - 1,
                self.min_workers
            )
```

## Monitoring and Profiling

### 1. Performance Metrics

```python
import time
from dataclasses import dataclass
from typing import Dict

@dataclass
class PerformanceMetrics:
    operation: str
    duration: float
    success: bool
    error: str = None

class PerformanceMonitor:
    def __init__(self):
        self.metrics: Dict[str, list] = {}
    
    def record(self, metric: PerformanceMetrics):
        if metric.operation not in self.metrics:
            self.metrics[metric.operation] = []
        self.metrics[metric.operation].append(metric)
    
    def get_stats(self, operation: str):
        metrics = self.metrics.get(operation, [])
        if not metrics:
            return None
        
        durations = [m.duration for m in metrics if m.success]
        return {
            'count': len(metrics),
            'success_rate': sum(1 for m in metrics if m.success) / len(metrics),
            'avg_duration': sum(durations) / len(durations) if durations else 0,
            'p95_duration': np.percentile(durations, 95) if durations else 0,
            'p99_duration': np.percentile(durations, 99) if durations else 0
        }
```

### 2. Distributed Tracing

```python
from opentelemetry import trace
from opentelemetry.exporter.jaeger import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Setup tracer
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Setup Jaeger exporter
jaeger_exporter = JaegerExporter(
    agent_host_name="localhost",
    agent_port=6831,
)

span_processor = BatchSpanProcessor(jaeger_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Use in code
@trace_operation("fetch_products")
async def fetch_products(filters=None):
    with tracer.start_as_current_span("shopify_api_call"):
        products = await shopify_client.get_products(filters)
    
    with tracer.start_as_current_span("process_products"):
        processed = process_products(products)
    
    return processed
```

### 3. Custom Profiling

```python
import cProfile
import pstats
from io import StringIO

def profile_function(func):
    def wrapper(*args, **kwargs):
        profiler = cProfile.Profile()
        profiler.enable()
        
        try:
            result = func(*args, **kwargs)
        finally:
            profiler.disable()
            
            # Generate report
            s = StringIO()
            stats = pstats.Stats(profiler, stream=s)
            stats.sort_stats('cumulative')
            stats.print_stats(10)  # Top 10 functions
            
            print(s.getvalue())
        
        return result
    return wrapper
```

## Best Practices Summary

1. **Always measure before optimizing** - Use profiling to identify bottlenecks
2. **Optimize the critical path first** - Focus on the most frequently used operations
3. **Cache aggressively but invalidate smartly** - Balance freshness with performance
4. **Use async/await for I/O operations** - Maximize concurrency for network calls
5. **Batch operations when possible** - Reduce overhead and improve throughput
6. **Monitor production performance** - Set up alerts for degradation
7. **Plan for failure** - Implement circuit breakers and fallbacks
8. **Document optimization decisions** - Explain why certain trade-offs were made

## Conclusion

Performance optimization is an iterative process. Start with the basics, measure the impact, and gradually apply more advanced techniques. Remember that premature optimization can lead to unnecessary complexity - always balance performance gains against code maintainability.
