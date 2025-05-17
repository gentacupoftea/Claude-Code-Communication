# Shopify API Integration Guide

## Overview
This document outlines the integration patterns and best practices for connecting to Shopify's REST and GraphQL APIs through the MCP server.

## Authentication

### API Key Configuration
```python
SHOPIFY_CONFIG = {
    "api_key": os.getenv("SHOPIFY_API_KEY"),
    "api_secret": os.getenv("SHOPIFY_API_SECRET"),
    "access_token": os.getenv("SHOPIFY_ACCESS_TOKEN"),
    "shop_domain": os.getenv("SHOPIFY_SHOP_DOMAIN")
}
```

### OAuth Flow
1. Generate installation URL
2. Handle callback with authorization code
3. Exchange code for access token
4. Store token securely

## REST API Integration

### Endpoint Structure
```python
class ShopifyRestClient:
    BASE_URL = "https://{shop}.myshopify.com/admin/api/2024-01"
    
    def __init__(self, shop_domain, access_token):
        self.shop_domain = shop_domain
        self.headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
```

### Common Operations

#### Get Products
```python
def get_products(self, limit=50, page_info=None):
    endpoint = f"/products.json?limit={limit}"
    if page_info:
        endpoint += f"&page_info={page_info}"
    return self._make_request("GET", endpoint)
```

#### Create Order
```python
def create_order(self, order_data):
    endpoint = "/orders.json"
    return self._make_request("POST", endpoint, json={"order": order_data})
```

## GraphQL API Integration

### Client Setup
```python
class ShopifyGraphQLClient:
    GRAPHQL_URL = "https://{shop}.myshopify.com/admin/api/2024-01/graphql.json"
    
    def execute_query(self, query, variables=None):
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        return self._make_request(payload)
```

### Query Examples

#### Products Query
```graphql
query getProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    edges {
      node {
        id
        title
        variants(first: 10) {
          edges {
            node {
              id
              price
              inventoryQuantity
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

#### Bulk Operations
```graphql
mutation {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            id
            title
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

## Error Handling

### Rate Limiting
```python
def handle_rate_limit(response):
    if response.status_code == 429:
        retry_after = int(response.headers.get('Retry-After', 2))
        time.sleep(retry_after)
        return True
    return False
```

### API Errors
```python
ERROR_CODES = {
    401: "Authentication failed",
    403: "Access forbidden",
    404: "Resource not found",
    422: "Validation error",
    429: "Rate limit exceeded",
    500: "Shopify server error"
}
```

## Best Practices

### 1. Pagination
- Always implement cursor-based pagination
- Handle page_info for REST API
- Use GraphQL connections for large datasets

### 2. Caching
- Cache frequently accessed data
- Implement TTL for cache entries
- Use webhooks for cache invalidation

### 3. Webhook Integration
```python
WEBHOOK_TOPICS = [
    "orders/create",
    "orders/updated",
    "products/create",
    "products/update",
    "inventory_levels/update"
]
```

### 4. Batch Operations
- Use GraphQL bulk operations for large data exports
- Implement job queue for async processing
- Monitor bulk operation status

## Performance Optimization

### 1. Field Selection
- Request only necessary fields
- Use GraphQL fragments for reusable field sets
- Minimize nested queries

### 2. Connection Pooling
```python
session = requests.Session()
adapter = HTTPAdapter(
    pool_connections=10,
    pool_maxsize=10,
    max_retries=3
)
session.mount('https://', adapter)
```

### 3. Async Operations
```python
async def batch_get_products(product_ids):
    tasks = [get_product(pid) for pid in product_ids]
    return await asyncio.gather(*tasks)
```

## Security Considerations

### 1. Token Storage
- Never commit tokens to version control
- Use environment variables
- Implement token rotation

### 2. Request Validation
- Validate all input parameters
- Sanitize data before API calls
- Implement request signing for webhooks

### 3. Scope Management
```python
REQUIRED_SCOPES = [
    "read_products",
    "write_products",
    "read_orders",
    "write_orders",
    "read_inventory"
]
```

## Testing

### 1. Mock Responses
```python
@patch('shopify_client.requests.get')
def test_get_products(mock_get):
    mock_get.return_value.json.return_value = {
        "products": [{"id": 1, "title": "Test Product"}]
    }
```

### 2. Integration Tests
- Use Shopify's test stores
- Implement cleanup after tests
- Test error scenarios

## Migration Guide

### REST to GraphQL Migration
1. Map REST endpoints to GraphQL queries
2. Update response parsing
3. Implement cursor pagination
4. Update error handling

### Version Updates
- Check Shopify API changelog
- Update deprecated endpoints
- Test with new API version
- Update documentation

Generated by: エンジニア (OdenCraft)
Date: 2025-5-17