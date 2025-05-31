"""FastAPI routes for Google Analytics integration."""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
import uuid
from datetime import datetime

from ..schemas import (
    GoogleAnalyticsConnectionRequest,
    GoogleAnalyticsConnectionResponse,
    StandardReportRequest,
    StandardReportResponse,
    RealtimeReportRequest,
    RealtimeReportResponse,
    PropertyResponse,
    ErrorResponse
)
from ..schemas.property import PropertiesListResponse
from ..schemas.reports import ReportRow
from ..service import GoogleAnalyticsService
from ..cache import AnalyticsCache
from ..models import GoogleAnalyticsConnection
from ..config import GoogleAnalyticsConfig, RedisConfig
from ..utils.errors import (
    GoogleAnalyticsError,
    AuthenticationError,
    APIError,
    PropertyNotFoundError
)

router = APIRouter(prefix="/google-analytics", tags=["Google Analytics"])

# Service instances
_ga_service: Optional[GoogleAnalyticsService] = None
_cache: Optional[AnalyticsCache] = None


def get_ga_service() -> GoogleAnalyticsService:
    """Get or create GA service instance."""
    global _ga_service
    if _ga_service is None:
        config = GoogleAnalyticsConfig()
        _ga_service = GoogleAnalyticsService(config)
    return _ga_service


def get_cache() -> AnalyticsCache:
    """Get or create cache instance."""
    global _cache
    if _cache is None:
        redis_config = RedisConfig()
        _cache = AnalyticsCache(redis_config)
    return _cache


@router.post(
    "/connect",
    response_model=GoogleAnalyticsConnectionResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)
async def connect_google_analytics(
    request: GoogleAnalyticsConnectionRequest,
    ga_service: GoogleAnalyticsService = Depends(get_ga_service)
) -> GoogleAnalyticsConnectionResponse:
    """Connect to Google Analytics using service account."""
    try:
        # Create connection
        connection_id = str(uuid.uuid4())
        
        # Initialize service with credentials
        ga_service.initialize_service(request.service_account_json)
        
        # Test connection by listing properties
        properties = ga_service.list_properties()
        
        # Store connection
        connection = GoogleAnalyticsConnection(
            connection_id=connection_id,
            service_account_info=request.service_account_json,
            created_at=datetime.utcnow()
        )
        
        # TODO: Store connection in database
        
        return GoogleAnalyticsConnectionResponse(
            connection_id=connection_id,
            status="connected",
            properties_count=len(properties),
            created_at=connection.created_at.isoformat(),
            metadata=request.metadata
        )
    
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except GoogleAnalyticsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Connection failed: {str(e)}"
        )


@router.get(
    "/properties",
    response_model=PropertiesListResponse,
    responses={
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)
async def list_properties(
    connection_id: str,
    ga_service: GoogleAnalyticsService = Depends(get_ga_service)
) -> PropertiesListResponse:
    """List all accessible Google Analytics properties."""
    try:
        # TODO: Load connection from database by connection_id
        # For now, assume service is already initialized
        
        properties = ga_service.list_properties()
        
        property_responses = [
            PropertyResponse(
                property_id=prop.name,
                display_name=prop.displayName,
                property_type=prop.propertyType,
                time_zone=prop.timeZone,
                currency_code=prop.currencyCode,
                industry_category=prop.industryCategory,
                created_time=prop.createTime.isoformat() if prop.createTime else "",
                parent=prop.parent
            )
            for prop in properties
        ]
        
        return PropertiesListResponse(
            properties=property_responses,
            count=len(property_responses)
        )
    
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list properties: {str(e)}"
        )


@router.post(
    "/reports/standard",
    response_model=StandardReportResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)
