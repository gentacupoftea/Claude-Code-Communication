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
from ..models import GoogleAnalyticsConnection, GAReport, GAReportData, GAReportStorage
from ..database import SessionLocal, get_db
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
        
        # Store connection in database
        db = SessionLocal()
        try:
            db_connection = GoogleAnalyticsConnection(
                connection_id=connection_id,
                user_id=request.metadata.get('user_id', 'anonymous'),
                connection_name=request.metadata.get('name', f'GA Connection {connection_id[:8]}'),
                description=request.metadata.get('description', 'Google Analytics connection'),
                property_ids=[prop.name for prop in properties],
                default_property_id=properties[0].name if properties else None,
                settings=request.metadata or {}
            )
            
            # Store encrypted service account JSON
            db_connection.set_service_account_json(request.service_account_json)
            db_connection.mark_as_validated(True)
            
            db.add(db_connection)
            db.commit()
            db.refresh(db_connection)
            
            logger.info(f\"Stored GA connection {connection_id} in database\")
            
        except Exception as e:
            db.rollback()
            logger.error(f\"Failed to store GA connection: {e}\")
            # Continue without database storage for now
        finally:
            db.close()
        
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
        # Load connection from database by connection_id
        db = SessionLocal()
        try:
            db_connection = db.query(GoogleAnalyticsConnection).filter(
                GoogleAnalyticsConnection.connection_id == connection_id
            ).first()
            
            if not db_connection:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f\"Connection {connection_id} not found\"
                )
            
            # Initialize service with stored credentials
            service_account_json = db_connection.get_service_account_json()
            if service_account_json:
                ga_service.initialize_service(service_account_json)
                db_connection.update_last_used()
                db.commit()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=\"No credentials found for connection\"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f\"Failed to load connection {connection_id}: {e}\")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=\"Failed to load connection\"
            )
        finally:
            db.close()
        
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
        
        # Load connection from database by connection_id
        db = SessionLocal()
        db_connection = None
        try:
            db_connection = db.query(GoogleAnalyticsConnection).filter(
                GoogleAnalyticsConnection.connection_id == connection_id
            ).first()
            
            if not db_connection:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f\"Connection {connection_id} not found\"
                )
            
            # Initialize service with stored credentials
            service_account_json = db_connection.get_service_account_json()
            if service_account_json:
                ga_service.initialize_service(service_account_json)
                db_connection.update_last_used()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=\"No credentials found for connection\"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f\"Failed to load connection {connection_id}: {e}\")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=\"Failed to load connection\"
            )
        
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
        
        # Store report in database for persistence
        try:
            # Create report record
            db_report = GAReport(
                report_id=report_id,
                connection_id=connection_id,
                user_id=db_connection.user_id if db_connection else 'anonymous',
                report_name=f\"Standard Report - {request.property_id}\",
                report_type=\"standard\",
                property_id=request.property_id,
                date_range=request.date_range.dict(),
                dimensions=[d.dict() for d in request.dimensions],
                metrics=[m.dict() for m in request.metrics],
                status=\"completed\",
                row_count=len(rows)
            )
            
            # Calculate data size
            data_size = GAReportStorage.estimate_storage_size([row.dict() for row in rows])
            db_report.data_size_bytes = data_size
            should_compress = GAReportStorage.should_compress(data_size)
            
            db.add(db_report)
            db.flush()  # Get the report ID
            
            # Store report data rows
            for idx, row in enumerate(rows):
                report_data = GAReportData(
                    report_id=db_report.id,
                    row_index=idx
                )
                report_data.set_data(
                    dimensions=row.dimensions, 
                    metrics=row.metrics,
                    compress=should_compress
                )
                db.add(report_data)
            
            db.commit()
            logger.info(f\"Stored report {report_id} with {len(rows)} rows in database\")
            
        except Exception as e:
            db.rollback()
            logger.error(f\"Failed to store report in database: {e}\")
            # Continue without database storage
        finally:
            db.close()
        
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
        # Retrieve report from database
        db = SessionLocal()
        try:
            # Get report metadata
            db_report = db.query(GAReport).filter(
                GAReport.report_id == report_id
            ).first()
            
            if not db_report:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Report {report_id} not found"
                )
            
            # Get report data
            report_data_rows = db.query(GAReportData).filter(
                GAReportData.report_id == db_report.id
            ).order_by(GAReportData.row_index).all()
            
            # Convert to response format
            rows = []
            for data_row in report_data_rows:
                row_data = data_row.get_data()
                rows.append(ReportRow(
                    dimensions=row_data['dimensions'],
                    metrics=row_data['metrics']
                ))
            
            # Build response
            response = StandardReportResponse(
                report_id=report_id,
                property_id=db_report.property_id,
                date_range=db_report.date_range,
                rows=rows,
                row_count=len(rows),
                metadata={
                    "cache_hit": False,
                    "total_rows": db_report.row_count,
                    "stored_in_db": True,
                    "data_size_bytes": db_report.data_size_bytes,
                    "report_status": db_report.status
                },
                created_at=db_report.created_at.isoformat() if db_report.created_at else None
            )
            
            return response
            
        finally:
            db.close()
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