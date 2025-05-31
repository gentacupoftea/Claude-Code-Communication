"""Database models for Google Analytics data

This module defines SQLAlchemy models for storing Google Analytics
reports, metrics, dimensions, and cached data.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    DateTime,
    JSON,
    Boolean,
    Index,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Text,
    Enum,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

Base = declarative_base()


class ReportStatus(enum.Enum):
    """Status of a report execution"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CACHED = "cached"


class MetricType(enum.Enum):
    """Google Analytics metric types"""
    INTEGER = "INTEGER"
    FLOAT = "FLOAT"
    CURRENCY = "CURRENCY"
    PERCENT = "PERCENT"
    TIME = "TIME"
    STRING = "STRING"


class PropertyInfo(Base):
    """Google Analytics property information"""
    __tablename__ = 'ga_properties'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    time_zone = Column(String(100))
    currency_code = Column(String(10))
    industry_category = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    reports = relationship("Report", back_populates="property")
    saved_queries = relationship("SavedQuery", back_populates="property")
    
    __table_args__ = (
        Index('idx_property_active', 'is_active'),
    )


class Report(Base):
    """Google Analytics report definition and results"""
    __tablename__ = 'ga_reports'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(String(50), ForeignKey('ga_properties.property_id'), nullable=False)
    report_name = Column(String(255))
    description = Column(Text)
    
    # Report configuration
    dimensions = Column(JSONB, nullable=False)  # List of dimension names
    metrics = Column(JSONB, nullable=False)  # List of metric names
    date_ranges = Column(JSONB, nullable=False)  # List of date range objects
    dimension_filter = Column(JSONB)  # Filter expression for dimensions
    metric_filter = Column(JSONB)  # Filter expression for metrics
    order_bys = Column(JSONB)  # Ordering criteria
    
    # Execution details
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    requested_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    
    # Results metadata
    row_count = Column(Integer)
    cache_key = Column(String(100), unique=True, index=True)
    expires_at = Column(DateTime)
    
    # API quota tracking
    tokens_consumed = Column(Integer)
    quota_remaining = Column(Integer)
    
    # Relationships
    property = relationship("PropertyInfo", back_populates="reports")
    results = relationship("ReportResult", back_populates="report", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_report_status', 'status'),
        Index('idx_report_property_status', 'property_id', 'status'),
        Index('idx_report_cache_expiry', 'cache_key', 'expires_at'),
    )


class ReportResult(Base):
    """Individual rows from a Google Analytics report"""
    __tablename__ = 'ga_report_results'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey('ga_reports.id'), nullable=False)
    row_index = Column(Integer, nullable=False)
    
    # Dimension values (stored as JSON for flexibility)
    dimension_values = Column(JSONB, nullable=False)
    
    # Metric values (stored as JSON for flexibility)
    metric_values = Column(JSONB, nullable=False)
    
    # Computed/derived fields
    date = Column(DateTime)  # If date dimension is present
    device_category = Column(String(50))  # If device dimension is present
    country = Column(String(100))  # If country dimension is present
    page_path = Column(String(500))  # If page dimension is present
    
    # Relationships
    report = relationship("Report", back_populates="results")
    
    __table_args__ = (
        Index('idx_result_report_row', 'report_id', 'row_index'),
        Index('idx_result_date', 'date'),
        Index('idx_result_device', 'device_category'),
        UniqueConstraint('report_id', 'row_index', name='uq_report_row'),
    )


class MetricDefinition(Base):
    """Google Analytics metric definitions"""
    __tablename__ = 'ga_metric_definitions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    api_name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text)
    metric_type = Column(Enum(MetricType), nullable=False)
    category = Column(String(100))
    is_custom = Column(Boolean, default=False)
    expression = Column(String(500))  # For calculated metrics
    deprecated = Column(Boolean, default=False)
    
    __table_args__ = (
        Index('idx_metric_api_name', 'api_name'),
        Index('idx_metric_category', 'category'),
    )


class DimensionDefinition(Base):
    """Google Analytics dimension definitions"""
    __tablename__ = 'ga_dimension_definitions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    api_name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    is_custom = Column(Boolean, default=False)
    deprecated = Column(Boolean, default=False)
    
    __table_args__ = (
        Index('idx_dimension_api_name', 'api_name'),
        Index('idx_dimension_category', 'category'),
    )


class SavedQuery(Base):
    """User-saved report queries"""
    __tablename__ = 'ga_saved_queries'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(String(50), ForeignKey('ga_properties.property_id'), nullable=False)
    query_name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Query configuration (same as Report)
    dimensions = Column(JSONB, nullable=False)
    metrics = Column(JSONB, nullable=False)
    date_ranges = Column(JSONB, nullable=False)
    dimension_filter = Column(JSONB)
    metric_filter = Column(JSONB)
    order_bys = Column(JSONB)
    
    # Metadata
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = Column(Boolean, default=False)
    tags = Column(JSONB)
    
    # Relationships
    property = relationship("PropertyInfo", back_populates="saved_queries")
    
    __table_args__ = (
        Index('idx_saved_query_property', 'property_id'),
        Index('idx_saved_query_name', 'query_name'),
        UniqueConstraint('property_id', 'query_name', name='uq_property_query_name'),
    )


class CachedReport(Base):
    """Cache for frequently accessed reports"""
    __tablename__ = 'ga_cached_reports'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cache_key = Column(String(100), unique=True, nullable=False, index=True)
    property_id = Column(String(50), nullable=False)
    
    # Request parameters
    request_params = Column(JSONB, nullable=False)
    
    # Response data
    response_data = Column(JSONB, nullable=False)
    row_count = Column(Integer)
    
    # Cache metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    hit_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_cache_expiry', 'expires_at'),
        Index('idx_cache_property', 'property_id'),
        CheckConstraint('expires_at > created_at', name='check_expiry_after_creation'),
    )


class AuditLog(Base):
    """Audit log for GA API requests"""
    __tablename__ = 'ga_audit_logs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Request details
    property_id = Column(String(50))
    request_type = Column(String(50))  # e.g., 'run_report', 'get_metadata'
    request_params = Column(JSONB)
    
    # Response details
    status_code = Column(Integer)
    error_message = Column(Text)
    response_time_ms = Column(Integer)
    row_count = Column(Integer)
    
    # API quota tracking
    tokens_consumed = Column(Integer)
    quota_remaining = Column(Integer)
    
    # User/session tracking
    user_id = Column(String(255))
    session_id = Column(String(255))
    ip_address = Column(String(45))
    
    __table_args__ = (
        Index('idx_audit_timestamp', 'timestamp'),
        Index('idx_audit_property', 'property_id'),
        Index('idx_audit_user', 'user_id'),
    )


class ReportSchedule(Base):
    """Scheduled report generation"""
    __tablename__ = 'ga_report_schedules'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_name = Column(String(255), nullable=False)
    property_id = Column(String(50), nullable=False)
    
    # Report configuration
    report_config = Column(JSONB, nullable=False)
    
    # Schedule configuration
    cron_expression = Column(String(100))  # e.g., '0 0 * * *' for daily
    time_zone = Column(String(100), default='UTC')
    is_active = Column(Boolean, default=True)
    
    # Execution tracking
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    failure_count = Column(Integer, default=0)
    
    # Metadata
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_schedule_active', 'is_active'),
        Index('idx_schedule_next_run', 'next_run'),
    )