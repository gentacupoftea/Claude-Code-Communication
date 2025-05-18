"""
統合データモデル - 複数のデータソースからの情報を統合
"""
from datetime import datetime
from typing import Optional, Dict, List, Any
from sqlalchemy import Column, String, JSON, DateTime, Integer, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, Field

Base = declarative_base()

class IntegratedDataModel(Base):
    """統合データの永続化モデル"""
    __tablename__ = 'integrated_data'
    
    id = Column(String, primary_key=True)
    data_type = Column(String, nullable=False)  # 'customer', 'product', 'analytics'
    source_ids = Column(JSON, nullable=False)   # 元のデータソースのID群
    merged_data = Column(JSON, nullable=False)  # 統合されたデータ
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    confidence_score = Column(Float, default=0.0)
    metadata = Column(JSON, default={})

class IntegratedCustomerData(BaseModel):
    """統合された顧客データ"""
    customer_id: str
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    orders_count: int = 0
    total_spent: float = 0.0
    average_order_value: float = 0.0
    lifetime_value: float = 0.0
    tags: List[str] = Field(default_factory=list)
    segments: List[str] = Field(default_factory=list)
    marketing_preferences: Dict[str, Any] = Field(default_factory=dict)
    engagement_score: float = 0.0
    last_interaction: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    data_sources: List[str] = Field(default_factory=list)

class IntegratedProductData(BaseModel):
    """統合された商品データ"""
    product_id: str
    title: str
    description: Optional[str] = None
    variant_count: int = 0
    price_range: Dict[str, float] = Field(default_factory=dict)
    total_sales: float = 0.0
    units_sold: int = 0
    inventory_levels: Dict[str, int] = Field(default_factory=dict)
    performance_score: float = 0.0
    categories: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    popularity_score: float = 0.0
    review_score: Optional[float] = None
    review_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    data_sources: List[str] = Field(default_factory=list)

class IntegratedOrderData(BaseModel):
    """統合された注文データ"""
    order_id: str
    customer_id: str
    order_date: datetime
    total_amount: float
    item_count: int
    status: str
    fulfillment_status: Optional[str] = None
    payment_method: Optional[str] = None
    shipping_method: Optional[str] = None
    products: List[Dict[str, Any]] = Field(default_factory=list)
    customer_satisfaction: Optional[float] = None
    refund_amount: float = 0.0
    discount_amount: float = 0.0
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    data_sources: List[str] = Field(default_factory=list)

class DataIntegrationConfig(BaseModel):
    """データ統合の設定"""
    merge_strategy: str = "latest"  # 'latest', 'weighted', 'manual'
    conflict_resolution: str = "highest_confidence"  # 'highest_confidence', 'most_recent', 'manual'
    data_sources: List[str] = Field(default_factory=list)
    field_mappings: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    quality_thresholds: Dict[str, float] = Field(default_factory=dict)
    update_frequency: str = "hourly"  # 'realtime', 'hourly', 'daily', 'weekly'
    retention_days: int = 90