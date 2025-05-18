"""API client example for the data integration module."""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class DataIntegrationAPIClient:
    """Client for the Data Integration API."""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make an API request."""
        url = f"{self.base_url}{endpoint}"
        
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, headers=self.headers, **kwargs) as response:
                response.raise_for_status()
                return await response.json()
    
    async def get_dashboard(self, store_domain: str) -> Dict[str, Any]:
        """Get unified dashboard data."""
        return await self._request(
            "GET",
            f"/api/v1/dashboard",
            params={"store_domain": store_domain}
        )
    
    async def get_predictions(self, store_domain: str) -> Dict[str, Any]:
        """Get predictions."""
        return await self._request(
            "GET",
            f"/api/v1/predictions",
            params={"store_domain": store_domain}
        )
    
    async def get_insights(self, store_domain: str) -> Dict[str, Any]:
        """Get business insights."""
        return await self._request(
            "GET",
            f"/api/v1/insights",
            params={"store_domain": store_domain}
        )
    
    async def search_products(self, query: str, store_domain: str, limit: int = 10) -> list:
        """Search products."""
        return await self._request(
            "GET",
            f"/api/v1/search/products",
            params={
                "query": query,
                "store_domain": store_domain,
                "limit": limit
            }
        )
    
    async def search_customers(self, query: str, store_domain: str, limit: int = 10) -> list:
        """Search customers."""
        return await self._request(
            "GET",
            f"/api/v1/search/customers",
            params={
                "query": query,
                "store_domain": store_domain,
                "limit": limit
            }
        )
    
    async def get_analytics_summary(
        self,
        store_domain: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get analytics summary."""
        return await self._request(
            "GET",
            f"/api/v1/analytics/summary",
            params={
                "store_domain": store_domain,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        )
    
    async def generate_report(
        self,
        report_type: str,
        store_domain: str,
        start_date: datetime,
        end_date: datetime,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate a report."""
        payload = {
            "report_type": report_type,
            "store_domain": store_domain,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "options": options or {}
        }
        
        return await self._request(
            "POST",
            f"/api/v1/reports/generate",
            json=payload
        )
    
    async def get_report_status(self, report_id: str) -> Dict[str, Any]:
        """Get report status."""
        return await self._request(
            "GET",
            f"/api/v1/reports/{report_id}/status"
        )
    
    async def download_report(self, report_id: str) -> bytes:
        """Download report."""
        url = f"{self.base_url}/api/v1/reports/{report_id}/download"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers) as response:
                response.raise_for_status()
                return await response.read()

async def main():
    """Example usage of the API client."""
    # Initialize client
    client = DataIntegrationAPIClient(
        base_url="http://localhost:8000",
        api_key="your-api-key-here"
    )
    
    store_domain = "example.myshopify.com"
    
    # Get dashboard data
    print("Fetching dashboard data...")
    dashboard = await client.get_dashboard(store_domain)
    print(f"Total Revenue: ${dashboard['revenue_metrics']['total_revenue']:,.2f}")
    print(f"Total Orders: {dashboard['revenue_metrics']['total_orders']}")
    print(f"New Customers: {dashboard['customer_analytics']['new_customers']}")
    
    # Get predictions
    print("\nFetching predictions...")
    predictions = await client.get_predictions(store_domain)
    print(f"High-risk churn customers: {len(predictions['churn_predictions'])}")
    print(f"Forecasted demand (30 days): {predictions['demand_forecast']['total_units']}")
    
    # Search products
    print("\nSearching products...")
    products = await client.search_products("blue shirt", store_domain)
    for product in products[:3]:
        print(f"- {product['title']} (Score: {product['score']:.2f})")
    
    # Get analytics summary
    print("\nFetching analytics summary...")
    start_date = datetime.now() - timedelta(days=30)
    end_date = datetime.now()
    summary = await client.get_analytics_summary(store_domain, start_date, end_date)
    print(f"Period: {summary['period']['start']} to {summary['period']['end']}")
    print(f"Conversion Rate: {summary['conversion_rate']:.2%}")
    print(f"Average Order Value: ${summary['average_order_value']:.2f}")
    
    # Generate report
    print("\nGenerating monthly report...")
    report = await client.generate_report(
        report_type="monthly_performance",
        store_domain=store_domain,
        start_date=start_date,
        end_date=end_date,
        options={
            "include_predictions": True,
            "include_recommendations": True
        }
    )
    print(f"Report ID: {report['report_id']}")
    print(f"Status: {report['status']}")
    
    # Check report status
    await asyncio.sleep(2)  # Wait for processing
    status = await client.get_report_status(report['report_id'])
    print(f"Report Status: {status['status']}")
    
    if status['status'] == 'completed':
        # Download report
        print("\nDownloading report...")
        report_data = await client.download_report(report['report_id'])
        with open(f"report_{report['report_id']}.pdf", "wb") as f:
            f.write(report_data)
        print(f"Report saved: report_{report['report_id']}.pdf")

if __name__ == "__main__":
    asyncio.run(main())
