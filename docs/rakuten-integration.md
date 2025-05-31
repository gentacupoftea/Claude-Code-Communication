# Rakuten API Integration Guide

This guide covers the Rakuten API integration for Shopify MCP Server v0.3.1.

## Overview

The Rakuten integration allows you to synchronize products, orders, inventory, and customer data between Shopify and Rakuten marketplaces. This enables unified management of your omnichannel commerce operations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│                    Platform Manager                          │
├────────────────────────┬────────────────────────────────────┤
│    Shopify Client      │         Rakuten Client             │
├────────────────────────┴────────────────────────────────────┤
│                  Abstract Base Classes                       │
├─────────────────────────────────────────────────────────────┤
│                 Synchronization Engine                       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Configuration

Create a `.env` file with your credentials:

```bash
# Shopify Configuration
SHOPIFY_SHOP_URL=https://your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_shopify_token

# Rakuten Configuration
RAKUTEN_SERVICE_SECRET=your_service_secret
RAKUTEN_LICENSE_KEY=your_license_key
RAKUTEN_SHOP_ID=your_shop_id

# Optional
REDIS_URL=redis://localhost:6379
```

### 2. Basic Usage

```python
from src.api.rakuten import RakutenAPIClient

# Initialize client
credentials = {
    'service_secret': 'your_service_secret',
    'license_key': 'your_license_key',
    'shop_id': 'your_shop_id'
}

client = RakutenAPIClient(credentials)

# Authenticate
await client.authenticate()

# Get products
products = await client.get_products(limit=50)

# Get orders
orders = await client.get_orders(limit=50)
```

### 3. Multi-Platform Management

```python
from src.api.abstract import platform_manager, PlatformType

# Register platforms
platform_manager.register_platform(PlatformType.SHOPIFY, ShopifyClient)
platform_manager.register_platform(PlatformType.RAKUTEN, RakutenAPIClient)

# Initialize platforms
await platform_manager.initialize_platform(
    PlatformType.RAKUTEN, 
    rakuten_credentials
)

# Check connections
connections = await platform_manager.check_all_connections()
```

### 4. Synchronization

```python
from src.sync.rakuten_sync import RakutenSync, SyncConfig

# Configure sync
config = SyncConfig(
    sync_products=True,
    sync_inventory=True,
    sync_orders=True,
    sync_direction='bidirectional'
)

# Initialize sync manager
sync_manager = RakutenSync(config)
await sync_manager.initialize(shopify_creds, rakuten_creds)

# Start continuous sync
await sync_manager.start_sync()
```

## API Client Features

### Authentication

The Rakuten API uses OAuth 2.0 authentication:

```python
from src.api.rakuten.auth import RakutenAuth, RakutenCredentials

credentials = RakutenCredentials(
    service_secret='your_secret',
    license_key='your_key',
    shop_id='your_shop'
)

auth = RakutenAuth(credentials)
await auth.authenticate()

# Get access token
header = auth.get_auth_header()
```

### Product Management

```python
# Get single product
product = await client.get_product('product_id')

# Get multiple products
products = await client.get_products(
    limit=100,
    offset=0,
    filters={'category': 'electronics'}
)

# Create product
new_product = await client.create_product({
    'title': '新商品',
    'price': '10000',
    'description': '商品説明',
    'sku': 'NEW-001'
})

# Update product
updated = await client.update_product('product_id', {
    'price': '12000',
    'inventory_quantity': 50
})

# Delete product
success = await client.delete_product('product_id')
```

### Order Management

```python
# Get orders
orders = await client.get_orders(
    limit=50,
    filters={
        'status': 'processing',
        'created_after': '2025-01-01'
    }
)

# Get single order
order = await client.get_order('order_number')

# Update order status
updated_order = await client.update_order_status(
    'order_number',
    'shipped'
)
```

### Customer Management

```python
# Get customers
customers = await client.get_customers(limit=50)

# Get single customer
customer = await client.get_customer('customer_id')
```

### Inventory Management

```python
# Get inventory
inventory = await client.get_inventory('product_id')

# Update inventory
updated = await client.update_inventory(
    'product_id',
    quantity=100,
    location_id='warehouse_1'
)
```

## Data Models

### Product Model

```python
from src.api.rakuten.models import RakutenProduct

product = RakutenProduct(
    platform_id='12345',
    title='商品名',
    description='商品説明',
    price=Decimal('1000'),
    inventory_quantity=50,
    status=ProductStatus.ACTIVE
)

# Convert to Rakuten format
rakuten_data = product.to_platform_format()

# Create from Rakuten data
product = RakutenProduct.from_platform_format(data)

# Convert to common format
common_data = product.to_common_format()
```

### Order Model

```python
from src.api.rakuten.models import RakutenOrder

order = RakutenOrder(
    platform_id='ORD-001',
    order_number='ORD-001',
    status=OrderStatus.PROCESSING,
    total=Decimal('5000'),
    customer_id='CUST-001'
)
```

### Customer Model

```python
from src.api.rakuten.models import RakutenCustomer

customer = RakutenCustomer(
    platform_id='CUST-001',
    email='customer@example.com',
    first_name='太郎',
    last_name='田中'
)
```

