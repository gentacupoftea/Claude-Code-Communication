"""
Enhanced authentication routes with advanced security features
"""
import logging
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
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
from .models import User, Organization, OrganizationMember, APIToken, UserSession, AuditLog
from .services import AuthService, AuthorizationService, APITokenService
from .security_service import SecurityService
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


# Enhanced User Registration with Email Verification
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def register_user(
    request: Request,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user with email verification"""
    try:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        
        # Check password policy
        is_valid, errors = SecurityService.check_password_policy(user_data.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Password does not meet requirements", "errors": errors}
            )
        
        # Hash password
        from .security import PasswordManager
        password_manager = PasswordManager()
        hashed_password = password_manager.get_password_hash(user_data.password)
        
        # Generate email verification token
        verification_token = SecurityService.generate_verification_token()
        
        # Create user
        new_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            is_active=True,
            email_verified=False,
            email_verification_token=verification_token,
            email_verification_sent_at=datetime.utcnow()
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Record password in history
        SecurityService.record_password_history(db, str(new_user.id), hashed_password)
        
        # Send verification email
        SecurityService.send_verification_email(new_user, verification_token)
        
        # Log audit event
        SecurityService.log_audit_event(
            db=db,
            action="user.registered",
            user_id=str(new_user.id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            metadata={"email": new_user.email}
        )
        
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


# Enhanced Login with Account Lockout and Session Management
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = False,
    db: Session = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service)
):
    """Enhanced user login with security features"""
    try:
        # Find user
        user = db.query(User).filter(User.email == form_data.username).first()
        
        if not user:
            # Log failed attempt for non-existent user
            SecurityService.log_audit_event(
                db=db,
                action="login.failed",
                ip_address=request.client.host,
                user_agent=request.headers.get("User-Agent"),
                metadata={"reason": "user_not_found", "email": form_data.username}
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check account lockout
        is_locked, lock_message = SecurityService.check_account_lockout(user)
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=lock_message
            )
        
        # Verify password
        authenticated = await auth_service.authenticate_user(form_data.username, form_data.password)
        
        if not authenticated:
            # Handle failed login
            SecurityService.handle_failed_login(db, user)
            
            # Log audit event
            SecurityService.log_audit_event(
                db=db,
                action="login.failed",
                user_id=str(user.id),
                ip_address=request.client.host,
                user_agent=request.headers.get("User-Agent"),
                metadata={"reason": "invalid_password"}
            )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if email is verified
        if not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please check your email for verification link."
            )
        
        # Check if 2FA is enabled
        if user.two_factor_enabled:
            # Return partial token that requires 2FA verification
            return TokenResponse(
                access_token="",
                refresh_token="",
                token_type="bearer",
                expires_in=0,
                requires_2fa=True,
                user_id=str(user.id)
            )
        
        # Handle successful login
        SecurityService.handle_successful_login(db, user)
        
        # Create tokens
        tokens = await auth_service.create_tokens(user)
        
        # Create session
        session = SecurityService.create_session(
            db=db,
            user_id=str(user.id),
            token=tokens.access_token,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            remember_me=remember_me
        )
        
        # Log audit event
        SecurityService.log_audit_event(
            db=db,
            action="login.success",
            user_id=str(user.id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            metadata={"session_id": str(session.id)}
        )
        
        # Set secure cookie if remember me
        if remember_me:
            response.set_cookie(
                key="remember_token",
                value=tokens.refresh_token,
                max_age=30 * 24 * 60 * 60,  # 30 days
                httponly=True,
                secure=True,
                samesite="lax"
            )
        
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during login"
        )


# Email Verification
@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    token: str,
    db: Session = Depends(get_db)
):
    """Verify email address"""
    try:
        user = SecurityService.verify_email_token(db, token)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )
        
        # Mark email as verified
        user.email_verified = True
        user.email_verification_token = None
        user.email_verification_sent_at = None
        db.commit()
        
        # Log audit event
        SecurityService.log_audit_event(
            db=db,
            action="email.verified",
            user_id=str(user.id),
            metadata={"email": user.email}
        )
        
        return MessageResponse(
            message="Email verified successfully",
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error verifying email"
        )


# Resend Verification Email
@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
async def resend_verification_email(
    request: Request,
    email: str,
    db: Session = Depends(get_db)
):
    """Resend email verification"""
    try:
        user = db.query(User).filter(
            User.email == email,
            User.email_verified == False
        ).first()
        
        if user:
            # Generate new token
            verification_token = SecurityService.generate_verification_token()
            user.email_verification_token = verification_token
            user.email_verification_sent_at = datetime.utcnow()
            db.commit()
            
            # Send email
            SecurityService.send_verification_email(user, verification_token)
        
        # Always return success to prevent email enumeration
        return MessageResponse(
            message="If an unverified account exists with this email, you will receive a verification link.",
            success=True
        )
        
    except Exception as e:
        logger.error(f"Error resending verification: {str(e)}")
        return MessageResponse(
            message="If an unverified account exists with this email, you will receive a verification link.",
            success=True
        )


# Two-Factor Authentication Setup
@router.post("/2fa/setup", response_model=dict)
async def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Setup two-factor authentication"""
    try:
        if current_user.two_factor_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Two-factor authentication is already enabled"
            )
        
        # Generate secret
        secret = SecurityService.generate_2fa_secret()
        
        # Generate QR code
        qr_code = SecurityService.generate_2fa_qr_code(current_user.email, secret)
        
        # Generate backup codes
        backup_codes = SecurityService.generate_backup_codes()
        
        # Store temporarily (don't enable until verified)
        current_user.two_factor_secret = secret
        current_user.backup_codes = backup_codes
        db.commit()
        
        return {
            "secret": secret,
            "qr_code": qr_code,
            "backup_codes": backup_codes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting up 2FA: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error setting up two-factor authentication"
        )


