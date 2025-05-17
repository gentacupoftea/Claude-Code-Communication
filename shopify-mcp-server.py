#!/Users/mourigenta/auto-scraper/shopify_mcp_venv312/bin/python
"""
Shopify MCP Server
Shopify APIを通じてデータを取得し、Claude Desktopで可視化できるようにするMCPサーバー
"""

import sys
import json
import logging
import os
from datetime import datetime, timedelta
from mcp.server.fastmcp import FastMCP
from mcp.server.stdio import stdio_server
import requests
import pandas as pd
import matplotlib.pyplot as plt
import io
import base64
import asyncio

# Force correct LOG_LEVEL format before any MCP initialization
os.environ["LOG_LEVEL"] = "INFO"
os.environ["MCP_LOG_LEVEL"] = "INFO"

# Load other environment variables
from dotenv import load_dotenv
load_dotenv()

# Ensure LOG_LEVEL is uppercase (override dotenv)
os.environ["LOG_LEVEL"] = "INFO"

# Set up logging
logging.basicConfig(level=logging.INFO, stream=sys.stderr)

# Initialize MCP server
mcp = FastMCP("shopify-mcp-server", dependencies=["requests", "pandas", "matplotlib"])

# Shopify API configuration
SHOPIFY_API_VERSION = os.getenv("SHOPIFY_API_VERSION", "2023-10")
SHOPIFY_API_KEY = os.getenv("SHOPIFY_API_KEY")
SHOPIFY_API_SECRET_KEY = os.getenv("SHOPIFY_API_SECRET_KEY")
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")
SHOPIFY_SHOP_NAME = os.getenv("SHOPIFY_SHOP_NAME")

class ShopifyAPI:
    def __init__(self):
        self.base_url = f"https://{SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/{SHOPIFY_API_VERSION}"
        self.headers = {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json"
        }
    
    def get_orders(self, start_date=None, end_date=None):
        """Fetch orders from Shopify"""
        url = f"{self.base_url}/orders.json"
        params = {"status": "any", "limit": 250}
        
        if start_date:
            params["created_at_min"] = start_date
        if end_date:
            params["created_at_max"] = end_date
        
        response = requests.get(url, headers=self.headers, params=params)
        if response.status_code == 200:
            return response.json()["orders"]
        else:
            logging.error(f"Failed to fetch orders: {response.text}")
            return []
    
    def get_products(self):
        """Fetch products from Shopify"""
        url = f"{self.base_url}/products.json"
        params = {"limit": 250}
        
        response = requests.get(url, headers=self.headers, params=params)
        if response.status_code == 200:
            return response.json()["products"]
        else:
            logging.error(f"Failed to fetch products: {response.text}")
            return []
    
    def get_customers(self):
        """Fetch customers from Shopify"""
        url = f"{self.base_url}/customers.json"
        params = {"limit": 250}
        
        response = requests.get(url, headers=self.headers, params=params)
        if response.status_code == 200:
            return response.json()["customers"]
        else:
            logging.error(f"Failed to fetch customers: {response.text}")
            return []

# Initialize Shopify API client
shopify_api = ShopifyAPI()

@mcp.tool(description="Get orders summary with visualization")
async def get_orders_summary(start_date: str = None, end_date: str = None, visualization: str = "both") -> str:
    """
    Fetch orders summary from Shopify and visualize the data
    
    :param start_date: Start date in YYYY-MM-DD format
    :param end_date: End date in YYYY-MM-DD format
    :param visualization: Type of visualization ("chart", "table", or "both")
    :return: Markdown formatted report with embedded charts
    """
    orders = shopify_api.get_orders(start_date, end_date)
    
    if not orders:
        return "No orders found for the specified period."
    
    # Create DataFrame
    df = pd.DataFrame(orders)
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['total_price'] = df['total_price'].astype(float)
    
    # Calculate summary statistics
    total_orders = len(df)
    total_revenue = df['total_price'].sum()
    avg_order_value = df['total_price'].mean()
    
    # Create daily sales chart
    daily_sales = df.groupby(df['created_at'].dt.date)['total_price'].sum()
    
    result = f"""# Orders Summary

## Overview
- Total Orders: {total_orders}
- Total Revenue: ${total_revenue:,.2f}
- Average Order Value: ${avg_order_value:,.2f}

"""
    
    if visualization in ["chart", "both"]:
        # Create visualization
        plt.figure(figsize=(12, 6))
        plt.plot(daily_sales.index, daily_sales.values, marker='o', linestyle='-', linewidth=2)
        plt.title('Daily Sales Revenue')
        plt.xlabel('Date')
        plt.ylabel('Revenue ($)')
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        # Convert plot to base64 string
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        
        result += f"\n![Daily Sales Chart](data:image/png;base64,{img_base64})\n"
    
    if visualization in ["table", "both"]:
        # Add recent orders table
        recent_orders = df.nlargest(10, 'created_at')[['name', 'created_at', 'total_price', 'financial_status']]
        recent_orders['created_at'] = recent_orders['created_at'].dt.strftime('%Y-%m-%d %H:%M')
        
        result += "\n## Recent Orders\n\n"
        result += recent_orders.to_markdown(index=False)
    
    return result

