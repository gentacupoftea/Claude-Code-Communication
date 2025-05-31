"""
Database models for environment variable management.
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey, 
    UniqueConstraint, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import json

from .database import Base


class EnvironmentVariable(Base):
    """
    Environment variable configuration model.
    
    Stores environment variables that can be managed through the UI
    and applied to the application at runtime.
    """
    __tablename__ = "environment_variables"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String(50), nullable=False, index=True)
    key = Column(String(100), nullable=False)
    value = Column(Text)
    value_type = Column(String(20), nullable=False, default="string")  # string, number, boolean, json, secret
    description = Column(Text)
    is_editable = Column(Boolean, nullable=False, default=True)
    validation_regex = Column(String(255))
    options = Column(JSON)  # For enum-type variables (list of valid options)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_modified_by = Column(String(100))
    
    # Organization context (multi-tenancy support)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # Relationships
    history = relationship("EnvironmentVariableHistory", back_populates="variable", cascade="all, delete-orphan")
    organization = relationship("Organization", foreign_keys=[organization_id])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('category', 'key', 'organization_id', name='uix_category_key_org'),
        Index('idx_env_var_category_org', 'category', 'organization_id'),
    )
    
    def __repr__(self):
        return f"<EnvironmentVariable(category='{self.category}', key='{self.key}')>"
    
    @property
    def typed_value(self) -> Any:
        """Get the value converted to its appropriate type."""
        if self.value is None:
            return None
        
        if self.value_type == "boolean":
            return self.value.lower() in ("true", "1", "yes", "on")
        elif self.value_type == "number":
            try:
                # Try integer first
                if '.' not in self.value:
                    return int(self.value)
                return float(self.value)
            except (ValueError, TypeError):
                return self.value
        elif self.value_type == "json":
            try:
                return json.loads(self.value)
            except (json.JSONDecodeError, TypeError):
                return self.value
        else:
            # string and secret types
            return self.value
    
    def set_typed_value(self, value: Any) -> None:
        """Set the value with appropriate type conversion."""
        if value is None:
            self.value = None
            return
        
        if self.value_type == "boolean":
            self.value = str(bool(value)).lower()
        elif self.value_type == "number":
            self.value = str(value)
        elif self.value_type == "json":
            if isinstance(value, (dict, list)):
                self.value = json.dumps(value)
            else:
                self.value = str(value)
        else:
            # string and secret types
            self.value = str(value)
    
    def is_valid_option(self, value: Any) -> bool:
        """Check if a value is in the list of valid options."""
        if not self.options:
            return True
        return value in self.options
    
    def to_dict(self, include_value: bool = True, mask_secrets: bool = True) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "id": str(self.id),
            "category": self.category,
            "key": self.key,
            "value_type": self.value_type,
            "description": self.description,
            "is_editable": self.is_editable,
            "validation_regex": self.validation_regex,
            "options": self.options,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_modified_by": self.last_modified_by,
        }
        
        if include_value:
            if self.value_type == "secret" and mask_secrets and self.value:
                result["value"] = "••••••••"
            else:
                result["value"] = self.typed_value
        
        return result


class EnvironmentVariableHistory(Base):
    """
    History of changes to environment variables.
    
    Tracks all modifications to environment variables for audit purposes.
    """
    __tablename__ = "environment_variable_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    variable_id = Column(UUID(as_uuid=True), ForeignKey("environment_variables.id"), nullable=False)
    previous_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(String(100), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)
    
    # Relationships
    variable = relationship("EnvironmentVariable", back_populates="history")
    
    # Indexes
    __table_args__ = (
        Index('idx_env_var_history_variable_id', 'variable_id'),
        Index('idx_env_var_history_changed_at', 'changed_at'),
    )
    
    def __repr__(self):
        return f"<EnvironmentVariableHistory(variable_id='{self.variable_id}', changed_at='{self.changed_at}')>"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "id": str(self.id),
            "variable_id": str(self.variable_id),
            "previous_value": self.previous_value,
            "new_value": self.new_value,
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
            "notes": self.notes,
        }


class EnvironmentVariableTemplate(Base):
    """
    Templates for common environment variable configurations.
    
    Provides predefined sets of environment variables for different
    deployment scenarios or feature sets.
    """
    __tablename__ = "environment_variable_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50), nullable=False)
    template_data = Column(JSON, nullable=False)  # JSON structure of variables
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100))
    
    # Organization context
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    is_global = Column(Boolean, default=False)  # Global templates available to all organizations
    
    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('name', 'organization_id', name='uix_template_name_org'),
        Index('idx_template_category', 'category'),
    )
    
    def __repr__(self):
        return f"<EnvironmentVariableTemplate(name='{self.name}', category='{self.category}')>"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "template_data": self.template_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "is_global": self.is_global,
        }