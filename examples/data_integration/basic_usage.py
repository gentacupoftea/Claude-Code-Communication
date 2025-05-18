"""Basic usage examples for the data integration module."""

import asyncio
from datetime import datetime, timedelta
from src.data_integration.dependencies import (
    get_shopify_service,
    get_analytics_service,
    get_email_service,
    get_analytics_engine
)

async def basic_shopify_integration():
    """Example of basic Shopify integration."""
    # Initialize service
    shopify_service = get_shopify_service(
        api_key="your-api-key",
        secret="your-secret",
        store_domain="example.myshopify.com"
    )
    
    # Get products
    products = await shopify_service.get_products(
        limit=50,
        filters={"vendor": "Acme Corp"}
    )
    print(f"Found {len(products)} products")
    
    # Get recent orders
    orders = await shopify_service.get_orders(
        start_date=datetime.now() - timedelta(days=7),
        end_date=datetime.now()
    )
    print(f"Found {len(orders)} orders in the last week")
    
    # Get customer data
    customers = await shopify_service.get_customers(
        limit=100,
        filters={"accepts_marketing": True}
    )
    print(f"Found {len(customers)} customers who accept marketing")

async def analytics_example():
    """Example of analytics integration."""
    # Initialize analytics service
    analytics_service = get_analytics_service(
        api_key="your-analytics-api-key"
    )
    
    # Get page views
    page_views = await analytics_service.get_page_views(
        start_date=datetime.now() - timedelta(days=30),
        end_date=datetime.now()
    )
    print(f"Total page views: {sum(pv['views'] for pv in page_views)}")
    
    # Get conversion data
    conversion_data = await analytics_service.get_conversion_data(
        start_date=datetime.now() - timedelta(days=30),
        end_date=datetime.now()
    )
    print(f"Conversion rate: {conversion_data['conversion_rate']:.2%}")

async def unified_analytics_example():
    """Example of unified analytics."""
    # Initialize analytics engine
    analytics_engine = get_analytics_engine()
    
    # Get unified dashboard
    dashboard = await analytics_engine.get_unified_dashboard(
        store_domain="example.myshopify.com",
        date_range="last_30_days"
    )
    
    print("Dashboard Metrics:")
    print(f"- Revenue: ${dashboard['revenue_metrics']['total_revenue']:,.2f}")
    print(f"- Orders: {dashboard['revenue_metrics']['total_orders']}")
    print(f"- AOV: ${dashboard['revenue_metrics']['average_order_value']:.2f}")
    print(f"- New Customers: {dashboard['customer_analytics']['new_customers']}")
    
    # Get predictions
    predictions = await analytics_engine.get_predictions(
        store_domain="example.myshopify.com"
    )
    
    print("\nPredictions:")
    print(f"- Churn Risk Customers: {len(predictions['churn_predictions'])}")
    print(f"- Demand Forecast (30 days): {predictions['demand_forecast']['total_predicted_demand']}")

async def email_marketing_example():
    """Example of email marketing integration."""
    # Initialize email service
    email_service = get_email_service(
        api_key="your-email-api-key"
    )
    
    # Get campaign metrics
    campaigns = await email_service.get_campaign_metrics()
    
    for campaign in campaigns:
        print(f"Campaign: {campaign['name']}")
        print(f"- Opens: {campaign['opens']}")
        print(f"- Clicks: {campaign['clicks']}")
        print(f"- Conversions: {campaign['conversions']}")
        print(f"- Revenue: ${campaign['revenue']:,.2f}")
    
    # Get subscriber activity
    subscriber_activity = await email_service.get_subscriber_activity(
        email="customer@example.com"
    )
    
    print(f"\nSubscriber {subscriber_activity['email']}:")
    print(f"- Total Opens: {subscriber_activity['total_opens']}")
    print(f"- Total Clicks: {subscriber_activity['total_clicks']}")
    print(f"- Last Activity: {subscriber_activity['last_activity']}")

async def search_example():
    """Example of search functionality."""
    analytics_engine = get_analytics_engine()
    
    # Search products
    product_results = await analytics_engine.search_products(
        query="blue shirt",
        store_domain="example.myshopify.com",
        limit=10
    )
    
    print("Product Search Results:")
    for result in product_results:
        print(f"- {result['title']} (Score: {result['score']:.2f})")
    
    # Search customers
    customer_results = await analytics_engine.search_customers(
        query="john@example.com",
        store_domain="example.myshopify.com"
    )
    
    print("\nCustomer Search Results:")
    for result in customer_results:
        print(f"- {result['email']} - {result['name']} (Score: {result['score']:.2f})")

def main():
    """Run all examples."""
    print("Data Integration Examples\n")
    
    # Run examples
    asyncio.run(basic_shopify_integration())
    print("\n" + "="*50 + "\n")
    
    asyncio.run(analytics_example())
    print("\n" + "="*50 + "\n")
    
    asyncio.run(unified_analytics_example())
    print("\n" + "="*50 + "\n")
    
    asyncio.run(email_marketing_example())
    print("\n" + "="*50 + "\n")
    
    asyncio.run(search_example())

if __name__ == "__main__":
    main()
