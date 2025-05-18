# Data Integration Modules

This document describes the data integration modules for the Shopify MCP Server.

## Validation Module

The validation module provides functionality to validate Shopify data against the common data model specification.

### DataValidator

The `DataValidator` class validates Shopify data against the common data model specification.

```python
from src.data_integration.validation.data_validator import DataValidator, ValidationError

# Create a validator in non-strict mode (validation failures will be logged as warnings)
validator = DataValidator(strict=False)

# Validate an order
is_valid = validator.validate_order(order_data)
if not is_valid:
    errors = validator.get_errors()
    print(f"Validation errors: {errors}")

# Create a validator in strict mode (validation failures will raise ValidationError)
strict_validator = DataValidator(strict=True)
try:
    strict_validator.validate_order(order_data)
except ValidationError as e:
    print(f"Validation failed: {e.message}")
    print(f"Errors: {e.errors}")
```

### ValidationError

The `ValidationError` exception is raised when validation fails in strict mode.

```python
try:
    strict_validator.validate_order(order_data)
except ValidationError as e:
    print(f"Validation failed: {e.message}")
    print(f"Field: {e.field}")
    print(f"Errors: {e.errors}")
```

## GA4 Integration Module

The GA4 integration module provides functionality to map Shopify data to GA4 format according to the common data model specification.

### GA4Mapper

The `GA4Mapper` class maps Shopify data to GA4 format.

```python
from src.data_integration.ga4.ga4_mapper import GA4Mapper

# Map a Shopify order to GA4 format
ga4_order = GA4Mapper.map_order_to_ga4(order_data)

# Map multiple orders to GA4 format
ga4_orders = GA4Mapper.map_orders_to_ga4(orders_list)

# Convert orders to GA4 format DataFrame
ga4_df = GA4Mapper.orders_to_ga4_dataframe(orders_list)

# Map a Shopify product to GA4 format
ga4_product = GA4Mapper.map_product_to_ga4(product_data)

# Map a Shopify transaction to GA4 format
ga4_transaction = GA4Mapper.map_transaction_to_ga4(transaction_data)
```

## Integration with Shopify API Client

The data integration modules can be used with the Shopify API client to validate and transform data.

```python
from src.api.shopify_api import ShopifyAPI
from src.api.shopify_config import ShopifyConfig
from src.data_integration.validation.data_validator import DataValidator
from src.data_integration.ga4.ga4_mapper import GA4Mapper

# Create configuration
config = ShopifyConfig(
    shop_url="your-store.myshopify.com",
    access_token="your-access-token",
    api_version="2023-10"
)

# Create API client
async with ShopifyAPI(config) as api:
    # Get orders
    orders = await api.get_all_orders(
        status="any",
        financial_status="paid",
        created_at_min="2023-01-01T00:00:00Z",
        created_at_max="2023-01-31T23:59:59Z"
    )
    
    # Validate orders
    validator = DataValidator(strict=False)
    valid_orders = []
    for order in orders:
        if validator.validate_order(order):
            valid_orders.append(order)
    
    # Convert to GA4 format
    ga4_orders = GA4Mapper.map_orders_to_ga4(valid_orders)
    
    # Convert to DataFrame
    ga4_df = GA4Mapper.orders_to_ga4_dataframe(valid_orders)
```
