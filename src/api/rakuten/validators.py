"""
Validators for Rakuten API data
Ensures data integrity and proper formatting
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from decimal import Decimal
import re
from datetime import datetime


class RakutenProductCreate(BaseModel):
    """Validation model for product creation"""
    name: str = Field(..., min_length=1, max_length=255)
    price: int = Field(..., gt=0, le=99999999)  # Price in yen
    description: Optional[str] = Field(None, max_length=5000)
    sku: str = Field(..., min_length=1, max_length=64)
    stock: int = Field(..., ge=0, le=999999)
    categories: List[str] = Field(default_factory=list)
    images: List[Dict[str, Any]] = Field(default_factory=list)
    
    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v):
        if not re.match(r'^[A-Za-z0-9_\-]+$', v):
            raise ValueError('SKU must contain only alphanumeric characters, underscores, and hyphens')
        return v
    
    @field_validator('categories')
    @classmethod
    def validate_categories(cls, v):
        if len(v) > 5:
            raise ValueError('A maximum of 5 categories is allowed')
        return v
    
    @field_validator('images')
    @classmethod
    def validate_images(cls, v):
        if len(v) > 20:
            raise ValueError('A maximum of 20 images is allowed')
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        # Remove control characters
        v = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', v)
        if not v.strip():
            raise ValueError('Product name cannot be empty')
        return v.strip()


class RakutenProductUpdate(BaseModel):
    """Validation model for product updates"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    price: Optional[int] = Field(None, gt=0, le=99999999)
    description: Optional[str] = Field(None, max_length=5000)
    stock: Optional[int] = Field(None, ge=0, le=999999)
    categories: Optional[List[str]] = None
    images: Optional[List[Dict[str, Any]]] = None
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            v = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', v)
            if not v.strip():
                raise ValueError('Product name cannot be empty')
            return v.strip()
        return v
    
    @field_validator('categories')
    @classmethod
    def validate_categories(cls, v):
        if v is not None and len(v) > 5:
            raise ValueError('A maximum of 5 categories is allowed')
        return v
    
    @field_validator('images')
    @classmethod
    def validate_images(cls, v):
        if v is not None and len(v) > 20:
            raise ValueError('A maximum of 20 images is allowed')
        return v


class RakutenOrderItem(BaseModel):
    """Validation model for order items"""
    product_id: str = Field(..., min_length=1)
    quantity: int = Field(..., gt=0, le=9999)
    price: int = Field(..., gt=0)
    
    @field_validator('product_id')
    @classmethod
    def validate_product_id(cls, v):
        if not re.match(r'^[A-Za-z0-9_\-]+$', v):
            raise ValueError('Invalid product ID format')
        return v


class RakutenAddressCreate(BaseModel):
    """Validation model for address creation"""
    full_name: str = Field(..., min_length=1, max_length=100)
    postal_code: str = Field(..., pattern=r'^\d{3}-?\d{4}$')
    prefecture: str = Field(..., min_length=1, max_length=10)
    city: str = Field(..., min_length=1, max_length=50)
    address1: str = Field(..., min_length=1, max_length=100)
    address2: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, pattern=r'^[\d\-]+$')
    
    @field_validator('postal_code')
    @classmethod
    def normalize_postal_code(cls, v):
        # Normalize postal code format (add hyphen if missing)
        if len(v) == 7 and '-' not in v:
            return f"{v[:3]}-{v[3:]}"
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v:
            # Remove non-numeric characters
            cleaned = re.sub(r'[^\d]', '', v)
            if len(cleaned) < 10 or len(cleaned) > 11:
                raise ValueError('Phone number must be 10 or 11 digits')
        return v


class RakutenCustomerCreate(BaseModel):
    """Validation model for customer creation"""
    email: str = Field(..., pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    phone: Optional[str] = Field(None, pattern=r'^[\d\-]+$')
    accepts_marketing: bool = Field(default=False)
    
    @field_validator('email')
    @classmethod
    def normalize_email(cls, v):
        return v.lower().strip()
    
    @field_validator('first_name', 'last_name')
    @classmethod
    def sanitize_name(cls, v):
        if v:
            # Remove control characters and normalize whitespace
            v = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', v)
            return ' '.join(v.split())
        return v


def validate_product_data(data: Dict[str, Any], is_update: bool = False) -> Dict[str, Any]:
    """
    Validate product data
    
    Args:
        data: Product data to validate
        is_update: Whether this is an update operation
        
    Returns:
        Validated and cleaned data
    """
    if is_update:
        model = RakutenProductUpdate(**data)
    else:
        model = RakutenProductCreate(**data)
    
    return model.dict(exclude_unset=True)


def validate_order_item(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate order item data
    
    Args:
        data: Order item data to validate
        
    Returns:
        Validated data
    """
    model = RakutenOrderItem(**data)
    return model.dict()


def validate_address(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate address data
    
    Args:
        data: Address data to validate
        
    Returns:
        Validated data
    """
    model = RakutenAddressCreate(**data)
    return model.dict()


def validate_customer_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate customer data
    
    Args:
        data: Customer data to validate
        
    Returns:
        Validated and cleaned data
    """
    model = RakutenCustomerCreate(**data)
    return model.dict(exclude_unset=True)