@mcp.tool(description="Get sales analytics with trends visualization")
async def get_sales_analytics(period: str = "daily", days: int = 30) -> str:
    """
    Analyze sales trends over time
    
    :param period: Aggregation period ("daily", "weekly", "monthly")
    :param days: Number of days to analyze
    :return: Sales analytics report with charts
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    orders = shopify_api.get_orders(
        start_date.strftime('%Y-%m-%d'),
        end_date.strftime('%Y-%m-%d')
    )
    
    if not orders:
        return "No orders found for the specified period."
    
    df = pd.DataFrame(orders)
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['total_price'] = df['total_price'].astype(float)
    
    # Aggregate by period
    if period == "daily":
        sales_data = df.groupby(df['created_at'].dt.date).agg({
            'total_price': 'sum',
            'id': 'count'
        }).rename(columns={'id': 'order_count'})
    elif period == "weekly":
        sales_data = df.groupby(df['created_at'].dt.isocalendar().week).agg({
            'total_price': 'sum',
            'id': 'count'
        }).rename(columns={'id': 'order_count'})
    else:  # monthly
        sales_data = df.groupby(df['created_at'].dt.to_period('M')).agg({
            'total_price': 'sum',
            'id': 'count'
        }).rename(columns={'id': 'order_count'})
    
    # Create visualization
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
    
    # Revenue chart
    ax1.bar(range(len(sales_data)), sales_data['total_price'], color='skyblue')
    ax1.set_title(f'{period.capitalize()} Revenue')
    ax1.set_ylabel('Revenue ($)')
    ax1.grid(True, alpha=0.3)
    
    # Order count chart
    ax2.bar(range(len(sales_data)), sales_data['order_count'], color='lightgreen')
    ax2.set_title(f'{period.capitalize()} Order Count')
    ax2.set_ylabel('Number of Orders')
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Convert to base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    result = f"""# Sales Analytics ({period.capitalize()})

## Summary
- Total Revenue: ${sales_data['total_price'].sum():,.2f}
- Total Orders: {sales_data['order_count'].sum()}
- Average Revenue per {period}: ${sales_data['total_price'].mean():,.2f}
- Average Orders per {period}: {sales_data['order_count'].mean():.1f}

![Sales Analytics Chart](data:image/png;base64,{img_base64})
"""
    
    return result

@mcp.tool(description="Get product performance analysis")
async def get_product_performance(limit: int = 10) -> str:
    """
    Analyze product performance based on sales data
    
    :param limit: Number of top products to show
    :return: Product performance report with visualizations
    """
    products = shopify_api.get_products()
    orders = shopify_api.get_orders()
    
    if not products or not orders:
        return "Unable to fetch product or order data."
    
    # Extract line items from orders
    line_items = []
    for order in orders:
        for item in order.get('line_items', []):
            line_items.append({
                'product_id': item.get('product_id'),
                'product_title': item.get('title'),
                'quantity': item.get('quantity'),
                'price': float(item.get('price', 0)),
                'total': float(item.get('price', 0)) * item.get('quantity', 0)
            })
    
    if not line_items:
        return "No product sales data found."
    
    # Create DataFrame and analyze
    df = pd.DataFrame(line_items)
    product_performance = df.groupby(['product_id', 'product_title']).agg({
        'quantity': 'sum',
        'total': 'sum'
    }).sort_values('total', ascending=False).head(limit)
    
    # Create visualization
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    
    # Revenue by product
    ax1.barh(range(len(product_performance)), product_performance['total'])
    ax1.set_yticks(range(len(product_performance)))
    ax1.set_yticklabels([title[1] for title in product_performance.index])
    ax1.set_xlabel('Revenue ($)')
    ax1.set_title('Top Products by Revenue')
    ax1.grid(True, alpha=0.3)
    
    # Quantity sold
    ax2.barh(range(len(product_performance)), product_performance['quantity'])
    ax2.set_yticks(range(len(product_performance)))
    ax2.set_yticklabels([title[1] for title in product_performance.index])
    ax2.set_xlabel('Units Sold')
    ax2.set_title('Top Products by Quantity')
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Convert to base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    result = f"""# Product Performance Analysis

