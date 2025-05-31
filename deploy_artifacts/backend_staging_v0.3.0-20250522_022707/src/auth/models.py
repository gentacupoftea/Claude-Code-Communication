"""
Authentication and authorization models for Shopify MCP Server
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """User model for authentication"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Relationships
    organizations = relationship("OrganizationMember", back_populates="user")
    api_tokens = relationship("APIToken", back_populates="user")
    
    def __repr__(self):
        return f"<User(email='{self.email}', id='{self.id}')>"


class Organization(Base):
    """Organization model for multi-tenancy"""
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    members = relationship("OrganizationMember", back_populates="organization")
    shopify_stores = relationship("ShopifyStore", back_populates="organization")
    
    def __repr__(self):
        return f"<Organization(name='{self.name}', slug='{self.slug}')>"


class OrganizationMember(Base):
    """Organization membership and role management"""
    __tablename__ = "organization_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    role = Column(String, nullable=False)  # 'owner', 'admin', 'member', 'viewer'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="organizations")
    organization = relationship("Organization", back_populates="members")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('user_id', 'organization_id', name='uix_user_organization'),
    )
    
    def __repr__(self):
        return f"<OrganizationMember(user_id='{self.user_id}', org_id='{self.organization_id}', role='{self.role}')>"


class APIToken(Base):
    """API token for programmatic access"""
    __tablename__ = "api_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    token_hash = Column(String, nullable=False, unique=True)
    scopes = Column(ARRAY(String), nullable=False)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime)
    
    # Relationships
    user = relationship("User", back_populates="api_tokens")
    
    def __repr__(self):
        return f"<APIToken(name='{self.name}', user_id='{self.user_id}')>"


class ShopifyStore(Base):
    """Shopify store configuration per organization"""
    __tablename__ = "shopify_stores"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    shop_url = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    api_secret_key = Column(String, nullable=False)
    access_token = Column(String, nullable=False)
    api_version = Column(String, default="2024-10")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="shopify_stores")
    
    def __repr__(self):
        return f"<ShopifyStore(shop_url='{self.shop_url}', org_id='{self.organization_id}')>"