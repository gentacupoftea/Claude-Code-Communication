"""
Basic Google Analytics reporting example.
"""
import asyncio
from datetime import date, timedelta
import httpx
import json


async def run_basic_report():
    """Run a basic Google Analytics report."""
    
    # Configuration
    BASE_URL = "http://localhost:8000"
    API_KEY = "your-api-key"
    PROPERTY_ID = "123456789"
    
    # Create HTTP client
    async with httpx.AsyncClient(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {API_KEY}"}
    ) as client:
        
        # 1. Simple traffic report
        print("=== Daily Traffic Report ===")
        
        response = await client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": PROPERTY_ID,
                "metrics": [
                    {"name": "sessions"},
                    {"name": "users"},
                    {"name": "newUsers"},
                    {"name": "bounceRate"},
                    {"name": "averageSessionDuration"}
                ],
                "dimensions": [{"name": "date"}],
                "date_ranges": [{
                    "start_date": (date.today() - timedelta(days=7)).isoformat(),
                    "end_date": date.today().isoformat()
                }],
                "order_bys": [{"field": "date", "desc": False}]
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            print(f"Dimension headers: {report['dimension_headers']}")
            print(f"Metric headers: {report['metric_headers']}")
            print()
            
            for row in report['rows']:
                date_str = row['dimension_values'][0]
                metrics = row['metric_values']
                
                print(f"Date: {date_str}")
                print(f"  Sessions: {metrics[0]}")
                print(f"  Users: {metrics[1]}")
                print(f"  New Users: {metrics[2]}")
                print(f"  Bounce Rate: {metrics[3]:.2%}")
                print(f"  Avg Session Duration: {metrics[4]:.2f} seconds")
                print()
        else:
            print(f"Error: {response.status_code} - {response.text}")
        
        
        # 2. Traffic by source
        print("\n=== Traffic by Source ===")
        
        response = await client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": PROPERTY_ID,
                "metrics": [
                    {"name": "sessions"},
                    {"name": "users"}
                ],
                "dimensions": [
                    {"name": "sessionSource"},
                    {"name": "sessionMedium"}
                ],
                "date_ranges": [{
                    "start_date": "30daysAgo",
                    "end_date": "today"
                }],
                "order_bys": [{"field": "sessions", "desc": True}],
                "limit": 10
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            for row in report['rows']:
                source = row['dimension_values'][0]
                medium = row['dimension_values'][1]
                sessions = row['metric_values'][0]
                users = row['metric_values'][1]
                
                print(f"{source} / {medium}: {sessions} sessions, {users} users")
        
        
        # 3. Top pages
        print("\n=== Top Pages ===")
        
        response = await client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": PROPERTY_ID,
                "metrics": [
                    {"name": "screenPageViews"},
                    {"name": "userEngagementDuration"},
                    {"name": "bounceRate"}
                ],
                "dimensions": [{"name": "pageTitle"}],
                "date_ranges": [{
                    "start_date": "7daysAgo",
                    "end_date": "today"
                }],
                "order_bys": [{"field": "screenPageViews", "desc": True}],
                "limit": 10
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            for row in report['rows']:
                page_title = row['dimension_values'][0]
                page_views = row['metric_values'][0]
                engagement_time = row['metric_values'][1]
                bounce_rate = row['metric_values'][2]
                
                print(f"{page_title}:")
                print(f"  Page Views: {page_views}")
                print(f"  Engagement Time: {engagement_time:.2f} seconds")
                print(f"  Bounce Rate: {bounce_rate:.2%}")
                print()
        
        
        # 4. Device breakdown
        print("\n=== Device Breakdown ===")
        
        response = await client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": PROPERTY_ID,
                "metrics": [
                    {"name": "sessions"},
                    {"name": "users"},
                    {"name": "conversions"}
                ],
                "dimensions": [{"name": "deviceCategory"}],
                "date_ranges": [{
                    "start_date": "30daysAgo",
                    "end_date": "today"
                }]
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            total_sessions = sum(row['metric_values'][0] for row in report['rows'])
            
            for row in report['rows']:
                device = row['dimension_values'][0]
                sessions = row['metric_values'][0]
                users = row['metric_values'][1]
                conversions = row['metric_values'][2]
                
                percentage = (sessions / total_sessions) * 100 if total_sessions > 0 else 0
                
                print(f"{device}:")
                print(f"  Sessions: {sessions} ({percentage:.1f}%)")
                print(f"  Users: {users}")
                print(f"  Conversions: {conversions}")
                print()


if __name__ == "__main__":
    asyncio.run(run_basic_report())