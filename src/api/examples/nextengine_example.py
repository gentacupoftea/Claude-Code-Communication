#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from api.connectors.nextengine_connector import NextEngineConnector
from api.models.product import Product
from api.models.order import Order
from api.utils.caching import cached, CacheManager
from api.utils.error_handling import APIError, AuthenticationError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def generate_auth_url(project_id: str, redirect_uri: str):
    """
    Generate an OAuth authorization URL for NextEngine API.
    
    Args:
        project_id: GCP project ID
        redirect_uri: OAuth redirect URI
    """
    try:
        connector = NextEngineConnector(project_id)
        auth_url = connector.generate_auth_url(redirect_uri)
        
        print(f"\nAuthorization URL:")
        print(f"{auth_url}\n")
        print(f"Open this URL in a browser and authorize the application.")
        print(f"You will be redirected to {redirect_uri} with an authorization code.")
        
    except Exception as e:
        logger.error(f"Error generating authorization URL: {str(e)}")
        sys.exit(1)

def exchange_auth_code(project_id: str, auth_code: str, redirect_uri: str):
    """
    Exchange authorization code for access and refresh tokens.
    
    Args:
        project_id: GCP project ID
        auth_code: Authorization code from OAuth redirect
        redirect_uri: OAuth redirect URI
    """
    try:
        connector = NextEngineConnector(project_id)
        token_data = connector.exchange_auth_code(auth_code, redirect_uri)
        
        print(f"\nToken exchange successful!")
        access_token = token_data.get("access_token", {}).get("value", "")
        refresh_token = token_data.get("refresh_token", {}).get("value", "")
        
        print(f"Access Token: {access_token[:10]}...")
        print(f"Refresh Token: {refresh_token[:10]}...")
        print(f"Expires In: {token_data.get('access_token', {}).get('expires_in')} seconds\n")
        
        print(f"IMPORTANT: Store the refresh token securely in Secret Manager:")
        print(f"Secret name: nextengine-refresh-token\n")
        
    except Exception as e:
        logger.error(f"Error exchanging authorization code: {str(e)}")
        sys.exit(1)

def get_master_products(project_id: str, limit: int = 10):
    """
    Get product master data from NextEngine.
    
    Args:
        project_id: GCP project ID
        limit: Maximum number of results to return
    """
    try:
        connector = NextEngineConnector(project_id)
        connector.authenticate()
        
        print(f"\nFetching up to {limit} products from NextEngine:")
        products = connector.get_master_products(limit=limit)
        
        print(f"\nFound {len(products)} products:")
        for product in products:
            product_id = product.get("goods_id", "Unknown")
            product_code = product.get("goods_code", "Unknown")
            product_name = product.get("goods_name", "Unknown")
            
            print(f"  - {product_id}: {product_code} - {product_name}")
        
        # Convert to standardized Product model
        if products:
            print(f"\nConverting to standardized Product model:")
            std_product = Product.from_nextengine_product(products[0])
            print(json.dumps(std_product.to_dict(), indent=2)[:500])
            print("...")
        
    except Exception as e:
        logger.error(f"Error getting products: {str(e)}")
        sys.exit(1)

def get_receive_orders(project_id: str, limit: int = 10):
    """
    Get receive order data from NextEngine.
    
    Args:
        project_id: GCP project ID
        limit: Maximum number of results to return
    """
    try:
        connector = NextEngineConnector(project_id)
        connector.authenticate()
        
        print(f"\nFetching up to {limit} receive orders from NextEngine:")
        orders = connector.get_receive_orders(limit=limit)
        
        print(f"\nFound {len(orders)} orders:")
        for order in orders:
            order_id = order.get("receive_order_id", "Unknown")
            order_date = order.get("receive_order_date", "Unknown")
            order_status = order.get("receive_order_status", "Unknown")
            
            print(f"  - {order_id} ({order_date}): Status {order_status}")
        
        # Get order rows for the first order
        if orders:
            first_order_id = orders[0].get("receive_order_id", "")
            if first_order_id:
                print(f"\nFetching order rows for order {first_order_id}:")
                rows = connector.get_receive_order_rows(first_order_id)
                
                print(f"Found {len(rows)} order rows:")
                for row in rows:
                    row_id = row.get("receive_order_row_id", "Unknown")
                    product_name = row.get("receive_order_row_goods_name", "Unknown")
                    quantity = row.get("receive_order_row_quantity", "0")
                    
                    print(f"  - {row_id}: {product_name} (Qty: {quantity})")
                
                # Convert to standardized Order model
                print(f"\nConverting to standardized Order model:")
                std_order = Order.from_nextengine_order(orders[0], rows)
                print(json.dumps(std_order.to_dict(), indent=2)[:500])
                print("...")
        
    except Exception as e:
        logger.error(f"Error getting orders: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NextEngine API Example")
    parser.add_argument("--project-id", required=True, help="GCP project ID")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Generate auth URL command
    auth_url_parser = subparsers.add_parser("auth-url", help="Generate an OAuth authorization URL")
    auth_url_parser.add_argument("--redirect-uri", required=True, help="OAuth redirect URI")
    
    # Exchange auth code command
    exchange_parser = subparsers.add_parser("exchange", help="Exchange authorization code for tokens")
    exchange_parser.add_argument("--auth-code", required=True, help="Authorization code from OAuth redirect")
    exchange_parser.add_argument("--redirect-uri", required=True, help="OAuth redirect URI")
    
    # Get products command
    products_parser = subparsers.add_parser("products", help="Get product master data")
    products_parser.add_argument("--limit", type=int, default=10, help="Maximum number of results to return")
    
    # Get orders command
    orders_parser = subparsers.add_parser("orders", help="Get receive order data")
    orders_parser.add_argument("--limit", type=int, default=10, help="Maximum number of results to return")
    
    args = parser.parse_args()
    
    if args.command == "auth-url":
        generate_auth_url(args.project_id, args.redirect_uri)
    elif args.command == "exchange":
        exchange_auth_code(args.project_id, args.auth_code, args.redirect_uri)
    elif args.command == "products":
        get_master_products(args.project_id, args.limit)
    elif args.command == "orders":
        get_receive_orders(args.project_id, args.limit)
    else:
        parser.print_help()
        sys.exit(1)