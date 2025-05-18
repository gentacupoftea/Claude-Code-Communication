from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, UUID4, validator
from decimal import Decimal
from enum import Enum


# Enums
class DataSource(str, Enum):
    SHOPIFY = "shopify"
    MAILCHIMP = "mailchimp"
    GOOGLE_ADS = "google_ads"
    FACEBOOK_ADS = "facebook_ads"
    INSTAGRAM = "instagram"
    GOOGLE_ANALYTICS = "google_analytics"
    KLAVIYO = "klaviyo"
    CUSTOM = "custom"


class EntityType(str, Enum):
    ORDER = "order"
    CUSTOMER = "customer"
    PRODUCT = "product"
    CAMPAIGN = "campaign"
    EVENT = "event"
    METRIC = "metric"


class DataStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"
    DRAFT = "draft"
    ARCHIVED = "archived"


class CurrencyCode(str, Enum):
    JPY = "JPY"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"


# Integrated Data Models
class IntegratedCustomer(BaseModel):
    """統合顧客データモデル"""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    
    # 日付
    created_at: datetime
    updated_at: datetime
    first_purchase_date: Optional[datetime] = None
    last_purchase_date: Optional[datetime] = None
    
    # 統計
    total_spent: Decimal = Decimal("0")
    total_orders: int = 0
    average_order_value: Decimal = Decimal("0")
    lifetime_value: Optional[Decimal] = None
    
    # セグメント
    tags: List[str] = []
    groups: List[str] = []
    tier: Optional[str] = None
    
    # マーケティング
    accepts_marketing: bool = False
    marketing_opt_in_level: Optional[str] = None
    email_marketing_consent: Optional[bool] = None
    sms_marketing_consent: Optional[bool] = None
    
    # 地理情報
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    
    # ソース情報
    sources: List[DataSource] = []
    source_ids: Dict[DataSource, str] = {}
    metadata: Dict[str, Any] = {}
    
    @validator('email')
    def validate_email(cls, v):
        # 簡単なメール検証
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower()


class IntegratedOrder(BaseModel):
    """統合注文データモデル"""
    id: str
    order_number: str
    customer_id: str
    customer_email: Optional[str] = None
    
    # 金額
    currency: CurrencyCode = CurrencyCode.JPY
    total_amount: Decimal
    subtotal_amount: Decimal
    tax_amount: Decimal = Decimal("0")
    shipping_amount: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    
    # 日付
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None
    fulfilled_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    
    # ステータス
    status: str
    financial_status: Optional[str] = None
    fulfillment_status: Optional[str] = None
    
    # アイテム
    line_items: List[Dict[str, Any]] = []
    item_count: int = 0
    unique_items: int = 0
    
    # 配送
    shipping_address: Optional[Dict[str, Any]] = None
    billing_address: Optional[Dict[str, Any]] = None
    shipping_method: Optional[str] = None
    
    # マーケティング
    source_name: Optional[str] = None
    referring_site: Optional[str] = None
    landing_site: Optional[str] = None
    marketing_channel: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    
    # ソース情報
    sources: List[DataSource] = []
    source_ids: Dict[DataSource, str] = {}
    metadata: Dict[str, Any] = {}


class IntegratedProduct(BaseModel):
    """統合商品データモデル"""
    id: str
    sku: Optional[str] = None
    title: str
    description: Optional[str] = None
    
    # 価格
    price: Decimal
    compare_at_price: Optional[Decimal] = None
    cost: Optional[Decimal] = None
    currency: CurrencyCode = CurrencyCode.JPY
    
    # 在庫
    inventory_quantity: int = 0
    track_inventory: bool = True
    
    # カテゴリ
    product_type: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    vendor: Optional[str] = None
    
    # 画像
    images: List[str] = []
    featured_image: Optional[str] = None
    
    # バリエーション
    variants: List[Dict[str, Any]] = []
    options: List[Dict[str, Any]] = []
    
    # SEO
    handle: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    
    # 統計
    total_sales: Decimal = Decimal("0")
    units_sold: int = 0
    view_count: int = 0
    
    # 日付
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    
    # ソース情報
    sources: List[DataSource] = []
    source_ids: Dict[DataSource, str] = {}
    metadata: Dict[str, Any] = {}


