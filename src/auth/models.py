"""
Authentication and authorization models for Shopify MCP Server
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint, ARRAY, Integer, JSON
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
    
    # Email verification
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(255), nullable=True)
    email_verification_sent_at = Column(DateTime, nullable=True)
    
    # Account security
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    account_locked_until = Column(DateTime, nullable=True)
    last_failed_login_at = Column(DateTime, nullable=True)
    
    # Two-factor authentication
    two_factor_secret = Column(String(255), nullable=True)
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    backup_codes = Column(JSON, nullable=True)
    
    # Relationships
    organizations = relationship("OrganizationMember", back_populates="user")
    api_tokens = relationship("APIToken", back_populates="user")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    password_history = relationship("PasswordHistory", back_populates="user", cascade="all, delete-orphan")
    
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


class PasswordResetToken(Base):
    """Password reset token for secure password recovery"""
    __tablename__ = "password_reset_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="password_reset_tokens")
    
    def is_expired(self) -> bool:
        """Check if the token has expired"""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if the token is valid (not used and not expired)"""
        return not self.used and not self.is_expired()
    
    def __repr__(self):
        return f"<PasswordResetToken(user_id='{self.user_id}', expires_at='{self.expires_at}', used={self.used})>"


class UserSession(Base):
    """User session tracking for security and management"""
    __tablename__ = "user_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    device_info = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_active_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def is_expired(self) -> bool:
        """Check if the session has expired"""
        return datetime.utcnow() > self.expires_at
    
    def __repr__(self):
        return f"<UserSession(user_id='{self.user_id}', created_at='{self.created_at}')>"


class AuditLog(Base):
    """Audit logging for security and compliance"""
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String, nullable=True)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    organization = relationship("Organization", backref="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog(action='{self.action}', user_id='{self.user_id}', created_at='{self.created_at}')>"


class PasswordHistory(Base):
    """Password history for preventing reuse"""
    __tablename__ = "password_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="password_history")
    
    def __repr__(self):
        return f"<PasswordHistory(user_id='{self.user_id}', created_at='{self.created_at}')>"