async def create_standard_report(
    request: StandardReportRequest,
    connection_id: str,
    ga_service: GoogleAnalyticsService = Depends(get_ga_service),
    cache: AnalyticsCache = Depends(get_cache)
) -> StandardReportResponse:
    """Create standard Google Analytics report."""
    try:
        # Check cache first
        cached_report = cache.get_report(
            property_id=request.property_id,
            report_type="standard",
            params=request.dict()
        )
        
        if cached_report:
            return StandardReportResponse(**cached_report)
        
        # TODO: Load connection from database by connection_id
        
        # Build report request
        report_request = ga_service.build_standard_report_request(
            property_id=request.property_id,
            date_range=(request.date_range.startDate, request.date_range.endDate),
            dimensions=[d.name for d in request.dimensions],
            metrics=[m.name for m in request.metrics]
        )
        
        # Run report
        report = ga_service.run_standard_report(request.property_id, report_request)
        
        # Generate report ID
        report_id = str(uuid.uuid4())
        
        # Process report rows
        rows = []
        for row in report.rows:
            row_data = ReportRow(
                dimensions={dim.name: value.value for dim, value in zip(report.dimensionHeaders, row.dimensionValues)},
                metrics={metric.name: value.value for metric, value in zip(report.metricHeaders, row.metricValues)}
            )
            rows.append(row_data)
        
        response = StandardReportResponse(
            report_id=report_id,
            property_id=request.property_id,
            date_range=request.date_range,
            rows=rows,
            row_count=len(rows),
            metadata={
                "cache_hit": False,
                "total_rows": report.rowCount,
                "dimension_headers": [h.name for h in report.dimensionHeaders],
                "metric_headers": [h.name for h in report.metricHeaders]
            },
            created_at=datetime.utcnow().isoformat()
        )
        
        # Cache the report
        cache.set_report(
            property_id=request.property_id,
            report_type="standard",
            params=request.dict(),
            data=response.dict()
        )
        
        return response
    
    except PropertyNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except GoogleAnalyticsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {str(e)}"
        )


@router.post(
    "/reports/realtime",
    response_model=RealtimeReportResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)
async def create_realtime_report(
    request: RealtimeReportRequest,
    connection_id: str,
    ga_service: GoogleAnalyticsService = Depends(get_ga_service),
    cache: AnalyticsCache = Depends(get_cache)
) -> RealtimeReportResponse:
    """Create realtime Google Analytics report."""
    try:
        # Check cache first
        cached_report = cache.get_report(
            property_id=request.property_id,
            report_type="realtime",
            params=request.dict()
        )
        
        if cached_report:
            return RealtimeReportResponse(**cached_report)
        
        # TODO: Load connection from database by connection_id
        
        # Build report request
        report_request = ga_service.build_realtime_report_request(
            property_id=request.property_id,
            dimensions=[d.name for d in request.dimensions],
            metrics=[m.name for m in request.metrics]
        )
        
        # Run report
        report = ga_service.run_realtime_report(request.property_id, report_request)
        
        # Generate report ID
        report_id = str(uuid.uuid4())
        
        # Process report rows
        rows = []
        for row in report.rows:
            row_data = ReportRow(
                dimensions={dim.name: value.value for dim, value in zip(report.dimensionHeaders, row.dimensionValues)},
                metrics={metric.name: value.value for metric, value in zip(report.metricHeaders, row.metricValues)}
            )
            rows.append(row_data)
        
        response = RealtimeReportResponse(
            report_id=report_id,
            property_id=request.property_id,
            rows=rows,
            row_count=len(rows),
            metadata={
                "cache_hit": False,
                "total_rows": report.rowCount,
                "dimension_headers": [h.name for h in report.dimensionHeaders],
                "metric_headers": [h.name for h in report.metricHeaders]
            },
            created_at=datetime.utcnow().isoformat()
        )
        
        # Cache the report with shorter TTL for realtime data
        cache.set_report(
            property_id=request.property_id,
            report_type="realtime",
            params=request.dict(),
            data=response.dict()
        )
        
        return response
    
    except PropertyNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except GoogleAnalyticsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Realtime report generation failed: {str(e)}"
        )


@router.get(
    "/reports/{report_id}",
    response_model=StandardReportResponse,
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)
async def get_report(
    report_id: str,
    ga_service: GoogleAnalyticsService = Depends(get_ga_service)
) -> StandardReportResponse:
    """Get previously generated report by ID."""
    try:
        # TODO: Implement report storage and retrieval
        # For now, return not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve report: {str(e)}"
        )


@router.post(
    "/cache/invalidate/{property_id}",
    responses={
        200: {"description": "Cache invalidated successfully"},
        500: {"model": ErrorResponse}
    }
)
async def invalidate_property_cache(
    property_id: str,
    cache: AnalyticsCache = Depends(get_cache)
) -> dict:
    """Invalidate cache for a specific property."""
    try:
        deleted_count = cache.invalidate_property_cache(property_id)
        return {
            "message": "Cache invalidated successfully",
            "deleted_entries": deleted_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to invalidate cache: {str(e)}"
        )


@router.get(
    "/cache/stats",
    responses={
        200: {"description": "Cache statistics"},
        500: {"model": ErrorResponse}
    }
)
async def get_cache_stats(
    cache: AnalyticsCache = Depends(get_cache)
) -> dict:
    """Get cache statistics."""
    try:
        return cache.get_cache_stats()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get cache stats: {str(e)}"
        )