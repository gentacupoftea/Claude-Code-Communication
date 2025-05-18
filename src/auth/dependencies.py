"""
Authentication and authorization dependencies
"""
import logging
from functools import wraps
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .models import User
from .services import AuthService, AuthorizationService, APITokenService
from .security import PasswordManager, JWTManager, InvalidTokenError
from .permissions import RolePermissionManager
from .config import get_auth_settings
from .database import get_db

logger = logging.getLogger(__name__)

# OAuth2 configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# API Key header configuration
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_password_manager() -> PasswordManager:
    """Get password manager instance"""
    return PasswordManager()


def get_jwt_manager() -> JWTManager:
    """Get JWT manager instance"""
    settings = get_auth_settings()
    return JWTManager(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        access_token_expire_minutes=settings.access_token_expire_minutes,
        refresh_token_expire_minutes=settings.refresh_token_expire_minutes
    )


def get_role_permission_manager() -> RolePermissionManager:
    """Get role permission manager instance"""
    return RolePermissionManager()


def get_auth_service(
    db: Session = Depends(get_db),
    password_manager: PasswordManager = Depends(get_password_manager),
    jwt_manager: JWTManager = Depends(get_jwt_manager)
) -> AuthService:
    """Get authentication service instance"""
    return AuthService(db, password_manager, jwt_manager)


def get_authorization_service(
    db: Session = Depends(get_db),
    role_permission_manager: RolePermissionManager = Depends(get_role_permission_manager)
) -> AuthorizationService:
    """Get authorization service instance"""
    return AuthorizationService(db, role_permission_manager)


def get_api_token_service(
    db: Session = Depends(get_db)
) -> APITokenService:
    """Get API token service instance"""
    return APITokenService(db)


async def get_current_user_from_token(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service)
) -> Optional[User]:
    """Get current user from JWT token"""
    user = await auth_service.get_current_user(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_user_from_api_key(
    api_key: Optional[str] = Depends(api_key_header),
    token_service: APITokenService = Depends(get_api_token_service),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user from API key"""
    if not api_key:
        return None
    
    token = await token_service.verify_token(api_key)
    if not token:
        return None
    
    user = db.query(User).filter(User.id == token.user_id).first()
    return user if user and user.is_active else None


async def get_current_user(
    user_from_token: Optional[User] = Depends(get_current_user_from_token),
    user_from_api_key: Optional[User] = Depends(get_current_user_from_api_key)
) -> User:
    """Get current user from either JWT token or API key"""
    # Try JWT token first
    if user_from_token:
        return user_from_token
    
    # Try API key next
    if user_from_api_key:
        return user_from_api_key
    
    # No valid authentication found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def get_superuser(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Get superuser only"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def require_permission(permission: str, organization_param: str = "org_id"):
    """Decorator for requiring specific permission in an organization"""
    def decorator(func):
        @wraps(func)
        async def wrapper(
            *args,
            current_user: User = Depends(get_current_active_user),
            auth_service: AuthorizationService = Depends(get_authorization_service),
            **kwargs
        ):
            # Extract organization ID from path parameters
            org_id = kwargs.get(organization_param)
            if not org_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Missing organization parameter: {organization_param}"
                )
            
            # Superusers have all permissions
            if current_user.is_superuser:
                return await func(*args, current_user=current_user, 
                                auth_service=auth_service, **kwargs)
            
            # Check permission
            has_permission = await auth_service.check_permission(
                current_user.id, org_id, permission
            )
            
            if not has_permission:
                logger.warning(
                    f"User {current_user.id} denied permission {permission} "
                    f"in organization {org_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enough permissions"
                )
            
            return await func(*args, current_user=current_user, 
                            auth_service=auth_service, **kwargs)
        return wrapper
    return decorator


def require_organization_access(organization_param: str = "org_id"):
    """Decorator for requiring basic organization access"""
    return require_permission("read:analytics", organization_param)


class RateLimitDependency:
    """Rate limiting dependency for API endpoints"""
    
    def __init__(self, requests: int, window_seconds: int):
        self.requests = requests
        self.window_seconds = window_seconds
    
    async def __call__(self, current_user: User = Depends(get_current_user)):
        # Rate limiting logic would go here
        # For now, just return the user
        return current_user