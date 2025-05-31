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

from api.connectors.amazon_sp_api_connector import AmazonSPAPIConnector
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
    Generate an OAuth authorization URL for Amazon SP API.
    
    Args:
        project_id: GCP project ID
        redirect_uri: OAuth redirect URI
    """
    try:
        connector = AmazonSPAPIConnector(project_id)
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
        connector = AmazonSPAPIConnector(project_id)
        token_data = connector.exchange_auth_code(auth_code, redirect_uri)
        
        print(f"\nToken exchange successful!")
        print(f"Access Token: {token_data.get('access_token')[:10]}...")
        print(f"Refresh Token: {token_data.get('refresh_token')[:10]}...")
        print(f"Expires In: {token_data.get('expires_in')} seconds\n")
        
        print(f"IMPORTANT: Store the refresh token securely in Secret Manager:")
        print(f"Secret name: amazon-sp-api-refresh-token\n")
        
    except Exception as e:
        logger.error(f"Error exchanging authorization code: {str(e)}")
        sys.exit(1)

def get_rate_limits(project_id: str):
    """
    Get current rate limits from the SP API.
    
    Args:
        project_id: GCP project ID
    """
    try:
        connector = AmazonSPAPIConnector(project_id)
        connector.authenticate()
        
        rate_limits = connector.get_rate_limits()
        
        print(f"\nCurrent Rate Limits:")
        print(json.dumps(rate_limits, indent=2))
        
    except Exception as e:
        logger.error(f"Error getting rate limits: {str(e)}")
        sys.exit(1)

def get_orders(project_id: str, days: int = 30):
    """
    Get orders from Amazon SP API.
    
    Args:
        project_id: GCP project ID
        days: Number of days to look back
    """
    try:
        connector = AmazonSPAPIConnector(project_id)
        connector.authenticate()
        
        created_after = datetime.now() - timedelta(days=days)
        orders = connector.get_orders(created_after=created_after)
        
        print(f"\nFound {len(orders)} orders in the last {days} days:")
        for order in orders[:5]:  # Show first 5 orders only
            order_id = order.get("AmazonOrderId", "Unknown")
            order_date = order.get("PurchaseDate", "Unknown")
            status = order.get("OrderStatus", "Unknown")
            
            print(f"  - Order {order_id} ({order_date}): {status}")
        
        if len(orders) > 5:
            print(f"  ... and {len(orders) - 5} more orders")
        
    except Exception as e:
        logger.error(f"Error getting orders: {str(e)}")
        sys.exit(1)

def get_products(project_id: str, marketplace_id: str, sku_list: list = None):
    """
    Get products from Amazon SP API.
    
    Args:
        project_id: GCP project ID
        marketplace_id: Amazon marketplace ID
        sku_list: Optional list of SKUs to filter
    """
    try:
        connector = AmazonSPAPIConnector(project_id)
        connector.authenticate()
        
        if sku_list:
            print(f"\nFetching products for SKUs: {', '.join(sku_list)}")
        else:
            print(f"\nFetching all products")
        
        products = connector.get_products(marketplace_id, sku_list)
        
        print(f"\nFound {len(products)} products:")
        for product in products[:5]:  # Show first 5 products only
            sku = product.get("sku", "Unknown")
            title = product.get("attributes", {}).get("title", [{"value": "Unknown"}])[0].get("value", "Unknown")
            
            print(f"  - {sku}: {title}")
        
        if len(products) > 5:
            print(f"  ... and {len(products) - 5} more products")
        
        # Convert to standardized Product model
        if products:
            print(f"\nConverting to standardized Product model:")
            std_product = Product.from_amazon_listing(products[0])
            print(json.dumps(std_product.to_dict(), indent=2)[:500])
            print("...")
        
    except Exception as e:
        logger.error(f"Error getting products: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Amazon SP API Example")
    parser.add_argument("--project-id", required=True, help="GCP project ID")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Generate auth URL command
    auth_url_parser = subparsers.add_parser("auth-url", help="Generate an OAuth authorization URL")
    auth_url_parser.add_argument("--redirect-uri", required=True, help="OAuth redirect URI")
    
    # Exchange auth code command
    exchange_parser = subparsers.add_parser("exchange", help="Exchange authorization code for tokens")
    exchange_parser.add_argument("--auth-code", required=True, help="Authorization code from OAuth redirect")
    exchange_parser.add_argument("--redirect-uri", required=True, help="OAuth redirect URI")
    
    # Get rate limits command
    rate_limits_parser = subparsers.add_parser("rate-limits", help="Get current rate limits")
    
    # Get orders command
    orders_parser = subparsers.add_parser("orders", help="Get orders")
    orders_parser.add_argument("--days", type=int, default=30, help="Number of days to look back")
    
    # Get products command
    products_parser = subparsers.add_parser("products", help="Get products")
    products_parser.add_argument("--marketplace-id", required=True, help="Amazon marketplace ID")
    products_parser.add_argument("--skus", nargs="*", help="Optional list of SKUs to filter")
    
    args = parser.parse_args()
    
    if args.command == "auth-url":
        generate_auth_url(args.project_id, args.redirect_uri)
    elif args.command == "exchange":
        exchange_auth_code(args.project_id, args.auth_code, args.redirect_uri)
    elif args.command == "rate-limits":
        get_rate_limits(args.project_id)
    elif args.command == "orders":
        get_orders(args.project_id, args.days)
    elif args.command == "products":
        get_products(args.project_id, args.marketplace_id, args.skus)
    else:
        parser.print_help()
        sys.exit(1)