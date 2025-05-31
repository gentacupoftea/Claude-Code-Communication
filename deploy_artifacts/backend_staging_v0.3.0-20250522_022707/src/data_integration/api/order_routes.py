from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from ..schemas.integration import IntegratedOrder
from ..schemas.request import SyncRequest, QueryRequest
from ..schemas.response import (
    BaseResponse,
    PaginatedResponse,
    create_success_response,
    create_error_response
)
from ..services.order_service import OrderService
from ..auth import get_current_user


router = APIRouter(tags=["orders"])


# Dependencies
async def get_order_service() -> OrderService:
    """注文サービスの取得"""
    return OrderService()


# Order Endpoints
@router.get("/", response_model=PaginatedResponse[List[IntegratedOrder]])
async def get_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    service: OrderService = Depends(get_order_service),
    current_user: Dict = Depends(get_current_user)
) -> PaginatedResponse[List[IntegratedOrder]]:
    """
    注文一覧を取得
    """
    try:
        filters = {}
        if start_date:
            filters["created_at_gte"] = start_date
        if end_date:
            filters["created_at_lte"] = end_date
        if status:
            filters["status"] = status
        if customer_id:
            filters["customer_id"] = customer_id
        if source:
            filters["source"] = source
        
        result = await service.get_orders(
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


@router.get("/{order_id}", response_model=BaseResponse[IntegratedOrder])
async def get_order(
    order_id: str,
    service: OrderService = Depends(get_order_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse[IntegratedOrder]:
    """
    指定のIDの注文を取得
    """
    try:
        order = await service.get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return create_success_response(order)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync")
async def sync_orders(
    request: SyncRequest,
    service: OrderService = Depends(get_order_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    注文データを同期
    """
    try:
        result = await service.sync_orders(
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


@router.get("/stats/summary")
async def get_order_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    group_by: str = Query("day", regex="^(hour|day|week|month)$"),
    service: OrderService = Depends(get_order_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    注文サマリーを取得
    """
    try:
        summary = await service.get_order_summary(
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        return create_success_response(summary)
    except Exception as e:
        return create_error_response(
            error_code="SUMMARY_ERROR",
            error_message=str(e)
        )


@router.get("/stats/revenue")
async def get_revenue_stats(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    dimension: str = Query("total", regex="^(total|channel|product|customer)$"),
    service: OrderService = Depends(get_order_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    売上統計を取得
    """
    try:
        stats = await service.get_revenue_stats(
            start_date=start_date,
            end_date=end_date,
            dimension=dimension
        )
        return create_success_response(stats)
    except Exception as e:
        return create_error_response(
            error_code="STATS_ERROR",
            error_message=str(e)
        )


@router.get("/customer/{customer_id}/orders")
async def get_customer_orders(
    customer_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    service: OrderService = Depends(get_order_service),
    current_user: Dict = Depends(get_current_user)
) -> PaginatedResponse[List[IntegratedOrder]]:
    """
    顧客の注文履歴を取得
    """
    try:
        result = await service.get_customer_orders(
            customer_id=customer_id,
            page=page,
            page_size=page_size
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


@router.post("/export")
async def export_orders(
    format: str = Query("csv", regex="^(csv|json|excel)$"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    fields: Optional[List[str]] = Query(None),
    service: OrderService = Depends(get_order_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    注文データをエクスポート
    """
    try:
        export_url = await service.export_orders(
            format=format,
            start_date=start_date,
            end_date=end_date,
            fields=fields
        )
        return create_success_response({"export_url": export_url})
    except Exception as e:
        return create_error_response(
            error_code="EXPORT_ERROR",
            error_message=str(e)
        )