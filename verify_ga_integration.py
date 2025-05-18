#!/usr/bin/env python3
"""
Verify Google Analytics integration is working correctly.
"""
import asyncio
import sys
import os
from datetime import date, timedelta

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from google_analytics.client import GoogleAnalyticsClient
    from google_analytics.models import ReportRequest, Metric, Dimension, DateRange
    print("✅ Google Analytics modules imported successfully")
except ImportError as e:
    print(f"❌ Error importing GA modules: {e}")
    print("Please run: pip install -r requirements-ga.txt")
    sys.exit(1)


async def verify_integration():
    """Verify GA integration works."""
    
    # Check environment variables
    credentials_path = os.getenv("GA_CREDENTIALS_PATH")
    property_id = os.getenv("GA_PROPERTY_ID")
    
    if not credentials_path:
        print("❌ GA_CREDENTIALS_PATH not set")
        print("Please set it to your service account JSON file path")
        return False
    
    if not property_id:
        print("❌ GA_PROPERTY_ID not set")
        print("Please set it to your Google Analytics property ID")
        return False
    
    print(f"✅ Environment variables configured")
    print(f"   Credentials: {credentials_path}")
    print(f"   Property ID: {property_id}")
    
    # Try to create client
    try:
        client = GoogleAnalyticsClient(
            credentials_path=credentials_path,
            property_id=property_id
        )
        print("✅ GA client created successfully")
    except Exception as e:
        print(f"❌ Error creating GA client: {e}")
        return False
    
    # Test API access
    try:
        has_access = await client.check_access()
        if has_access:
            print("✅ API access verified")
        else:
            print("❌ No API access to property")
            return False
    except Exception as e:
        print(f"❌ Error checking API access: {e}")
        return False
    
    # Try a simple report
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=7)
        
        request = ReportRequest(
            property_id=property_id,
            metrics=[Metric(name="sessions")],
            dimensions=[Dimension(name="date")],
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)]
        )
        
        print("📊 Running test report...")
        report = await client.run_report(request)
        
        print(f"✅ Report executed successfully")
        print(f"   Rows returned: {report.row_count}")
        print(f"   Date range: {start_date} to {end_date}")
        
        if report.rows:
            print("   Sample data:")
            for row in report.rows[:3]:
                date_val = row.dimension_values[0]
                sessions = row.metric_values[0]
                print(f"     {date_val}: {sessions} sessions")
        
        return True
        
    except Exception as e:
        print(f"❌ Error running report: {e}")
        return False


async def main():
    """Main verification function."""
    print("🔍 Verifying Google Analytics Integration...")
    print("=" * 40)
    
    success = await verify_integration()
    
    print("=" * 40)
    if success:
        print("✅ Google Analytics integration is working correctly!")
    else:
        print("❌ Google Analytics integration has issues")
        print("\nTroubleshooting steps:")
        print("1. Check your .env file has GA_CREDENTIALS_PATH and GA_PROPERTY_ID")
        print("2. Verify the service account has access to the GA property")
        print("3. Ensure Google Analytics Data API is enabled in Google Cloud Console")
        print("4. Check the service account JSON file exists and is valid")


if __name__ == "__main__":
    asyncio.run(main())