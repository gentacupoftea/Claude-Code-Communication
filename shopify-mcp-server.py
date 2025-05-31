#!/usr/bin/env python3
"""
Shopify MCP Server - Main entry point for Claude Desktop integration
"""
import os
import sys
import json
import asyncio
import logging
from typing import Dict, Any, List, Optional

# Add project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.main import app
from src.shopify.client import ShopifyClient
from src.auth.services import AuthService
from src.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ShopifyMCPServer:
    """MCP Server for Shopify integration"""
    
    def __init__(self):
        self.shopify_client = None
        self.auth_service = None
        self.initialize_services()
    
    def initialize_services(self):
        """Initialize required services"""
        try:
            # Initialize Shopify client if credentials are available
            if all([settings.SHOPIFY_API_KEY, settings.SHOPIFY_API_SECRET]):
                self.shopify_client = ShopifyClient(
                    api_key=settings.SHOPIFY_API_KEY,
                    api_secret=settings.SHOPIFY_API_SECRET,
                    access_token=settings.SHOPIFY_ACCESS_TOKEN,
                    shop_url=settings.SHOPIFY_SHOP_URL
                )
                logger.info("Shopify client initialized successfully")
            else:
                logger.warning("Shopify credentials not configured")
            
            # Initialize auth service
            self.auth_service = AuthService()
            logger.info("Auth service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize services: {e}")
    
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming MCP requests"""
        method = request.get("method")
        params = request.get("params", {})
        
        try:
            if method == "shopify/products/list":
                return await self.list_products(params)
            elif method == "shopify/products/get":
                return await self.get_product(params)
            elif method == "shopify/products/create":
                return await self.create_product(params)
            elif method == "shopify/orders/list":
                return await self.list_orders(params)
            elif method == "auth/login":
                return await self.authenticate(params)
            elif method == "health":
                return {"status": "healthy", "version": "1.0.0"}
            else:
                return {"error": f"Unknown method: {method}"}
                
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            return {"error": str(e)}
    
    async def list_products(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """List Shopify products"""
        if not self.shopify_client:
            return {"error": "Shopify client not initialized"}
        
        limit = params.get("limit", 50)
        page = params.get("page", 1)
        
        products = await self.shopify_client.get_products(limit=limit, page=page)
        return {"products": products}
    
    async def get_product(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get a specific product"""
        if not self.shopify_client:
            return {"error": "Shopify client not initialized"}
        
        product_id = params.get("product_id")
        if not product_id:
            return {"error": "product_id is required"}
        
        product = await self.shopify_client.get_product(product_id)
        return {"product": product}
    
    async def create_product(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new product"""
        if not self.shopify_client:
            return {"error": "Shopify client not initialized"}
        
        product_data = params.get("product")
        if not product_data:
            return {"error": "product data is required"}
        
        product = await self.shopify_client.create_product(product_data)
        return {"product": product}
    
    async def list_orders(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """List Shopify orders"""
        if not self.shopify_client:
            return {"error": "Shopify client not initialized"}
        
        limit = params.get("limit", 50)
        status = params.get("status", "any")
        
        orders = await self.shopify_client.get_orders(limit=limit, status=status)
        return {"orders": orders}
    
    async def authenticate(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Authenticate a user"""
        email = params.get("email")
        password = params.get("password")
        
        if not email or not password:
            return {"error": "email and password are required"}
        
        result = await self.auth_service.authenticate_user(email, password)
        if result:
            return {"success": True, "token": result.get("access_token")}
        else:
            return {"error": "Authentication failed"}
    
    async def run(self):
        """Run the MCP server"""
        logger.info("Starting Shopify MCP Server...")
        
        while True:
            try:
                # Read request from stdin
                line = sys.stdin.readline()
                if not line:
                    break
                
                # Parse JSON request
                request = json.loads(line.strip())
                
                # Handle request
                response = await self.handle_request(request)
                
                # Send response
                print(json.dumps(response))
                sys.stdout.flush()
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
                print(json.dumps({"error": "Invalid JSON"}))
                sys.stdout.flush()
            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                print(json.dumps({"error": str(e)}))
                sys.stdout.flush()


def main():
    """Main entry point"""
    server = ShopifyMCPServer()
    
    # Run the server
    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()