"""
Authentication and authorization API routes
"""
import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from .schemas import (
    UserCreate, UserResponse, UserUpdate,
    TokenResponse, TokenRefresh, LoginRequest,
    OrganizationCreate, OrganizationResponse,
    MembershipCreate, MembershipResponse,
    APITokenCreate, APITokenResponse, APITokenCreateResponse,
    ShopifyStoreCreate, ShopifyStoreResponse,
    PasswordResetRequest, PasswordResetConfirm, PasswordResetTokenVerify, MessageResponse
)
from .models import User, Organization, OrganizationMember, APIToken
from .services import AuthService, AuthorizationService, APITokenService
from .dependencies import (
    get_current_user, get_auth_service, get_authorization_service,
    get_api_token_service, get_password_reset_service, require_permission
)
from .permissions import Permission
from .database import get_db
from .email import email_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
limiter = Limiter(key_func=get_remote_address)

# OAuth2 configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# User Registration and Authentication
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def register_user(
    request: Request,  # Required for rate limiting
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    try:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        
        # Hash password
        from .security import PasswordManager
        password_manager = PasswordManager()
        hashed_password = password_manager.get_password_hash(user_data.password)
        
        # Create user
        new_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            is_active=user_data.is_active
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"New user registered: {new_user.id}")
        return new_user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,  # Required for rate limiting
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service)
):
    """User login endpoint"""
    user = await auth_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = await auth_service.create_tokens(user)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    token_data: TokenRefresh,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Refresh access token"""
    try:
        tokens = await auth_service.refresh_access_token(token_data.refresh_token)
        return tokens
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user profile"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile"""
    try:
        # Update user fields if provided
        if user_update.full_name is not None:
            current_user.full_name = user_update.full_name
        
        if user_update.password is not None:
            from .security import PasswordManager
            password_manager = PasswordManager()
            current_user.hashed_password = password_manager.get_password_hash(user_update.password)
        
        db.commit()
        db.refresh(current_user)
        
        return current_user
        
    except Exception as e:
        logger.error(f"Error updating user: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating user"
        )


