"""
Enhanced security features for authentication
"""
import secrets
import hashlib
import pyotp
import qrcode
import io
import base64
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from src.auth.models import User, UserSession, AuditLog, PasswordHistory
from src.core.config import settings
from src.core.security import get_password_hash, verify_password


class SecurityService:
    """Enhanced security service for authentication"""
    
    # Account lockout settings
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 30
    
    # Password policy
    PASSWORD_MIN_LENGTH = 8
    PASSWORD_HISTORY_COUNT = 5
    PASSWORD_REQUIRE_UPPERCASE = True
    PASSWORD_REQUIRE_LOWERCASE = True
    PASSWORD_REQUIRE_DIGIT = True
    PASSWORD_REQUIRE_SPECIAL = True
    
    # Email verification
    EMAIL_VERIFICATION_EXPIRY_HOURS = 24
    
    # Session management
    SESSION_EXPIRY_HOURS = 24
    REMEMBER_ME_DAYS = 30
    
    @staticmethod
    def generate_verification_token() -> str:
        """Generate a secure email verification token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def generate_2fa_secret() -> str:
        """Generate a TOTP secret for 2FA"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_2fa_qr_code(user_email: str, secret: str) -> str:
        """Generate QR code for 2FA setup"""
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user_email,
            issuer_name=settings.APP_NAME
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        
        return base64.b64encode(buffer.getvalue()).decode()
    
    @staticmethod
    def verify_2fa_token(secret: str, token: str) -> bool:
        """Verify a TOTP token"""
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=1)
    
    @staticmethod
    def generate_backup_codes() -> List[str]:
        """Generate backup codes for 2FA"""
        return [secrets.token_hex(4) for _ in range(10)]
    
    @classmethod
    def check_password_policy(cls, password: str) -> Tuple[bool, List[str]]:
        """Check if password meets policy requirements"""
        errors = []
        
        if len(password) < cls.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {cls.PASSWORD_MIN_LENGTH} characters long")
        
        if cls.PASSWORD_REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        if cls.PASSWORD_REQUIRE_LOWERCASE and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        if cls.PASSWORD_REQUIRE_DIGIT and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
        
        if cls.PASSWORD_REQUIRE_SPECIAL and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            errors.append("Password must contain at least one special character")
        
        return len(errors) == 0, errors
    
    @classmethod
    def check_password_history(cls, db: Session, user_id: str, password: str) -> bool:
        """Check if password was recently used"""
        history = db.query(PasswordHistory).filter(
            PasswordHistory.user_id == user_id
        ).order_by(PasswordHistory.created_at.desc()).limit(cls.PASSWORD_HISTORY_COUNT).all()
        
        for entry in history:
            if verify_password(password, entry.password_hash):
                return False
        
        return True
    
    @classmethod
    def record_password_history(cls, db: Session, user_id: str, password_hash: str):
        """Record password in history"""
        history_entry = PasswordHistory(
            user_id=user_id,
            password_hash=password_hash
        )
        db.add(history_entry)
        
        # Clean up old entries
        old_entries = db.query(PasswordHistory).filter(
            PasswordHistory.user_id == user_id
        ).order_by(PasswordHistory.created_at.desc()).offset(cls.PASSWORD_HISTORY_COUNT).all()
        
        for entry in old_entries:
            db.delete(entry)
    
    @classmethod
    def check_account_lockout(cls, user: User) -> Tuple[bool, Optional[str]]:
        """Check if account is locked"""
        if user.account_locked_until and user.account_locked_until > datetime.utcnow():
            return True, f"Account locked until {user.account_locked_until.isoformat()}"
        return False, None
    
    @classmethod
    def handle_failed_login(cls, db: Session, user: User):
        """Handle failed login attempt"""
        user.failed_login_attempts += 1
        user.last_failed_login_at = datetime.utcnow()
        
        if user.failed_login_attempts >= cls.MAX_LOGIN_ATTEMPTS:
            user.account_locked_until = datetime.utcnow() + timedelta(minutes=cls.LOCKOUT_DURATION_MINUTES)
        
        db.commit()
    
    @classmethod
    def handle_successful_login(cls, db: Session, user: User):
        """Handle successful login"""
        user.failed_login_attempts = 0
        user.last_login = datetime.utcnow()
        user.account_locked_until = None
        db.commit()
    
    @staticmethod
    def create_session(db: Session, user_id: str, token: str, ip_address: str = None, 
                      user_agent: str = None, remember_me: bool = False) -> UserSession:
        """Create a new user session"""
        if remember_me:
            expires_at = datetime.utcnow() + timedelta(days=SecurityService.REMEMBER_ME_DAYS)
        else:
            expires_at = datetime.utcnow() + timedelta(hours=SecurityService.SESSION_EXPIRY_HOURS)
        
        session = UserSession(
            user_id=user_id,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            ip_address=ip_address,
            device_info={"user_agent": user_agent} if user_agent else None,
            expires_at=expires_at
        )
        
        db.add(session)
        db.commit()
        
        return session
    
    @staticmethod
    def verify_session(db: Session, token: str) -> Optional[UserSession]:
        """Verify and return active session"""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        session = db.query(UserSession).filter(
            UserSession.token_hash == token_hash,
            UserSession.expires_at > datetime.utcnow()
        ).first()
        
        if session:
            session.last_active_at = datetime.utcnow()
            db.commit()
        
        return session
    
    @staticmethod
    def revoke_session(db: Session, session_id: str):
        """Revoke a specific session"""
        session = db.query(UserSession).filter(UserSession.id == session_id).first()
        if session:
            db.delete(session)
            db.commit()
    
    @staticmethod
    def revoke_all_sessions(db: Session, user_id: str):
        """Revoke all sessions for a user"""
        db.query(UserSession).filter(UserSession.user_id == user_id).delete()
        db.commit()
    
    @staticmethod
    def log_audit_event(db: Session, action: str, user_id: str = None, 
                       organization_id: str = None, resource_type: str = None,
                       resource_id: str = None, ip_address: str = None,
                       user_agent: str = None, metadata: Dict = None):
        """Log an audit event"""
        audit_log = AuditLog(
            action=action,
            user_id=user_id,
            organization_id=organization_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata
        )
        
        db.add(audit_log)
        db.commit()
    
    @staticmethod
    def cleanup_expired_sessions(db: Session):
        """Clean up expired sessions"""
        db.query(UserSession).filter(
            UserSession.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
    
    @staticmethod
    def send_verification_email(user: User, token: str):
        """Send email verification (placeholder for email service integration)"""
        # TODO: Integrate with email service
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        print(f"Verification URL for {user.email}: {verification_url}")
    
    @staticmethod
    def verify_email_token(db: Session, token: str) -> Optional[User]:
        """Verify email verification token"""
        user = db.query(User).filter(
            User.email_verification_token == token,
            User.email_verified == False
        ).first()
        
        if user and user.email_verification_sent_at:
            # Check if token is expired
            expiry_time = user.email_verification_sent_at + timedelta(
                hours=SecurityService.EMAIL_VERIFICATION_EXPIRY_HOURS
            )
            if datetime.utcnow() > expiry_time:
                return None
        
        return user