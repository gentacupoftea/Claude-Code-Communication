"""
Initial data setup for environment variables.
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from .models import EnvironmentVariable, EnvironmentVariableTemplate


def get_default_environment_variables() -> List[Dict[str, Any]]:
    """Get default environment variables configuration."""
    return [
        # API Configuration
        {
            "category": "api",
            "key": "BASE_URL",
            "value": "https://conea-service.run.app",
            "value_type": "string",
            "description": "Base URL for API endpoints",
            "is_editable": True,
        },
        {
            "category": "api",
            "key": "RATE_LIMIT_PER_MINUTE",
            "value": "100",
            "value_type": "number",
            "description": "API rate limit per minute",
            "is_editable": True,
        },
        {
            "category": "api",
            "key": "REQUEST_TIMEOUT",
            "value": "30",
            "value_type": "number",
            "description": "API request timeout in seconds",
            "is_editable": True,
        },
        {
            "category": "api",
            "key": "MAX_RETRIES",
            "value": "3",
            "value_type": "number",
            "description": "Maximum number of retry attempts",
            "is_editable": True,
        },
        
        # Authentication Configuration
        {
            "category": "auth",
            "key": "JWT_EXPIRATION",
            "value": "86400",
            "value_type": "number",
            "description": "JWT token expiration time in seconds (24 hours)",
            "is_editable": True,
        },
        {
            "category": "auth",
            "key": "REFRESH_TOKEN_EXPIRATION", 
            "value": "604800",
            "value_type": "number",
            "description": "Refresh token expiration time in seconds (7 days)",
            "is_editable": True,
        },
        {
            "category": "auth",
            "key": "PASSWORD_MIN_LENGTH",
            "value": "8",
            "value_type": "number",
            "description": "Minimum password length",
            "is_editable": True,
        },
        {
            "category": "auth",
            "key": "REQUIRE_EMAIL_VERIFICATION",
            "value": "true",
            "value_type": "boolean",
            "description": "Whether email verification is required",
            "is_editable": True,
        },
        
        # Feature Flags
        {
            "category": "features",
            "key": "ENABLE_GRAPHQL",
            "value": "false",
            "value_type": "boolean",
            "description": "Enable GraphQL API endpoint",
            "is_editable": True,
        },
        {
            "category": "features",
            "key": "ENABLE_WEBSOCKETS",
            "value": "true",
            "value_type": "boolean",
            "description": "Enable WebSocket connections",
            "is_editable": True,
        },
        {
            "category": "features",
            "key": "ENABLE_EXPORT",
            "value": "true",
            "value_type": "boolean",
            "description": "Enable data export functionality",
            "is_editable": True,
        },
        {
            "category": "features",
            "key": "ENABLE_IMPORT",
            "value": "true",
            "value_type": "boolean",
            "description": "Enable data import functionality",
            "is_editable": True,
        },
        
        # System Configuration
        {
            "category": "system",
            "key": "LOG_LEVEL",
            "value": "info",
            "value_type": "string",
            "description": "Application log level",
            "is_editable": True,
            "options": ["debug", "info", "warning", "error", "critical"],
        },
        {
            "category": "system",
            "key": "MAINTENANCE_MODE",
            "value": "false",
            "value_type": "boolean",
            "description": "Enable maintenance mode",
            "is_editable": True,
        },
        {
            "category": "system",
            "key": "MAX_UPLOAD_SIZE",
            "value": "10485760",
            "value_type": "number",
            "description": "Maximum file upload size in bytes (10MB)",
            "is_editable": True,
        },
        
        # Integration Configuration
        {
            "category": "integrations",
            "key": "SHOPIFY_API_VERSION",
            "value": "2024-01",
            "value_type": "string",
            "description": "Shopify API version to use",
            "is_editable": True,
            "options": ["2023-10", "2024-01", "2024-04", "2024-07", "2024-10"],
        },
        {
            "category": "integrations",
            "key": "CACHE_TTL",
            "value": "3600",
            "value_type": "number",
            "description": "Cache time-to-live in seconds (1 hour)",
            "is_editable": True,
        },
        
        # Database Configuration
        {
            "category": "database",
            "key": "POOL_SIZE",
            "value": "10",
            "value_type": "number",
            "description": "Database connection pool size",
            "is_editable": True,
        },
        {
            "category": "database",
            "key": "MAX_OVERFLOW",
            "value": "20",
            "value_type": "number",
            "description": "Maximum connection pool overflow",
            "is_editable": True,
        },
        
        # Security Configuration
        {
            "category": "security",
            "key": "CORS_ORIGINS",
            "value": '["*"]',
            "value_type": "json",
            "description": "Allowed CORS origins",
            "is_editable": True,
        },
        {
            "category": "security",
            "key": "SECURE_COOKIES",
            "value": "true",
            "value_type": "boolean",
            "description": "Use secure cookies",
            "is_editable": True,
        },
        {
            "category": "security",
            "key": "CSRF_PROTECTION",
            "value": "true",
            "value_type": "boolean",
            "description": "Enable CSRF protection",
            "is_editable": True,
        },
    ]


def get_default_templates() -> List[Dict[str, Any]]:
    """Get default environment variable templates."""
    return [
        {
            "name": "Development Environment",
            "description": "Default settings for development environment",
            "category": "development",
            "template_data": {
                "api": {
                    "BASE_URL": "http://localhost:8000",
                    "RATE_LIMIT_PER_MINUTE": 1000,
                    "REQUEST_TIMEOUT": 60
                },
                "auth": {
                    "JWT_EXPIRATION": 86400,
                    "REQUIRE_EMAIL_VERIFICATION": False
                },
                "features": {
                    "ENABLE_GRAPHQL": True,
                    "ENABLE_WEBSOCKETS": True
                },
                "system": {
                    "LOG_LEVEL": "debug",
                    "MAINTENANCE_MODE": False
                }
            },
            "is_global": True,
            "created_by": "system"
        },
        {
            "name": "Production Environment",
            "description": "Default settings for production environment",
            "category": "production",
            "template_data": {
                "api": {
                    "BASE_URL": "https://api.conea.com",
                    "RATE_LIMIT_PER_MINUTE": 100,
                    "REQUEST_TIMEOUT": 30
                },
                "auth": {
                    "JWT_EXPIRATION": 3600,
                    "REQUIRE_EMAIL_VERIFICATION": True
                },
                "features": {
                    "ENABLE_GRAPHQL": False,
                    "ENABLE_WEBSOCKETS": True
                },
                "system": {
                    "LOG_LEVEL": "error",
                    "MAINTENANCE_MODE": False
                },
                "security": {
                    "CORS_ORIGINS": ["https://conea.com"],
                    "SECURE_COOKIES": True,
                    "CSRF_PROTECTION": True
                }
            },
            "is_global": True,
            "created_by": "system"
        },
        {
            "name": "Staging Environment",
            "description": "Default settings for staging environment",
            "category": "staging",
            "template_data": {
                "api": {
                    "BASE_URL": "https://staging-api.conea.com",
                    "RATE_LIMIT_PER_MINUTE": 500,
                    "REQUEST_TIMEOUT": 30
                },
                "auth": {
                    "JWT_EXPIRATION": 7200,
                    "REQUIRE_EMAIL_VERIFICATION": True
                },
                "features": {
                    "ENABLE_GRAPHQL": True,
                    "ENABLE_WEBSOCKETS": True
                },
                "system": {
                    "LOG_LEVEL": "info",
                    "MAINTENANCE_MODE": False
                }
            },
            "is_global": True,
            "created_by": "system"
        },
        {
            "name": "High Performance",
            "description": "Settings optimized for high performance",
            "category": "performance",
            "template_data": {
                "api": {
                    "RATE_LIMIT_PER_MINUTE": 10000,
                    "REQUEST_TIMEOUT": 10,
                    "MAX_RETRIES": 1
                },
                "database": {
                    "POOL_SIZE": 50,
                    "MAX_OVERFLOW": 100
                },
                "integrations": {
                    "CACHE_TTL": 7200
                }
            },
            "is_global": True,
            "created_by": "system"
        },
        {
            "name": "Security Focused",
            "description": "Settings with enhanced security",
            "category": "security",
            "template_data": {
                "auth": {
                    "JWT_EXPIRATION": 900,
                    "REQUIRE_EMAIL_VERIFICATION": True,
                    "PASSWORD_MIN_LENGTH": 12
                },
                "security": {
                    "CORS_ORIGINS": ["https://conea.com"],
                    "SECURE_COOKIES": True,
                    "CSRF_PROTECTION": True
                },
                "system": {
                    "LOG_LEVEL": "info"
                }
            },
            "is_global": True,
            "created_by": "system"
        }
    ]


def initialize_environment_variables(db: Session, organization_id: str = None) -> None:
    """
    Initialize default environment variables.
    
    Args:
        db: Database session
        organization_id: Organization ID (None for global variables)
    """
    default_vars = get_default_environment_variables()
    
    for var_data in default_vars:
        # Check if variable already exists
        existing = db.query(EnvironmentVariable).filter(
            EnvironmentVariable.category == var_data["category"],
            EnvironmentVariable.key == var_data["key"],
            EnvironmentVariable.organization_id == organization_id
        ).first()
        
        if not existing:
            variable = EnvironmentVariable(
                category=var_data["category"],
                key=var_data["key"],
                value=var_data["value"],
                value_type=var_data["value_type"],
                description=var_data["description"],
                is_editable=var_data["is_editable"],
                options=var_data.get("options"),
                organization_id=organization_id,
                last_modified_by="system"
            )
            db.add(variable)
    
    db.commit()


def initialize_templates(db: Session, organization_id: str = None) -> None:
    """
    Initialize default environment variable templates.
    
    Args:
        db: Database session
        organization_id: Organization ID (None for global templates)
    """
    default_templates = get_default_templates()
    
    for template_data in default_templates:
        # Check if template already exists
        existing = db.query(EnvironmentVariableTemplate).filter(
            EnvironmentVariableTemplate.name == template_data["name"],
            EnvironmentVariableTemplate.organization_id == organization_id
        ).first()
        
        if not existing:
            template = EnvironmentVariableTemplate(
                name=template_data["name"],
                description=template_data["description"],
                category=template_data["category"],
                template_data=template_data["template_data"],
                is_global=template_data["is_global"],
                created_by=template_data["created_by"],
                organization_id=organization_id
            )
            db.add(template)
    
    db.commit()


def setup_initial_data(db: Session, organization_id: str = None) -> None:
    """
    Set up initial environment variables and templates.
    
    Args:
        db: Database session
        organization_id: Organization ID (None for global setup)
    """
    print("Setting up initial environment variables...")
    initialize_environment_variables(db, organization_id)
    
    print("Setting up initial environment variable templates...")
    initialize_templates(db, organization_id)
    
    print("Initial environment data setup completed!")


if __name__ == "__main__":
    # This can be run as a standalone script for initial setup
    from ..database import get_db
    
    db = next(get_db())
    try:
        setup_initial_data(db)
    finally:
        db.close()