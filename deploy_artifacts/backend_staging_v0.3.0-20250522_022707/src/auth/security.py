"""
Security utilities for password hashing and JWT management
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict

from passlib.context import CryptContext
import jwt
from jwt.exceptions import PyJWTError as JWTError


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
    """Manages JWT token creation and verification"""
    
    def __init__(self, secret_key: str, algorithm: str = "HS256", 
                 access_token_expire_minutes: int = 15,
                 refresh_token_expire_minutes: int = 60 * 24 * 7):  # 7 days
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.refresh_token_expire_minutes = refresh_token_expire_minutes
    
    def create_access_token(self, data: dict) -> str:
        """Create a new access token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({"exp": expire, "token_type": "access"})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_refresh_token(self, data: dict) -> str:
        """Create a new refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.refresh_token_expire_minutes)
        to_encode.update({"exp": expire, "token_type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> dict:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError as e:
            raise InvalidTokenError(f"Invalid token: {str(e)}")
    
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
    """Manages API token creation and verification"""
    
    @staticmethod
    def generate_token() -> tuple[str, str]:
        """Generate a new API token and its hash"""
        # Generate a secure random token
        token_value = secrets.token_urlsafe(32)
        
        # Hash the token for storage
        token_hash = hashlib.sha256(token_value.encode()).hexdigest()
        
        return token_value, token_hash
    
    @staticmethod
    def hash_token(token_value: str) -> str:
        """Hash an API token for comparison"""
        return hashlib.sha256(token_value.encode()).hexdigest()


class InvalidTokenError(Exception):
    """Exception raised for invalid JWT tokens"""
    pass