# Organization Management
@router.post("/organizations", response_model=OrganizationResponse, 
             status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new organization"""
    try:
        # Generate slug from name
        from slugify import slugify
        slug = slugify(org_data.name)
        
        # Check if slug already exists
        existing_org = db.query(Organization).filter(Organization.slug == slug).first()
        if existing_org:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Organization with this name already exists"
            )
        
        # Create organization
        new_org = Organization(
            name=org_data.name,
            slug=slug
        )
        
        db.add(new_org)
        db.flush()  # Get the ID before committing
        
        # Add creator as owner
        membership = OrganizationMember(
            user_id=current_user.id,
            organization_id=new_org.id,
            role="owner"
        )
        
        db.add(membership)
        db.commit()
        db.refresh(new_org)
        
        logger.info(f"Organization created: {new_org.id}")
        return new_org
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating organization: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating organization"
        )


@router.get("/organizations", response_model=List[OrganizationResponse])
async def get_user_organizations(
    current_user: User = Depends(get_current_user),
    auth_service: AuthorizationService = Depends(get_authorization_service)
):
    """Get organizations the current user belongs to"""
    organizations = await auth_service.get_user_organizations(current_user.id)
    return organizations


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    auth_service: AuthorizationService = Depends(get_authorization_service),
    db: Session = Depends(get_db)
):
    """Get organization details"""
    # Check if user has access to this organization
    has_access = await auth_service.check_permission(
        current_user.id, org_id, Permission.READ_ANALYTICS
    )
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    return organization


# Organization Member Management
@router.post("/organizations/{org_id}/members", response_model=MembershipResponse,
             status_code=status.HTTP_201_CREATED)
@require_permission(Permission.MANAGE_USERS)
async def add_organization_member(
    org_id: UUID,
    member_data: MembershipCreate,
    current_user: User = Depends(get_current_user),
    auth_service: AuthorizationService = Depends(get_authorization_service),
    db: Session = Depends(get_db)
):
    """Add a member to an organization"""
    try:
        # Find user by email
        user = db.query(User).filter(User.email == member_data.user_email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Add user to organization
        membership = await auth_service.add_user_to_organization(
            user.id, org_id, member_data.role
        )
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this organization"
            )
        
        # Load relationships for response
        db.refresh(membership)
        return membership
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding organization member: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error adding member"
        )


@router.get("/organizations/{org_id}/members", response_model=List[MembershipResponse])
async def get_organization_members(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    auth_service: AuthorizationService = Depends(get_authorization_service),
    db: Session = Depends(get_db)
):
    """Get organization members"""
    # Check if user has access to this organization
    has_access = await auth_service.check_permission(
        current_user.id, org_id, Permission.READ_ANALYTICS
    )
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    members = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id
    ).all()
    
    return members


# API Token Management
@router.post("/tokens", response_model=APITokenCreateResponse,
             status_code=status.HTTP_201_CREATED)
async def create_api_token(
    token_data: APITokenCreate,
    current_user: User = Depends(get_current_user),
    token_service: APITokenService = Depends(get_api_token_service)
):
    """Create a new API token"""
    try:
        token, token_value = await token_service.create_token(
            user_id=current_user.id,
            name=token_data.name,
            scopes=token_data.scopes,
            expires_in_days=token_data.expires_in_days
        )
        
        # Return token with the actual token value
        return APITokenCreateResponse(
            id=token.id,
            name=token.name,
            scopes=token.scopes,
            expires_at=token.expires_at,
            created_at=token.created_at,
            last_used_at=token.last_used_at,
            token=token_value  # Only returned during creation
        )
        
    except Exception as e:
        logger.error(f"Error creating API token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating token"
        )


@router.get("/tokens", response_model=List[APITokenResponse])
async def get_user_tokens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's API tokens"""
    tokens = db.query(APIToken).filter(
        APIToken.user_id == current_user.id
    ).all()
    
    return tokens


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_token(
    token_id: UUID,
    current_user: User = Depends(get_current_user),
    token_service: APITokenService = Depends(get_api_token_service)
):
    """Revoke an API token"""
    success = await token_service.revoke_token(token_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    return None


# Password Reset Endpoints
@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,  # Required for rate limiting
    password_reset: PasswordResetRequest,
    password_reset_service = Depends(get_password_reset_service)
):
    """Request password reset email"""
    try:
        # Create reset token
        result = await password_reset_service.create_reset_token(password_reset.email)
        
        if result:
            user, reset_token = result
            # Send reset email
            await email_service.send_password_reset_email(
                to_email=user.email,
                user_name=user.full_name,
                reset_token=reset_token
            )
        
        # Always return success to prevent email enumeration
        return MessageResponse(
            message="If an account exists with this email, you will receive a password reset link.",
            success=True
        )
        
    except Exception as e:
        logger.error(f"Error in forgot password: {str(e)}")
        # Still return success to prevent email enumeration
        return MessageResponse(
            message="If an account exists with this email, you will receive a password reset link.",
            success=True
        )


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/hour")
async def reset_password(
    request: Request,  # Required for rate limiting
    password_reset: PasswordResetConfirm,
    password_reset_service = Depends(get_password_reset_service)
):
    """Reset password using token"""
    try:
        # Reset the password
        success = await password_reset_service.reset_password(
            password_reset.token,
            password_reset.new_password
        )
        
        if success:
            # Get user info for email notification
            user = await password_reset_service.verify_reset_token(password_reset.token)
            if user:
                await email_service.send_password_changed_email(
                    to_email=user.email,
                    user_name=user.full_name
                )
            
            return MessageResponse(
                message="Password has been reset successfully.",
                success=True
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error resetting password"
        )


@router.get("/verify-reset-token", response_model=MessageResponse)
async def verify_reset_token(
    token: str,
    password_reset_service = Depends(get_password_reset_service)
):
    """Verify if a reset token is valid"""
    try:
        user = await password_reset_service.verify_reset_token(token)
        
        if user:
            return MessageResponse(
                message="Token is valid",
                success=True
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying reset token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error verifying token"
        )