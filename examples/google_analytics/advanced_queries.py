"""
Advanced Google Analytics query examples.
"""
import asyncio
import httpx
from datetime import date, timedelta
import json
from typing import List, Dict, Any


class AdvancedAnalytics:
    """Advanced analytics query examples."""
    
    def __init__(self, base_url: str, api_key: str, property_id: str):
        self.base_url = base_url
        self.api_key = api_key
        self.property_id = property_id
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"}
        )
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    async def conversion_funnel_analysis(self):
        """Analyze conversion funnel."""
        print("=== Conversion Funnel Analysis ===")
        
        # Define funnel steps
        funnel_steps = [
            "view_item",
            "add_to_cart",
            "begin_checkout",
            "add_payment_info",
            "purchase"
        ]
        
        response = await self.client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": self.property_id,
                "metrics": [{"name": "eventCount"}],
                "dimensions": [{"name": "eventName"}],
                "date_ranges": [{
                    "start_date": "30daysAgo",
                    "end_date": "today"
                }],
                "dimension_filter": {
                    "field": "eventName",
                    "operation": "IN_LIST",
                    "value": ",".join(funnel_steps)
                }
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            # Create funnel data
            funnel_data = {}
            for row in report['rows']:
                event_name = row['dimension_values'][0]
                event_count = int(row['metric_values'][0])
                funnel_data[event_name] = event_count
            
            # Calculate conversion rates
            print("\nFunnel Steps:")
            previous_count = None
            
            for i, step in enumerate(funnel_steps):
                count = funnel_data.get(step, 0)
                
                if i == 0:
                    print(f"{i+1}. {step}: {count} events")
                else:
                    conversion_rate = (count / previous_count * 100) if previous_count > 0 else 0
                    print(f"{i+1}. {step}: {count} events ({conversion_rate:.1f}% conversion)")
                
                previous_count = count
            
            # Overall conversion rate
            if funnel_steps[0] in funnel_data and funnel_steps[-1] in funnel_data:
                overall_conversion = (funnel_data[funnel_steps[-1]] / funnel_data[funnel_steps[0]] * 100)
                print(f"\nOverall Conversion Rate: {overall_conversion:.2f}%")
    
    async def cohort_retention_analysis(self):
        """Perform cohort retention analysis."""
        print("\n=== Cohort Retention Analysis ===")
        
        # Get cohort data for the last 4 weeks
        cohort_date = date.today() - timedelta(weeks=4)
        
        response = await self.client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": self.property_id,
                "metrics": [
                    {"name": "cohortActiveUsers"},
                    {"name": "cohortRetentionRate"}
                ],
                "dimensions": [
                    {"name": "cohort"},
                    {"name": "cohortNthDay"}
                ],
                "date_ranges": [{
                    "start_date": cohort_date.isoformat(),
                    "end_date": date.today().isoformat()
                }],
                "cohort_spec": {
                    "cohorts": [{
                        "name": "Weekly Cohort",
                        "date_range": {
                            "start_date": cohort_date.isoformat(),
                            "end_date": (cohort_date + timedelta(days=6)).isoformat()
                        }
                    }]
                },
                "order_bys": [
                    {"field": "cohort", "desc": False},
                    {"field": "cohortNthDay", "desc": False}
                ]
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            # Organize data by cohort
            cohort_data = {}
            
            for row in report['rows']:
                cohort = row['dimension_values'][0]
                nth_day = int(row['dimension_values'][1])
                active_users = int(row['metric_values'][0])
                retention_rate = float(row['metric_values'][1])
                
                if cohort not in cohort_data:
                    cohort_data[cohort] = {}
                
                cohort_data[cohort][nth_day] = {
                    'active_users': active_users,
                    'retention_rate': retention_rate
                }
            
            # Display retention table
            for cohort, days_data in cohort_data.items():
                print(f"\nCohort: {cohort}")
                print("Day | Active Users | Retention Rate")
                print("----|--------------|---------------")
                
                for day in sorted(days_data.keys()):
                    data = days_data[day]
                    print(f"{day:3d} | {data['active_users']:12d} | {data['retention_rate']:13.1%}")
    
    async def user_behavior_analysis(self):
        """Analyze user behavior patterns."""
        print("\n=== User Behavior Analysis ===")
        
        # 1. User engagement by time of day
        response = await self.client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": self.property_id,
                "metrics": [
                    {"name": "sessions"},
                    {"name": "userEngagementDuration"},
                    {"name": "engagedSessions"}
                ],
                "dimensions": [{"name": "hour"}],
                "date_ranges": [{
                    "start_date": "7daysAgo",
                    "end_date": "today"
                }],
                "order_bys": [{"field": "hour", "desc": False}]
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            print("\nEngagement by Hour of Day:")
            print("Hour | Sessions | Avg Engagement | Engaged Sessions")
            print("-----|----------|----------------|------------------")
            
            for row in report['rows']:
                hour = int(row['dimension_values'][0])
                sessions = int(row['metric_values'][0])
                engagement_duration = float(row['metric_values'][1])
                engaged_sessions = int(row['metric_values'][2])
                
                avg_engagement = engagement_duration / sessions if sessions > 0 else 0
                
                print(f"{hour:4d} | {sessions:8d} | {avg_engagement:14.1f} | {engaged_sessions:16d}")
        
        # 2. User journey analysis
        response = await self.client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": self.property_id,
                "metrics": [{"name": "sessions"}],
                "dimensions": [
                    {"name": "sessionSource"},
                    {"name": "landingPage"},
                    {"name": "exitPage"}
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
            
            print("\n\nTop User Journeys:")
            print("Source | Landing Page | Exit Page | Sessions")
            print("-------|--------------|-----------|----------")
            
            for row in report['rows']:
                source = row['dimension_values'][0]
                landing = row['dimension_values'][1]
                exit_page = row['dimension_values'][2]
                sessions = int(row['metric_values'][0])
                
                # Truncate long URLs
                landing = landing[:30] + "..." if len(landing) > 30 else landing
                exit_page = exit_page[:30] + "..." if len(exit_page) > 30 else exit_page
                
                print(f"{source:6} | {landing:12} | {exit_page:9} | {sessions:8d}")
    
    async def segment_comparison(self):
        """Compare different user segments."""
        print("\n=== Segment Comparison ===")
        
        segments = [
            {"name": "New Users", "filter": {"field": "newVsReturning", "operation": "EXACT", "value": "new"}},
            {"name": "Returning Users", "filter": {"field": "newVsReturning", "operation": "EXACT", "value": "returning"}},
            {"name": "Mobile Users", "filter": {"field": "deviceCategory", "operation": "EXACT", "value": "mobile"}},
            {"name": "Desktop Users", "filter": {"field": "deviceCategory", "operation": "EXACT", "value": "desktop"}}
        ]
        
        segment_data = {}
        
        for segment in segments:
            response = await self.client.post(
                "/api/v1/google-analytics/reports",
                json={
                    "property_id": self.property_id,
                    "metrics": [
                        {"name": "sessions"},
                        {"name": "bounceRate"},
                        {"name": "averageSessionDuration"},
                        {"name": "conversions"}
                    ],
                    "date_ranges": [{
                        "start_date": "30daysAgo",
                        "end_date": "today"
                    }],
                    "dimension_filter": segment["filter"]
                }
            )
            
            if response.status_code == 200:
                report = response.json()
                
                if report['rows']:
                    metrics = report['rows'][0]['metric_values']
                    segment_data[segment["name"]] = {
                        "sessions": int(metrics[0]),
                        "bounce_rate": float(metrics[1]),
                        "avg_duration": float(metrics[2]),
                        "conversions": int(metrics[3])
                    }
        
        # Display comparison
        print("\nSegment | Sessions | Bounce Rate | Avg Duration | Conversions")
        print("--------|----------|-------------|--------------|------------")
        
        for segment_name, data in segment_data.items():
            print(f"{segment_name:7} | {data['sessions']:8d} | {data['bounce_rate']:10.1%} | "
                  f"{data['avg_duration']:12.1f} | {data['conversions']:11d}")
    
    async def custom_metrics_calculation(self):
        """Calculate custom metrics using expressions."""
        print("\n=== Custom Metrics Calculation ===")
        
        response = await self.client.post(
            "/api/v1/google-analytics/reports",
            json={
                "property_id": self.property_id,
                "metrics": [
                    {"name": "sessions"},
                    {"name": "users"},
                    {"name": "newUsers"},
                    {"name": "screenPageViews"},
                    {"name": "conversions"},
                    # Custom metrics
                    {"name": "sessions_per_user", "expression": "sessions / users"},
                    {"name": "pages_per_session", "expression": "screenPageViews / sessions"},
                    {"name": "conversion_rate", "expression": "conversions / sessions * 100"},
                    {"name": "returning_user_rate", "expression": "(users - newUsers) / users * 100"}
                ],
                "dimensions": [{"name": "month"}],
                "date_ranges": [{
                    "start_date": "6monthsAgo",
                    "end_date": "today"
                }],
                "order_bys": [{"field": "month", "desc": False}]
            }
        )
        
        if response.status_code == 200:
            report = response.json()
            
            print("\nMonth | Sessions/User | Pages/Session | Conversion Rate | Returning Users")
            print("------|---------------|---------------|-----------------|----------------")
            
            for row in report['rows']:
                month = row['dimension_values'][0]
                metrics = row['metric_values']
                
                sessions_per_user = float(metrics[5])
                pages_per_session = float(metrics[6])
                conversion_rate = float(metrics[7])
                returning_rate = float(metrics[8])
                
                print(f"{month} | {sessions_per_user:13.2f} | {pages_per_session:13.2f} | "
                      f"{conversion_rate:14.1f}% | {returning_rate:14.1f}%")
    
    async def run_all_analyses(self):
        """Run all analysis examples."""
        await self.conversion_funnel_analysis()
        await self.cohort_retention_analysis()
        await self.user_behavior_analysis()
        await self.segment_comparison()
        await self.custom_metrics_calculation()


async def main():
    """Run advanced analytics examples."""
    analytics = AdvancedAnalytics(
        base_url="http://localhost:8000",
        api_key="your-api-key",
        property_id="123456789"
    )
    
    try:
        await analytics.run_all_analyses()
    finally:
        await analytics.close()


if __name__ == "__main__":
    asyncio.run(main())