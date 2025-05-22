"""
FastAPI routes for environment variable management.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .database import get_db
from ..auth.dependencies import get_current_active_user, has_permission
from .schemas import (
    EnvironmentVariableCreate,
    EnvironmentVariableUpdate,
    EnvironmentVariableResponse,
    EnvironmentVariableHistoryResponse,
    EnvironmentVariableBulkUpdate,
    EnvironmentVariableExport,
    EnvironmentVariableImport,
    EnvironmentVariableImportResult,
    EnvironmentVariableValidationResult,
    EnvironmentVariableCategoryInfo,
)
from .service import EnvironmentVariableService
import os

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/environment", tags=["environment"])
router.state.limiter = limiter
router.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def get_environment_service(db: Session = Depends(get_db)) -> EnvironmentVariableService:
    """Get environment variable service instance."""
    return EnvironmentVariableService(db)


@router.get("/categories", response_model=List[EnvironmentVariableCategoryInfo])
@limiter.limit("100/minute")
async def get_categories(
    request: Request,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Get all environment variable categories with counts."""
    try:
        # Get organization ID from current user context
        organization_id = getattr(current_user, 'organization_id', None)
        categories = service.get_categories(organization_id)
        
        return [
            EnvironmentVariableCategoryInfo(
                category=cat["category"],
                count=cat["count"],
                last_modified=cat["last_modified"]
            )
            for cat in categories
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}"
        )


@router.get("/variables", response_model=List[EnvironmentVariableResponse])
@limiter.limit("200/minute")
async def get_environment_variables(
    request: Request,
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search term"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: Optional[int] = Query(0, ge=0, description="Number of results to skip"),
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Get environment variables with optional filtering."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        variables = service.get_variables(
            category=category,
            organization_id=organization_id,
            search=search,
            limit=limit,
            offset=offset
        )
        
        return [
            EnvironmentVariableResponse(
                id=str(var.id),
                category=var.category,
                key=var.key,
                value=var.typed_value,
                value_type=var.value_type,
                description=var.description,
                is_editable=var.is_editable,
                validation_regex=var.validation_regex,
                options=var.options,
                created_at=var.created_at,
                updated_at=var.updated_at,
                last_modified_by=var.last_modified_by
            )
            for var in variables
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get environment variables: {str(e)}"
        )