# Verify and Enable 2FA
@router.post("/2fa/verify", response_model=MessageResponse)
async def verify_2fa(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify and enable two-factor authentication"""
    try:
        if current_user.two_factor_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Two-factor authentication is already enabled"
            )
        
        if not current_user.two_factor_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please setup two-factor authentication first"
            )
        
        # Verify token
        is_valid = SecurityService.verify_2fa_token(current_user.two_factor_secret, token)
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        # Enable 2FA
        current_user.two_factor_enabled = True
        db.commit()
        
        # Log audit event
        SecurityService.log_audit_event(
            db=db,
            action="2fa.enabled",
            user_id=str(current_user.id),
            metadata={"method": "totp"}
        )
        
        return MessageResponse(
            message="Two-factor authentication enabled successfully",
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying 2FA: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error enabling two-factor authentication"
        )


# Login with 2FA
@router.post("/2fa/login", response_model=TokenResponse)
async def login_2fa(
    user_id: str,
    token: str,
    request: Request,
    db: Session = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service)
):
    """Complete login with 2FA token"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user or not user.two_factor_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request"
            )
        
        # Verify 2FA token
        is_valid = SecurityService.verify_2fa_token(user.two_factor_secret, token)
        
        # Check backup codes if TOTP fails
        if not is_valid and user.backup_codes:
            if token in user.backup_codes:
                is_valid = True
                # Remove used backup code
                user.backup_codes = [code for code in user.backup_codes if code != token]
                db.commit()
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        # Create tokens
        tokens = await auth_service.create_tokens(user)
        
        # Create session
        session = SecurityService.create_session(
            db=db,
            user_id=str(user.id),
            token=tokens.access_token,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        )
        
        # Log audit event
        SecurityService.log_audit_event(
            db=db,
            action="2fa.login.success",
            user_id=str(user.id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            metadata={"session_id": str(session.id)}
        )
        
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during 2FA login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during login"
        )


# Session Management
@router.get("/sessions", response_model=List[dict])
async def get_user_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active sessions for the current user"""
    sessions = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.expires_at > datetime.utcnow()
    ).all()
    
    return [
        {
            "id": str(session.id),
            "created_at": session.created_at,
            "last_active_at": session.last_active_at,
            "expires_at": session.expires_at,
            "ip_address": session.ip_address,
            "device_info": session.device_info
        }
        for session in sessions
    ]


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific session"""
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    SecurityService.revoke_session(db, str(session_id))
    
    # Log audit event
    SecurityService.log_audit_event(
        db=db,
        action="session.revoked",
        user_id=str(current_user.id),
        metadata={"session_id": str(session_id)}
    )
    
    return MessageResponse(
        message="Session revoked successfully",
        success=True
    )


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout from all sessions"""
    SecurityService.revoke_all_sessions(db, str(current_user.id))
    
    # Log audit event
    SecurityService.log_audit_event(
        db=db,
        action="sessions.revoked_all",
        user_id=str(current_user.id),
        metadata={"reason": "user_initiated"}
    )
    
    return MessageResponse(
        message="All sessions revoked successfully",
        success=True
    )


# Audit Logs
@router.get("/audit-logs", response_model=List[dict])
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    action: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get audit logs for the current user"""
    query = db.query(AuditLog).filter(AuditLog.user_id == current_user.id)
    
    if action:
        query = query.filter(AuditLog.action == action)
    
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()
    
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "metadata": log.metadata,
            "created_at": log.created_at
        }
        for log in logs
    ]


# Enhanced Password Update with History Check
@router.put("/change-password", response_model=MessageResponse)
async def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password with security checks"""
    try:
        # Verify current password
        from .security import PasswordManager
        password_manager = PasswordManager()
        
        if not password_manager.verify_password(current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Check password policy
        is_valid, errors = SecurityService.check_password_policy(new_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Password does not meet requirements", "errors": errors}
            )
        
        # Check password history
        if not SecurityService.check_password_history(db, str(current_user.id), new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password was recently used. Please choose a different password."
            )
        
        # Update password
        hashed_password = password_manager.get_password_hash(new_password)
        current_user.hashed_password = hashed_password
        db.commit()
        
        # Record in password history
        SecurityService.record_password_history(db, str(current_user.id), hashed_password)
        
        # Log audit event
        SecurityService.log_audit_event(
            db=db,
            action="password.changed",
            user_id=str(current_user.id),
            metadata={"method": "user_initiated"}
        )
        
        # Send notification email
        await email_service.send_password_changed_email(
            to_email=current_user.email,
            user_name=current_user.full_name
        )
        
        return MessageResponse(
            message="Password changed successfully",
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error changing password"
        )