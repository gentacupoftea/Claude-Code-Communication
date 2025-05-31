# GraphQL API Usage Guide for Developers

## Quick Start

### Basic Setup

```python
from src.api.shopify_graphql import ShopifyGraphQLAPI

# Initialize GraphQL client
graphql_client = ShopifyGraphQLAPI(
    shop_url="https://your-shop.myshopify.com",
    access_token="your-access-token",
    api_version="2025-04"
)

# Execute a simple query
query = """
  query {
    shop {
      id
      name
      currencyCode
    }
  }
"""

result = await graphql_client.execute_query(query)
print(result['shop']['name'])
```

### Shopify API with GraphQL Mode

```python
from src.api.shopify_api import ShopifyAPI

# Initialize with GraphQL enabled
api = ShopifyAPI(
    shop_url="https://your-shop.myshopify.com",
    access_token="your-access-token",
    use_graphql=True  # Enable GraphQL mode
)

# The API automatically uses GraphQL for better performance
orders = api.get_orders(limit=250)  # Can fetch up to 250 at once with GraphQL
products = api.get_products(limit=250)
```

## Performance Best Practices

### 1. Query Batching

Combine multiple queries to reduce API calls:

```python
async def get_dashboard_data():
    """Fetch all dashboard data in a single GraphQL call"""
    query = """
      query DashboardData($orderLimit: Int!, $productLimit: Int!) {
        orders(first: $orderLimit, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              createdAt
              fulfillmentStatus
            }
          }
        }
        products(first: $productLimit) {
          edges {
            node {
              id
              title
              totalInventory
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    """
    
    variables = {
        "orderLimit": 10,
        "productLimit": 20
    }
    
    result = await graphql_client.execute_query(query, variables)
    return result
```

### 2. Optimized Field Selection

Request only the fields you need:

```python
# Bad: Requesting all fields
query = """
  query {
    products(first: 10) {
      edges {
        node {
          ... on Product {
            __typename
            id
            title
            description
            handle
            tags
            productType
            vendor
            status
            publishedAt
            createdAt
            updatedAt
            variants {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  barcode
                  weight
                  weightUnit
                }
              }
            }
          }
        }
      }
    }
  }
"""

# Good: Request only needed fields
query = """
  query {
    products(first: 10) {
      edges {
        node {
          id
          title
          handle
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }
    }
  }
"""
```

### 3. Pagination Strategy

Use cursor-based pagination for large datasets:

```python
async def get_all_products():
    """Fetch all products using cursor pagination"""
    all_products = []
    has_next_page = True
    cursor = None
    
    while has_next_page:
        query = """
          query GetProducts($cursor: String) {
            products(first: 250, after: $cursor) {
              edges {
                node {
                  id
                  title
                  handle
                }
                cursor
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        """
        
        variables = {"cursor": cursor} if cursor else {}
        result = await graphql_client.execute_query(query, variables)
        
        products_data = result['products']
        all_products.extend([edge['node'] for edge in products_data['edges']])
        
        has_next_page = products_data['pageInfo']['hasNextPage']
        cursor = products_data['pageInfo']['endCursor']
    
    return all_products
```

## Advanced Features

### Query Optimization with Fragments

Use fragments for reusable query parts:

```python
PRODUCT_FIELDS = """
  fragment ProductFields on Product {
    id
    title
    handle
    status
    totalInventory
    priceRangeV2 {
      minVariantPrice {
        amount
        currencyCode
      }
    }
  }
"""

async def get_products_by_status(status):
    query = f"""
      {PRODUCT_FIELDS}
      
      query ProductsByStatus($status: ProductStatus!) {{
        products(first: 100, query: "status:$status") {{
          edges {{
            node {{
              ...ProductFields
            }}
          }}
        }}
      }}
    """
    
    variables = {"status": status}
    return await graphql_client.execute_query(query, variables)
```

### Error Handling

Properly handle GraphQL errors:

```python
from src.api.errors import ShopifyGraphQLError

async def safe_query_execution(query, variables=None):
    try:
        result = await graphql_client.execute_query(query, variables)
        
        # Check for GraphQL errors in response
        if 'errors' in result:
            print(f"GraphQL errors: {result['errors']}")
            
        return result
        
    except ShopifyGraphQLError as e:
        print(f"GraphQL error: {e.message}")
        if e.query_cost:
            print(f"Query cost: {e.query_cost}")
        raise
        
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
```

### Monitoring Query Performance

Track query costs and performance:

```python
class QueryPerformanceMonitor:
    def __init__(self):
        self.query_metrics = []
    
    async def execute_monitored_query(self, client, query, variables=None):
        start_time = time.time()
        
        try:
            result = await client.execute_query(query, variables)
            
            # Extract performance metrics
            extensions = result.get('extensions', {})
            cost = extensions.get('cost', {})
            
            metric = {
                'timestamp': datetime.now(),
                'duration': time.time() - start_time,
                'requested_cost': cost.get('requestedQueryCost', 0),
                'actual_cost': cost.get('actualQueryCost', 0),
                'throttle_status': cost.get('throttleStatus', {})
            }
            
            self.query_metrics.append(metric)
            return result
            
        except Exception as e:
            print(f"Query monitoring error: {e}")
            raise
    
    def get_performance_summary(self):
        if not self.query_metrics:
            return "No metrics collected"
        
        avg_duration = sum(m['duration'] for m in self.query_metrics) / len(self.query_metrics)
        avg_cost = sum(m['actual_cost'] for m in self.query_metrics) / len(self.query_metrics)
        
        return f"""
        Performance Summary:
        - Total queries: {len(self.query_metrics)}
        - Average duration: {avg_duration:.3f}s
        - Average cost: {avg_cost:.1f}
        """
```

## Testing GraphQL Queries

### Unit Testing

```python
import pytest
from unittest.mock import Mock, patch

@pytest.mark.asyncio
async def test_product_query():
    # Mock GraphQL client
    mock_client = Mock()
    mock_client.execute_query.return_value = {
        'products': {
            'edges': [
                {'node': {'id': '1', 'title': 'Test Product'}}
            ]
        }
    }
    
    # Test query execution
    query = "query { products(first: 1) { edges { node { id title } } } }"
    result = await mock_client.execute_query(query)
    
    assert len(result['products']['edges']) == 1
    assert result['products']['edges'][0]['node']['title'] == 'Test Product'
```

### Integration Testing

```python
import asyncio
from src.api.shopify_graphql import ShopifyGraphQLAPI

class TestShopifyGraphQLIntegration:
    @pytest.fixture
    async def client(self):
        # Use test shop credentials
        return ShopifyGraphQLAPI(
            shop_url=os.getenv('TEST_SHOP_URL'),
            access_token=os.getenv('TEST_ACCESS_TOKEN')
        )
    
    @pytest.mark.asyncio
    async def test_real_shop_query(self, client):
        query = """
          query {
            shop {
              name
              currencyCode
            }
          }
        """
        
        result = await client.execute_query(query)
        
        assert 'shop' in result
        assert 'name' in result['shop']
        assert 'currencyCode' in result['shop']
```

## Troubleshooting

### Common Issues and Solutions

1. **Rate Limiting**
   ```python
   # Handle rate limits with exponential backoff
   @backoff.on_exception(
       backoff.expo,
       ShopifyRateLimitError,
       max_tries=3
   )
   async def rate_limited_query(query):
       return await graphql_client.execute_query(query)
   ```

2. **Query Timeout**
   ```python
   # Set appropriate timeout for complex queries
   graphql_client = ShopifyGraphQLAPI(
       shop_url="...",
       access_token="...",
       timeout=30  # 30 seconds for complex queries
   )
   ```

3. **Memory Issues with Large Datasets**
   ```python
   # Use streaming pagination for memory efficiency
   async def stream_large_dataset():
       async for product in stream_all_products():
           process_product(product)  # Process one at a time
   ```

## API Cost Optimization

Monitor and optimize your API usage:

```python
class APIUsageOptimizer:
    def analyze_query_cost(self, query):
        """Analyze query cost before execution"""
        # Use Shopify's cost calculation logic
        # This is a simplified example
        
        cost_factors = {
            'products': 1,
            'orders': 2,
            'customers': 1,
            'variants': 0.5
        }
        
        estimated_cost = 0
        for entity, cost in cost_factors.items():
            if entity in query:
                estimated_cost += cost
        
        return estimated_cost
    
    def suggest_optimization(self, query):
        """Suggest query optimizations"""
        suggestions = []
        
        if 'products' in query and 'variants' in query:
            suggestions.append("Consider limiting variant fields to reduce cost")
        
        if not 'first:' in query and not 'last:' in query:
            suggestions.append("Add pagination limits to control query cost")
        
        return suggestions
```

## Performance Benchmarks

Expected performance metrics with GraphQL:

| Operation | REST Calls | GraphQL Calls | Time Saved |
|-----------|------------|---------------|------------|
| Fetch 250 products | 10 | 1 | 80% |
| Get order with details | 3 | 1 | 66% |
| Customer + orders | 4 | 1 | 75% |
| Bulk inventory update | 100 | 20 | 80% |

## Next Steps

1. Review the [GraphQL Performance Analysis](../GRAPHQL_PERFORMANCE.md)
2. Check the [API Reference](../api-reference/graphql-api.md)
3. Explore [Advanced Optimization Techniques](../GRAPHQL_OPTIMIZATION.md)

For additional support, consult the [Troubleshooting Guide](../TROUBLESHOOTING.md) or open an issue on GitHub.