## Top {limit} Products

![Product Performance Chart](data:image/png;base64,{img_base64})

## Details
"""
    
    for (product_id, product_title), row in product_performance.iterrows():
        result += f"\n### {product_title}\n"
        result += f"- Revenue: ${row['total']:,.2f}\n"
        result += f"- Units Sold: {row['quantity']}\n"
        result += f"- Average Price: ${row['total']/row['quantity']:.2f}\n"
    
    return result

@mcp.tool(description="Get customer analytics and insights")
async def get_customer_analytics() -> str:
    """
    Analyze customer data and provide insights
    
    :return: Customer analytics report with visualizations
    """
    customers = shopify_api.get_customers()
    orders = shopify_api.get_orders()
    
    if not customers or not orders:
        return "Unable to fetch customer or order data."
    
    # Create DataFrames
    customers_df = pd.DataFrame(customers)
    orders_df = pd.DataFrame(orders)
    
    # Customer registration trend
    customers_df['created_at'] = pd.to_datetime(customers_df['created_at'])
    monthly_registrations = customers_df.groupby(customers_df['created_at'].dt.to_period('M')).size()
    
    # Customer order analysis
    customer_orders = orders_df.groupby('customer')['total_price'].agg(['count', 'sum', 'mean'])
    customer_orders.columns = ['order_count', 'total_spent', 'avg_order_value']
    
    # Top customers
    top_customers = customer_orders.nlargest(10, 'total_spent')
    
    # Create visualization
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
    
    # Monthly registrations
    ax1.plot(range(len(monthly_registrations)), monthly_registrations.values, marker='o')
    ax1.set_title('Customer Registration Trend')
    ax1.set_ylabel('New Customers')
    ax1.grid(True, alpha=0.3)
    
    # Order count distribution
    ax2.hist(customer_orders['order_count'], bins=20, edgecolor='black')
    ax2.set_title('Customer Order Frequency Distribution')
    ax2.set_xlabel('Number of Orders')
    ax2.set_ylabel('Number of Customers')
    ax2.grid(True, alpha=0.3)
    
    # Average order value distribution
    ax3.hist(customer_orders['avg_order_value'], bins=20, edgecolor='black')
    ax3.set_title('Average Order Value Distribution')
    ax3.set_xlabel('Average Order Value ($)')
    ax3.set_ylabel('Number of Customers')
    ax3.grid(True, alpha=0.3)
    
    # Top customers by spending
    ax4.barh(range(len(top_customers)), top_customers['total_spent'])
    ax4.set_yticks(range(len(top_customers)))
    ax4.set_yticklabels([str(i)[:20] for i in top_customers.index])
    ax4.set_xlabel('Total Spent ($)')
    ax4.set_title('Top 10 Customers by Spending')
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Convert to base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    
    result = f"""# Customer Analytics

## Overview
- Total Customers: {len(customers_df)}
- Customers with Orders: {len(customer_orders)}
- Average Orders per Customer: {customer_orders['order_count'].mean():.1f}
- Average Customer Lifetime Value: ${customer_orders['total_spent'].mean():,.2f}

![Customer Analytics Charts](data:image/png;base64,{img_base64})

