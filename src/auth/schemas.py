"""
Pydantic schemas for authentication and authorization
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, validator


# User Schemas
class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for user creation"""
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def validate_password(cls, v):
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


class UserUpdate(BaseModel):
    """Schema for user updates"""
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """Schema for user responses"""
    id: UUID
    created_at: datetime
    last_login: Optional[datetime]
    is_superuser: bool
    
    class Config:
        from_attributes = True


# Authentication Schemas
class TokenResponse(BaseModel):
    """Schema for token responses"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Schema for token refresh requests"""
    refresh_token: str


class LoginRequest(BaseModel):
    """Schema for login requests"""
    email: EmailStr
    password: str


# Organization Schemas
class OrganizationBase(BaseModel):
    """Base organization schema"""
    name: str = Field(..., min_length=1, max_length=100)


class OrganizationCreate(OrganizationBase):
    """Schema for organization creation"""
    pass


class OrganizationUpdate(BaseModel):
    """Schema for organization updates"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class OrganizationResponse(OrganizationBase):
    """Schema for organization responses"""
    id: UUID
    slug: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Membership Schemas
class MembershipCreate(BaseModel):
    """Schema for adding organization members"""
    user_email: EmailStr
    role: str = Field(..., pattern="^(owner|admin|member|viewer)$")


class MembershipUpdate(BaseModel):
    """Schema for updating membership"""
    role: str = Field(..., pattern="^(owner|admin|member|viewer)$")


class MembershipResponse(BaseModel):
    """Schema for membership responses"""
    id: UUID
    user_id: UUID
    organization_id: UUID
    role: str
    created_at: datetime
    user: UserResponse
    
    class Config:
        from_attributes = True


# API Token Schemas
class APITokenCreate(BaseModel):
    """Schema for API token creation"""
    name: str = Field(..., min_length=1, max_length=100)
    scopes: List[str]
    expires_in_days: Optional[int] = Field(None, ge=1, le=3650)  # Max 10 years


class APITokenResponse(BaseModel):
    """Schema for API token responses"""
    id: UUID
    name: str
    scopes: List[str]
    expires_at: Optional[datetime]
    created_at: datetime
    last_used_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class APITokenCreateResponse(APITokenResponse):
    """Schema for API token creation response with token value"""
    token: str


# Shopify Store Schemas
class ShopifyStoreCreate(BaseModel):
    """Schema for Shopify store creation"""
    shop_url: str
    api_key: str
    api_secret_key: str
    access_token: str
    api_version: str = "2024-10"


class ShopifyStoreUpdate(BaseModel):
    """Schema for Shopify store updates"""
    api_key: Optional[str] = None
    api_secret_key: Optional[str] = None
    access_token: Optional[str] = None
    api_version: Optional[str] = None


class ShopifyStoreResponse(BaseModel):
    """Schema for Shopify store responses"""
    id: UUID
    organization_id: UUID
    shop_url: str
    api_version: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True