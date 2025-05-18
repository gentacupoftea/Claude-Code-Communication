"""Analytics API routes for the Shopify MCP Server."""

from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io

from ...api.shopify_api import ShopifyAPI
from ..dashboard.analytics_processor import AnalyticsProcessor


router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def get_shopify_api() -> ShopifyAPI:
    """Dependency to get Shopify API instance."""
    return ShopifyAPI()


def get_analytics_processor(api: ShopifyAPI = Depends(get_shopify_api)) -> AnalyticsProcessor:
    """Dependency to get analytics processor."""
    return AnalyticsProcessor(api)


@router.get("/orders/summary")
async def get_order_summary(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    group_by: str = Query("day", description="Grouping period: day, week, month"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor)
):
    """Get order summary data grouped by time period."""
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        data = processor.get_order_summary(
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch order summary: {str(e)}")


@router.get("/sales/by-category")
async def get_category_sales(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor)
):
    """Get sales data by product category."""
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        data = processor.get_category_sales(
            start_date=start_date,
            end_date=end_date
        )
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch category sales: {str(e)}")


@router.get("/sales/trend")
async def get_sales_trend(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    compare_previous: bool = Query(True, description="Include previous year comparison"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor)
):
    """Get sales trend data with optional year-over-year comparison."""
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        data = processor.get_sales_trend(
            start_date=start_date,
            end_date=end_date,
            compare_previous=compare_previous
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sales trend: {str(e)}")


@router.get("/sales/geographic")
async def get_geographic_distribution(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor)
):
    """Get sales distribution by geographic location."""
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        data = processor.get_geographic_distribution(
            start_date=start_date,
            end_date=end_date
        )
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch geographic data: {str(e)}")


@router.get("/export/{data_type}")
async def export_data(
    data_type: str,
    format: str = Query("csv", description="Export format: csv, json, excel"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor)
):
    """Export analytics data in specified format."""
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        # Fetch data based on type
        if data_type == "orders":
            data = processor.get_order_summary(start_date=start_date, end_date=end_date)
        elif data_type == "categories":
            data = processor.get_category_sales(start_date=start_date, end_date=end_date)
        elif data_type == "trend":
            data = processor.get_sales_trend(start_date=start_date, end_date=end_date)
        elif data_type == "geographic":
            data = processor.get_geographic_distribution(start_date=start_date, end_date=end_date)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid data type: {data_type}")
        
        # Export data
        exported = processor.export_data(data, format=format)
        
        # Set appropriate content type
        content_types = {
            'csv': 'text/csv',
            'json': 'application/json',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        
        filename = f"{data_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{format}"
        
        return StreamingResponse(
            io.BytesIO(exported),
            media_type=content_types.get(format, 'application/octet-stream'),
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")