"""
Shopify Data Models for Conea Integration
Defines Pydantic models for all Shopify entities with comprehensive validation
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator
from pydantic.dataclasses import dataclass


class ShopifyEntityStatus(str, Enum):
    """Base status enum for Shopify entities"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
    DRAFT = "draft"


class OrderStatus(str, Enum):
    """Shopify order status values"""
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class FulfillmentStatus(str, Enum):
    """Shopify fulfillment status values"""
    FULFILLED = "fulfilled"
    PARTIAL = "partial"
    UNFULFILLED = "unfulfilled"


class FinancialStatus(str, Enum):
    """Shopify financial status values"""
    AUTHORIZED = "authorized"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    PENDING = "pending"
    PARTIALLY_REFUNDED = "partially_refunded"
    REFUNDED = "refunded"
    VOIDED = "voided"


class InventoryPolicy(str, Enum):
    """Shopify inventory tracking policy"""
    DENY = "deny"
    CONTINUE = "continue"


class WeightUnit(str, Enum):
    """Weight measurement units"""
    GRAMS = "g"
    KILOGRAMS = "kg"
    OUNCES = "oz"
    POUNDS = "lb"


# ================================
# Core Shopify Data Models
# ================================

class ShopifyBase(BaseModel):
    """Base model for all Shopify entities"""
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            Decimal: lambda v: float(v) if v else None
        }


class ShopifyImage(ShopifyBase):
    """Shopify image model"""
    alt: Optional[str] = None
    src: str
    width: Optional[int] = None
    height: Optional[int] = None
    position: Optional[int] = None
    product_id: Optional[int] = None
    variant_ids: Optional[List[int]] = []


class ShopifyVariant(ShopifyBase):
    """Shopify product variant model"""
    product_id: Optional[int] = None
    title: str
    price: Decimal = Field(..., decimal_places=2)
    sku: Optional[str] = None
    position: Optional[int] = None
    inventory_policy: InventoryPolicy = InventoryPolicy.DENY
    compare_at_price: Optional[Decimal] = Field(None, decimal_places=2)
    fulfillment_service: str = "manual"
    inventory_management: Optional[str] = None
    option1: Optional[str] = None
    option2: Optional[str] = None
    option3: Optional[str] = None
    taxable: bool = True
    barcode: Optional[str] = None
    grams: Optional[int] = None
    image_id: Optional[int] = None
    weight: Optional[float] = None
    weight_unit: WeightUnit = WeightUnit.GRAMS
    inventory_item_id: Optional[int] = None
    inventory_quantity: Optional[int] = None
    old_inventory_quantity: Optional[int] = None
    requires_shipping: bool = True
    
    @validator('price', 'compare_at_price', pre=True)
    def validate_decimal_fields(cls, v):
        if v is None:
            return v
        return Decimal(str(v))


class ShopifyProduct(ShopifyBase):
    """Shopify product model with comprehensive attributes"""
    title: str
    body_html: Optional[str] = None
    vendor: Optional[str] = None
    product_type: Optional[str] = None
    handle: Optional[str] = None
    template_suffix: Optional[str] = None
    published_scope: str = "web"
    tags: Optional[str] = None
    status: ShopifyEntityStatus = ShopifyEntityStatus.ACTIVE
    published_at: Optional[datetime] = None
    
    # Related entities
    variants: List[ShopifyVariant] = []
    options: List[Dict[str, Any]] = []
    images: List[ShopifyImage] = []
    
    # SEO and metadata
    metafields_global_title_tag: Optional[str] = None
    metafields_global_description_tag: Optional[str] = None
    
    @validator('tags', pre=True)
    def validate_tags(cls, v):
        if isinstance(v, list):
            return ', '.join(v)
        return v
    
    @root_validator
    def ensure_primary_variant(cls, values):
        """Ensure at least one variant exists"""
        variants = values.get('variants', [])
        if not variants and values.get('id'):
            # Create default variant for existing products
            values['variants'] = [ShopifyVariant(
                title="Default Title",
                price=Decimal('0.00'),
                inventory_policy=InventoryPolicy.DENY
            )]
        return values


