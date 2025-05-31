#!/usr/bin/env python3
"""
Shopify MCP Server API Interaction Example

This script demonstrates how to programmatically interact with the Shopify MCP Server
REST and GraphQL APIs for common operations.
"""

import os
import sys
import json
import asyncio
import requests
from typing import Dict, Any, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import API client components
from src.api.shopify_api import ShopifyAPI
from src.api.shopify_graphql import ShopifyGraphQLClient


class MCPServerClient:
    """Client for interacting with the Shopify MCP Server API."""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """
        Initialize the MCP Server client.
        
        Args:
            base_url: The base URL of the MCP server (e.g., http://localhost:8765)
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
        if api_key:
            self.session.headers.update({
                'Authorization': f'Bearer {api_key}'
            })
    
    def get_server_status(self) -> Dict[str, Any]:
        """Get the current server status."""
        response = self.session.get(f"{self.base_url}/api/status")
        response.raise_for_status()
        return response.json()
    
    def get_server_metrics(self) -> Dict[str, Any]:
        """Get server performance metrics."""
        response = self.session.get(f"{self.base_url}/api/metrics")
        response.raise_for_status()
        return response.json()
    
    def get_sync_status(self) -> Dict[str, Any]:
        """Get the current sync status."""
        response = self.session.get(f"{self.base_url}/api/sync/status")
        response.raise_for_status()
        return response.json()
    
    def get_sync_history(self) -> List[Dict[str, Any]]:
        """Get sync job history."""
        response = self.session.get(f"{self.base_url}/api/sync/history")
        response.raise_for_status()
        return response.json()
    
    def trigger_sync_job(self, entity_type: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Trigger a new sync job.
        
        Args:
            entity_type: Type of entity to sync (product, order, inventory, etc.)
            options: Optional configuration for the sync job
        
        Returns:
            Dict containing the created job information
        """
        payload = {
            "entity_type": entity_type,
            "options": options or {}
        }
        
        response = self.session.post(
            f"{self.base_url}/api/sync/jobs",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def cancel_sync_job(self, job_id: str) -> Dict[str, Any]:
        """
        Cancel a running sync job.
        
        Args:
            job_id: ID of the sync job to cancel
            
        Returns:
            Dict containing the updated job information
        """
        response = self.session.post(f"{self.base_url}/api/sync/jobs/{job_id}/cancel")
        response.raise_for_status()
        return response.json()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        response = self.session.get(f"{self.base_url}/api/cache/stats")
        response.raise_for_status()
        return response.json()
    
    def invalidate_cache(self, cache_key: str) -> Dict[str, Any]:
        """
        Invalidate a specific cache key.
        
        Args:
            cache_key: The cache key to invalidate
            
        Returns:
            Dict containing the invalidation result
        """
        response = self.session.post(
            f"{self.base_url}/api/cache/invalidate",
            json={"key": cache_key}
        )
        response.raise_for_status()
        return response.json()
    
    def get_shopify_products(self, 
                            limit: int = 10, 
                            page: int = 1, 
                            filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get Shopify products via the MCP server.
        
        Args:
            limit: Maximum number of products to return
            page: Page number
            filters: Optional filters to apply
            
        Returns:
            Dict containing products and pagination info
        """
        params = {
            "limit": limit,
            "page": page
        }
        
        if filters:
            params.update(filters)
        
        response = self.session.get(
            f"{self.base_url}/api/shopify/products",
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def get_shopify_orders(self, 
                          limit: int = 10, 
                          page: int = 1,
                          filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get Shopify orders via the MCP server.
        
        Args:
            limit: Maximum number of orders to return
            page: Page number
            filters: Optional filters to apply
            
        Returns:
            Dict containing orders and pagination info
        """
        params = {
            "limit": limit,
            "page": page
        }
        
        if filters:
            params.update(filters)
        
        response = self.session.get(
            f"{self.base_url}/api/shopify/orders",
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def execute_graphql_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a GraphQL query via the MCP server.
        
        Args:
            query: The GraphQL query string
            variables: Optional variables for the query
            
        Returns:
            Dict containing the GraphQL response
        """
        payload = {
            "query": query,
            "variables": variables or {}
        }
        
        response = self.session.post(
            f"{self.base_url}/api/graphql",
            json=payload
        )
        response.raise_for_status()
        return response.json()


async def demonstrate_direct_shopify_api_usage():
    """Demonstrates direct usage of the Shopify API client."""
    print("\n=== Demonstrating Direct Shopify API Usage ===\n")
    
    # In a real scenario, these would be loaded from environment variables
    # or a configuration file
    shopify_credentials = {
        "api_key": "your_api_key",
        "api_secret": "your_api_secret",
        "shop_url": "your-store.myshopify.com",
        "access_token": "your_access_token",
        "api_version": "2025-04"
    }
    
    # Initialize the Shopify API client
    shopify_api = ShopifyAPI(
        shop_url=f"https://{shopify_credentials['shop_url']}",
        access_token=shopify_credentials['access_token'],
        api_version=shopify_credentials['api_version']
    )
    
    # For demonstration purposes, we'll mock the API responses
    print("NOTE: Using mock data for demonstration")
    
    # Get products
    # In a real scenario, this would make an actual API call
    products = [
        {"id": 1, "title": "Product 1", "price": "19.99"},
        {"id": 2, "title": "Product 2", "price": "29.99"},
        {"id": 3, "title": "Product 3", "price": "39.99"}
    ]
    
    print("Retrieved products:")
    for product in products:
        print(f"  - {product['title']} (ID: {product['id']}, Price: ${product['price']})")
    
    # Get orders
    # In a real scenario, this would make an actual API call
    orders = [
        {"id": 101, "order_number": "1001", "total_price": "59.97", "line_items_count": 2},
        {"id": 102, "order_number": "1002", "total_price": "19.99", "line_items_count": 1}
    ]
    
    print("\nRetrieved orders:")
    for order in orders:
        print(f"  - Order #{order['order_number']} (ID: {order['id']}, Total: ${order['total_price']})")
    
    # Initialize GraphQL client
    graphql_client = ShopifyGraphQLClient(
        shop_url=f"https://{shopify_credentials['shop_url']}",
        access_token=shopify_credentials['access_token'],
        api_version=shopify_credentials['api_version']
    )
    
    # Example GraphQL query
    query = """
    {
      shop {
        name
        primaryDomain {
          url
          host
        }
        plan {
          displayName
          partnerDevelopment
          shopifyPlus
        }
      }
    }
    """
    
    # In a real scenario, this would execute the query against Shopify's GraphQL API
    # Mock the response for demonstration
    graphql_response = {
        "data": {
            "shop": {
                "name": "Example Store",
                "primaryDomain": {
                    "url": "https://example-store.myshopify.com",
                    "host": "example-store.myshopify.com"
                },
                "plan": {
                    "displayName": "Basic Shopify",
                    "partnerDevelopment": False,
                    "shopifyPlus": False
                }
            }
        }
    }
    
    print("\nGraphQL Query Result:")
    print(f"  Shop Name: {graphql_response['data']['shop']['name']}")
    print(f"  Domain: {graphql_response['data']['shop']['primaryDomain']['url']}")
    print(f"  Plan: {graphql_response['data']['shop']['plan']['displayName']}")
    
    print("\n=== Direct Shopify API Usage Demonstration Completed ===\n")


def demonstrate_mcp_server_api_usage():
    """Demonstrates usage of the MCP Server API client."""
    print("\n=== Demonstrating MCP Server API Usage ===\n")
    
    # Create MCP server client
    # In a real scenario, this would point to an actual running server
    client = MCPServerClient(
        base_url="http://localhost:8765",
        api_key="example_api_key"
    )
    
    print("Connecting to MCP Server at: http://localhost:8765")
    
    # For demonstration purposes, we'll mock the API responses
    print("NOTE: Using mock data for demonstration")
    
    # Get server status
    server_status = {
        "status": "running",
        "version": "0.3.0",
        "uptime": "2d 5h 37m",
        "workers": 4,
        "active_connections": 12
    }
    
    print("\nServer Status:")
    print(f"  Status: {server_status['status']}")
    print(f"  Version: {server_status['version']}")
    print(f"  Uptime: {server_status['uptime']}")
    print(f"  Workers: {server_status['workers']}")
    print(f"  Active Connections: {server_status['active_connections']}")
    
    # Get sync status
    sync_status = {
        "active_jobs": 2,
        "completed_jobs": 128,
        "failed_jobs": 3,
        "jobs": [
            {
                "id": "job_123",
                "entity_type": "product",
                "status": "running",
                "progress": 45,
                "total_entities": 100,
                "processed_entities": 45,
                "created_at": "2025-05-21T08:30:00Z"
            },
            {
                "id": "job_124",
                "entity_type": "inventory",
                "status": "running",
                "progress": 72,
                "total_entities": 250,
                "processed_entities": 180,
                "created_at": "2025-05-21T08:35:00Z"
            }
        ]
    }
    
    print("\nSync Status:")
    print(f"  Active Jobs: {sync_status['active_jobs']}")
    print(f"  Completed Jobs: {sync_status['completed_jobs']}")
    print(f"  Failed Jobs: {sync_status['failed_jobs']}")
    
    print("\nActive Sync Jobs:")
    for job in sync_status['jobs']:
        print(f"  - Job {job['id']} ({job['entity_type']}): {job['status']}, Progress: {job['progress']}%")
    
    # Trigger a new sync job
    new_job = {
        "id": "job_125",
        "entity_type": "order",
        "status": "pending",
        "created_at": "2025-05-21T09:00:00Z",
        "options": {
            "date_range": "last_7_days",
            "batch_size": 50,
            "priority": "high"
        }
    }
    
    print("\nTriggered New Sync Job:")
    print(f"  Job ID: {new_job['id']}")
    print(f"  Entity Type: {new_job['entity_type']}")
    print(f"  Status: {new_job['status']}")
    print(f"  Created At: {new_job['created_at']}")
    print(f"  Options: {json.dumps(new_job['options'])}")
    
    # Get cache stats
    cache_stats = {
        "type": "redis",
        "entries": 12500,
        "memory_usage": "256 MB",
        "hit_rate": 0.87,
        "miss_rate": 0.13,
        "average_ttl": 3600,
        "keys_by_prefix": {
            "product:": 2500,
            "order:": 8000,
            "inventory:": 1500,
            "customer:": 500
        }
    }
    
    print("\nCache Statistics:")
    print(f"  Type: {cache_stats['type']}")
    print(f"  Entries: {cache_stats['entries']}")
    print(f"  Memory Usage: {cache_stats['memory_usage']}")
    print(f"  Hit Rate: {cache_stats['hit_rate']:.1%}")
    print(f"  Miss Rate: {cache_stats['miss_rate']:.1%}")
    print("\nCache Keys by Prefix:")
    for prefix, count in cache_stats['keys_by_prefix'].items():
        print(f"  - {prefix}: {count}")
    
    # Execute a GraphQL query through the MCP server
    graphql_query = """
    query ($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            variants(first: 1) {
              edges {
                node {
                  price
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
    """
    
    variables = {"first": 5}
    
    # Mock GraphQL response
    graphql_response = {
        "data": {
            "products": {
                "edges": [
                    {
                        "node": {
                            "id": "gid://shopify/Product/1",
                            "title": "Premium T-Shirt",
                            "handle": "premium-t-shirt",
                            "variants": {
                                "edges": [
                                    {
                                        "node": {
                                            "price": "29.99",
                                            "inventoryQuantity": 42
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    {
                        "node": {
                            "id": "gid://shopify/Product/2",
                            "title": "Casual Jeans",
                            "handle": "casual-jeans",
                            "variants": {
                                "edges": [
                                    {
                                        "node": {
                                            "price": "59.99",
                                            "inventoryQuantity": 28
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
    }
    
    print("\nGraphQL Query Results:")
    for edge in graphql_response['data']['products']['edges']:
        product = edge['node']
        variant = product['variants']['edges'][0]['node']
        print(f"  - {product['title']} (ID: {product['id'].split('/')[-1]})")
        print(f"    Price: ${variant['price']}, Inventory: {variant['inventoryQuantity']}")
    
    print("\n=== MCP Server API Usage Demonstration Completed ===\n")


def main():
    """Main function to run the example."""
    print("Shopify MCP Server API Interaction Examples")
    
    # Run direct Shopify API usage example
    asyncio.run(demonstrate_direct_shopify_api_usage())
    
    # Run MCP Server API usage example
    demonstrate_mcp_server_api_usage()
    
    print("\nAll API interaction examples completed successfully!")


if __name__ == "__main__":
    main()