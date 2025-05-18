from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from ..schemas.integration import IntegratedCustomer
from ..schemas.request import SyncRequest, QueryRequest
from ..schemas.response import (
    BaseResponse,
    PaginatedResponse,
    create_success_response,
    create_error_response
)
from ..services.customer_service import CustomerService
from ..auth import get_current_user


router = APIRouter(tags=["customers"])


# Dependencies
async def get_customer_service() -> CustomerService:
    """顧客サービスの取得"""
    return CustomerService()


# Customer Endpoints
@router.get("/", response_model=PaginatedResponse[List[IntegratedCustomer]])
async def get_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    tier: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None),
    source: Optional[str] = Query(None),
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> PaginatedResponse[List[IntegratedCustomer]]:
    """
    顧客一覧を取得
    """
    try:
        filters = {}
        if start_date:
            filters["created_at_gte"] = start_date
        if end_date:
            filters["created_at_lte"] = end_date
        if tier:
            filters["tier"] = tier
        if tags:
            filters["tags"] = tags
        if source:
            filters["source"] = source
        
        result = await service.get_customers(
            page=page,
            page_size=page_size,
            filters=filters
        )
        
        return PaginatedResponse(
            status="success",
            data=result["data"],
            page=page,
            page_size=page_size,
            total_count=result["total_count"],
            total_pages=result["total_pages"],
            has_next=result["has_next"],
            has_previous=result["has_previous"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{customer_id}", response_model=BaseResponse[IntegratedCustomer])
async def get_customer(
    customer_id: str,
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse[IntegratedCustomer]:
    """
    指定のIDの顧客を取得
    """
    try:
        customer = await service.get_customer_by_id(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return create_success_response(customer)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync")
async def sync_customers(
    request: SyncRequest,
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    顧客データを同期
    """
    try:
        result = await service.sync_customers(
            sources=request.sources,
            sync_mode=request.sync_mode,
            start_date=request.start_date,
            end_date=request.end_date
        )
        return create_success_response(result)
    except Exception as e:
        return create_error_response(
            error_code="SYNC_ERROR",
            error_message=str(e)
        )


@router.get("/segments/analysis")
async def analyze_segments(
    dimension: str = Query("tier", regex="^(tier|tags|location|behavior)$"),
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    顧客セグメント分析
    """
    try:
        analysis = await service.analyze_segments(dimension=dimension)
        return create_success_response(analysis)
    except Exception as e:
        return create_error_response(
            error_code="ANALYSIS_ERROR",
            error_message=str(e)
        )


@router.get("/stats/summary")
async def get_customer_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    顧客サマリーを取得
    """
    try:
        summary = await service.get_customer_summary(
            start_date=start_date,
            end_date=end_date
        )
        return create_success_response(summary)
    except Exception as e:
        return create_error_response(
            error_code="SUMMARY_ERROR",
            error_message=str(e)
        )


@router.get("/stats/ltv")
async def get_ltv_stats(
    segment: Optional[str] = Query(None),
    prediction_months: int = Query(12, ge=1, le=36),
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    LTV統計を取得
    """
    try:
        stats = await service.get_ltv_stats(
            segment=segment,
            prediction_months=prediction_months
        )
        return create_success_response(stats)
    except Exception as e:
        return create_error_response(
            error_code="LTV_ERROR",
            error_message=str(e)
        )


@router.get("/behavior/patterns")
async def get_behavior_patterns(
    pattern_type: str = Query("purchase", regex="^(purchase|engagement|churn)$"),
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    顧客行動パターンを取得
    """
    try:
        patterns = await service.get_behavior_patterns(pattern_type=pattern_type)
        return create_success_response(patterns)
    except Exception as e:
        return create_error_response(
            error_code="PATTERN_ERROR",
            error_message=str(e)
        )


@router.post("/tags/bulk-update")
async def bulk_update_tags(
    customer_ids: List[str],
    add_tags: Optional[List[str]] = None,
    remove_tags: Optional[List[str]] = None,
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    顧客タグを一括更新
    """
    try:
        result = await service.bulk_update_tags(
            customer_ids=customer_ids,
            add_tags=add_tags,
            remove_tags=remove_tags
        )
        return create_success_response(result)
    except Exception as e:
        return create_error_response(
            error_code="TAG_UPDATE_ERROR",
            error_message=str(e)
        )


@router.post("/tiers/recalculate")
async def recalculate_tiers(
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    顧客ティアを再計算
    """
    try:
        result = await service.recalculate_customer_tiers()
        return create_success_response(result)
    except Exception as e:
        return create_error_response(
            error_code="TIER_CALCULATION_ERROR",
            error_message=str(e)
        )


@router.post("/export")
async def export_customers(
    format: str = Query("csv", regex="^(csv|json|excel)$"),
    include_orders: bool = Query(False),
    fields: Optional[List[str]] = Query(None),
    service: CustomerService = Depends(get_customer_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    顧客データをエクスポート
    """
    try:
        export_url = await service.export_customers(
            format=format,
            include_orders=include_orders,
            fields=fields
        )
        return create_success_response({"export_url": export_url})
    except Exception as e:
        return create_error_response(
            error_code="EXPORT_ERROR",
            error_message=str(e)
        )