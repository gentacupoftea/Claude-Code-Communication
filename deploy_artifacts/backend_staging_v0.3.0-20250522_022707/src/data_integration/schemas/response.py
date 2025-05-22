from datetime import datetime
from typing import List, Optional, Dict, Any, Generic, TypeVar
from pydantic import BaseModel, Field, UUID4
from enum import Enum


T = TypeVar('T')


# Status Enums
class ResponseStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL_SUCCESS = "partial_success"
    PENDING = "pending"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Base Response Models
class BaseResponse(BaseModel, Generic[T]):
    """基本レスポンスモデル"""
    status: ResponseStatus
    message: Optional[str] = None
    data: Optional[T] = None
    errors: Optional[List[Dict[str, Any]]] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    request_id: Optional[UUID4] = None


class PaginatedResponse(BaseResponse[T]):
    """ページネーション付きレスポンス"""
    page: int
    page_size: int
    total_count: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ErrorResponse(BaseModel):
    """エラーレスポンス"""
    status: ResponseStatus = ResponseStatus.ERROR
    error_code: str
    error_message: str
    error_details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    request_id: Optional[UUID4] = None


# Integration Response Models
class IntegrationResponse(BaseModel):
    """統合レスポンス"""
    integration_id: UUID4
    status: ResponseStatus
    records_processed: int
    records_succeeded: int
    records_failed: int
    execution_time_ms: float
    errors: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class SyncResponse(BaseModel):
    """同期レスポンス"""
    sync_id: UUID4
    status: TaskStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    sources_synced: List[str]
    entities_synced: List[str]
    total_records: int
    success_count: int
    error_count: int
    duration_seconds: Optional[float] = None
    errors: Optional[List[Dict[str, Any]]] = None


class WebhookResponse(BaseModel):
    """Webhookレスポンス"""
    webhook_id: UUID4
    status: ResponseStatus
    processed: bool
    processing_time_ms: float
    acknowledgment: Optional[str] = None


class TransformResponse(BaseModel):
    """変換レスポンス"""
    transform_id: UUID4
    status: ResponseStatus
    original_format: str
    target_format: str
    transformed_data: Optional[Dict[str, Any]] = None
    validation_results: Optional[Dict[str, Any]] = None
    warnings: Optional[List[str]] = None


class ConflictResolutionResponse(BaseModel):
    """競合解決レスポンス"""
    resolution_id: UUID4
    status: ResponseStatus
    entity_type: str
    entity_id: str
    resolved_data: Optional[Dict[str, Any]] = None
    resolution_method: str
    conflicts_resolved: int
    metadata: Optional[Dict[str, Any]] = None


# Analytics Response Models
class PerformanceAnalysisResponse(BaseModel):
    """パフォーマンス分析レスポンス"""
    analysis_id: UUID4
    status: ResponseStatus
    period: Dict[str, datetime]
    metrics: Dict[str, Any]
    trends: Optional[Dict[str, List]] = None
    comparison: Optional[Dict[str, Any]] = None
    breakdown: Optional[Dict[str, Any]] = None
    insights: Optional[List[str]] = None


class CohortAnalysisResponse(BaseModel):
    """コホート分析レスポンス"""
    analysis_id: UUID4
    status: ResponseStatus
    cohort_type: str
    metric: str
    matrix: Dict[str, Any]
    summary: Dict[str, Any]
    visualizations: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[str]] = None


class FunnelAnalysisResponse(BaseModel):
    """ファネル分析レスポンス"""
    analysis_id: UUID4
    status: ResponseStatus
    funnel_steps: List[Dict[str, Any]]
    conversion_rates: List[Dict[str, float]]
    dropoff_analysis: Dict[str, Any]
    time_analysis: Dict[str, Any]
    segment: Optional[str] = None
    optimization_suggestions: Optional[List[Dict[str, Any]]] = None


class LTVAnalysisResponse(BaseModel):
    """LTV分析レスポンス"""
    analysis_id: UUID4
    status: ResponseStatus
    average_ltv: float
    predicted_ltv: float
    segments: Optional[List[Dict[str, Any]]] = None
    distribution: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    calculation_date: datetime
    prediction_confidence: Optional[float] = None


class AnalyticsResponse(BaseModel):
    """分析レスポンスの統合モデル"""
    analysis_type: str
    analysis_id: UUID4
    status: ResponseStatus
    execution_time_ms: float
    result: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


# Task and Schedule Response Models
class TaskResponse(BaseModel):
    """タスクレスポンス"""
    task_id: UUID4
    task_type: str
    status: TaskStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: Optional[float] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class ScheduledTaskResponse(BaseModel):
    """スケジュールタスクレスポンス"""
    task_id: UUID4
    task_type: str
    schedule: str
    enabled: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    execution_history: Optional[List[Dict[str, Any]]] = None


class BatchResponse(BaseModel):
    """バッチ処理レスポンス"""
    batch_id: UUID4
    status: TaskStatus
    total_requests: int
    completed_requests: int
    failed_requests: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    results: List[IntegrationResponse]
    summary: Dict[str, Any]


# Monitoring and Health Response Models
class HealthCheckResponse(BaseModel):
    """ヘルスチェックレスポンス"""
    status: str
    version: str
    timestamp: datetime
    services: Dict[str, Dict[str, Any]]
    dependencies: Dict[str, bool]


class MetricsResponse(BaseModel):
    """メトリクスレスポンス"""
    timestamp: datetime
    period: str
    metrics: Dict[str, Any]
    system_stats: Dict[str, Any]
    integration_stats: Dict[str, Any]


# Query Response Models
class QueryResponse(PaginatedResponse[List[Dict[str, Any]]]):
    """クエリレスポンス"""
    query_time_ms: float
    filters_applied: Optional[Dict[str, Any]] = None
    sort_applied: Optional[Dict[str, str]] = None


# Helper functions
def create_success_response(data: Any, message: str = "Success") -> BaseResponse:
    """成功レスポンスを作成"""
    return BaseResponse(
        status=ResponseStatus.SUCCESS,
        message=message,
        data=data
    )


def create_error_response(
    error_code: str,
    error_message: str,
    error_details: Optional[Dict[str, Any]] = None
) -> ErrorResponse:
    """エラーレスポンスを作成"""
    return ErrorResponse(
        error_code=error_code,
        error_message=error_message,
        error_details=error_details
    )