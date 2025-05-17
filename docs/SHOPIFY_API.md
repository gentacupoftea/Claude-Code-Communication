# Shopify API Client Documentation

## Overview

The `ShopifyAPI` class provides an interface to interact with the Shopify Admin API.
It supports both REST and GraphQL API calls to retrieve and manage Shopify store data.

## Usage

```python
# Initialize the API client
shopify_api = ShopifyAPI()

# Get orders within a date range
orders = shopify_api.get_orders(start_date="2023-01-01", end_date="2023-01-31")

# Get all products
products = shopify_api.get_products()

# Get all customers
customers = shopify_api.get_customers()
```

## API Methods

### REST API

#### `get_orders(start_date=None, end_date=None)`

Retrieves orders from the Shopify store.

- **Parameters:**
  - `start_date` (optional): Start date in YYYY-MM-DD format
  - `end_date` (optional): End date in YYYY-MM-DD format
- **Returns:** List of order objects

#### `get_products()`

Retrieves products from the Shopify store.

- **Returns:** List of product objects

#### `get_customers()`

Retrieves customers from the Shopify store.

- **Returns:** List of customer objects

### Error Handling

The client handles various HTTP and network errors and logs them appropriately.
Failed requests return empty lists instead of raising exceptions.

## Future Enhancements

- GraphQL API support
- Rate limiting
- Advanced error handling with retries
- Pagination support for large datasets
