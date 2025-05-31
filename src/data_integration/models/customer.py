"""
顧客インサイトモデル - 顧客データの分析と洞察
"""
from datetime import datetime
from typing import Optional, Dict, List, Any
from sqlalchemy import Column, String, JSON, DateTime, Float, Integer, Boolean
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, Field

Base = declarative_base()

class CustomerInsight(Base):
    """顧客インサイトの永続化モデル"""
    __tablename__ = 'customer_insights'
    
    customer_id = Column(String, primary_key=True)
    segment = Column(String, nullable=False)
    lifetime_value = Column(Float, default=0.0)
    churn_risk_score = Column(Float, default=0.0)
    engagement_score = Column(Float, default=0.0)
    purchase_frequency = Column(Float, default=0.0)
    average_order_value = Column(Float, default=0.0)
    last_purchase_date = Column(DateTime)
    next_purchase_prediction = Column(DateTime)
    preferred_categories = Column(JSON, default=[])
    preferred_products = Column(JSON, default=[])
    communication_preferences = Column(JSON, default={})
    behavioral_patterns = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CustomerSegment(BaseModel):
    """顧客セグメントの定義"""
    segment_id: str
    name: str
    description: Optional[str] = None
    criteria: Dict[str, Any] = Field(default_factory=dict)
    customer_count: int = 0
    average_ltv: float = 0.0
    characteristics: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerBehavior(BaseModel):
    """顧客行動パターンの分析"""
    customer_id: str
    purchase_cycle_days: Optional[float] = None
    favorite_purchase_time: Optional[str] = None  # 'morning', 'afternoon', 'evening', 'night'
    favorite_purchase_day: Optional[str] = None   # 'weekday', 'weekend'
    device_preference: Optional[str] = None       # 'mobile', 'desktop', 'tablet'
    channel_preference: Optional[str] = None      # 'online', 'retail', 'social'
    price_sensitivity: float = 0.5               # 0-1 scale
    promotion_responsiveness: float = 0.5         # 0-1 scale
    brand_loyalty: float = 0.5                   # 0-1 scale
    cross_sell_potential: float = 0.5            # 0-1 scale
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerLifecycleStage(BaseModel):
    """顧客ライフサイクルステージ"""
    customer_id: str
    current_stage: str  # 'new', 'growing', 'mature', 'at_risk', 'churned'
    stage_duration_days: int = 0
    stage_transition_date: Optional[datetime] = None
    next_likely_stage: Optional[str] = None
    stage_confidence: float = 0.0
    recommended_actions: List[Dict[str, Any]] = Field(default_factory=list)
    stage_metrics: Dict[str, float] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerCohort(BaseModel):
    """顧客コホート分析"""
    cohort_id: str
    name: str
    definition: Dict[str, Any] = Field(default_factory=dict)
    customer_count: int = 0
    retention_rates: Dict[str, float] = Field(default_factory=dict)  # month: rate
    revenue_per_customer: Dict[str, float] = Field(default_factory=dict)
    cohort_metrics: Dict[str, Any] = Field(default_factory=dict)
    trends: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerRecommendation(BaseModel):
    """顧客への推奨アクション"""
    customer_id: str
    recommendation_type: str  # 'product', 'campaign', 'retention', 'upsell'
    recommendation_id: str
    title: str
    description: Optional[str] = None
    priority: int = 5  # 1-10 scale
    confidence_score: float = 0.0
    expected_impact: Dict[str, Any] = Field(default_factory=dict)
    expiration_date: Optional[datetime] = None
    status: str = "pending"  # 'pending', 'acted_upon', 'expired'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerRiskProfile(BaseModel):
    """顧客リスクプロファイル"""
    customer_id: str
    churn_risk: float = 0.0  # 0-1 scale
    payment_risk: float = 0.0
    fraud_risk: float = 0.0
    risk_factors: List[str] = Field(default_factory=list)
    risk_mitigation_actions: List[Dict[str, Any]] = Field(default_factory=list)
    last_risk_assessment: datetime = Field(default_factory=datetime.utcnow)
    next_assessment_due: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)