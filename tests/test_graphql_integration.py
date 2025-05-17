"""
GraphQL Integration Tests
Tests for GraphQL API implementation including REST/GraphQL compatibility
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime

from src.api.shopify_graphql import ShopifyGraphQLAPI, ShopifyGraphQLError
from src.api.shopify_api import ShopifyAPI
from src.api.errors import ShopifyRESTError, ShopifyRateLimitError
from src.api.pagination import GraphQLPaginator, AsyncBatchPaginator


class TestShopifyGraphQLAPI:
    """Test GraphQL API client functionality"""
    
    @pytest.fixture
    def graphql_client(self):
        """Create a test GraphQL client"""
        return ShopifyGraphQLAPI(
            shop_url="https://test-shop.myshopify.com",
            access_token="test-token",
            api_version="2025-04"
        )
    
    @pytest.fixture
    def mock_httpx_client(self):
        """Mock httpx client for GraphQL requests"""
        with patch('src.api.shopify_graphql.httpx.AsyncClient') as mock_client:
            mock_instance = AsyncMock()
            mock_client.return_value = mock_instance
            yield mock_instance
    
    @pytest.mark.asyncio
    async def test_execute_query_success(self, graphql_client, mock_httpx_client):
        """Test successful GraphQL query execution"""
        # Mock response
        mock_response = Mock()
        mock_response.json.return_value = {
            'data': {
                'orders': {
                    'edges': [
                        {'node': {'id': 'gid://shopify/Order/1', 'name': '#1001'}}
                    ],
                    'pageInfo': {'hasNextPage': False, 'endCursor': 'cursor123'}
                }
            }
        }
        mock_response.headers = {'X-Shopify-API-Call-Limit': '10/100'}
        mock_httpx_client.post.return_value = mock_response
        
        # Execute query
        query = "query { orders(first: 1) { edges { node { id name } } } }"
        result = await graphql_client.execute_query(query)
        
        # Verify
        assert 'orders' in result
        assert len(result['orders']['edges']) == 1
        assert graphql_client.cost_available == 90
    
    @pytest.mark.asyncio
    async def test_execute_query_with_errors(self, graphql_client, mock_httpx_client):
        """Test GraphQL query with errors"""
        # Mock error response
        mock_response = Mock()
        mock_response.json.return_value = {
            'errors': [
                {
                    'message': 'Field does not exist',
                    'extensions': {'code': 'FIELD_NOT_FOUND'}
                }
            ]
        }
        mock_httpx_client.post.return_value = mock_response
        
        # Execute query and expect error
        with pytest.raises(ShopifyGraphQLError) as exc_info:
            await graphql_client.execute_query("query { invalidField }")
        
        assert "GraphQL query failed" in str(exc_info.value)
        assert len(exc_info.value.errors) == 1
    
    @pytest.mark.asyncio
    async def test_rate_limit_handling(self, graphql_client, mock_httpx_client):
        """Test rate limit error handling"""
        # Mock rate limit error
        mock_response = Mock()
        mock_response.json.return_value = {
            'errors': [
                {
                    'message': 'Throttled',
                    'extensions': {
                        'code': 'THROTTLED',
                        'retryAfter': 120
                    }
                }
            ]
        }
        mock_httpx_client.post.return_value = mock_response
        
        # Execute query and expect rate limit error
        with pytest.raises(ShopifyRateLimitError) as exc_info:
            await graphql_client.execute_query("query { orders { edges { node { id } } } }")
        
        assert exc_info.value.retry_after == 120
    
    @pytest.mark.asyncio
    async def test_get_orders(self, graphql_client, mock_httpx_client):
        """Test get_orders method"""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {
            'data': {
                'orders': {
                    'edges': [
                        {
                            'node': {
                                'id': 'gid://shopify/Order/1',
                                'name': '#1001',
                                'totalPrice': '100.00',
                                'createdAt': '2025-05-18T00:00:00Z'
                            }
                        }
                    ],
                    'pageInfo': {'hasNextPage': False}
                }
            }
        }
        mock_response.headers = {}
        mock_httpx_client.post.return_value = mock_response
        
        # Get orders
        result = await graphql_client.get_orders(first=1)
        
        # Verify
        assert 'orders' in result
        assert len(result['orders']['edges']) == 1
        order = result['orders']['edges'][0]['node']
        assert order['name'] == '#1001'
    
    @pytest.mark.asyncio
    async def test_get_products(self, graphql_client, mock_httpx_client):
        """Test get_products method"""
        # Mock response
        mock_response = Mock()
        mock_response.json.return_value = {
            'data': {
                'products': {
                    'edges': [
                        {
                            'node': {
                                'id': 'gid://shopify/Product/1',
                                'title': 'Test Product',
                                'handle': 'test-product'
                            }
                        }
                    ],
                    'pageInfo': {'hasNextPage': False}
                }
            }
        }
        mock_response.headers = {}
        mock_httpx_client.post.return_value = mock_response
        
        # Get products
        result = await graphql_client.get_products(first=1)
        
        # Verify
        assert 'products' in result
        assert len(result['products']['edges']) == 1
        product = result['products']['edges'][0]['node']
        assert product['title'] == 'Test Product'


class TestShopifyAPIIntegration:
    """Test REST/GraphQL integration in ShopifyAPI class"""
    
    @pytest.fixture
    def rest_api(self):
        """Create REST API client"""
        return ShopifyAPI(
            shop_url="https://test-shop.myshopify.com",
            access_token="test-token",
            use_graphql=False
        )
    
    @pytest.fixture
    def graphql_api(self):
        """Create GraphQL-enabled API client"""
        return ShopifyAPI(
            shop_url="https://test-shop.myshopify.com",
            access_token="test-token",
            use_graphql=True
        )
    
    def test_rest_mode_default(self, rest_api):
        """Test that REST mode is default"""
        assert not rest_api.use_graphql
        assert rest_api._graphql_client is None
    
    def test_graphql_mode_initialization(self, graphql_api):
        """Test GraphQL mode initialization"""
        assert graphql_api.use_graphql
        assert graphql_api._graphql_client is not None
    
    def test_set_graphql_mode(self, rest_api):
        """Test switching to GraphQL mode after initialization"""
        assert not rest_api.use_graphql
        
        rest_api.set_graphql_mode(True)
        
        assert rest_api.use_graphql
        assert rest_api._graphql_client is not None
    
    @patch('src.api.shopify_api.requests.request')
    def test_get_orders_rest(self, mock_request, rest_api):
        """Test get_orders in REST mode"""
        # Mock REST response
        mock_response = Mock()
        mock_response.json.return_value = {
            'orders': [
                {
                    'id': 1,
                    'name': '#1001',
                    'total_price': '100.00'
                }
            ]
        }
        mock_response.headers = {'Link': ''}
        mock_response.status_code = 200
        mock_request.return_value = mock_response
        
        # Get orders
        orders = rest_api.get_orders(limit=1)
        
        # Verify
        assert len(orders) == 1
        assert orders[0]['name'] == '#1001'
    
    @patch('src.api.shopify_api.ShopifyGraphQLAPI.get_orders')
    @patch('src.api.shopify_api.asyncio.get_event_loop')
    def test_get_orders_graphql(self, mock_loop, mock_get_orders, graphql_api):
        """Test get_orders in GraphQL mode"""
        # Mock async execution
        mock_loop_instance = Mock()
        mock_loop.return_value = mock_loop_instance
        
        # Mock GraphQL response
        future = asyncio.Future()
        future.set_result({
            'orders': {
                'edges': [
                    {
                        'node': {
                            'id': 'gid://shopify/Order/1',
                            'name': '#1001',
                            'totalPrice': '100.00'
                        }
                    }
                ]
            }
        })
        mock_get_orders.return_value = future
        mock_loop_instance.run_until_complete.return_value = [
            {
                'id': 'gid://shopify/Order/1',
                'name': '#1001',
                'total_price': '100.00'
            }
        ]
        
        # Get orders
        orders = graphql_api.get_orders(limit=1)
        
        # Verify
        assert len(orders) == 1
        assert orders[0]['name'] == '#1001'
    
    def test_graphql_to_rest_order_transformation(self, graphql_api):
        """Test GraphQL to REST format transformation for orders"""
        graphql_order = {
            'id': 'gid://shopify/Order/1',
            'name': '#1001',
            'totalPrice': '100.00',
            'createdAt': '2025-05-18T00:00:00Z',
            'currencyCode': 'USD',
            'lineItems': {
                'edges': [
                    {
                        'node': {
                            'id': 'gid://shopify/LineItem/1',
                            'title': 'Product 1',
                            'quantity': 2,
                            'price': '50.00'
                        }
                    }
                ]
            }
        }
        
        transformed = graphql_api._transform_graphql_order(graphql_order)
        
        assert transformed['id'] == 'gid://shopify/Order/1'
        assert transformed['name'] == '#1001'
        assert transformed['total_price'] == '100.00'
        assert transformed['currency'] == 'USD'
        assert len(transformed['line_items']) == 1
        assert transformed['line_items'][0]['title'] == 'Product 1'


class TestPagination:
    """Test pagination helpers"""
    
    @pytest.fixture
    def mock_client(self):
        """Create mock GraphQL client"""
        return Mock(spec=ShopifyGraphQLAPI)
    
    @pytest.mark.asyncio
    async def test_graphql_paginator(self, mock_client):
        """Test GraphQLPaginator async iteration"""
        # Mock query function
        async def mock_query_func(first, after, **kwargs):
            if after is None:
                return {
                    'orders': {
                        'edges': [
                            {'node': {'id': 1, 'name': '#1001'}},
                            {'node': {'id': 2, 'name': '#1002'}}
                        ],
                        'pageInfo': {'hasNextPage': True, 'endCursor': 'cursor1'}
                    }
                }
            else:
                return {
                    'orders': {
                        'edges': [
                            {'node': {'id': 3, 'name': '#1003'}}
                        ],
                        'pageInfo': {'hasNextPage': False, 'endCursor': 'cursor2'}
                    }
                }
        
        # Create paginator
        paginator = GraphQLPaginator(
            client=mock_client,
            query_func=mock_query_func,
            first=2
        )
        
        # Collect all results
        results = []
        async for item in paginator:
            results.append(item)
        
        # Verify
        assert len(results) == 3
        assert results[0]['name'] == '#1001'
        assert results[1]['name'] == '#1002'
        assert results[2]['name'] == '#1003'
    
    @pytest.mark.asyncio
    async def test_async_batch_paginator(self, mock_client):
        """Test AsyncBatchPaginator concurrent fetching"""
        # Mock query function
        call_count = 0
        async def mock_query_func(first, after, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {
                    'products': {
                        'edges': [
                            {'node': {'id': 1, 'title': 'Product 1'}}
                        ],
                        'pageInfo': {'hasNextPage': True, 'endCursor': 'cursor1'}
                    }
                }
            else:
                return {
                    'products': {
                        'edges': [
                            {'node': {'id': 2, 'title': 'Product 2'}}
                        ],
                        'pageInfo': {'hasNextPage': False, 'endCursor': 'cursor2'}
                    }
                }
        
        # Create batch paginator
        paginator = AsyncBatchPaginator(
            client=mock_client,
            query_func=mock_query_func,
            batch_size=2,
            first=1
        )
        
        # Fetch all
        results = await paginator.fetch_all(max_pages=2)
        
        # Verify
        assert len(results) == 2
        assert results[0]['title'] == 'Product 1'
        assert results[1]['title'] == 'Product 2'


class TestErrorHandling:
    """Test error handling functionality"""
    
    def test_graphql_error_parsing(self):
        """Test GraphQL error parsing"""
        errors = [
            {
                'message': 'Query cost exceeded',
                'extensions': {
                    'code': 'MAX_COST_EXCEEDED',
                    'cost': 1500
                }
            }
        ]
        
        error = ShopifyGraphQLError("Test error", errors=errors)
        
        assert error.errors == errors
        assert error.query_cost == 1500
    
    def test_rate_limit_error(self):
        """Test rate limit error"""
        error = ShopifyRateLimitError(retry_after=60)
        
        assert error.retry_after == 60
        assert "Retry after 60 seconds" in str(error)
    
    def test_should_retry_error(self):
        """Test error retry logic"""
        from src.api.errors import should_retry_error
        
        # Should retry on rate limit
        rate_limit_error = ShopifyRateLimitError()
        assert should_retry_error(rate_limit_error)
        
        # Should not retry on validation error
        from src.api.errors import ShopifyValidationError
        validation_error = ShopifyValidationError("Invalid input")
        assert not should_retry_error(validation_error)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
