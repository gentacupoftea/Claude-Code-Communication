import sys
import os
import asyncio
import pytest
import httpx
from unittest.mock import AsyncMock, Mock, patch
import redis

# Ensure project root is on sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Import after ensuring project root is in sys.path
from src.api.shopify_graphql import ShopifyGraphQLAPI
from src.api.shopify.optimized_client import OptimizedShopifyGraphQL


@pytest.fixture
def event_loop():
    """Create a new event loop for async tests"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture
async def mock_graphql_client():
    """Create a mocked ShopifyGraphQLAPI client"""
    with patch('src.api.shopify_graphql.ShopifyGraphQLAPI') as mock_class:
        # Setup instance with mocked execute_query
        mock_instance = mock_class.return_value
        mock_instance.execute_query = AsyncMock()
        
        # Default return value - overridable in tests
        mock_instance.execute_query.return_value = {"test": "data"}
        
        # Mock HTTP client
        mock_instance.client = Mock(spec=httpx.AsyncClient)
        mock_instance.client.aclose = AsyncMock()
        
        yield mock_instance


@pytest.fixture
async def mock_optimized_client():
    """Create a mocked OptimizedShopifyGraphQL client"""
    with patch('src.api.shopify.optimized_client.OptimizedShopifyGraphQL') as mock_class:
        mock_instance = mock_class.return_value
        
        # Mock primary methods
        mock_instance.execute_query = AsyncMock()
        mock_instance.execute_query.return_value = {"test": "data"}
        
        # Mock optimization components
        mock_instance.start = AsyncMock()
        mock_instance.stop = AsyncMock()
        
        # Mock batch processor
        mock_instance.batch_processor = Mock()
        mock_instance.batch_processor.add_query = AsyncMock()
        mock_instance.batch_processor.add_query.return_value = {"test": "batch_data"}
        
        # Mock cache manager
        mock_instance.cache_manager = Mock()
        mock_instance.cache_manager.get = AsyncMock(return_value=None)
        mock_instance.cache_manager.set = AsyncMock(return_value=True)
        
        yield mock_instance


@pytest.fixture
async def real_graphql_client():
    """Create a real ShopifyGraphQLAPI client for integration tests"""
    client = ShopifyGraphQLAPI(
        shop_url="https://test.myshopify.com",
        access_token="test_token"
    )
    
    # Replace execute_query with a mock to avoid real API calls
    client.execute_query = AsyncMock()
    client.execute_query.return_value = {"test": "data"}
    
    yield client
    await client.close()


@pytest.fixture
async def real_optimized_client():
    """Create a real OptimizedShopifyGraphQL client for integration tests"""
    client = OptimizedShopifyGraphQL(
        shop_url="https://test.myshopify.com",
        access_token="test_token",
        redis_url=None  # No real Redis for tests
    )
    
    # Replace base client execute_query with mock
    client.base_client.execute_query = AsyncMock()
    client.base_client.execute_query.return_value = {"test": "data"}
    
    await client.start()
    yield client
    await client.stop()


@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    mock = Mock(spec=redis.Redis)
    mock.get.return_value = None
    mock.setex.return_value = True
    mock.delete.return_value = 1
    mock.close.return_value = None
    
    with patch('redis.from_url', return_value=mock):
        yield mock


@pytest.fixture
def mock_response():
    """Create a mock HTTP response"""
    response = Mock(spec=httpx.Response)
    response.status_code = 200
    response.headers = {}
    response.json.return_value = {}
    response.text = ""
    return response


@pytest.fixture
def shopify_order_response():
    """Sample Shopify order response"""
    return {
        "order": {
            "id": "gid://shopify/Order/12345",
            "name": "#1001",
            "createdAt": "2023-01-01T00:00:00Z",
            "totalPrice": "100.00",
            "currencyCode": "USD",
            "displayFinancialStatus": "PAID",
            "customer": {
                "id": "gid://shopify/Customer/67890",
                "displayName": "John Doe",
                "email": "john.doe@example.com"
            },
            "lineItems": {
                "edges": [
                    {
                        "node": {
                            "id": "gid://shopify/LineItem/111",
                            "title": "Test Product",
                            "quantity": 1,
                            "price": "100.00"
                        }
                    }
                ],
                "pageInfo": {
                    "hasNextPage": False,
                    "endCursor": None
                }
            }
        }
    }


@pytest.fixture
def shopify_orders_response():
    """Sample Shopify orders list response"""
    return {
        "orders": {
            "edges": [
                {
                    "node": {
                        "id": "gid://shopify/Order/12345",
                        "name": "#1001",
                        "createdAt": "2023-01-01T00:00:00Z",
                        "totalPrice": "100.00",
                        "currencyCode": "USD"
                    }
                },
                {
                    "node": {
                        "id": "gid://shopify/Order/67890",
                        "name": "#1002",
                        "createdAt": "2023-01-02T00:00:00Z",
                        "totalPrice": "200.00",
                        "currencyCode": "USD"
                    }
                }
            ],
            "pageInfo": {
                "hasNextPage": True,
                "endCursor": "cursor123"
            }
        }
    }


@pytest.fixture
def shopify_product_response():
    """Sample Shopify product response"""
    return {
        "product": {
            "id": "gid://shopify/Product/12345",
            "title": "Test Product",
            "handle": "test-product",
            "description": "Test product description",
            "createdAt": "2023-01-01T00:00:00Z",
            "variants": {
                "edges": [
                    {
                        "node": {
                            "id": "gid://shopify/ProductVariant/67890",
                            "title": "Default",
                            "price": "100.00",
                            "availableForSale": True
                        }
                    }
                ],
                "pageInfo": {
                    "hasNextPage": False,
                    "endCursor": None
                }
            }
        }
    }


@pytest.fixture
def shopify_products_response():
    """Sample Shopify products list response"""
    return {
        "products": {
            "edges": [
                {
                    "node": {
                        "id": "gid://shopify/Product/12345",
                        "title": "Test Product 1",
                        "handle": "test-product-1"
                    }
                },
                {
                    "node": {
                        "id": "gid://shopify/Product/67890",
                        "title": "Test Product 2",
                        "handle": "test-product-2"
                    }
                }
            ],
            "pageInfo": {
                "hasNextPage": True,
                "endCursor": "cursor123"
            }
        }
    }