# API Connectors for Conea Platform

This directory contains API connectors and utilities for integrating with various e-commerce platforms and services.

## Overview

The API connectors are designed with the following principles:

1. **Standardized Interface**: All connectors inherit from `BaseAPIConnector` for a consistent interface
2. **Error Handling**: Comprehensive error handling with specific exception types
3. **Rate Limiting**: Built-in rate limiting and retry mechanisms
4. **Authentication**: Secure authentication with GCP Secret Manager
5. **Data Models**: Standardized data models for products and orders

## API Connectors

### Amazon Selling Partner API

The `AmazonSPAPIConnector` provides integration with Amazon Selling Partner API:

- OAuth 2.0 authentication flow
- Product data retrieval
- Order data synchronization
- Rate limit handling

### NextEngine API

The `NextEngineConnector` provides integration with NextEngine:

- OAuth authentication
- Product master data retrieval
- Order data synchronization
- Data mapping to standard models

## Data Models

Standardized data models are provided for common e-commerce entities:

- **Product**: Represents product data with variants, images, and attributes
- **Order**: Represents order data with line items, addresses, and status

## Utilities

- **Error Handling**: The `error_handling.py` module provides exception classes for different error types
- **Caching**: The `caching.py` module provides caching utilities for API responses

## Authentication Setup

### Amazon SP-API Authentication

1. Register an Amazon SP-API application in Seller Central
2. Store credentials in GCP Secret Manager:
   - `amazon-sp-api-client-id`
   - `amazon-sp-api-client-secret`
   - `amazon-sp-api-refresh-token` (after OAuth flow)
3. Run OAuth flow to get a refresh token:
   ```
   python -m api.examples.amazon_sp_api_example --project-id YOUR_PROJECT_ID auth-url --redirect-uri YOUR_REDIRECT_URI
   ```
4. Exchange authorization code for tokens:
   ```
   python -m api.examples.amazon_sp_api_example --project-id YOUR_PROJECT_ID exchange --auth-code AUTH_CODE --redirect-uri YOUR_REDIRECT_URI
   ```
5. Store the refresh token in Secret Manager

### NextEngine Authentication

1. Register a NextEngine API application
2. Store credentials in GCP Secret Manager:
   - `nextengine-client-id`
   - `nextengine-client-secret`
   - `nextengine-refresh-token` (after OAuth flow)
3. Run OAuth flow to get a refresh token:
   ```
   python -m api.examples.nextengine_example --project-id YOUR_PROJECT_ID auth-url --redirect-uri YOUR_REDIRECT_URI
   ```
4. Exchange authorization code for tokens:
   ```
   python -m api.examples.nextengine_example --project-id YOUR_PROJECT_ID exchange --auth-code AUTH_CODE --redirect-uri YOUR_REDIRECT_URI
   ```
5. Store the refresh token in Secret Manager

## Usage Examples

### Amazon SP-API Example

```python
from api.connectors.amazon_sp_api_connector import AmazonSPAPIConnector
from api.models.product import Product

# Initialize connector
connector = AmazonSPAPIConnector(project_id="your-gcp-project-id")

# Authenticate
connector.authenticate()

# Get products
products = connector.get_products(marketplace_id="A1VC38T7YXB528")

# Convert to standardized model
for product_data in products:
    standard_product = Product.from_amazon_listing(product_data)
    print(standard_product.title)
```

### NextEngine Example

```python
from api.connectors.nextengine_connector import NextEngineConnector
from api.models.order import Order

# Initialize connector
connector = NextEngineConnector(project_id="your-gcp-project-id")

# Authenticate
connector.authenticate()

# Get orders
orders = connector.get_receive_orders(limit=10)

# Get order details and convert to standardized model
for order_data in orders:
    order_id = order_data.get("receive_order_id")
    order_rows = connector.get_receive_order_rows(order_id)
    
    standard_order = Order.from_nextengine_order(order_data, order_rows)
    print(f"Order {standard_order.order_number}: {standard_order.status}")
```

## Error Handling

The connectors include comprehensive error handling:

```python
from api.utils.error_handling import APIError, AuthenticationError

try:
    connector.authenticate()
    products = connector.get_products(marketplace_id="A1VC38T7YXB528")
except AuthenticationError as e:
    print(f"Authentication failed: {str(e)}")
except APIError as e:
    print(f"API error: {str(e)}")
```

## Caching

API responses can be cached using the provided caching utilities:

```python
from api.utils.caching import cached

@cached("amazon_products", ttl=3600)  # Cache for 1 hour
def get_amazon_products(marketplace_id):
    connector = AmazonSPAPIConnector(project_id="your-gcp-project-id")
    connector.authenticate()
    return connector.get_products(marketplace_id=marketplace_id)
```