## Synchronization

### Configuration Options

```python
from src.sync.rakuten_sync import SyncConfig

config = SyncConfig(
    # Batch settings
    batch_size=50,              # Items per batch
    sync_interval=300,          # Seconds between syncs
    
    # Sync options
    sync_products=True,
    sync_inventory=True,
    sync_orders=True,
    sync_customers=False,       # Privacy considerations
    
    # Sync direction
    sync_direction='bidirectional',  # Options: shopify_to_rakuten, rakuten_to_shopify, bidirectional
    
    # Conflict resolution
    conflict_resolution='newest',    # Options: newest, shopify_priority, rakuten_priority
    
    # Retry settings
    retry_attempts=3,
    retry_delay=5
)
```

### Sync Operations

```python
# One-time sync
product_result = await sync_manager.sync_products()
inventory_result = await sync_manager.sync_inventory()
order_result = await sync_manager.sync_orders()

# Check sync results
print(f"Products synced: {product_result.synced_count}")
print(f"Failed: {product_result.failed_count}")
print(f"Errors: {product_result.errors}")

# View sync history
for result in sync_manager.sync_history:
    print(f"Sync at {result.timestamp}: {result.synced_count} items")
```

### Continuous Synchronization

```python
from src.sync.rakuten_sync import SyncScheduler

# Create scheduler
scheduler = SyncScheduler(sync_manager)

# Start scheduled sync
await scheduler.start()

# Stop scheduler
await scheduler.stop()
```

## Error Handling

```python
from src.api.rakuten import RakutenAPIError

try:
    product = await client.get_product('invalid_id')
except RakutenAPIError as e:
    print(f"API Error: {e}")
    print(f"Error code: {e.code}")
    print(f"Request ID: {e.request_id}")
```

## Rate Limiting

The Rakuten API has rate limits that are automatically managed:

```python
# Check current rate limit status
rate_limit = client.get_rate_limit_info()
print(f"Requests remaining: {rate_limit.requests_remaining}/{rate_limit.requests_limit}")
print(f"Usage: {rate_limit.usage_percentage:.1%}")
print(f"Reset time: {rate_limit.reset_time}")
```

## Platform Capabilities

Check what features are supported by Rakuten:

```python
capabilities = client.get_platform_capabilities()

# Available capabilities:
# - multi_warehouse: True
# - multi_currency: False (JPY only)
# - gift_wrapping: True
# - tax_calculation: True
# - shipping_integration: True
# - loyalty_points: True (楽天ポイント)
# - marketplace: True
# - product_variants: True
# - bulk_operations: True
# - webhooks: False
```

## Testing

Run the test suite:

```bash
# All Rakuten tests
pytest tests/api/rakuten/
pytest tests/sync/

# Specific test files
pytest tests/api/rakuten/test_client.py
pytest tests/api/rakuten/test_auth.py
pytest tests/sync/test_rakuten_sync.py
```

## Examples

See the `examples/rakuten_integration_demo.py` file for comprehensive examples:

```bash
python examples/rakuten_integration_demo.py
```

## Troubleshooting

### Authentication Issues

```python
# Check token expiration
if auth.token and auth.token.is_expired:
    await auth.refresh_access_token()

# Re-authenticate if needed
if not await auth.ensure_valid_token():
    await auth.authenticate()
```

### Connection Issues

```python
# Test connection
if not await client.check_connection():
    logger.error("Connection failed")
    # Check credentials and network
```

### Sync Conflicts

```python
# Configure conflict resolution
config.conflict_resolution = 'shopify_priority'

# Or implement custom logic
def custom_conflict_resolver(source, target):
    # Your logic here
    return source if source['updated_at'] > target['updated_at'] else target
```

## Best Practices

1. **Use Environment Variables**: Store credentials securely
2. **Monitor Rate Limits**: Check usage regularly
3. **Batch Operations**: Use batch operations for better performance
4. **Error Handling**: Always handle API errors gracefully
5. **Logging**: Enable detailed logging for debugging
6. **Testing**: Test in Rakuten's sandbox environment first

## Limitations

1. **Currency**: Rakuten only supports JPY
2. **Webhooks**: No real-time event notifications
3. **API Rate Limits**: 30 requests per minute
4. **Language**: Primary documentation in Japanese

## Future Enhancements

1. **Real-time Sync**: Webhook support when available
2. **Advanced Mapping**: Custom field mapping
3. **Bulk Operations**: Enhanced bulk import/export
4. **Analytics**: Cross-platform analytics
5. **ML Integration**: Predictive inventory management

## Resources

- [Rakuten RMS API Documentation](https://developers.rakuten.com/)
- [OAuth 2.0 Guide](https://developers.rakuten.com/oauth)
- [API Rate Limits](https://developers.rakuten.com/rate-limits)
- [Error Codes Reference](https://developers.rakuten.com/errors)

## Support

For issues specific to the Rakuten integration:

1. Check the [troubleshooting guide](#troubleshooting)
2. Review the [test suite](tests/api/rakuten/)
3. Submit an issue on GitHub
4. Contact support@shopify-mcp.com

---

**Version**: 0.3.1  
**Last Updated**: May 22, 2025  
**Status**: Production Ready