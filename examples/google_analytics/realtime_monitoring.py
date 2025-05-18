"""
Real-time monitoring example for Google Analytics.
"""
import asyncio
import httpx
from datetime import datetime
import json


async def monitor_realtime_data():
    """Monitor real-time Google Analytics data."""
    
    # Configuration
    BASE_URL = "http://localhost:8000"
    API_KEY = "your-api-key"
    PROPERTY_ID = "123456789"
    REFRESH_INTERVAL = 30  # seconds
    
    # Create HTTP client
    async with httpx.AsyncClient(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {API_KEY}"}
    ) as client:
        
        while True:
            try:
                print(f"\n=== Real-time Data - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")
                
                # 1. Active users
                response = await client.post(
                    "/api/v1/google-analytics/realtime/reports",
                    json={
                        "property_id": PROPERTY_ID,
                        "metrics": [{"name": "activeUsers"}],
                        "dimensions": [
                            {"name": "country"},
                            {"name": "city"}
                        ],
                        "limit": 10
                    }
                )
                
                if response.status_code == 200:
                    report = response.json()
                    
                    total_active = sum(row['metric_values'][0] for row in report['rows'])
                    print(f"\nTotal Active Users: {total_active}")
                    
                    print("\nActive Users by Location:")
                    for row in report['rows']:
                        country = row['dimension_values'][0]
                        city = row['dimension_values'][1]
                        active_users = row['metric_values'][0]
                        
                        print(f"  {city}, {country}: {active_users} users")
                
                
                # 2. Events in last 30 minutes
                response = await client.post(
                    "/api/v1/google-analytics/realtime/reports",
                    json={
                        "property_id": PROPERTY_ID,
                        "metrics": [
                            {"name": "eventCount"},
                            {"name": "activeUsers"}
                        ],
                        "dimensions": [{"name": "eventName"}],
                        "minute_ranges": [{"name": "last30minutes"}],
                        "order_bys": [{"field": "eventCount", "desc": True}],
                        "limit": 10
                    }
                )
                
                if response.status_code == 200:
                    report = response.json()
                    
                    print("\nTop Events (Last 30 minutes):")
                    for row in report['rows']:
                        event_name = row['dimension_values'][0]
                        event_count = row['metric_values'][0]
                        active_users = row['metric_values'][1]
                        
                        print(f"  {event_name}: {event_count} events by {active_users} users")
                
                
                # 3. Traffic sources
                response = await client.post(
                    "/api/v1/google-analytics/realtime/reports",
                    json={
                        "property_id": PROPERTY_ID,
                        "metrics": [{"name": "activeUsers"}],
                        "dimensions": [
                            {"name": "sessionSource"},
                            {"name": "sessionMedium"}
                        ],
                        "order_bys": [{"field": "activeUsers", "desc": True}],
                        "limit": 5
                    }
                )
                
                if response.status_code == 200:
                    report = response.json()
                    
                    print("\nTraffic Sources:")
                    for row in report['rows']:
                        source = row['dimension_values'][0]
                        medium = row['dimension_values'][1]
                        active_users = row['metric_values'][0]
                        
                        print(f"  {source} / {medium}: {active_users} active users")
                
                
                # 4. Active pages
                response = await client.post(
                    "/api/v1/google-analytics/realtime/reports",
                    json={
                        "property_id": PROPERTY_ID,
                        "metrics": [
                            {"name": "activeUsers"},
                            {"name": "screenPageViews"}
                        ],
                        "dimensions": [
                            {"name": "pageTitle"},
                            {"name": "pagePath"}
                        ],
                        "order_bys": [{"field": "activeUsers", "desc": True}],
                        "limit": 10
                    }
                )
                
                if response.status_code == 200:
                    report = response.json()
                    
                    print("\nActive Pages:")
                    for row in report['rows']:
                        page_title = row['dimension_values'][0]
                        page_path = row['dimension_values'][1]
                        active_users = row['metric_values'][0]
                        page_views = row['metric_values'][1]
                        
                        print(f"  {page_title}")
                        print(f"    Path: {page_path}")
                        print(f"    Active Users: {active_users}, Views: {page_views}")
                
                
                # 5. Device breakdown
                response = await client.post(
                    "/api/v1/google-analytics/realtime/reports",
                    json={
                        "property_id": PROPERTY_ID,
                        "metrics": [{"name": "activeUsers"}],
                        "dimensions": [
                            {"name": "deviceCategory"},
                            {"name": "operatingSystem"}
                        ]
                    }
                )
                
                if response.status_code == 200:
                    report = response.json()
                    
                    print("\nDevice Breakdown:")
                    device_totals = {}
                    
                    for row in report['rows']:
                        device = row['dimension_values'][0]
                        os = row['dimension_values'][1]
                        active_users = row['metric_values'][0]
                        
                        if device not in device_totals:
                            device_totals[device] = 0
                        device_totals[device] += active_users
                        
                        print(f"  {device} ({os}): {active_users} users")
                    
                    print("\nDevice Summary:")
                    for device, total in device_totals.items():
                        print(f"  {device}: {total} total users")
                
                
                print(f"\nRefreshing in {REFRESH_INTERVAL} seconds...")
                await asyncio.sleep(REFRESH_INTERVAL)
                
            except Exception as e:
                print(f"Error: {e}")
                await asyncio.sleep(REFRESH_INTERVAL)


async def alert_on_traffic_spike():
    """Alert when traffic exceeds threshold."""
    
    BASE_URL = "http://localhost:8000"
    API_KEY = "your-api-key"
    PROPERTY_ID = "123456789"
    THRESHOLD = 100  # Alert if active users exceed this
    CHECK_INTERVAL = 60  # seconds
    
    async with httpx.AsyncClient(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {API_KEY}"}
    ) as client:
        
        while True:
            try:
                response = await client.post(
                    "/api/v1/google-analytics/realtime/reports",
                    json={
                        "property_id": PROPERTY_ID,
                        "metrics": [{"name": "activeUsers"}]
                    }
                )
                
                if response.status_code == 200:
                    report = response.json()
                    total_active = sum(row['metric_values'][0] for row in report['rows'])
                    
                    if total_active > THRESHOLD:
                        print(f"🚨 ALERT: High traffic detected! {total_active} active users (threshold: {THRESHOLD})")
                        # Send notification (email, Slack, etc.)
                    else:
                        print(f"Normal traffic: {total_active} active users")
                
                await asyncio.sleep(CHECK_INTERVAL)
                
            except Exception as e:
                print(f"Error in monitoring: {e}")
                await asyncio.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    # Run the real-time monitor
    asyncio.run(monitor_realtime_data())
    
    # Or run the alert system
    # asyncio.run(alert_on_traffic_spike())