## Top Customers
"""
    
    for customer_id, row in top_customers.iterrows():
        result += f"\n- Customer {str(customer_id)[:20]}: ${row['total_spent']:,.2f} ({row['order_count']} orders)\n"
    
    return result

@mcp.tool(description="商品ごとの注文・売上・返品を集計")
async def get_product_order_sales_refunds(start_date: str = None, end_date: str = None) -> str:
    orders = shopify_api.get_orders(start_date, end_date)
    if not orders:
        return "No orders found."
    product_stats = {}
    for order in orders:
        for item in order.get('line_items', []):
            pid = item['product_id']
            if pid not in product_stats:
                product_stats[pid] = {
                    'title': item['title'],
                    'orders': 0,
                    'sales': 0.0,
                    'refunds': 0.0
                }
            product_stats[pid]['orders'] += 1
            product_stats[pid]['sales'] += float(item['price']) * item['quantity']
        for refund in order.get('refunds', []):
            for ritem in refund.get('refund_line_items', []):
                pid = ritem['line_item']['product_id']
                if pid in product_stats:
                    product_stats[pid]['refunds'] += float(ritem.get('subtotal', 0))
    result = "| 商品 | 注文数 | 売上 | 返品 |\n|---|---|---|---|\n"
    for stat in product_stats.values():
        result += f"| {stat['title']} | {stat['orders']} | ¥{stat['sales']:.0f} | ¥{stat['refunds']:.0f} |\n"
    return result

@mcp.tool(description="参照元ごとの注文・売上・返品を集計")
async def get_referrer_order_sales_refunds(start_date: str = None, end_date: str = None) -> str:
    orders = shopify_api.get_orders(start_date, end_date)
    if not orders:
        return "No orders found."
    ref_stats = {}
    for order in orders:
        ref = order.get('referring_site') or 'Direct'
        if ref not in ref_stats:
            ref_stats[ref] = {'orders': 0, 'sales': 0.0, 'refunds': 0.0}
        ref_stats[ref]['orders'] += 1
        ref_stats[ref]['sales'] += float(order['total_price'])
        for refund in order.get('refunds', []):
            for ritem in refund.get('refund_line_items', []):
                ref_stats[ref]['refunds'] += float(ritem.get('subtotal', 0))
    result = "| 参照元 | 注文数 | 売上 | 返品 |\n|---|---|---|---|\n"
    for ref, stat in ref_stats.items():
        result += f"| {ref} | {stat['orders']} | ¥{stat['sales']:.0f} | ¥{stat['refunds']:.0f} |\n"
    return result

@mcp.tool(description="全体の注文・売上・返品を集計")
async def get_total_order_sales_refunds(start_date: str = None, end_date: str = None) -> str:
    orders = shopify_api.get_orders(start_date, end_date)
    if not orders:
        return "No orders found."
    total_orders = len(orders)
    total_sales = sum(float(order['total_price']) for order in orders)
    total_refunds = sum(
        float(ritem.get('subtotal', 0))
        for order in orders
        for refund in order.get('refunds', [])
        for ritem in refund.get('refund_line_items', [])
    )
    return f"全体集計\n- 注文数: {total_orders}\n- 売上: ¥{total_sales:.0f}\n- 返品: ¥{total_refunds:.0f}"

@mcp.tool(description="ページごとの注文・売上・返品を集計")
async def get_page_order_sales_refunds(start_date: str = None, end_date: str = None) -> str:
    orders = shopify_api.get_orders(start_date, end_date)
    if not orders:
        return "No orders found."
    page_stats = {}
    for order in orders:
        page = order.get('landing_site') or 'Unknown'
        if page not in page_stats:
            page_stats[page] = {'orders': 0, 'sales': 0.0, 'refunds': 0.0}
        page_stats[page]['orders'] += 1
        page_stats[page]['sales'] += float(order['total_price'])
        for refund in order.get('refunds', []):
            for ritem in refund.get('refund_line_items', []):
                page_stats[page]['refunds'] += float(ritem.get('subtotal', 0))
    result = "| ページ | 注文数 | 売上 | 返品 |\n|---|---|---|---|\n"
    for page, stat in page_stats.items():
        result += f"| {page} | {stat['orders']} | ¥{stat['sales']:.0f} | ¥{stat['refunds']:.0f} |\n"
    return result

# Main entry point
if __name__ == "__main__":
    mcp.run()