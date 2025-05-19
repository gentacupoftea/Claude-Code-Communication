"""
Abstract base models for e-commerce entities
Provides common data structures across platforms
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime
from decimal import Decimal
import enum


class ProductStatus(enum.Enum):
    """Common product status across platforms"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"
    ARCHIVED = "archived"


class OrderStatus(enum.Enum):
    """Common order status across platforms"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    SHIPPED = "shipped"
    DELIVERED = "delivered"


class PaymentStatus(enum.Enum):
    """Common payment status"""
    PENDING = "pending"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    REFUNDED = "refunded"
    FAILED = "failed"


@dataclass
class BaseAddress:
    """Base address model"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class BaseProduct(ABC):
    """Abstract base product model"""
    platform_id: str  # Platform-specific ID
    title: str
    description: Optional[str] = None
    status: ProductStatus = ProductStatus.ACTIVE
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Common attributes
    sku: Optional[str] = None
    barcode: Optional[str] = None
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    cost: Optional[Decimal] = None
    weight: Optional[float] = None
    weight_unit: Optional[str] = None
    
    # Inventory
    track_inventory: bool = True
    inventory_quantity: Optional[int] = None
    
    # SEO
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    
    # Images
    images: List[Dict[str, Any]] = field(default_factory=list)
    
    # Platform-specific data
    platform_data: Dict[str, Any] = field(default_factory=dict)
    
    @abstractmethod
    def to_platform_format(self) -> Dict[str, Any]:
        """Convert to platform-specific format"""
        pass
    
    @classmethod
    @abstractmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'BaseProduct':
        """Create from platform-specific format"""
        pass
    
    def to_common_format(self) -> Dict[str, Any]:
        """Convert to common format"""
        return {
            'platform_id': self.platform_id,
            'title': self.title,
            'description': self.description,
            'status': self.status.value,
            'sku': self.sku,
            'barcode': self.barcode,
            'price': str(self.price) if self.price else None,
            'compare_price': str(self.compare_price) if self.compare_price else None,
            'cost': str(self.cost) if self.cost else None,
            'weight': self.weight,
            'weight_unit': self.weight_unit,
            'inventory_quantity': self.inventory_quantity,
            'images': self.images,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


@dataclass
class BaseLineItem:
    """Base order line item"""
    product_id: str
    variant_id: Optional[str] = None
    title: str = ""
    quantity: int = 1
    price: Decimal = Decimal('0')
    total: Decimal = Decimal('0')
    sku: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    
    def calculate_total(self) -> Decimal:
        """Calculate line item total"""
        self.total = self.price * self.quantity
        return self.total


@dataclass
class BaseOrder(ABC):
    """Abstract base order model"""
    platform_id: str  # Platform-specific ID
    order_number: str
    status: OrderStatus = OrderStatus.PENDING
    payment_status: PaymentStatus = PaymentStatus.PENDING
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Customer info
    customer_id: Optional[str] = None
    email: Optional[str] = None
    
    # Addresses
    billing_address: Optional[BaseAddress] = None
    shipping_address: Optional[BaseAddress] = None
    
    # Financial
    currency: str = "JPY"
    subtotal: Decimal = Decimal('0')
    tax_total: Decimal = Decimal('0')
    shipping_total: Decimal = Decimal('0')
    discount_total: Decimal = Decimal('0')
    total: Decimal = Decimal('0')
    
    # Line items
    line_items: List[BaseLineItem] = field(default_factory=list)
    
    # Shipping
    shipping_method: Optional[str] = None
    tracking_number: Optional[str] = None
    
    # Notes
    customer_note: Optional[str] = None
    internal_note: Optional[str] = None
    
    # Platform-specific data
    platform_data: Dict[str, Any] = field(default_factory=dict)
    
    @abstractmethod
    def to_platform_format(self) -> Dict[str, Any]:
        """Convert to platform-specific format"""
        pass
    
    @classmethod
    @abstractmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'BaseOrder':
        """Create from platform-specific format"""
        pass
    
    def calculate_totals(self) -> None:
        """Calculate order totals"""
        self.subtotal = sum(item.calculate_total() for item in self.line_items)
        self.total = self.subtotal + self.tax_total + self.shipping_total - self.discount_total
    
    def to_common_format(self) -> Dict[str, Any]:
        """Convert to common format"""
        return {
            'platform_id': self.platform_id,
            'order_number': self.order_number,
            'status': self.status.value,
            'payment_status': self.payment_status.value,
            'customer_id': self.customer_id,
            'email': self.email,
            'currency': self.currency,
            'subtotal': str(self.subtotal),
            'tax_total': str(self.tax_total),
            'shipping_total': str(self.shipping_total),
            'discount_total': str(self.discount_total),
            'total': str(self.total),
            'line_items': [
                {
                    'product_id': item.product_id,
                    'variant_id': item.variant_id,
                    'title': item.title,
                    'quantity': item.quantity,
                    'price': str(item.price),
                    'total': str(item.total),
                    'sku': item.sku
                }
                for item in self.line_items
            ],
            'billing_address': self.billing_address.to_dict() if self.billing_address else None,
            'shipping_address': self.shipping_address.to_dict() if self.shipping_address else None,
            'shipping_method': self.shipping_method,
            'tracking_number': self.tracking_number,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


@dataclass
class BaseCustomer(ABC):
    """Abstract base customer model"""
    platform_id: str  # Platform-specific ID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    
    # Status
    accepts_marketing: bool = False
    is_tax_exempt: bool = False
    
    # Addresses
    default_address: Optional[BaseAddress] = None
    addresses: List[BaseAddress] = field(default_factory=list)
    
    # Metadata
    tags: List[str] = field(default_factory=list)
    note: Optional[str] = None
    
    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Platform-specific data
    platform_data: Dict[str, Any] = field(default_factory=dict)
    
    @abstractmethod
    def to_platform_format(self) -> Dict[str, Any]:
        """Convert to platform-specific format"""
        pass
    
    @classmethod
    @abstractmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'BaseCustomer':
        """Create from platform-specific format"""
        pass
    
    def to_common_format(self) -> Dict[str, Any]:
        """Convert to common format"""
        return {
            'platform_id': self.platform_id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'accepts_marketing': self.accepts_marketing,
            'is_tax_exempt': self.is_tax_exempt,
            'default_address': self.default_address.to_dict() if self.default_address else None,
            'addresses': [addr.to_dict() for addr in self.addresses],
            'tags': self.tags,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }