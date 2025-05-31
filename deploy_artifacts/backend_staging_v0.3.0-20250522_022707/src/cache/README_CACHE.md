# Cache System Documentation

This document provides an overview of the caching system used in the Shopify MCP Server.

## Cache Components

The system offers multiple components for complete cache management:

1. **Cache Managers**
   - **CacheManager** - Basic Redis-based caching
   - **OptimizedCacheManager** - Advanced multi-level caching with memory and Redis

2. **CacheDependencyTracker** - Intelligent cache invalidation through dependencies

3. **CacheFactory** - Factory for creating and configuring cache components

4. **CacheMetricsCollector** - Collects and aggregates cache performance metrics

5. **CacheDashboard** - Generates visual dashboards and reports for monitoring

## OptimizedCacheManager

The `OptimizedCacheManager` implements a sophisticated multi-level caching strategy that combines an in-memory cache (L1) with Redis (L2) for improved performance and scalability.

### Key Features

- **Two-tier caching**: Memory (L1) backed by Redis (L2)
- **Adaptive TTL**: Dynamic TTL adjustment based on data size and type
- **Data compression**: Automatic compression for large values
- **Smart eviction**: LRU-based strategy with size and access count factors
- **Performance monitoring**: Comprehensive metrics for cache operations
- **Pattern-based invalidation**: Support for invalidating groups of cache keys

### Configuration

```python
cache_manager = OptimizedCacheManager(
    redis_client=redis_client,
    memory_cache_size=10000,       # Maximum items in memory cache
    redis_ttl=3600,                # Default Redis TTL (seconds)
    memory_ttl=300,                # Default memory TTL (seconds)
    enable_compression=True,       # Enable compression for large values
    compression_min_size=1024,     # Minimum size for compression (bytes)
    compression_level=6,           # Compression level (1-9)
    enable_adaptive_ttl=True,      # Enable adaptive TTL
    ttl_min_factor=0.5,            # Minimum TTL factor
    ttl_max_factor=2.0,            # Maximum TTL factor
    ttl_size_threshold=10000,      # Size threshold for TTL adjustment
    track_metrics=True             # Enable metrics collection
)
```

### Basic Usage

```python
# Set a value
cache_manager.set("key", "value")

# Get a value
value = cache_manager.get("key")

# Set with namespace
cache_manager.set("key", "value", namespace="products")

# Get with namespace
value = cache_manager.get("key", namespace="products")

# Set with custom TTL
cache_manager.set("key", "value", ttl=600)  # 10 minutes

# Invalidate a specific key
cache_manager.invalidate("key")

# Invalidate by pattern
cache_manager.invalidate_pattern("product_*")

# Invalidate all
cache_manager.invalidate_all()

# Get cache statistics
stats = cache_manager.get_stats()
```

### How It Works

1. **Cache operations**:
   - `get` operation checks memory cache first, falls back to Redis
   - `set` operation stores in both memory and Redis
   - Items found in Redis are automatically promoted to memory cache

2. **Adaptive TTL**:
   - Smaller objects get longer TTL (more efficient to store)
   - Larger objects get shorter TTL (more expensive to store)
   - TTL calculation includes jitter to prevent cache stampedes

3. **Compression**:
   - Large values are automatically compressed using zlib
   - Compression only applies when value size exceeds threshold
   - Compression/decompression is transparent to the user

4. **LRU Eviction**:
   - When memory cache reaches capacity, least recently used items are evicted
   - Access to an item refreshes its LRU status

### Performance Monitoring

The `get_stats()` method returns comprehensive metrics:

```python
{
    "total_requests": 1000,
    "hits": 800,
    "misses": 200,
    "hit_rate": 0.8,          # 80% hit rate
    "redis_hits": 100,
    "redis_misses": 200,
    "memory_cache_size": 500,
    "memory_cache_limit": 1000,
    "memory_evictions": 50,
    "compressed_items": 30
}
```

### Thread Safety

The OptimizedCacheManager is designed to be thread-safe for concurrent operations.

## When to Use OptimizedCacheManager

- **High-traffic applications**: Benefits from memory caching
- **Frequent access to the same data**: Memory caching provides fast access
- **Mixed data sizes**: Adaptive TTL and compression optimize for various sizes
- **Need for detailed metrics**: Provides comprehensive performance statistics

## CacheDependencyTracker

The `CacheDependencyTracker` provides intelligent cache invalidation through tracking dependencies between cache keys.

### Key Features

- **Dependency tracking**: Track relationships between related cache entries
- **Intelligent invalidation**: Automatically invalidate dependent keys when a key is invalidated
- **Configurable TTL**: Set how long dependencies are tracked
- **Automatic cleanup**: Periodically remove expired dependencies

### Basic Usage

