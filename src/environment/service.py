"""
Service layer for environment variable management.
"""
import json
import re
import yaml
import bleach
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from cryptography.fernet import Fernet
import logging

from .models import EnvironmentVariable, EnvironmentVariableHistory, EnvironmentVariableTemplate
from .security import key_manager
from .schemas import (
    EnvironmentVariableCreate,
    EnvironmentVariableUpdate,
    EnvironmentVariableBulkUpdate,
    EnvironmentVariableTemplateCreate,
    EnvironmentVariableExport,
    EnvironmentVariableImport,
    EnvironmentVariableImportResult,
    EnvironmentVariableValidationResult,
)

logger = logging.getLogger(__name__)


class EnvironmentVariableService:
    """Service for managing environment variables."""
    
    def __init__(self, db: Session):
        """
        Initialize the service.
        
        Args:
            db: Database session
        """
        self.db = db
        # Use the secure key manager instead of passed key
        self.key_manager = key_manager
    
    def _encrypt_value(self, value: str) -> str:
        """Encrypt a sensitive value using secure key manager."""
        if not self.key_manager.is_available():
            logger.warning("Encryption not available, storing value unencrypted")
            return value
        
        encrypted = self.key_manager.encrypt(value)
        return encrypted if encrypted is not None else value
    
    def _decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt a sensitive value using secure key manager."""
        if not self.key_manager.is_available():
            logger.warning("Encryption not available, returning value as-is")
            return encrypted_value
        
        decrypted = self.key_manager.decrypt(encrypted_value)
        return decrypted if decrypted is not None else encrypted_value
    
    def _sanitize_input(self, value: str) -> str:
        """Sanitize input to prevent XSS and other injection attacks."""
        if not isinstance(value, str):
            return str(value)
        
        # Remove HTML tags and attributes
        cleaned = bleach.clean(value, tags=[], attributes={}, strip=True)
        
        # Additional sanitization for special characters
        cleaned = re.sub(r'[<>&"\'`]', '', cleaned)
        
        return cleaned.strip()
    
    def get_variables(
        self, 
        category: Optional[str] = None,
        organization_id: Optional[str] = None,
        include_secrets: bool = False,
        search: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[EnvironmentVariable]:
        """
        Get environment variables with optional filtering.
        
        Args:
            category: Filter by category
            organization_id: Filter by organization
            include_secrets: Whether to include decrypted secret values
            search: Search term for key or description
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            List of environment variables
        """
        query = self.db.query(EnvironmentVariable)
        
        # Apply filters
        filters = []
        if category:
            filters.append(EnvironmentVariable.category == category.lower())
        if organization_id:
            filters.append(EnvironmentVariable.organization_id == organization_id)
        
        if filters:
            query = query.filter(and_(*filters))
        
        # Apply search with SQL injection protection
        if search:
            # Sanitize search input
            sanitized_search = self._sanitize_input(search)
            search_term = f"%{sanitized_search.lower()}%"
            
            # Use parameterized queries to prevent SQL injection
            query = query.filter(
                or_(
                    text("LOWER(key) LIKE :search").params(search=search_term),
                    text("LOWER(description) LIKE :search").params(search=search_term)
                )
            )
        
        # Apply ordering
        query = query.order_by(EnvironmentVariable.category, EnvironmentVariable.key)
        
        # Apply pagination
        if offset:
            query = query.offset(offset)
        if limit:
            query = query.limit(limit)
        
        variables = query.all()
        
        # Handle secret value decryption
        if not include_secrets:
            for var in variables:
                if var.value_type == "secret" and var.value:
                    var.value = "••••••••"
        else:
            for var in variables:
                if var.value_type == "secret" and var.value:
                    var.value = self._decrypt_value(var.value)
        
        return variables
    
    def get_variable(
        self, 
        category: str, 
        key: str, 
        organization_id: Optional[str] = None,
        include_secret: bool = False
    ) -> Optional[EnvironmentVariable]:
        """
        Get a specific environment variable.
        
        Args:
            category: Variable category
            key: Variable key
            organization_id: Organization ID
            include_secret: Whether to include decrypted secret value
            
        Returns:
            Environment variable or None if not found
        """
        filters = [
            EnvironmentVariable.category == category.lower(),
            EnvironmentVariable.key == key.upper()
        ]
        
        if organization_id:
            filters.append(EnvironmentVariable.organization_id == organization_id)
        
        variable = self.db.query(EnvironmentVariable).filter(and_(*filters)).first()
        
        if variable and variable.value_type == "secret" and variable.value:
            if include_secret:
                variable.value = self._decrypt_value(variable.value)
            else:
                variable.value = "••••••••"
        
        return variable
    
    def create_variable(
        self, 
        variable_data: EnvironmentVariableCreate,
        organization_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> EnvironmentVariable:
        """
        Create a new environment variable with comprehensive error handling.
        
        Args:
            variable_data: Variable data
            organization_id: Organization ID
            created_by: User who created the variable
            
        Returns:
            Created environment variable
            
        Raises:
            ValueError: If variable already exists or validation fails
            RuntimeError: If database operation fails
        """
        try:
            # Sanitize inputs
            sanitized_category = self._sanitize_input(variable_data.category)
            sanitized_key = self._sanitize_input(variable_data.key)
            sanitized_description = self._sanitize_input(variable_data.description or "")
            
            # Check if variable already exists
            existing = self.get_variable(
                sanitized_category, 
                sanitized_key, 
                organization_id
            )
            if existing:
                raise ValueError(f"Variable {sanitized_category}/{sanitized_key} already exists")
            
            # Validate the value
            validation_result = self.validate_value(variable_data)
            if not validation_result.is_valid:
                raise ValueError(validation_result.error_message)
            
            # Create new variable
            variable = EnvironmentVariable(
                category=sanitized_category.lower(),
                key=sanitized_key.upper(),
                value_type=variable_data.value_type,
                description=sanitized_description,
                is_editable=variable_data.is_editable,
                validation_regex=variable_data.validation_regex,
                options=variable_data.options,
                organization_id=organization_id,
                last_modified_by=created_by
            )
            
            # Set the value with appropriate handling for secrets
            if variable_data.value_type == "secret" and variable_data.value:
                variable.value = self._encrypt_value(str(variable_data.value))
            else:
                variable.set_typed_value(variable_data.value)
            
            # Database transaction with error handling
            self.db.add(variable)
            self.db.commit()
            self.db.refresh(variable)
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Integrity constraint violation: {e}")
            raise ValueError(f"Variable {sanitized_category}/{sanitized_key} already exists")
        except OperationalError as e:
            self.db.rollback()
            logger.error(f"Database operational error: {e}")
            raise RuntimeError(f"Database error occurred: {str(e)}")
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error: {e}")
            raise RuntimeError(f"Database operation failed: {str(e)}")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error creating variable: {e}")
            raise RuntimeError(f"Failed to create variable: {str(e)}")
        
        try:
            # Create history entry
            self._create_history_entry(
                variable.id,
                None,
                variable.value if variable.value_type != "secret" else None,
                created_by or "system",
                "Variable created"
            )
        except Exception as e:
            logger.warning(f"Failed to create history entry: {e}")
        
        return variable
    
    def update_variable(
        self, 
        category: str,
        key: str,
        update_data: EnvironmentVariableUpdate,
        organization_id: Optional[str] = None,
        updated_by: Optional[str] = None
    ) -> EnvironmentVariable:
        """
        Update an environment variable.
        
        Args:
            category: Variable category
            key: Variable key
            update_data: Update data
            organization_id: Organization ID
            updated_by: User who updated the variable
            
        Returns:
            Updated environment variable
            
        Raises:
            ValueError: If variable not found or not editable
        """
        variable = self.get_variable(category, key, organization_id, include_secret=True)
        if not variable:
            raise ValueError(f"Variable {category}/{key} not found")
        
        if not variable.is_editable:
            raise ValueError(f"Variable {category}/{key} is not editable")
        
        # Validate the new value
        temp_data = EnvironmentVariableCreate(
            category=variable.category,
            key=variable.key,
            value=update_data.value,
            value_type=variable.value_type,
            validation_regex=variable.validation_regex,
            options=variable.options
        )
        validation_result = self.validate_value(temp_data)
        if not validation_result.is_valid:
            raise ValueError(validation_result.error_message)
        
        # Store previous value for history
        previous_value = variable.value if variable.value_type != "secret" else None
        
        # Update the value
        if variable.value_type == "secret" and update_data.value != "••••••••":
            variable.value = self._encrypt_value(str(update_data.value))
        else:
            variable.set_typed_value(update_data.value)
        
        variable.updated_at = datetime.utcnow()
        variable.last_modified_by = updated_by
        
        self.db.commit()
        self.db.refresh(variable)
        
        # Create history entry
        new_value = variable.value if variable.value_type != "secret" else None
        self._create_history_entry(
            variable.id,
            previous_value,
            new_value,
            updated_by or "system",
            update_data.notes
        )
        
        return variable
    
    def delete_variable(
        self, 
        category: str,
        key: str,
        organization_id: Optional[str] = None,
        deleted_by: Optional[str] = None
    ) -> bool:
        """
        Delete an environment variable.
        
        Args:
            category: Variable category
            key: Variable key
            organization_id: Organization ID
            deleted_by: User who deleted the variable
            
        Returns:
            True if deleted, False if not found
        """
        variable = self.get_variable(category, key, organization_id)
        if not variable:
            return False
        
        # Create history entry for deletion
        self._create_history_entry(
            variable.id,
            variable.value if variable.value_type != "secret" else None,
            None,
            deleted_by or "system",
            "Variable deleted"
        )
        
        self.db.delete(variable)
        self.db.commit()
        
        return True
    
    def bulk_update_variables(
        self,
        update_data: EnvironmentVariableBulkUpdate,
        organization_id: Optional[str] = None,
        updated_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Bulk update multiple environment variables.
        
        Args:
            update_data: Bulk update data
            organization_id: Organization ID
            updated_by: User who performed the update
            
        Returns:
            Results summary
        """
        results = {
            "success": 0,
            "errors": 0,
            "details": []
        }
        
        for var_data in update_data.variables:
            try:
                update = EnvironmentVariableUpdate(
                    value=var_data["value"],
                    notes=update_data.notes
                )
                
                self.update_variable(
                    var_data["category"],
                    var_data["key"],
                    update,
                    organization_id,
                    updated_by
                )
                
                results["success"] += 1
                results["details"].append({
                    "category": var_data["category"],
                    "key": var_data["key"],
                    "status": "success"
                })
                
            except Exception as e:
                results["errors"] += 1
                results["details"].append({
                    "category": var_data.get("category", "unknown"),
                    "key": var_data.get("key", "unknown"),
                    "status": "error",
                    "error": str(e)
                })
        
        return results
    
    def get_variable_history(
        self,
        category: Optional[str] = None,
        key: Optional[str] = None,
        organization_id: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[EnvironmentVariableHistory]:
        """
        Get variable change history.
        
        Args:
            category: Filter by category
            key: Filter by key
            organization_id: Organization ID
            limit: Maximum number of results
            
        Returns:
            List of history entries
        """
        query = self.db.query(EnvironmentVariableHistory)
        
        if category and key:
            variable = self.get_variable(category, key, organization_id)
            if variable:
                query = query.filter(EnvironmentVariableHistory.variable_id == variable.id)
            else:
                return []
        
        query = query.order_by(EnvironmentVariableHistory.changed_at.desc())
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    def get_categories(self, organization_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get list of variable categories with counts.
        
        Args:
            organization_id: Organization ID
            
        Returns:
            List of category information
        """
        query = self.db.query(
            EnvironmentVariable.category,
            func.count(EnvironmentVariable.id).label('count'),
            func.max(EnvironmentVariable.updated_at).label('last_modified')
        )
        
        if organization_id:
            query = query.filter(EnvironmentVariable.organization_id == organization_id)
        
        query = query.group_by(EnvironmentVariable.category)
        query = query.order_by(EnvironmentVariable.category)
        
        results = query.all()
        
        categories = []
        for result in results:
            categories.append({
                "category": result.category,
                "count": result.count,
                "last_modified": result.last_modified
            })
        
        return categories
    
    def validate_value(self, variable_data: EnvironmentVariableCreate) -> EnvironmentVariableValidationResult:
        """
        Validate an environment variable value.
        
        Args:
            variable_data: Variable data to validate
            
        Returns:
            Validation result
        """
        try:
            # Type validation
            if variable_data.value_type == "number":
                try:
                    float(variable_data.value)
                except (ValueError, TypeError):
                    return EnvironmentVariableValidationResult(
                        is_valid=False,
                        error_message="Value must be a valid number"
                    )
            
            elif variable_data.value_type == "boolean":
                if not isinstance(variable_data.value, bool):
                    if isinstance(variable_data.value, str):
                        if variable_data.value.lower() not in ("true", "false", "1", "0", "yes", "no"):
                            return EnvironmentVariableValidationResult(
                                is_valid=False,
                                error_message="Value must be a valid boolean (true/false)"
                            )
                    else:
                        return EnvironmentVariableValidationResult(
                            is_valid=False,
                            error_message="Value must be a boolean"
                        )
            
            elif variable_data.value_type == "json":
                if isinstance(variable_data.value, str):
                    try:
                        json.loads(variable_data.value)
                    except json.JSONDecodeError as e:
                        return EnvironmentVariableValidationResult(
                            is_valid=False,
                            error_message=f"Invalid JSON: {str(e)}"
                        )
            
            # Regex validation
            if variable_data.validation_regex and variable_data.value:
                try:
                    if not re.match(variable_data.validation_regex, str(variable_data.value)):
                        return EnvironmentVariableValidationResult(
                            is_valid=False,
                            error_message="Value does not match validation pattern"
                        )
                except re.error as e:
                    return EnvironmentVariableValidationResult(
                        is_valid=False,
                        error_message=f"Invalid regex pattern: {str(e)}"
                    )
            
            # Options validation
            if variable_data.options and variable_data.value not in variable_data.options:
                return EnvironmentVariableValidationResult(
                    is_valid=False,
                    error_message=f"Value must be one of: {', '.join(variable_data.options)}"
                )
            
            return EnvironmentVariableValidationResult(is_valid=True)
            
        except Exception as e:
            return EnvironmentVariableValidationResult(
                is_valid=False,
                error_message=f"Validation error: {str(e)}"
            )
    
    def export_variables(
        self,
        export_config: EnvironmentVariableExport,
        organization_id: Optional[str] = None
    ) -> str:
        """
        Export environment variables in specified format.
        
        Args:
            export_config: Export configuration
            organization_id: Organization ID
            
        Returns:
            Exported data as string
        """
        variables = self.get_variables(
            organization_id=organization_id,
            include_secrets=export_config.include_secrets
        )
        
        # Filter by categories if specified
        if export_config.categories:
            variables = [v for v in variables if v.category in export_config.categories]
        
        if export_config.format == "json":
            data = {}
            for var in variables:
                if var.category not in data:
                    data[var.category] = {}
                data[var.category][var.key] = var.typed_value
            return json.dumps(data, indent=2)
        
        elif export_config.format == "yaml":
            data = {}
            for var in variables:
                if var.category not in data:
                    data[var.category] = {}
                data[var.category][var.key] = var.typed_value
            return yaml.dump(data, default_flow_style=False)
        
        elif export_config.format == "env":
            lines = []
            for var in variables:
                if var.value is not None:
                    key = f"{var.category.upper()}_{var.key}"
                    value = str(var.typed_value)
                    # Escape quotes in value
                    if '"' in value or "'" in value or " " in value:
                        value = f'"{value.replace('"', '\\"')}"'
                    lines.append(f"{key}={value}")
            return "\n".join(lines)
        
        else:
            raise ValueError(f"Unsupported export format: {export_config.format}")
    
    def import_variables(
        self,
        import_config: EnvironmentVariableImport,
        organization_id: Optional[str] = None,
        imported_by: Optional[str] = None
    ) -> EnvironmentVariableImportResult:
        """
        Import environment variables from data.
        
        Args:
            import_config: Import configuration
            organization_id: Organization ID
            imported_by: User who performed the import
            
        Returns:
            Import result
        """
        result = EnvironmentVariableImportResult()
        
        try:
            # Parse import data
            if import_config.format == "json":
                if isinstance(import_config.data, str):
                    data = json.loads(import_config.data)
                else:
                    data = import_config.data
            
            elif import_config.format == "yaml":
                if isinstance(import_config.data, str):
                    data = yaml.safe_load(import_config.data)
                else:
                    data = import_config.data
            
            elif import_config.format == "env":
                data = {}
                lines = import_config.data.split("\n") if isinstance(import_config.data, str) else []
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        if "=" in line:
                            key, value = line.split("=", 1)
                            # Parse category and key from env var name
                            if "_" in key:
                                parts = key.split("_", 1)
                                category = parts[0].lower()
                                var_key = parts[1]
                                if category not in data:
                                    data[category] = {}
                                data[category][var_key] = value.strip('"\'')
            
            else:
                result.success = False
                result.errors.append(f"Unsupported import format: {import_config.format}")
                return result
            
            # Process variables
            for category, variables in data.items():
                for key, value in variables.items():
                    try:
                        existing = self.get_variable(category, key, organization_id)
                        
                        if existing:
                            if import_config.merge_strategy == "skip":
                                result.skipped_count += 1
                                continue
                            elif import_config.merge_strategy == "update":
                                if not import_config.dry_run:
                                    update_data = EnvironmentVariableUpdate(value=value)
                                    self.update_variable(
                                        category, key, update_data, 
                                        organization_id, imported_by
                                    )
                                result.updated_count += 1
                        else:
                            if not import_config.dry_run:
                                create_data = EnvironmentVariableCreate(
                                    category=category,
                                    key=key,
                                    value=value,
                                    value_type="string"  # Default type for imports
                                )
                                self.create_variable(
                                    create_data, organization_id, imported_by
                                )
                            result.imported_count += 1
                    
                    except Exception as e:
                        result.errors.append(f"Error processing {category}/{key}: {str(e)}")
            
            result.success = len(result.errors) == 0
            
        except Exception as e:
            result.success = False
            result.errors.append(f"Import failed: {str(e)}")
        
        return result
    
    def _create_history_entry(
        self,
        variable_id: str,
        previous_value: Optional[str],
        new_value: Optional[str],
        changed_by: str,
        notes: Optional[str] = None
    ) -> None:
        """Create a history entry for a variable change."""
        history = EnvironmentVariableHistory(
            variable_id=variable_id,
            previous_value=previous_value,
            new_value=new_value,
            changed_by=changed_by,
            notes=notes
        )
        
        self.db.add(history)
        self.db.commit()