class IntegratedCampaign(BaseModel):
    """統合キャンペーンデータモデル"""
    id: str
    name: str
    campaign_type: str
    
    # ステータス
    status: DataStatus
    
    # 期間
    start_date: datetime
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # 予算
    budget: Optional[Decimal] = None
    spent: Decimal = Decimal("0")
    currency: CurrencyCode = CurrencyCode.JPY
    
    # ターゲティング
    target_audience: Optional[Dict[str, Any]] = None
    locations: List[str] = []
    keywords: List[str] = []
    
    # パフォーマンス
    impressions: int = 0
    clicks: int = 0
    conversions: int = 0
    revenue: Decimal = Decimal("0")
    
    # メトリクス
    ctr: float = 0.0  # Click-through rate
    conversion_rate: float = 0.0
    roas: float = 0.0  # Return on ad spend
    cpa: Optional[Decimal] = None  # Cost per acquisition
    
    # コンテンツ
    creative_assets: List[Dict[str, Any]] = []
    landing_page: Optional[str] = None
    
    # ソース情報
    platform: DataSource
    sources: List[DataSource] = []
    source_ids: Dict[DataSource, str] = {}
    metadata: Dict[str, Any] = {}


class IntegratedEvent(BaseModel):
    """統合イベントデータモデル"""
    id: str
    event_type: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    
    # タイムスタンプ
    timestamp: datetime
    
    # プロパティ
    properties: Dict[str, Any] = {}
    
    # コンテキスト
    device: Optional[Dict[str, Any]] = None
    browser: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, Any]] = None
    referrer: Optional[str] = None
    
    # ソース情報
    source: DataSource
    source_id: Optional[str] = None
    metadata: Dict[str, Any] = {}


class IntegratedMetric(BaseModel):
    """統合メトリクスデータモデル"""
    id: str
    metric_name: str
    metric_type: str
    
    # 値
    value: Union[float, int, Decimal]
    unit: Optional[str] = None
    
    # 期間
    timestamp: datetime
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    granularity: Optional[str] = None  # hour, day, week, month
    
    # ディメンション
    dimensions: Dict[str, Any] = {}
    
    # 統計
    count: Optional[int] = None
    sum: Optional[Decimal] = None
    average: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    
    # ソース情報
    source: DataSource
    source_id: Optional[str] = None
    metadata: Dict[str, Any] = {}


# Integration Configuration Models
class IntegrationConfig(BaseModel):
    """統合設定モデル"""
    id: UUID4
    name: str
    source: DataSource
    entity_types: List[EntityType]
    enabled: bool = True
    
    # 接続情報
    connection_params: Dict[str, Any]
    auth_method: str
    
    # 同期設定
    sync_frequency: str  # cron形式
    sync_mode: str
    batch_size: int = 100
    
    # マッピング
    field_mappings: Dict[str, str] = {}
    transform_rules: List[Dict[str, Any]] = []
    
    # エラーハンドリング
    error_handling: Dict[str, Any] = {}
    retry_policy: Dict[str, Any] = {}
    
    # メタデータ
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    metadata: Dict[str, Any] = {}


class DataMapping(BaseModel):
    """データマッピング設定"""
    id: UUID4
    name: str
    source: DataSource
    target: DataSource
    entity_type: EntityType
    
    # マッピングルール
    field_mappings: Dict[str, Union[str, Dict[str, Any]]]
    
    # 変換ルール
    transformations: List[Dict[str, Any]] = []
    
    # 検証ルール
    validations: List[Dict[str, Any]] = []
    
    # フィルタ
    filters: List[Dict[str, Any]] = []
    
    # メタデータ
    created_at: datetime
    updated_at: datetime
    version: int = 1
    active: bool = True


class IntegrationMetadata(BaseModel):
    """統合メタデータ"""
    integration_id: UUID4
    last_sync: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    records_synced: int = 0
    errors_count: int = 0
    warnings_count: int = 0
    
    # 統計
    total_records: int = 0
    success_rate: float = 0.0
    average_sync_time: float = 0.0
    
    # ヘルスチェック
    health_status: str = "unknown"
    last_health_check: Optional[datetime] = None
    health_details: Dict[str, Any] = {}
    
    # バージョン情報
    api_version: Optional[str] = None
    schema_version: Optional[str] = None
    
    # その他
    metadata: Dict[str, Any] = {}