class ShopifyCustomer(ShopifyBase):
    """Shopify customer model"""
    email: Optional[str] = None
    accepts_marketing: bool = False
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    orders_count: Optional[int] = 0
    state: str = "disabled"
    total_spent: Optional[Decimal] = Field(None, decimal_places=2)
    last_order_id: Optional[int] = None
    note: Optional[str] = None
    verified_email: bool = False
    multipass_identifier: Optional[str] = None
    tax_exempt: bool = False
    phone: Optional[str] = None
    tags: Optional[str] = None
    last_order_name: Optional[str] = None
    currency: str = "USD"
    
    # Address information
    addresses: List[Dict[str, Any]] = []
    default_address: Optional[Dict[str, Any]] = None
    
    @validator('total_spent', pre=True)
    def validate_total_spent(cls, v):
        if v is None:
            return Decimal('0.00')
        return Decimal(str(v))


class ShopifyLineItem(BaseModel):
    """Shopify order line item model"""
    id: Optional[int] = None
    variant_id: Optional[int] = None
    title: str
    quantity: int
    sku: Optional[str] = None
    variant_title: Optional[str] = None
    vendor: Optional[str] = None
    fulfillment_service: str = "manual"
    product_id: Optional[int] = None
    requires_shipping: bool = True
    taxable: bool = True
    gift_card: bool = False
    name: str
    variant_inventory_management: Optional[str] = None
    properties: List[Dict[str, Any]] = []
    product_exists: bool = True
    fulfillable_quantity: int = 0
    grams: Optional[int] = None
    price: Decimal = Field(..., decimal_places=2)
    total_discount: Decimal = Field(default=Decimal('0.00'), decimal_places=2)
    fulfillment_status: Optional[FulfillmentStatus] = None
    
    # Pricing
    pre_tax_price: Optional[Decimal] = Field(None, decimal_places=2)
    tax_lines: List[Dict[str, Any]] = []
    
    @validator('price', 'total_discount', 'pre_tax_price', pre=True)
    def validate_decimal_fields(cls, v):
        if v is None:
            return v
        return Decimal(str(v))


class ShopifyOrder(ShopifyBase):
    """Shopify order model with complete order information"""
    email: Optional[str] = None
    closed_at: Optional[datetime] = None
    number: Optional[int] = None
    note: Optional[str] = None
    token: Optional[str] = None
    gateway: Optional[str] = None
    test: bool = False
    total_price: Decimal = Field(..., decimal_places=2)
    subtotal_price: Decimal = Field(..., decimal_places=2)
    total_weight: Optional[int] = None
    total_tax: Decimal = Field(default=Decimal('0.00'), decimal_places=2)
    taxes_included: bool = False
    currency: str = "USD"
    financial_status: FinancialStatus = FinancialStatus.PENDING
    confirmed: bool = True
    total_discounts: Decimal = Field(default=Decimal('0.00'), decimal_places=2)
    total_line_items_price: Decimal = Field(..., decimal_places=2)
    cart_token: Optional[str] = None
    buyer_accepts_marketing: bool = False
    name: Optional[str] = None
    referring_site: Optional[str] = None
    landing_site: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    total_price_usd: Optional[Decimal] = Field(None, decimal_places=2)
    checkout_token: Optional[str] = None
    reference: Optional[str] = None
    user_id: Optional[int] = None
    location_id: Optional[int] = None
    source_identifier: Optional[str] = None
    source_url: Optional[str] = None
    processed_at: Optional[datetime] = None
    device_id: Optional[int] = None
    phone: Optional[str] = None
    customer_locale: str = "en"
    app_id: Optional[int] = None
    browser_ip: Optional[str] = None
    landing_site_ref: Optional[str] = None
    order_number: Optional[int] = None
    
    # Status fields
    order_status_url: Optional[str] = None
    fulfillment_status: Optional[FulfillmentStatus] = None
    
    # Related entities
    line_items: List[ShopifyLineItem] = []
    customer: Optional[ShopifyCustomer] = None
    billing_address: Optional[Dict[str, Any]] = None
    shipping_address: Optional[Dict[str, Any]] = None
    fulfillments: List[Dict[str, Any]] = []
    refunds: List[Dict[str, Any]] = []
    
    # Discount and shipping
    discount_codes: List[Dict[str, Any]] = []
    discount_applications: List[Dict[str, Any]] = []
    shipping_lines: List[Dict[str, Any]] = []
    tax_lines: List[Dict[str, Any]] = []
    
    @validator('total_price', 'subtotal_price', 'total_tax', 'total_discounts', 
              'total_line_items_price', 'total_price_usd', pre=True)
    def validate_decimal_fields(cls, v):
        if v is None:
            return v
        return Decimal(str(v))
    
    @root_validator
    def validate_order_totals(cls, values):
        """Validate order financial calculations"""
        subtotal = values.get('subtotal_price', Decimal('0.00'))
        tax = values.get('total_tax', Decimal('0.00'))
        discounts = values.get('total_discounts', Decimal('0.00'))
        
        # Basic validation - total should equal subtotal + tax - discounts
        # (simplified, real Shopify calculation can be more complex)
        return values


