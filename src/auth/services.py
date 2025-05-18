"""
Authentication and authorization services
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .models import User, Organization, OrganizationMember, APIToken
from .security import PasswordManager, JWTManager, APITokenManager, InvalidTokenError
from .permissions import RolePermissionManager

logger = logging.getLogger(__name__)


class AuthService:
    """Authentication service for user authentication and token management"""
    
    def __init__(self, db: Session, password_manager: PasswordManager, 
                 jwt_manager: JWTManager):
        self.db = db
        self.password_manager = password_manager
        self.jwt_manager = jwt_manager
    
    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user with email and password"""
        try:
            user = self.db.query(User).filter(User.email == email).first()
            
            if not user or not self.password_manager.verify_password(password, user.hashed_password):
                logger.warning(f"Failed authentication attempt for email: {email}")
                return None
            
            # Update last login time
            user.last_login = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Successful authentication for user: {user.id}")
            return user
            
        except Exception as e:
            logger.error(f"Error during authentication: {str(e)}")
            return None
    
    async def create_tokens(self, user: User) -> Dict[str, str]:
        """Create access and refresh tokens for a user"""
        return self.jwt_manager.create_tokens(
            user_id=str(user.id),
            email=user.email,
            is_superuser=user.is_superuser
        )
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, str]:
        """Refresh an access token using a refresh token"""
        try:
            payload = self.jwt_manager.verify_token(refresh_token)
            
            if payload.get("token_type") != "refresh":
                raise InvalidTokenError("Not a refresh token")
            
            user_id = payload.get("sub")
            if not user_id:
                raise InvalidTokenError("Invalid user")
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user or not user.is_active:
                raise InvalidTokenError("User not found or inactive")
            
            return await self.create_tokens(user)
            
        except InvalidTokenError:
            raise
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            raise InvalidTokenError("Could not refresh token")
    
    async def get_current_user(self, token: str) -> Optional[User]:
        """Get current user from JWT token"""
        try:
            payload = self.jwt_manager.verify_token(token)
            
            if payload.get("token_type") != "access":
                return None
            
            user_id = payload.get("sub")
            if not user_id:
                return None
            
            user = self.db.query(User).filter(User.id == user_id).first()
            return user if user and user.is_active else None
            
        except Exception as e:
            logger.error(f"Error getting current user: {str(e)}")
            return None


class AuthorizationService:
    """Authorization service for organization and resource access control"""
    
    def __init__(self, db: Session, role_permission_manager: RolePermissionManager):
        self.db = db
        self.role_permission_manager = role_permission_manager
    
    async def get_user_organizations(self, user_id: UUID) -> List[Organization]:
        """Get all organizations a user belongs to"""
        try:
            memberships = self.db.query(OrganizationMember).filter(
                OrganizationMember.user_id == user_id
            ).all()
            
            org_ids = [m.organization_id for m in memberships]
            organizations = self.db.query(Organization).filter(
                Organization.id.in_(org_ids)
            ).all()
            
            return organizations
            
        except Exception as e:
            logger.error(f"Error getting user organizations: {str(e)}")
            return []
    
    async def get_user_role_in_organization(self, user_id: UUID, 
                                          organization_id: UUID) -> Optional[str]:
        """Get a user's role in a specific organization"""
        try:
            membership = self.db.query(OrganizationMember).filter(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id == organization_id
            ).first()
            
            return membership.role if membership else None
            
        except Exception as e:
            logger.error(f"Error getting user role: {str(e)}")
            return None
    
    async def check_permission(self, user_id: UUID, organization_id: UUID, 
                             permission: str) -> bool:
        """Check if a user has a specific permission in an organization"""
        try:
            # Superusers have all permissions
            user = self.db.query(User).filter(User.id == user_id).first()
            if user and user.is_superuser:
                return True
            
            # Get user's role in the organization
            role = await self.get_user_role_in_organization(user_id, organization_id)
            if not role:
                return False
            
            # Check if the role has the required permission
            return self.role_permission_manager.has_permission(role, permission)
            
        except Exception as e:
            logger.error(f"Error checking permission: {str(e)}")
            return False
    
    async def add_user_to_organization(self, user_id: UUID, organization_id: UUID, 
                                     role: str) -> Optional[OrganizationMember]:
        """Add a user to an organization with a specific role"""
        try:
            # Validate the role
            if not self.role_permission_manager.validate_role(role):
                logger.warning(f"Invalid role specified: {role}")
                return None
            
            # Check if user is already a member
            existing = self.db.query(OrganizationMember).filter(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id == organization_id
            ).first()
            
            if existing:
                logger.warning(f"User {user_id} is already a member of organization {organization_id}")
                return None
            
            # Create new membership
            membership = OrganizationMember(
                user_id=user_id,
                organization_id=organization_id,
                role=role
            )
            
            self.db.add(membership)
            self.db.commit()
            self.db.refresh(membership)
            
            logger.info(f"Added user {user_id} to organization {organization_id} with role {role}")
            return membership
            
        except IntegrityError as e:
            logger.error(f"Database integrity error: {str(e)}")
            self.db.rollback()
            return None
        except Exception as e:
            logger.error(f"Error adding user to organization: {str(e)}")
            self.db.rollback()
            return None


class APITokenService:
    """Service for managing API tokens"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def create_token(self, user_id: UUID, name: str, scopes: List[str], 
                         expires_in_days: Optional[int] = 365) -> tuple[APIToken, str]:
        """Create a new API token"""
        try:
            # Generate token and hash
            token_value, token_hash = APITokenManager.generate_token()
            
            # Calculate expiration
            expires_at = None
            if expires_in_days:
                expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
            
            # Create token record
            token = APIToken(
                user_id=user_id,
                name=name,
                token_hash=token_hash,
                scopes=scopes,
                expires_at=expires_at
            )
            
            self.db.add(token)
            self.db.commit()
            self.db.refresh(token)
            
            logger.info(f"Created API token {token.id} for user {user_id}")
            return token, token_value
            
        except Exception as e:
            logger.error(f"Error creating API token: {str(e)}")
            self.db.rollback()
            raise
    
    async def verify_token(self, token_value: str) -> Optional[APIToken]:
        """Verify an API token"""
        try:
            # Hash the token for comparison
            token_hash = APITokenManager.hash_token(token_value)
            
            # Find the token in database
            token = self.db.query(APIToken).filter(
                APIToken.token_hash == token_hash
            ).first()
            
            if not token:
                return None
            
            # Check expiration
            if token.expires_at and token.expires_at < datetime.utcnow():
                logger.warning(f"Expired API token: {token.id}")
                return None
            
            # Update last used timestamp
            token.last_used_at = datetime.utcnow()
            self.db.commit()
            
            return token
            
        except Exception as e:
            logger.error(f"Error verifying API token: {str(e)}")
            return None
    
    async def revoke_token(self, token_id: UUID, user_id: UUID) -> bool:
        """Revoke an API token"""
        try:
            token = self.db.query(APIToken).filter(
                APIToken.id == token_id,
                APIToken.user_id == user_id
            ).first()
            
            if not token:
                return False
            
            self.db.delete(token)
            self.db.commit()
            
            logger.info(f"Revoked API token {token_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error revoking API token: {str(e)}")
            self.db.rollback()
            return False