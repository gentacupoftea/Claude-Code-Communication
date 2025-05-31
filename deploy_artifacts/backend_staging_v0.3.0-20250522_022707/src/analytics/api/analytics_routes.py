"""Analytics API routes for the Shopify MCP Server with enhanced security and export functionality."""

import logging
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Query, Depends, HTTPException, Header, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import io
import jwt
from jwt.exceptions import InvalidTokenError

from ...api.shopify_api import ShopifyAPI
from ..dashboard.analytics_processor import AnalyticsProcessor
from ..security.data_sanitizer import DataSanitizer, SQLInjectionProtector
from ...auth.models import User
from ...auth.security import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])
security = HTTPBearer()

# Security headers middleware
@router.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


class RBACChecker:
    """Role-Based Access Control checker."""
    
    PERMISSIONS = {
        "admin": ["analytics:read", "analytics:export", "analytics:admin"],
        "manager": ["analytics:read", "analytics:export"],
        "user": ["analytics:read"],
        "viewer": ["analytics:read"],
    }
    
    @classmethod
    def has_permission(cls, user: User, permission: str) -> bool:
        """Check if user has specific permission."""
        if not user or not user.role:
            return False
        
        role_permissions = cls.PERMISSIONS.get(user.role, [])
        return permission in role_permissions
    
    @classmethod
    def require_permission(cls, permission: str):
        """Decorator to require specific permission."""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                user = kwargs.get('current_user')
                if not cls.has_permission(user, permission):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission denied: {permission} required"
                    )
                return await func(*args, **kwargs)
            return wrapper
        return decorator


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Get current authenticated user from JWT token."""
    try:
        # Decode JWT token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        # Create user object from payload
        user = User(
            id=payload.get("sub"),
            email=payload.get("email"),
            role=payload.get("role", "user")
        )
        
        return user
    except InvalidTokenError as e:
        logger.error(f"Invalid token error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )


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
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get order summary data grouped by time period."""
    # Check permissions
    if not RBACChecker.has_permission(current_user, "analytics:read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: analytics:read required"
        )
    
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
        logger.error(f"Error fetching order summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch order summary: {str(e)}")


@router.get("/sales/analysis")
async def get_sales_analysis(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get sales analysis with revenue breakdown."""
    # Check permissions
    if not RBACChecker.has_permission(current_user, "analytics:read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: analytics:read required"
        )
    
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
        
        data = processor.get_sales_analysis(
            start_date=start_date,
            end_date=end_date
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching sales analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch sales analysis: {str(e)}")


@router.get("/export/{data_type}")
@RBACChecker.require_permission("analytics:export")
async def export_data(
    data_type: str,
    format: str = Query("csv", description="Export format: csv, json, excel, pdf"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
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
        elif data_type == "sales":
            data = processor.get_sales_analysis(start_date=start_date, end_date=end_date)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid data type: {data_type}")
        
        # Export data in requested format
        exported_data = processor.export_data(data, format=format)
        
        # Determine content type and filename
        content_types = {
            'csv': 'text/csv',
            'json': 'application/json',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        }
        
        extensions = {
            'csv': 'csv',
            'json': 'json',
            'excel': 'xlsx',
            'pdf': 'pdf'
        }
        
        filename = f"{data_type}_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{extensions[format]}"
        
        return StreamingResponse(
            io.BytesIO(exported_data),
            media_type=content_types[format],
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")


@router.get("/category-sales")
async def get_category_sales(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get sales by category."""
    # Check permissions
    if not RBACChecker.has_permission(current_user, "analytics:read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: analytics:read required"
        )
    
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
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching category sales: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch category sales: {str(e)}")


@router.get("/geographic-distribution")
async def get_geographic_distribution(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get geographic distribution of sales."""
    # Check permissions
    if not RBACChecker.has_permission(current_user, "analytics:read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: analytics:read required"
        )
    
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
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching geographic distribution: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch geographic distribution: {str(e)}")