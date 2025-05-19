"""Analytics API routes for the Shopify MCP Server with enhanced security."""

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
        
        # Extract user information
        user_id = payload.get("sub")
        user_role = payload.get("role", "user")
        user_email = payload.get("email")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Create user object
        user = User(
            id=user_id,
            email=user_email,
            role=user_role,
            is_active=True
        )
        
        return user
        
    except InvalidTokenError as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


def get_shopify_api() -> ShopifyAPI:
    """Dependency to get Shopify API instance."""
    # In production, this would use proper configuration
    return ShopifyAPI()


def get_analytics_processor(
    api: ShopifyAPI = Depends(get_shopify_api),
    current_user: User = Depends(get_current_user)
) -> AnalyticsProcessor:
    """Dependency to get analytics processor with user context."""
    logger.info(f"Creating analytics processor for user: {current_user.id}")
    return AnalyticsProcessor(api)


def sanitize_date_input(date_str: Optional[str]) -> Optional[str]:
    """Sanitize and validate date input."""
    if not date_str:
        return None
    
    try:
        # Remove any SQL injection attempts
        if not SQLInjectionProtector.is_safe(date_str):
            raise ValueError("Unsafe date input detected")
        
        # Validate date format
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        
        # Check reasonable date range
        now = datetime.utcnow()
        if dt < now - timedelta(days=365 * 5):  # 5 years ago
            raise ValueError("Date too far in the past")
        if dt > now + timedelta(days=365):  # 1 year in future
            raise ValueError("Date too far in the future")
        
        return dt.isoformat() + 'Z'
    
    except Exception as e:
        logger.error(f"Invalid date input: {date_str} - {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {date_str}"
        )


@router.get("/orders/summary")
@RBACChecker.require_permission("analytics:read")
async def get_order_summary(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    group_by: str = Query("day", description="Grouping period: day, week, month"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get order summary data grouped by time period."""
    logger.info(f"User {current_user.id} requesting order summary")
    
    try:
        # Sanitize inputs
        start_date = sanitize_date_input(start_date)
        end_date = sanitize_date_input(end_date)
        
        # Validate group_by parameter
        if group_by not in ['day', 'week', 'month']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid group_by parameter. Must be: day, week, or month"
            )
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat() + 'Z'
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat() + 'Z'
        
        # Get data
        data = processor.get_order_summary(
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        
        # Sanitize response data
        sanitized_data = DataSanitizer.sanitize_data(data)
        
        logger.info(f"Successfully fetched order summary for user {current_user.id}")
        return sanitized_data
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Value error in order summary: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching order summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch order summary"
        )


@router.get("/sales/by-category")
@RBACChecker.require_permission("analytics:read")
async def get_category_sales(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get sales data by product category."""
    logger.info(f"User {current_user.id} requesting category sales")
    
    try:
        # Sanitize inputs
        start_date = sanitize_date_input(start_date)
        end_date = sanitize_date_input(end_date)
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat() + 'Z'
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat() + 'Z'
        
        data = processor.get_category_sales(
            start_date=start_date,
            end_date=end_date
        )
        
        # Sanitize response
        sanitized_data = DataSanitizer.sanitize_data(data)
        
        return {"data": sanitized_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching category sales: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch category sales"
        )


@router.get("/sales/trend")
@RBACChecker.require_permission("analytics:read")
async def get_sales_trend(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    compare_previous: bool = Query(True, description="Include previous year comparison"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get sales trend data with optional year-over-year comparison."""
    logger.info(f"User {current_user.id} requesting sales trend")
    
    try:
        # Sanitize inputs
        start_date = sanitize_date_input(start_date)
        end_date = sanitize_date_input(end_date)
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat() + 'Z'
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat() + 'Z'
        
        data = processor.get_sales_trend(
            start_date=start_date,
            end_date=end_date,
            compare_previous=compare_previous
        )
        
        # Sanitize response
        sanitized_data = DataSanitizer.sanitize_data(data)
        
        return sanitized_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sales trend: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sales trend"
        )


@router.get("/sales/geographic")
@RBACChecker.require_permission("analytics:read")
async def get_geographic_distribution(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Get sales distribution by geographic location."""
    logger.info(f"User {current_user.id} requesting geographic distribution")
    
    try:
        # Sanitize inputs
        start_date = sanitize_date_input(start_date)
        end_date = sanitize_date_input(end_date)
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat() + 'Z'
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat() + 'Z'
        
        data = processor.get_geographic_distribution(
            start_date=start_date,
            end_date=end_date
        )
        
        # Sanitize response
        sanitized_data = DataSanitizer.sanitize_data(data)
        
        return {"data": sanitized_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching geographic data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch geographic data"
        )


@router.get("/export/{data_type}")
@RBACChecker.require_permission("analytics:export")
async def export_data(
    data_type: str,
    format: str = Query("csv", description="Export format: csv, json, excel"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    processor: AnalyticsProcessor = Depends(get_analytics_processor),
    current_user: User = Depends(get_current_user)
):
    """Export analytics data in specified format."""
    logger.info(f"User {current_user.id} exporting {data_type} as {format}")
    
    try:
        # Sanitize inputs
        start_date = sanitize_date_input(start_date)
        end_date = sanitize_date_input(end_date)
        
        # Validate export format
        if format not in ['csv', 'json', 'excel']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid format. Must be: csv, json, or excel"
            )
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow().isoformat() + 'Z'
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat() + 'Z'
        
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid data type: {data_type}"
            )
        
        # Sanitize data before export
        sanitized_data = DataSanitizer.sanitize_export_data(data)
        
        # Export data
        exported = processor.export_data(sanitized_data, format=format)
        
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
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Content-Type-Options": "nosniff"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export data"
        )