class ShopifyInventoryLevel(BaseModel):
    """Shopify inventory level tracking"""
    inventory_item_id: int
    location_id: int
    available: Optional[int] = None
    updated_at: Optional[datetime] = None


class ShopifyLocation(ShopifyBase):
    """Shopify location/warehouse model"""
    name: str
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    zip: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    province_code: Optional[str] = None
    legacy: bool = False
    active: bool = True
    admin_graphql_api_id: Optional[str] = None


class ShopifyWebhook(ShopifyBase):
    """Shopify webhook configuration model"""
    address: str
    topic: str
    format: str = "json"
    fields: Optional[List[str]] = None
    metafield_namespaces: Optional[List[str]] = None
    private_metafield_namespaces: Optional[List[str]] = None
    api_client_id: Optional[int] = None
    webhook_id: Optional[str] = None


# ================================
# Integration-Specific Models
# ================================

class ShopifyStoreConnection(BaseModel):
    """Model for storing Shopify store connection details"""
    store_id: str = Field(..., description="Unique identifier for the store")
    shop_domain: str = Field(..., description="myshopify.com domain")
    access_token: str = Field(..., description="Shopify access token")
    scope: str = Field(..., description="OAuth scope granted")
    
    # Store information
    store_name: Optional[str] = None
    store_email: Optional[str] = None
    currency: str = "USD"
    timezone: Optional[str] = None
    
    # Connection metadata
    connected_at: datetime = Field(default_factory=datetime.utcnow)
    last_sync: Optional[datetime] = None
    sync_enabled: bool = True
    webhook_verified: bool = False
    
    # Sync configuration
    sync_products: bool = True
    sync_orders: bool = True
    sync_customers: bool = True
    sync_inventory: bool = True
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class SyncOperation(BaseModel):
    """Model for tracking sync operations"""
    operation_id: str
    store_id: str
    operation_type: str  # products, orders, customers, inventory
    status: str  # pending, running, completed, failed
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    # Statistics
    total_records: Optional[int] = None
    processed_records: Optional[int] = None
    successful_records: Optional[int] = None
    failed_records: Optional[int] = None
    
    # Error tracking
    errors: List[Dict[str, Any]] = []
    error_summary: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class WebhookEvent(BaseModel):
    """Model for processing webhook events"""
    event_id: str
    store_id: str
    topic: str
    payload: Dict[str, Any]
    received_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    processing_status: str = "pending"  # pending, processed, failed
    retry_count: int = 0
    error_message: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# ================================
# Response Models for API
# ================================

class ShopifyAPIResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = {}


class PaginatedResponse(BaseModel):
    """Paginated response model"""
    items: List[Any]
    total_count: int
    page: int
    per_page: int
    has_next: bool
    has_previous: bool
    next_page_info: Optional[str] = None
    previous_page_info: Optional[str] = None


class SyncStatus(BaseModel):
    """Sync status response model"""
    store_id: str
    last_sync: Optional[datetime] = None
    sync_in_progress: bool = False
    next_scheduled_sync: Optional[datetime] = None
    
    # Sync statistics
    products_synced: int = 0
    orders_synced: int = 0
    customers_synced: int = 0
    
    # Health metrics
    webhook_status: str = "unknown"  # active, inactive, error
    api_health: str = "unknown"  # healthy, degraded, error
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }