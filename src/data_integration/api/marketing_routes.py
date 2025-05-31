from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid

from ..schemas.integration import IntegratedCampaign
from ..schemas.request import SyncRequest, QueryRequest
from ..schemas.response import (
    BaseResponse,
    PaginatedResponse,
    create_success_response,
    create_error_response
)
from ..services.marketing_service import MarketingService
from ..auth import get_current_user


router = APIRouter(tags=["marketing"])


# Dependencies
async def get_marketing_service() -> MarketingService:
    """マーケティングサービスの取得"""
    return MarketingService()


# Campaign Endpoints
@router.get("/campaigns", response_model=PaginatedResponse[List[IntegratedCampaign]])
async def get_campaigns(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    platform: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> PaginatedResponse[List[IntegratedCampaign]]:
    """
    キャンペーン一覧を取得
    """
    try:
        filters = {}
        if platform:
            filters["platform"] = platform
        if status:
            filters["status"] = status
        if start_date:
            filters["start_date_gte"] = start_date
        if end_date:
            filters["end_date_lte"] = end_date
        
        result = await service.get_campaigns(
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


@router.get("/campaigns/{campaign_id}", response_model=BaseResponse[IntegratedCampaign])
async def get_campaign(
    campaign_id: str,
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse[IntegratedCampaign]:
    """
    指定のIDのキャンペーンを取得
    """
    try:
        campaign = await service.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return create_success_response(campaign)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/campaigns/sync")
async def sync_campaigns(
    request: SyncRequest,
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    キャンペーンデータを同期
    """
    try:
        result = await service.sync_campaigns(
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


@router.get("/performance/overview")
async def get_performance_overview(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    platform: Optional[str] = Query(None),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    マーケティングパフォーマンス概要を取得
    """
    try:
        overview = await service.get_performance_overview(
            start_date=start_date,
            end_date=end_date,
            platform=platform
        )
        return create_success_response(overview)
    except Exception as e:
        return create_error_response(
            error_code="PERFORMANCE_ERROR",
            error_message=str(e)
        )


@router.get("/performance/comparison")
async def compare_performance(
    period_1_start: datetime = Query(...),
    period_1_end: datetime = Query(...),
    period_2_start: datetime = Query(...),
    period_2_end: datetime = Query(...),
    metrics: List[str] = Query(["revenue", "conversions", "roas"]),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    パフォーマンス期間比較
    """
    try:
        comparison = await service.compare_performance(
            period_1=(period_1_start, period_1_end),
            period_2=(period_2_start, period_2_end),
            metrics=metrics
        )
        return create_success_response(comparison)
    except Exception as e:
        return create_error_response(
            error_code="COMPARISON_ERROR",
            error_message=str(e)
        )


@router.get("/attribution/analysis")
async def get_attribution_analysis(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    model: str = Query("last_click", regex="^(last_click|first_click|linear|time_decay)$"),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    アトリビューション分析を取得
    """
    try:
        analysis = await service.get_attribution_analysis(
            start_date=start_date,
            end_date=end_date,
            model=model
        )
        return create_success_response(analysis)
    except Exception as e:
        return create_error_response(
            error_code="ATTRIBUTION_ERROR",
            error_message=str(e)
        )


@router.get("/roi/analysis")
async def get_roi_analysis(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    group_by: str = Query("platform", regex="^(platform|campaign|week|month)$"),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    ROI分析を取得
    """
    try:
        analysis = await service.get_roi_analysis(
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        return create_success_response(analysis)
    except Exception as e:
        return create_error_response(
            error_code="ROI_ERROR",
            error_message=str(e)
        )


@router.get("/audience/insights")
async def get_audience_insights(
    platform: Optional[str] = Query(None),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    オーディエンスインサイトを取得
    """
    try:
        insights = await service.get_audience_insights(platform=platform)
        return create_success_response(insights)
    except Exception as e:
        return create_error_response(
            error_code="AUDIENCE_ERROR",
            error_message=str(e)
        )


@router.post("/segments/create")
async def create_audience_segment(
    name: str,
    criteria: Dict[str, Any],
    platforms: List[str],
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    オーディエンスセグメントを作成
    """
    try:
        segment = await service.create_audience_segment(
            name=name,
            criteria=criteria,
            platforms=platforms
        )
        return create_success_response(segment)
    except Exception as e:
        return create_error_response(
            error_code="SEGMENT_CREATE_ERROR",
            error_message=str(e)
        )


@router.get("/forecast")
async def get_marketing_forecast(
    forecast_days: int = Query(30, ge=1, le=365),
    metrics: List[str] = Query(["revenue", "conversions", "spend"]),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    マーケティング予測を取得
    """
    try:
        forecast = await service.get_forecast(
            forecast_days=forecast_days,
            metrics=metrics
        )
        return create_success_response(forecast)
    except Exception as e:
        return create_error_response(
            error_code="FORECAST_ERROR",
            error_message=str(e)
        )


@router.post("/recommendations/generate")
async def generate_recommendations(
    optimization_goal: str = Query("revenue", regex="^(revenue|conversions|efficiency)$"),
    budget_constraint: Optional[float] = Query(None),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    最適化提案を生成
    """
    try:
        recommendations = await service.generate_recommendations(
            optimization_goal=optimization_goal,
            budget_constraint=budget_constraint
        )
        return create_success_response(recommendations)
    except Exception as e:
        return create_error_response(
            error_code="RECOMMENDATION_ERROR",
            error_message=str(e)
        )


@router.post("/reports/generate")
async def generate_marketing_report(
    report_type: str = Query(..., regex="^(performance|roi|attribution|audience)$"),
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    format: str = Query("pdf", regex="^(pdf|excel|powerpoint)$"),
    service: MarketingService = Depends(get_marketing_service),
    current_user: Dict = Depends(get_current_user)
) -> BaseResponse:
    """
    マーケティングレポートを生成
    """
    try:
        report_url = await service.generate_report(
            report_type=report_type,
            start_date=start_date,
            end_date=end_date,
            format=format
        )
        return create_success_response({"report_url": report_url})
    except Exception as e:
        return create_error_response(
            error_code="REPORT_ERROR",
            error_message=str(e)
        )