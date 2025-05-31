# GraphQL API Reference

This document details the GraphQL API implementation in Shopify MCP Server.

## Overview

The GraphQL API provides efficient data fetching with reduced network overhead. It allows clients to request exactly what they need, making it ideal for complex queries.

## Client Class

### ShopifyGraphQLClient

Main GraphQL client class for interacting with Shopify's GraphQL API.

```python
from shopify_graphql_client import ShopifyGraphQLClient

client = ShopifyGraphQLClient(
    shop_url="myshop.myshopify.com",
    access_token="your-access-token"
)
```

## Available Tools

### 1. get_shop_info_graphql

Retrieves comprehensive shop information.

**Parameters**: None

**Returns**:
```json
{
  "name": "My Shop",
  "email": "contact@myshop.com",
  "plan": {
    "displayName": "Basic",
    "shopifyPlus": false
  },
  "currencyCode": "USD",
  "timezoneAbbreviation": "EST"
}
```

**Example Usage**:
```python
shop_info = get_shop_info_graphql()
```

### 2. get_products_graphql

Fetches products with all related data.

**Parameters**:
- `limit` (int, optional): Number of products to fetch (default: 50)

**Returns**:
```json
[
  {
    "id": "gid://shopify/Product/123",
    "title": "Product Name",
    "handle": "product-name",
    "status": "active",
    "totalInventory": 100,
    "price_range": {
      "min": "10.00",
      "max": "20.00",
      "currency": "USD"
    }
  }
]
```

**Example Usage**:
```python
products = get_products_graphql(limit=20)
```

### 3. get_inventory_levels_graphql

Gets inventory levels for specific items.

**Parameters**:
- `inventory_item_ids` (list): List of inventory item IDs

**Returns**:
```json
{
  "edges": [
    {
      "node": {
        "id": "gid://shopify/InventoryItem/123",
        "inventoryLevels": {
          "edges": [
            {
              "node": {
                "available": 50,
                "location": {
                  "name": "Main Warehouse"
                }
              }
            }
          ]
        }
      }
    }
  ]
}
```

**Example Usage**:
```python
inventory = get_inventory_levels_graphql(["item1", "item2"])
```

## Query Examples

### Complex Product Query

```graphql
query getProductsWithDetails($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    edges {
      node {
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
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 5) {
          edges {
            node {
              id
              title
              price
              sku
              inventoryQuantity
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
```

### Order Analytics Query

```graphql
query getOrderAnalytics($startDate: DateTime!, $endDate: DateTime!) {
  orders(query: "created_at:>=$startDate created_at:<=$endDate") {
    edges {
      node {
        id
        createdAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItems {
          edges {
            node {
              quantity
              variant {
                product {
                  id
                  title
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Pagination

The GraphQL API supports cursor-based pagination:

```python
def fetch_all_pages(query_func, **kwargs):
    all_items = []
    has_next_page = True
    after = None
    
    while has_next_page:
        kwargs["after"] = after
        result = query_func(**kwargs)
        
        edges = result.get("edges", [])
        page_info = result.get("pageInfo", {})
        
        all_items.extend([edge["node"] for edge in edges])
        
        has_next_page = page_info.get("hasNextPage", False)
        if has_next_page and edges:
            after = edges[-1].get("cursor")
    
    return all_items
```

## Error Handling

GraphQL errors are handled through the `ShopifyGraphQLError` exception:

```python
try:
    result = client.execute_query(query)
except ShopifyGraphQLError as e:
    print(f"GraphQL error: {e}")
```

## Performance Optimization

### Query Cost

Shopify GraphQL queries have associated costs. Monitor your query costs:

```graphql
{
  shop {
    name
  }
  __extensions {
    cost {
      requestedQueryCost
      actualQueryCost
      throttleStatus {
        maximumAvailable
        currentlyAvailable
        restoreRate
      }
    }
  }
}
```

### Best Practices

1. **Request only needed fields**: Minimize query cost and response size
2. **Use pagination**: Don't fetch all data at once
3. **Cache responses**: Implement intelligent caching for frequently accessed data
4. **Monitor rate limits**: Track query costs and throttle status

## See Also

- [GraphQL vs REST Guide](../user-guide/graphql-vs-rest.md)
- [Performance Optimization](../developer-guide/performance.md)
- [Shopify GraphQL Documentation](https://shopify.dev/docs/api/admin-graphql)