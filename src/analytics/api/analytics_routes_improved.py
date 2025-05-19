"""Analytics API routes for the Shopify MCP Server."""

from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io
import logging

from ...api.shopify_api import ShopifyAPI
from ..dashboard.analytics_processor import AnalyticsProcessor
from ...auth.models import User
from ...auth.permissions import PermissionChecker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

# Dependency for authentication and permissions
permission_checker = PermissionChecker()

def get_shopify_api() -> ShopifyAPI:
    """Dependency to get Shopify API instance."""
    # TODO: This should be configured with proper credentials from environment
    # For now, return a configured instance
    return ShopifyAPI()


def get_analytics_processor(
    api: ShopifyAPI = Depends(get_shopify_api),
    current_user: User = Depends(permission_checker.get_current_user)
) -> AnalyticsProcessor:
    """Dependency to get analytics processor with user context."""
    # Check if user has analytics permissions
    permission_checker.check_permission(current_user, "analytics:read")
    return AnalyticsProcessor(api)


def parse_date_range(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> tuple[str, str]:
    """Parse and validate date range parameters."""
    # Set default end date to now
    if not end_date:
        end_date = datetime.utcnow().isoformat() + 'Z'
    
    # Set default start date to 30 days ago
    if not start_date:
        start_date = (datetime.utcnow() - timedelta(days=30)).isoformat() + 'Z'
    
    # Validate date format
    try:
        datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format. Use ISO 8601 format: {str(e)}"
        )
    
    return start_date, end_date


@router.get("/orders/summary")
async def get_order_summary(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    group_by: str = Query("day", description="Grouping period: day, week, month"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(permission_checker.get_current_user)
):
    """Get order summary data grouped by time period."""
    logger.info(f"User {current_user.id} requesting order summary")
    
    try:
        start_date, end_date = parse_date_range(start_date, end_date)
        
        # Validate group_by parameter
        if group_by not in ['day', 'week', 'month']:
            raise HTTPException(
                status_code=400,
                detail="Invalid group_by parameter. Must be: day, week, or month"
            )
        
        data = processor.get_order_summary(
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        
        logger.info(f"Successfully fetched order summary for user {current_user.id}")
        return data
        
    except ValueError as e:
        logger.error(f"Value error in order summary: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching order summary: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch order summary: {str(e)}"
        )


@router.get("/sales/by-category")
async def get_category_sales(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(permission_checker.get_current_user)
):
    """Get sales data by product category."""
    logger.info(f"User {current_user.id} requesting category sales")
    
    try:
        start_date, end_date = parse_date_range(start_date, end_date)
        
        data = processor.get_category_sales(
            start_date=start_date,
            end_date=end_date
        )
        
        return {"data": data}
        
    except Exception as e:
        logger.error(f"Error fetching category sales: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch category sales: {str(e)}"
        )


@router.get("/sales/trend")
async def get_sales_trend(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    compare_previous: bool = Query(True, description="Include previous year comparison"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(permission_checker.get_current_user)
):
    """Get sales trend data with optional year-over-year comparison."""
    logger.info(f"User {current_user.id} requesting sales trend")
    
    try:
        start_date, end_date = parse_date_range(start_date, end_date)
        
        data = processor.get_sales_trend(
            start_date=start_date,
            end_date=end_date,
            compare_previous=compare_previous
        )
        
        return data
        
    except Exception as e:
        logger.error(f"Error fetching sales trend: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch sales trend: {str(e)}"
        )


@router.get("/sales/geographic")
async def get_geographic_distribution(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(permission_checker.get_current_user)
):
    """Get sales distribution by geographic location."""
    logger.info(f"User {current_user.id} requesting geographic distribution")
    
    try:
        start_date, end_date = parse_date_range(start_date, end_date)
        
        data = processor.get_geographic_distribution(
            start_date=start_date,
            end_date=end_date
        )
        
        return {"data": data}
        
    except Exception as e:
        logger.error(f"Error fetching geographic data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch geographic data: {str(e)}"
        )


@router.get("/export/{data_type}")
async def export_data(
    data_type: str,
    format: str = Query("csv", description="Export format: csv, json, excel"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(permission_checker.get_current_user)
):
    """Export analytics data in specified format."""
    logger.info(f"User {current_user.id} exporting {data_type} as {format}")
    
    # Check export permissions
    permission_checker.check_permission(current_user, "analytics:export")
    
    try:
        start_date, end_date = parse_date_range(start_date, end_date)
        
        # Validate export format
        if format not in ['csv', 'json', 'excel']:
            raise HTTPException(
                status_code=400,
                detail="Invalid format. Must be: csv, json, or excel"
            )
        
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
        
        logger.info(f"Successfully exported {data_type} for user {current_user.id}")
        
        return StreamingResponse(
            io.BytesIO(exported),
            media_type=content_types.get(format, 'application/octet-stream'),
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export data: {str(e)}"
        )