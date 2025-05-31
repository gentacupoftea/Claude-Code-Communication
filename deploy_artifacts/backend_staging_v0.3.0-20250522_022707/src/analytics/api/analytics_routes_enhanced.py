"""Enhanced Analytics API routes with PDF export support."""

from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io

from ...api.shopify_api import ShopifyAPI
from ..dashboard.analytics_processor_enhanced import AnalyticsProcessor


router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def get_shopify_api() -> ShopifyAPI:
    """Dependency to get Shopify API instance."""
    return ShopifyAPI()


def get_analytics_processor(api: ShopifyAPI = Depends(get_shopify_api)) -> AnalyticsProcessor:
    """Dependency to get analytics processor."""
    return AnalyticsProcessor(api)


@router.get("/export/{data_type}")
async def export_data(
    data_type: str,
    format: str = Query("csv", description="Export format: csv, json, excel, pdf"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor)
):
    """Export analytics data in specified format including PDF."""
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        # Validate format
        valid_formats = ['csv', 'json', 'excel', 'pdf']
        if format not in valid_formats:
            raise HTTPException(status_code=400, detail=f"Invalid format: {format}. Valid formats: {', '.join(valid_formats)}")
        
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
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        }
        
        filename = f"{data_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{format}"
        
        return StreamingResponse(
            io.BytesIO(exported),
            media_type=content_types.get(format, 'application/octet-stream'),
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(exported))
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")


@router.get("/export/batch/{data_type}")
async def export_batch_data(
    data_type: str,
    formats: str = Query("csv,json", description="Comma-separated list of export formats"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor)
):
    """Export data in multiple formats simultaneously."""
    try:
        format_list = [f.strip() for f in formats.split(',')]
        valid_formats = ['csv', 'json', 'excel', 'pdf']
        
        for fmt in format_list:
            if fmt not in valid_formats:
                raise HTTPException(status_code=400, detail=f"Invalid format: {fmt}")
        
        # Set default date range
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        # Fetch data once
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
        
        # Export to all requested formats
        results = {}
        for fmt in format_list:
            exported = processor.export_data(data, format=fmt)
            results[fmt] = {
                'size': len(exported),
                'filename': f"{data_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{fmt}"
            }
        
        return {
            'status': 'success',
            'data_type': data_type,
            'formats': format_list,
            'results': results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export batch data: {str(e)}")


# Include other routes from original file
# ... (copy other routes)