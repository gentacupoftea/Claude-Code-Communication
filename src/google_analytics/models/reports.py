"""
Google Analytics Report Storage Models
Handles persistent storage of GA reports and their data
"""

import uuid
import json
import gzip
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, BYTEA
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class GAReport(Base):
    """
    Google Analytics Report metadata and configuration
    """
    __tablename__ = 'ga_reports'

    # Primary key and identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(String(255), unique=True, nullable=False, index=True)
    
    # Connection and user info
    connection_id = Column(String(255), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    
    # Report configuration
    report_name = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False)  # standard, realtime, custom
    property_id = Column(String(50), nullable=False)
    
    # Query parameters (stored as JSON)
    date_range = Column(JSONB)  # start_date, end_date
    dimensions = Column(JSONB)  # List of dimension names
    metrics = Column(JSONB)    # List of metric names
    filters = Column(JSONB)    # Query filters
    order_by = Column(JSONB)   # Sorting configuration
    
    # Status and metadata
    status = Column(String(50), default='pending')  # pending, processing, completed, failed
    row_count = Column(Integer, default=0)
    data_size_bytes = Column(Integer, default=0)
    is_cached = Column(Boolean, default=False)
    cache_expires_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True))
    
    # Error information
    error_message = Column(Text)
    error_details = Column(JSONB)
    
    # Relationships
    report_data = relationship("GAReportData", back_populates="report", cascade="all, delete-orphan")
    
    def update_status(self, status: str, error_message: str = None, error_details: Dict = None):
        """Update report status"""
        self.status = status
        self.updated_at = datetime.utcnow()
        
        if status == 'completed':
            self.completed_at = datetime.utcnow()
        elif status == 'failed':
            self.error_message = error_message
            self.error_details = error_details
    
    def set_cache_expiry(self, ttl_seconds: int):
        """Set cache expiry time"""
        self.cache_expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
        self.is_cached = True
    
    def is_cache_expired(self) -> bool:
        """Check if cached report has expired"""
        if not self.is_cached or not self.cache_expires_at:
            return True
        return datetime.utcnow() > self.cache_expires_at.replace(tzinfo=None)
    
    def to_dict(self, include_data: bool = False) -> Dict[str, Any]:
        """Convert report to dictionary"""
        data = {
            'id': str(self.id),
            'report_id': self.report_id,
            'connection_id': self.connection_id,
            'user_id': self.user_id,
            'report_name': self.report_name,
            'report_type': self.report_type,
            'property_id': self.property_id,
            'date_range': self.date_range,
            'dimensions': self.dimensions,
            'metrics': self.metrics,
            'filters': self.filters,
            'order_by': self.order_by,
            'status': self.status,
            'row_count': self.row_count,
            'data_size_bytes': self.data_size_bytes,
            'is_cached': self.is_cached,
            'cache_expires_at': self.cache_expires_at.isoformat() if self.cache_expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error_message': self.error_message,
            'error_details': self.error_details
        }
        
        if include_data and self.report_data:
            data['data'] = [row.to_dict() for row in self.report_data]
        
        return data


class GAReportData(Base):
    """
    Google Analytics Report row data with compression support
    """
    __tablename__ = 'ga_report_data'

    # Primary key and relationships
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey('ga_reports.id'), nullable=False)
    
    # Data storage
    row_index = Column(Integer, nullable=False)  # Row number within the report
    dimensions_data = Column(JSONB)  # Dimension values for this row
    metrics_data = Column(JSONB)     # Metric values for this row
    
    # Optional: Compressed storage for large datasets
    compressed_data = Column(BYTEA)  # Gzip compressed JSON data
    is_compressed = Column(Boolean, default=False)
    
    # Metadata
    data_hash = Column(String(64))  # Hash of the data for deduplication
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    report = relationship("GAReport", back_populates="report_data")
    
    def set_data(self, dimensions: Dict[str, Any], metrics: Dict[str, Any], compress: bool = True):
        """Set row data with optional compression"""
        self.dimensions_data = dimensions
        self.metrics_data = metrics
        
        # Calculate hash for deduplication
        import hashlib
        data_str = json.dumps({'dimensions': dimensions, 'metrics': metrics}, sort_keys=True)
        self.data_hash = hashlib.sha256(data_str.encode()).hexdigest()
        
        # Compress data if requested and size is significant
        if compress and len(data_str) > 1000:  # Only compress if > 1KB
            try:
                compressed = gzip.compress(data_str.encode())
                if len(compressed) < len(data_str.encode()) * 0.8:  # Only if compression saves 20%+
                    self.compressed_data = compressed
                    self.is_compressed = True
                    # Clear uncompressed data to save space
                    self.dimensions_data = None
                    self.metrics_data = None
            except Exception:
                # If compression fails, keep uncompressed data
                pass
    
    def get_data(self) -> Dict[str, Dict[str, Any]]:
        """Get row data, decompressing if necessary"""
        if self.is_compressed and self.compressed_data:
            try:
                decompressed = gzip.decompress(self.compressed_data)
                data = json.loads(decompressed.decode())
                return data
            except Exception:
                # Fall back to uncompressed data if decompression fails
                pass
        
        return {
            'dimensions': self.dimensions_data or {},
            'metrics': self.metrics_data or {}
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert report data row to dictionary"""
        data = self.get_data()
        return {
            'id': str(self.id),
            'row_index': self.row_index,
            'dimensions': data['dimensions'],
            'metrics': data['metrics'],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# Indexes for better query performance
Index('idx_ga_reports_connection_user', GAReport.connection_id, GAReport.user_id)
Index('idx_ga_reports_property_date', GAReport.property_id, GAReport.created_at)
Index('idx_ga_reports_status_created', GAReport.status, GAReport.created_at)
Index('idx_ga_report_data_report_row', GAReportData.report_id, GAReportData.row_index)
Index('idx_ga_report_data_hash', GAReportData.data_hash)  # For deduplication


class GAReportStorage:
    """
    Helper class for managing GA report storage operations
    """
    
    @staticmethod
    def estimate_storage_size(data: List[Dict]) -> int:
        """Estimate storage size for report data"""
        if not data:
            return 0
        
        # Sample size estimation based on first few rows
        sample_size = min(len(data), 10)
        sample_data = data[:sample_size]
        
        total_size = 0
        for row in sample_data:
            total_size += len(json.dumps(row))
        
        # Extrapolate to full dataset
        avg_row_size = total_size / sample_size if sample_size > 0 else 0
        return int(avg_row_size * len(data))
    
    @staticmethod
    def should_compress(data_size: int) -> bool:
        """Determine if data should be compressed based on size"""
        return data_size > 10000  # Compress if > 10KB
    
    @staticmethod
    def chunk_large_reports(data: List[Dict], max_chunk_size: int = 1000) -> List[List[Dict]]:
        """Split large reports into smaller chunks for better performance"""
        if len(data) <= max_chunk_size:
            return [data]
        
        chunks = []
        for i in range(0, len(data), max_chunk_size):
            chunks.append(data[i:i + max_chunk_size])
        
        return chunks