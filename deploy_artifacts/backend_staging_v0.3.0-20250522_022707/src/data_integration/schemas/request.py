from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, UUID4
from enum import Enum


# Enums
class IntegrationType(str, Enum):
    REAL_TIME = "real_time"
    BATCH = "batch"
    WEBHOOK = "webhook"
    API = "api"


class SyncMode(str, Enum):
    FULL = "full"
    INCREMENTAL = "incremental"
    DELTA = "delta"


class ConflictResolution(str, Enum):
    LAST_WRITE_WINS = "last_write_wins"
    MERGE = "merge"
    CUSTOM = "custom"


class AnalysisType(str, Enum):
    PERFORMANCE = "performance"
    COHORT = "cohort"
    FUNNEL = "funnel"
    LTV = "ltv"


class CohortType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class CohortMetric(str, Enum):
    RETENTION = "retention"
    REVENUE = "revenue"
    ORDERS = "orders"


# Request Models
class IntegrationRequest(BaseModel):
    """統合リクエストのベースモデル"""
    integration_id: UUID4
    source: str
    entity_type: str
    sync_mode: SyncMode = SyncMode.INCREMENTAL
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    filters: Optional[Dict[str, Any]] = None
    options: Optional[Dict[str, Any]] = None


class SyncRequest(BaseModel):
    """同期リクエスト"""
    sources: List[str]
    entity_types: List[str]
    sync_mode: SyncMode = SyncMode.INCREMENTAL
    full_sync: bool = False
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    batch_size: int = Field(default=100, ge=1, le=1000)


class WebhookRequest(BaseModel):
    """Webhookリクエスト"""
    source: str
    event_type: str
    payload: Dict[str, Any]
    timestamp: datetime
    signature: Optional[str] = None


class TransformRequest(BaseModel):
    """データ変換リクエスト"""
    source_format: str
    target_format: str
    data: Dict[str, Any]
    mapping_rules: Optional[Dict[str, Any]] = None
    validation_rules: Optional[Dict[str, Any]] = None


class ConflictResolutionRequest(BaseModel):
    """競合解決リクエスト"""
    entity_type: str
    entity_id: str
    conflicts: List[Dict[str, Any]]
    resolution_strategy: ConflictResolution
    custom_rules: Optional[Dict[str, Any]] = None


class PerformanceAnalysisRequest(BaseModel):
    """パフォーマンス分析リクエスト"""
    start_date: datetime
    end_date: datetime
    dimension: str = "overall"
    metrics: Optional[List[str]] = None
    filters: Optional[Dict[str, Any]] = None
    comparison_period: Optional[bool] = True


class CohortAnalysisRequest(BaseModel):
    """コホート分析リクエスト"""
    start_date: datetime
    end_date: datetime
    cohort_type: CohortType = CohortType.MONTHLY
    metric: CohortMetric = CohortMetric.RETENTION
    segments: Optional[List[str]] = None
    filters: Optional[Dict[str, Any]] = None


class FunnelAnalysisRequest(BaseModel):
    """ファネル分析リクエスト"""
    funnel_steps: List[str]
    start_date: datetime
    end_date: datetime
    conversion_window_days: int = Field(default=30, ge=1, le=365)
    segment: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None


class LTVAnalysisRequest(BaseModel):
    """LTV分析リクエスト"""
    start_date: datetime
    end_date: datetime
    prediction_months: int = Field(default=12, ge=1, le=36)
    segment_by: Optional[str] = None
    customer_segments: Optional[List[str]] = None
    include_churn_prediction: bool = True


class AnalyticsRequest(BaseModel):
    """分析リクエストの統合モデル"""
    analysis_type: AnalysisType
    performance: Optional[PerformanceAnalysisRequest] = None
    cohort: Optional[CohortAnalysisRequest] = None
    funnel: Optional[FunnelAnalysisRequest] = None
    ltv: Optional[LTVAnalysisRequest] = None
    
    def get_specific_request(self):
        """特定の分析リクエストを取得"""
        if self.analysis_type == AnalysisType.PERFORMANCE:
            return self.performance
        elif self.analysis_type == AnalysisType.COHORT:
            return self.cohort
        elif self.analysis_type == AnalysisType.FUNNEL:
            return self.funnel
        elif self.analysis_type == AnalysisType.LTV:
            return self.ltv
        else:
            raise ValueError(f"Unknown analysis type: {self.analysis_type}")


class ScheduledTaskRequest(BaseModel):
    """スケジュールタスクリクエスト"""
    task_id: UUID4
    task_type: str
    schedule: str  # cron形式
    enabled: bool = True
    parameters: Dict[str, Any]
    retry_policy: Optional[Dict[str, Any]] = None


class BatchRequest(BaseModel):
    """バッチ処理リクエスト"""
    batch_id: UUID4
    requests: List[IntegrationRequest]
    parallel: bool = True
    max_workers: int = Field(default=4, ge=1, le=10)
    timeout_seconds: int = Field(default=300, ge=60, le=3600)


class QueryRequest(BaseModel):
    """クエリリクエスト"""
    entity_type: str
    filters: Optional[Dict[str, Any]] = None
    sort_by: Optional[str] = None
    sort_order: str = Field(default="asc", regex="^(asc|desc)$")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    fields: Optional[List[str]] = None