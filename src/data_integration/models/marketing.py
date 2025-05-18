"""
マーケティング分析モデル - マーケティングキャンペーンと効果の分析
"""
from datetime import datetime
from typing import Optional, Dict, List, Any
from sqlalchemy import Column, String, JSON, DateTime, Float, Integer, Boolean
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, Field

Base = declarative_base()

class MarketingCampaign(Base):
    """マーケティングキャンペーンの永続化モデル"""
    __tablename__ = 'marketing_campaigns'
    
    campaign_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'email', 'social', 'display', 'search'
    status = Column(String, default='draft')  # 'draft', 'active', 'paused', 'completed'
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    budget = Column(Float, default=0.0)
    spent = Column(Float, default=0.0)
    target_audience = Column(JSON, default={})
    performance_metrics = Column(JSON, default={})
    conversion_rate = Column(Float, default=0.0)
    roi = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CampaignPerformance(BaseModel):
    """キャンペーンパフォーマンスメトリクス"""
    campaign_id: str
    impressions: int = 0
    clicks: int = 0
    conversions: int = 0
    revenue: float = 0.0
    cost: float = 0.0
    ctr: float = 0.0  # Click-through rate
    cpa: float = 0.0  # Cost per acquisition
    roi: float = 0.0  # Return on investment
    engagement_rate: float = 0.0
    bounce_rate: float = 0.0
    average_session_duration: float = 0.0
    by_channel: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    by_segment: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AttributionModel(BaseModel):
    """マーケティングアトリビューションモデル"""
    conversion_id: str
    customer_id: str
    conversion_value: float
    conversion_date: datetime
    touchpoints: List[Dict[str, Any]] = Field(default_factory=list)
    attribution_model: str = "last_click"  # 'last_click', 'first_click', 'linear', 'data_driven'
    channel_contributions: Dict[str, float] = Field(default_factory=dict)
    campaign_contributions: Dict[str, float] = Field(default_factory=dict)
    time_to_conversion: Optional[float] = None  # days
    path_length: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerJourney(BaseModel):
    """顧客ジャーニー分析"""
    journey_id: str
    customer_id: str
    journey_stage: str  # 'awareness', 'consideration', 'decision', 'retention', 'advocacy'
    touchpoints: List[Dict[str, Any]] = Field(default_factory=list)
    current_stage_duration: float = 0.0  # days
    total_journey_duration: float = 0.0  # days
    conversion_probability: float = 0.0
    next_best_action: Optional[Dict[str, Any]] = None
    journey_score: float = 0.0
    pain_points: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MarketingROI(BaseModel):
    """マーケティングROI分析"""
    channel: str
    campaign_id: Optional[str] = None
    time_period: str  # 'daily', 'weekly', 'monthly', 'quarterly'
    period_start: datetime
    period_end: datetime
    investment: float = 0.0
    revenue: float = 0.0
    profit: float = 0.0
    roi: float = 0.0
    customer_acquisition_cost: float = 0.0
    customer_lifetime_value: float = 0.0
    ltv_cac_ratio: float = 0.0
    breakeven_period: Optional[float] = None  # days
    metrics: Dict[str, float] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ContentPerformance(BaseModel):
    """コンテンツパフォーマンス分析"""
    content_id: str
    content_type: str  # 'blog', 'email', 'social', 'video', 'landing_page'
    title: str
    campaign_id: Optional[str] = None
    views: int = 0
    engagement_rate: float = 0.0
    conversion_rate: float = 0.0
    shares: int = 0
    comments: int = 0
    sentiment_score: float = 0.0  # -1 to 1
    time_on_content: float = 0.0  # seconds
    bounce_rate: float = 0.0
    performance_score: float = 0.0
    audience_segments: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MarketingForecast(BaseModel):
    """マーケティング予測モデル"""
    forecast_id: str
    metric: str  # 'revenue', 'conversions', 'cac', 'roi'
    period: str  # 'weekly', 'monthly', 'quarterly'
    forecast_date: datetime
    predicted_value: float
    confidence_interval: Dict[str, float] = Field(default_factory=dict)
    factors: List[Dict[str, Any]] = Field(default_factory=list)
    seasonality_impact: float = 0.0
    trend_impact: float = 0.0
    campaign_impact: Dict[str, float] = Field(default_factory=dict)
    accuracy: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ABTestResult(BaseModel):
    """A/Bテスト結果"""
    test_id: str
    test_name: str
    test_type: str  # 'email', 'landing_page', 'pricing', 'product'
    variations: List[Dict[str, Any]] = Field(default_factory=list)
    winner: Optional[str] = None
    confidence_level: float = 0.0
    sample_size: int = 0
    start_date: datetime
    end_date: Optional[datetime] = None
    primary_metric: str
    secondary_metrics: List[str] = Field(default_factory=list)
    results: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    statistical_significance: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)