@router.get("/{category}", response_model=List[EnvironmentVariableResponse])
async def get_environment_variables_by_category(
    category: str,
    search: Optional[str] = Query(None, description="Search term"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: Optional[int] = Query(0, ge=0, description="Number of results to skip"),
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Get environment variables for a specific category."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        variables = service.get_variables(
            category=category,
            organization_id=organization_id,
            search=search,
            limit=limit,
            offset=offset
        )
        
        return [
            EnvironmentVariableResponse(
                id=str(var.id),
                category=var.category,
                key=var.key,
                value=var.typed_value,
                value_type=var.value_type,
                description=var.description,
                is_editable=var.is_editable,
                validation_regex=var.validation_regex,
                options=var.options,
                created_at=var.created_at,
                updated_at=var.updated_at,
                last_modified_by=var.last_modified_by
            )
            for var in variables
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get environment variables for category {category}: {str(e)}"
        )


@router.get("/{category}/{key}", response_model=EnvironmentVariableResponse)
async def get_environment_variable(
    category: str,
    key: str,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Get a specific environment variable."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        variable = service.get_variable(category, key, organization_id)
        
        if not variable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment variable {category}/{key} not found"
            )
        
        return EnvironmentVariableResponse(
            id=str(variable.id),
            category=variable.category,
            key=variable.key,
            value=variable.typed_value,
            value_type=variable.value_type,
            description=variable.description,
            is_editable=variable.is_editable,
            validation_regex=variable.validation_regex,
            options=variable.options,
            created_at=variable.created_at,
            updated_at=variable.updated_at,
            last_modified_by=variable.last_modified_by
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get environment variable: {str(e)}"
        )


@router.post("/", response_model=EnvironmentVariableResponse)
async def create_environment_variable(
    variable_data: EnvironmentVariableCreate,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Create a new environment variable."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        username = getattr(current_user, 'email', 'unknown')
        
        variable = service.create_variable(
            variable_data,
            organization_id=organization_id,
            created_by=username
        )
        
        return EnvironmentVariableResponse(
            id=str(variable.id),
            category=variable.category,
            key=variable.key,
            value=variable.typed_value,
            value_type=variable.value_type,
            description=variable.description,
            is_editable=variable.is_editable,
            validation_regex=variable.validation_regex,
            options=variable.options,
            created_at=variable.created_at,
            updated_at=variable.updated_at,
            last_modified_by=variable.last_modified_by
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create environment variable: {str(e)}"
        )


@router.put("/{category}/{key}", response_model=EnvironmentVariableResponse)
async def update_environment_variable(
    category: str,
    key: str,
    update_data: EnvironmentVariableUpdate,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Update an environment variable."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        username = getattr(current_user, 'email', 'unknown')
        
        variable = service.update_variable(
            category,
            key,
            update_data,
            organization_id=organization_id,
            updated_by=username
        )
        
        return EnvironmentVariableResponse(
            id=str(variable.id),
            category=variable.category,
            key=variable.key,
            value=variable.typed_value if variable.value_type != "secret" else "••••••••",
            value_type=variable.value_type,
            description=variable.description,
            is_editable=variable.is_editable,
            validation_regex=variable.validation_regex,
            options=variable.options,
            created_at=variable.created_at,
            updated_at=variable.updated_at,
            last_modified_by=variable.last_modified_by
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update environment variable: {str(e)}"
        )


@router.delete("/{category}/{key}")
async def delete_environment_variable(
    category: str,
    key: str,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Delete an environment variable."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        username = getattr(current_user, 'email', 'unknown')
        
        success = service.delete_variable(
            category,
            key,
            organization_id=organization_id,
            deleted_by=username
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment variable {category}/{key} not found"
            )
        
        return {"message": f"Environment variable {category}/{key} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete environment variable: {str(e)}"
        )


@router.post("/bulk-update")
async def bulk_update_environment_variables(
    update_data: EnvironmentVariableBulkUpdate,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Bulk update multiple environment variables."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        username = getattr(current_user, 'email', 'unknown')
        
        results = service.bulk_update_variables(
            update_data,
            organization_id=organization_id,
            updated_by=username
        )
        
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update environment variables: {str(e)}"
        )


@router.get("/history/", response_model=List[EnvironmentVariableHistoryResponse])
async def get_environment_variable_history(
    category: Optional[str] = Query(None, description="Filter by category"),
    key: Optional[str] = Query(None, description="Filter by key"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Maximum number of results"),
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Get environment variable change history."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        history = service.get_variable_history(
            category=category,
            key=key,
            organization_id=organization_id,
            limit=limit
        )
        
        return [
            EnvironmentVariableHistoryResponse(
                id=str(entry.id),
                variable_id=str(entry.variable_id),
                previous_value=entry.previous_value,
                new_value=entry.new_value,
                changed_by=entry.changed_by,
                changed_at=entry.changed_at,
                notes=entry.notes
            )
            for entry in history
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get environment variable history: {str(e)}"
        )


@router.post("/validate", response_model=EnvironmentVariableValidationResult)
async def validate_environment_variable(
    variable_data: EnvironmentVariableCreate,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Validate an environment variable value."""
    try:
        result = service.validate_value(variable_data)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate environment variable: {str(e)}"
        )


@router.post("/export")
async def export_environment_variables(
    export_config: EnvironmentVariableExport,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Export environment variables in specified format."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        exported_data = service.export_variables(export_config, organization_id)
        
        # Determine content type based on format
        content_type = "text/plain"
        if export_config.format == "json":
            content_type = "application/json"
        elif export_config.format == "yaml":
            content_type = "application/x-yaml"
        
        from fastapi.responses import Response
        return Response(
            content=exported_data,
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename=environment_variables.{export_config.format}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export environment variables: {str(e)}"
        )


@router.post("/import", response_model=EnvironmentVariableImportResult)
async def import_environment_variables(
    import_config: EnvironmentVariableImport,
    service: EnvironmentVariableService = Depends(get_environment_service),
    current_user = Depends(get_current_active_user),
    _: bool = Depends(has_permission("manage_settings"))
):
    """Import environment variables from data."""
    try:
        organization_id = getattr(current_user, 'organization_id', None)
        username = getattr(current_user, 'email', 'unknown')
        
        result = service.import_variables(
            import_config,
            organization_id=organization_id,
            imported_by=username
        )
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import environment variables: {str(e)}"
        )