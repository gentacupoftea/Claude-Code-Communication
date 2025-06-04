"""
強化されたセキュリティユーティリティ
Enhanced security utilities for password hashing and JWT management
"""
import secrets
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple

from passlib.context import CryptContext
import jwt
from jwt.exceptions import PyJWTError as JWTError

logger = logging.getLogger(__name__)

# Allowed JWT algorithms to prevent "none" algorithm attack
ALLOWED_JWT_ALGORITHMS = ["HS256", "HS384", "HS512"]


class PasswordManager:
    """Manages password hashing and verification"""
    
    def __init__(self):
        # Configure bcrypt with 12 rounds for security
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a plain password against its hash"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password using bcrypt"""
        return self.pwd_context.hash(password)


class JWTManager:
    """Manages JWT token creation and verification with enhanced security"""
    
    def __init__(self, secret_key: str, algorithm: str = "HS256", 
                 access_token_expire_minutes: int = 15,
                 refresh_token_expire_minutes: int = 60 * 24 * 7):  # 7 days
        # Validate secret key strength
        if len(secret_key) < 32:
            raise ValueError("JWT secret key must be at least 32 characters long")
        if secret_key in ["your-secret-key-here", "default-secret-key", "change-me"]:
            raise ValueError("Default or weak JWT secret key detected. Please generate a secure key.")
        
        # Validate algorithm to prevent "none" algorithm attack
        if algorithm not in ALLOWED_JWT_ALGORITHMS:
            raise ValueError(f"Unsupported algorithm: {algorithm}. Allowed: {ALLOWED_JWT_ALGORITHMS}")
        
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.refresh_token_expire_minutes = refresh_token_expire_minutes
    
    def create_access_token(self, data: dict) -> str:
        """Create a new access token with JTI for blacklisting"""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        jti = secrets.token_urlsafe(32)  # JWT ID for blacklisting (32 chars for better security)
        to_encode.update({
            "exp": expire, 
            "token_type": "access",
            "jti": jti,
            "iat": datetime.now(timezone.utc)  # Issued at time
        })
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_refresh_token(self, data: dict) -> str:
        """Create a new refresh token with JTI"""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=self.refresh_token_expire_minutes)
        jti = secrets.token_urlsafe(32)  # JWT ID for blacklisting (32 chars for better security)
        to_encode.update({
            "exp": expire, 
            "token_type": "refresh",
            "jti": jti,
            "iat": datetime.now(timezone.utc)  # Issued at time
        })
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> dict:
        """Verify and decode a JWT token with improved error handling"""
        try:
            # Decode with algorithm restriction to prevent algorithm switching attacks
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm]  # Only allow the configured algorithm
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Attempted to use expired token")
            raise InvalidTokenError("Token has expired")
        except jwt.InvalidTokenError as e:
            logger.error(f"JWT verification failed: {str(e)}")
            raise InvalidTokenError("Invalid token")
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {str(e)}")
            raise InvalidTokenError("Token verification failed")
    
    def create_tokens(self, user_id: str, email: str, 
                     is_superuser: bool = False) -> Dict[str, str]:
        """Create both access and refresh tokens"""
        access_token_data = {
            "sub": user_id,
            "email": email,
            "is_superuser": is_superuser
        }
        
        refresh_token_data = {
            "sub": user_id
        }
        
        return {
            "access_token": self.create_access_token(access_token_data),
            "refresh_token": self.create_refresh_token(refresh_token_data),
            "token_type": "bearer"
        }


class APITokenManager:
    """Manages API token creation and verification with secure salted hashing"""
    
    @staticmethod
    def generate_token() -> Tuple[str, str, str]:
        """Generate a new API token and its salted hash
        
        Returns:
            tuple: (token_value, token_hash, salt)
        """
        # Generate a secure random token (32 bytes = 43 chars base64url)
        token_value = secrets.token_urlsafe(32)
        
        # Generate salt for this token (16 bytes = 32 hex chars)
        salt = secrets.token_hex(16)
        
        # Create salted hash using HMAC for constant-time comparison
        token_hash = APITokenManager._create_salted_hash(token_value, salt)
        
        return token_value, token_hash, salt
    
    @staticmethod
    def _create_salted_hash(token_value: str, salt: str) -> str:
        """Create a salted hash using HMAC"""
        return hmac.new(
            salt.encode(),
            token_value.encode(),
            hashlib.sha256
        ).hexdigest()
    
    @staticmethod
    def hash_token(token_value: str, salt: str) -> str:
        """Hash an API token with salt for secure comparison"""
        return APITokenManager._create_salted_hash(token_value, salt)
    
    @staticmethod
    def verify_token_hash(token_value: str, stored_hash: str, salt: str) -> bool:
        """Verify API token with timing attack protection
        
        Args:
            token_value: The plain token to verify
            stored_hash: The stored hash to compare against
            salt: The salt used to create the hash
            
        Returns:
            bool: True if token is valid, False otherwise
        """
        expected_hash = APITokenManager._create_salted_hash(token_value, salt)
        # Use constant-time comparison to prevent timing attacks
        return hmac.compare_digest(expected_hash, stored_hash)


class InvalidTokenError(Exception):
    """Exception raised for invalid JWT tokens"""
    pass