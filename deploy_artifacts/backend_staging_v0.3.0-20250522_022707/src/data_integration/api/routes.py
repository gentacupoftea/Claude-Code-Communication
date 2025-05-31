from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from ..schemas.request import (
    AnalyticsRequest, 
    IntegrationRequest,
    SyncRequest,
    QueryRequest
)
from ..schemas.response import (
    BaseResponse,
    AnalyticsResponse,
    IntegrationResponse,
    SyncResponse,
    QueryResponse,
    ErrorResponse,
    create_success_response,
    create_error_response
)
from ..services.integration_service import IntegrationService
from ..services.analytics_service import AnalyticsService
from ..config import get_settings
from ..auth import get_current_user


router = APIRouter(prefix="/api/v1/integration", tags=["integration"])


# Dependencies
async def get_integration_service() -> IntegrationService:
    """統合サービスの取得"""
    return IntegrationService()


async def get_analytics_service() -> AnalyticsService:
    """分析サービスの取得"""
    return AnalyticsService()


# Health Check
@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """ヘルスチェック"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


# Integration Endpoints
@router.post("/sync", response_model=SyncResponse)
async def sync_data(
    request: SyncRequest,
    service: IntegrationService = Depends(get_integration_service),
    current_user: Dict = Depends(get_current_user)
) -> SyncResponse:
    """
    データ同期を実行
    """
    try:
        sync_result = await service.sync_data(
            sources=request.sources,
            entity_types=request.entity_types,
            sync_mode=request.sync_mode,
            start_date=request.start_date,
            end_date=request.end_date,
            batch_size=request.batch_size
        )
        
        return SyncResponse(
            sync_id=uuid.uuid4(),
            status="completed",
            started_at=datetime.now(),
            sources_synced=request.sources,
            entities_synced=request.entity_types,
            **sync_result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transform", response_model=BaseResponse)
async def transform_data(
    source_format: str,
    target_format: str,
    data: Dict[str, Any],
    service: IntegrationService = Depends(get_integration_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    データ変換を実行
    """
    try:
        result = await service.transform_data(
            source_format=source_format,
            target_format=target_format,
            data=data
        )
        return create_success_response(result)
    except Exception as e:
        return create_error_response(
            error_code="TRANSFORM_ERROR",
            error_message=str(e)
        )


@router.get("/query", response_model=QueryResponse)
async def query_data(
    request: QueryRequest = Depends(),
    service: IntegrationService = Depends(get_integration_service),
    current_user: Dict = Depends(get_current_user)
) -> QueryResponse:
    """
    データをクエリ
    """
    try:
        result = await service.query_data(
            entity_type=request.entity_type,
            filters=request.filters,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            page=request.page,
            page_size=request.page_size
        )
        
        return QueryResponse(
            status="success",
            data=result["data"],
            page=request.page,
            page_size=request.page_size,
            total_count=result["total_count"],
            total_pages=result["total_pages"],
            has_next=result["has_next"],
            has_previous=result["has_previous"],
            query_time_ms=result["query_time_ms"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Analytics Endpoints
@router.post("/analytics", response_model=AnalyticsResponse)
async def analyze_data(
    request: AnalyticsRequest,
    service: AnalyticsService = Depends(get_analytics_service),
    current_user: Dict = Depends(get_current_user)
) -> AnalyticsResponse:
    """
    データ分析を実行
    """
    try:
        start_time = datetime.now()
        
        # 分析タイプに基づいて実行
        if request.analysis_type == "performance":
            result = await service.analyze_performance(request.performance)
        elif request.analysis_type == "cohort":
            result = await service.analyze_cohort(request.cohort)
        elif request.analysis_type == "funnel":
            result = await service.analyze_funnel(request.funnel)
        elif request.analysis_type == "ltv":
            result = await service.analyze_ltv(request.ltv)
        else:
            raise ValueError(f"Unknown analysis type: {request.analysis_type}")
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return AnalyticsResponse(
            analysis_type=request.analysis_type,
            analysis_id=uuid.uuid4(),
            status="success",
            execution_time_ms=execution_time,
            result=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/reports")
async def get_reports(
    report_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    service: AnalyticsService = Depends(get_analytics_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    レポート一覧を取得
    """
    try:
        reports = await service.get_reports(
            report_type=report_type,
            start_date=start_date,
            end_date=end_date
        )
        return create_success_response(reports)
    except Exception as e:
        return create_error_response(
            error_code="REPORT_ERROR",
            error_message=str(e)
        )


# Integration Status
@router.get("/status/{integration_id}")
async def get_integration_status(
    integration_id: str,
    service: IntegrationService = Depends(get_integration_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    統合ステータスを取得
    """
    try:
        status = await service.get_integration_status(integration_id)
        return create_success_response(status)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# Data Sources
@router.get("/sources")
async def get_data_sources(
    service: IntegrationService = Depends(get_integration_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    利用可能なデータソースを取得
    """
    try:
        sources = await service.get_available_sources()
        return create_success_response(sources)
    except Exception as e:
        return create_error_response(
            error_code="SOURCE_ERROR",
            error_message=str(e)
        )


# Entity Types
@router.get("/entities")
async def get_entity_types(
    source: Optional[str] = Query(None),
    service: IntegrationService = Depends(get_integration_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    利用可能なエンティティタイプを取得
    """
    try:
        entities = await service.get_entity_types(source)
        return create_success_response(entities)
    except Exception as e:
        return create_error_response(
            error_code="ENTITY_ERROR",
            error_message=str(e)
        )


# Webhook Endpoint
@router.post("/webhook/{source}")
async def handle_webhook(
    source: str,
    payload: Dict[str, Any],
    service: IntegrationService = Depends(get_integration_service)
) -> Dict[str, Any]:
    """
    Webhookを処理
    """
    try:
        result = await service.handle_webhook(
            source=source,
            payload=payload
        )
        return {"status": "success", "acknowledged": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Include sub-routers
from .order_routes import router as order_router
from .customer_routes import router as customer_router
from .marketing_routes import router as marketing_router

router.include_router(order_router, prefix="/orders")
router.include_router(customer_router, prefix="/customers")
router.include_router(marketing_router, prefix="/marketing")