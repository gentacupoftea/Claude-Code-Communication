# GraphQL Integration Documentation

This document describes how GraphQL is integrated into the Shopify MCP Server.

## Implementation Overview

### 1. GraphQL Client (`shopify_graphql_client.py`)
- Full-featured GraphQL client using the `gql` library
- Supports pagination, error handling, and query optimization
- Methods for products, orders, customers, and inventory

### 2. MCP Server Integration
The GraphQL client is integrated into the main `ShopifyAPI` class:

```python
class ShopifyAPI:
    def __init__(self):
        # ... REST API setup ...
        self.graphql_client = ShopifyGraphQLClient(
            shop_url=f"{SHOPIFY_SHOP_NAME}.myshopify.com",
            access_token=SHOPIFY_ACCESS_TOKEN
        )
```

### 3. GraphQL Tools
Three new MCP tools provide GraphQL functionality:

#### `get_shop_info_graphql()`
- Retrieves comprehensive shop information
- More efficient than multiple REST calls
- Returns shop details, plan info, currency, timezone

#### `get_products_graphql(limit=50)`
- Fetches products with all related data
- Supports pagination for large catalogs
- Includes variants, pricing, and inventory info

#### `get_inventory_levels_graphql(inventory_item_ids)`
- Queries inventory levels for specific items
- Useful for inventory management and tracking
- Returns location-aware inventory data

## Testing Strategy

### Unit Tests (`test_graphql_client.py`)
- Mock-based testing of all GraphQL methods
- Error handling verification
- Pagination logic testing

### Integration Tests
- `test_graphql_integration.py`: Full integration tests
- `test_graphql_integration_simple.py`: Basic connectivity tests

### Test Execution
Run all tests with:
```bash
./run_tests.sh
```

For coverage report:
```bash
./run_tests.sh --coverage
```

## Performance Considerations

### GraphQL Advantages
1. **Reduced Round Trips**: Fetch related data in one request
2. **Selective Fields**: Only request needed data
3. **Batch Operations**: Multiple queries in one request

### GraphQL Limitations
1. **Caching**: Less effective than REST
2. **Complexity**: More complex error handling
3. **Rate Limiting**: Subject to Shopify's GraphQL cost limits

## Best Practices

### 1. Query Optimization
- Request only necessary fields
- Use pagination for large datasets
- Implement query cost tracking

### 2. Error Handling
- Catch `ShopifyGraphQLError` exceptions
- Log errors appropriately
- Provide user-friendly error messages

### 3. Testing
- Test with mock data to avoid API limits
- Verify error handling paths
- Test pagination edge cases

## Future Enhancements

1. **Query Caching**: Implement intelligent caching
2. **Subscriptions**: Real-time data updates
3. **Mutations**: GraphQL-based write operations
4. **Cost Tracking**: Monitor query costs

## Migration Guide

To migrate from REST to GraphQL:

1. Identify complex queries that would benefit
2. Replace multiple REST calls with single GraphQL query
3. Update error handling for GraphQL errors
4. Test thoroughly with production-like data

## Resources

- [Shopify GraphQL API Documentation](https://shopify.dev/docs/api/admin-graphql)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [gql Library Documentation](https://gql.readthedocs.io/)