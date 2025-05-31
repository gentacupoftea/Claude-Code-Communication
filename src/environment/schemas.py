"""
Pydantic schemas for environment variable management API.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, validator
import json


class EnvironmentVariableBase(BaseModel):
    """Base schema for environment variables."""
    category: str = Field(..., description="Category of the environment variable")
    key: str = Field(..., description="Key name of the environment variable")
    value: Optional[Any] = Field(None, description="Value of the environment variable")
    value_type: str = Field(
        default="string", 
        description="Type of the value (string, number, boolean, json, secret)"
    )
    description: Optional[str] = Field(None, description="Description of the variable")
    is_editable: bool = Field(default=True, description="Whether the variable can be edited")
    validation_regex: Optional[str] = Field(None, description="Regex pattern for value validation")
    options: Optional[List[str]] = Field(None, description="List of valid options for enum-type variables")
    
    @validator("value_type")
    def validate_value_type(cls, v):
        """Validate value type."""
        valid_types = {"string", "number", "boolean", "json", "secret"}
        if v not in valid_types:
            raise ValueError(f"Invalid value type. Must be one of: {', '.join(valid_types)}")
        return v
    
    @validator("category")
    def validate_category(cls, v):
        """Validate category name."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Category cannot be empty")
        return v.strip().lower()
    
    @validator("key")
    def validate_key(cls, v):
        """Validate key name."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Key cannot be empty")
        # Allow only alphanumeric characters, underscores, and hyphens
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', v.strip()):
            raise ValueError("Key can only contain alphanumeric characters, underscores, and hyphens")
        return v.strip().upper()


class EnvironmentVariableCreate(EnvironmentVariableBase):
    """Schema for creating environment variables."""
    pass


class EnvironmentVariableUpdate(BaseModel):
    """Schema for updating environment variables."""
    value: Any = Field(..., description="New value for the environment variable")
    notes: Optional[str] = Field(None, description="Notes about the change")


class EnvironmentVariableResponse(EnvironmentVariableBase):
    """Schema for environment variable responses."""
    id: str = Field(..., description="Unique identifier")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    last_modified_by: Optional[str] = Field(None, description="User who last modified the variable")
    
    class Config:
        from_attributes = True


class EnvironmentVariableHistoryResponse(BaseModel):
    """Schema for environment variable history responses."""
    id: str = Field(..., description="Unique identifier")
    variable_id: str = Field(..., description="ID of the environment variable")
    previous_value: Optional[str] = Field(None, description="Previous value")
    new_value: Optional[str] = Field(None, description="New value")
    changed_by: str = Field(..., description="User who made the change")
    changed_at: datetime = Field(..., description="Timestamp of the change")
    notes: Optional[str] = Field(None, description="Notes about the change")
    
    class Config:
        from_attributes = True


class EnvironmentVariablesBulkUpdate(BaseModel):
    """Schema for bulk updating environment variables."""
    variables: List[Dict[str, Any]] = Field(..., description="List of variables to update")
    notes: Optional[str] = Field(None, description="Notes about the bulk update")
    
    @validator("variables")
    def validate_variables(cls, v):
        """Validate variables list."""
        if not v:
            raise ValueError("Variables list cannot be empty")
        
        required_fields = {"category", "key", "value"}
        for i, var in enumerate(v):
            if not isinstance(var, dict):
                raise ValueError(f"Variable at index {i} must be a dictionary")
            
            missing_fields = required_fields - set(var.keys())
            if missing_fields:
                raise ValueError(f"Variable at index {i} is missing required fields: {', '.join(missing_fields)}")
        
        return v


class EnvironmentVariableTemplateBase(BaseModel):
    """Base schema for environment variable templates."""
    name: str = Field(..., description="Name of the template")
    description: Optional[str] = Field(None, description="Description of the template")
    category: str = Field(..., description="Category of the template")
    template_data: Dict[str, Any] = Field(..., description="Template data structure")
    is_global: bool = Field(default=False, description="Whether the template is global")


class EnvironmentVariableTemplateCreate(EnvironmentVariableTemplateBase):
    """Schema for creating environment variable templates."""
    pass


class EnvironmentVariableTemplateResponse(EnvironmentVariableTemplateBase):
    """Schema for environment variable template responses."""
    id: str = Field(..., description="Unique identifier")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="User who created the template")
    
    class Config:
        from_attributes = True


class EnvironmentVariableCategoryInfo(BaseModel):
    """Schema for environment variable category information."""
    category: str = Field(..., description="Category name")
    count: int = Field(..., description="Number of variables in this category")
    description: Optional[str] = Field(None, description="Category description")
    last_modified: Optional[datetime] = Field(None, description="Last modification time")


class EnvironmentVariableValidationResult(BaseModel):
    """Schema for environment variable validation results."""
    is_valid: bool = Field(..., description="Whether the value is valid")
    error_message: Optional[str] = Field(None, description="Error message if validation failed")
    suggested_value: Optional[Any] = Field(None, description="Suggested corrected value")


class EnvironmentVariableExport(BaseModel):
    """Schema for exporting environment variables."""
    format: str = Field(default="json", description="Export format (json, yaml, env)")
    categories: Optional[List[str]] = Field(None, description="Categories to include (all if None)")
    include_secrets: bool = Field(default=False, description="Whether to include secret values")
    
    @validator("format")
    def validate_format(cls, v):
        """Validate export format."""
        valid_formats = {"json", "yaml", "env"}
        if v not in valid_formats:
            raise ValueError(f"Invalid format. Must be one of: {', '.join(valid_formats)}")
        return v


class EnvironmentVariableImport(BaseModel):
    """Schema for importing environment variables."""
    data: Union[str, Dict[str, Any]] = Field(..., description="Import data")
    format: str = Field(default="json", description="Import format (json, yaml, env)")
    merge_strategy: str = Field(default="update", description="Merge strategy (update, replace, skip)")
    dry_run: bool = Field(default=False, description="Whether to perform a dry run")
    
    @validator("format")
    def validate_format(cls, v):
        """Validate import format."""
        valid_formats = {"json", "yaml", "env"}
        if v not in valid_formats:
            raise ValueError(f"Invalid format. Must be one of: {', '.join(valid_formats)}")
        return v
    
    @validator("merge_strategy")
    def validate_merge_strategy(cls, v):
        """Validate merge strategy."""
        valid_strategies = {"update", "replace", "skip"}
        if v not in valid_strategies:
            raise ValueError(f"Invalid merge strategy. Must be one of: {', '.join(valid_strategies)}")
        return v


class EnvironmentVariableImportResult(BaseModel):
    """Schema for environment variable import results."""
    success: bool = Field(..., description="Whether the import was successful")
    imported_count: int = Field(default=0, description="Number of variables imported")
    updated_count: int = Field(default=0, description="Number of variables updated")
    skipped_count: int = Field(default=0, description="Number of variables skipped")
    errors: List[str] = Field(default_factory=list, description="List of error messages")
    warnings: List[str] = Field(default_factory=list, description="List of warning messages")