```python
# Create dependency tracker using existing cache manager
dependency_tracker = CacheDependencyTracker(
    cache_manager=cache_manager,
    dependency_ttl=86400,  # 1 day
    max_dependencies_per_key=1000,
    enable_auto_cleanup=True
)

# Register dependencies
dependency_tracker.register_dependency(
    key="product_1",
    depends_on_key="category_5"
)

# Register multiple dependencies at once
dependency_tracker.register_multiple_dependencies(
    key="product_1",
    depends_on_keys=["brand_3", "tag_7", "inventory_status"]
)

# Invalidate a key and all its dependencies
dependency_tracker.invalidate_with_dependencies("category_5")

# Get all keys that depend on a key
dependent_keys = dependency_tracker.get_dependencies("category_5")

# Clean up expired dependencies manually
dependency_tracker.cleanup_expired_dependencies()
```

## CacheFactory

The `CacheFactory` provides a convenient way to create and configure cache components.

### Key Features

- **Simplified creation**: Create cache components with minimal code
- **Configuration-based**: Use configuration dictionaries for flexibility
- **Redis connection management**: Create properly configured Redis clients
- **Complete cache system**: Create all components at once

### Basic Usage

```python
# Create a Redis client
redis_client = CacheFactory.create_redis_client(
    host='redis.example.com',
    port=6379,
    connection_pool_size=20
)

# Create a cache manager from configuration
cache_config = {
    'type': 'optimized',
    'memory_cache_size': 10000,
    'redis_ttl': 3600,
    'redis': {
        'host': 'redis.example.com',
        'port': 6379
    }
}
cache_manager = CacheFactory.create_cache_manager(cache_config)

# Create a complete cache system with dependency tracking
cache_system = CacheFactory.create_full_cache_system(cache_config)
cache_manager = cache_system['cache_manager']
dependency_tracker = cache_system['dependency_tracker']
```

## CacheMetricsCollector

The `CacheMetricsCollector` collects and aggregates cache performance metrics over time.

### Key Features

- **Automatic collection**: Periodically collects metrics in the background
- **Time-based metrics**: Tracks operations per second
- **Metric aggregation**: Calculates statistics over configurable time windows
- **Alert detection**: Identifies potential issues based on thresholds
- **Custom metrics**: Supports recording application-specific metrics

### Basic Usage

```python
# Create metrics collector
metrics_collector = CacheMetricsCollector(
    cache_manager=cache_manager,
    metrics_namespace="shop_cache",
    collection_interval=60,  # collect every minute
    retention_period=86400,  # retain for 1 day
    enable_periodic_collection=True
)

# Get recent metrics
recent_metrics = metrics_collector.get_recent_metrics(60)  # last 60 samples

# Get aggregated metrics for the last hour
aggregated = metrics_collector.get_aggregated_metrics(3600)

# Check for alert conditions
alerts = metrics_collector.get_alert_conditions()

# Record a custom metric
metrics_collector.record_metric("api_response_time", 120)

# Export metrics to a file
metrics_collector.export_metrics_to_file("/var/log/cache_metrics.json")
```

## CacheDashboard

The `CacheDashboard` generates visualizations and reports for monitoring cache performance.

### Key Features

- **HTML dashboards**: Interactive charts for cache metrics
- **Text reports**: Plain text summaries for logging or email
- **Auto-refresh**: Real-time dashboard updates
- **Alert highlighting**: Visual indicators for potential issues

### Basic Usage

```python
# Create dashboard
dashboard = CacheDashboard(
    metrics_collector=metrics_collector,
    dashboard_title="Shop Cache Performance",
    refresh_interval=60  # refresh every minute
)

# Generate and save HTML dashboard
dashboard.save_dashboard_html("/var/www/html/cache_dashboard.html")

# Generate text report for the last day
report = dashboard.generate_text_report(86400)
print(report)

# Save report to a file
dashboard.save_text_report("/var/log/cache_report.txt")
```

## Best Practices

1. **Set appropriate cache sizes**:
   - Memory cache size should be large enough for hot data
   - Too large memory cache may impact application memory usage

2. **Configure TTLs based on data volatility**:
   - Shorter TTL for frequently changing data
   - Longer TTL for stable data

3. **Use namespaces for logical grouping**:
   - Helps with organization and selective invalidation
   - Example: "products", "orders", "customers"

4. **Invalidate responsibly**:
   - Use dependency tracking for related items
   - Use pattern invalidation for structured key names
   - Avoid excessive use of invalidate_all()

5. **Design efficient dependency relationships**:
   - Track dependencies from specific to general (product → category)
   - Avoid circular dependencies
   - Limit dependency depth to prevent cascade performance issues

6. **Monitor cache performance**:
   - Track hit rates to evaluate cache effectiveness
   - Monitor dependency invalidation counts
   - Set up dashboards for real-time visibility
   - Configure alerts for performance issues
   - Analyze trends to guide optimization efforts
EOF < /dev/null