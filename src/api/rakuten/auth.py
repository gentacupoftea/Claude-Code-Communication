"""
Rakuten API Authentication
Handles OAuth 2.0 authentication for Rakuten API
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional
from dataclasses import dataclass
import httpx
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class RakutenCredentials:
    """Rakuten API credentials"""
    service_secret: str  # サービスシークレット
    license_key: str     # ライセンスキー
    shop_id: str         # 店舗ID
    grant_type: str = "client_credentials"
    
    # OAuth endpoints
    token_url: str = "https://api.rms.rakuten.co.jp/es/2.0/auth/token"
    
    # Optional
    redirect_uri: Optional[str] = None
    refresh_token: Optional[str] = None


@dataclass
class RakutenToken:
    """Rakuten access token"""
    access_token: str
    token_type: str
    expires_in: int
    scope: str
    refresh_token: Optional[str] = None
    created_at: float = 0
    
    def __post_init__(self):
        if self.created_at == 0:
            self.created_at = time.time()
    
    @property
    def is_expired(self) -> bool:
        """Check if token is expired"""
        return time.time() > (self.created_at + self.expires_in - 300)  # 5分前に期限切れとする
    
    @property
    def expires_at(self) -> datetime:
        """Get token expiration datetime"""
        return datetime.fromtimestamp(self.created_at + self.expires_in)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            'access_token': self.access_token,
            'token_type': self.token_type,
            'expires_in': self.expires_in,
            'scope': self.scope,
            'refresh_token': self.refresh_token,
            'created_at': self.created_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RakutenToken':
        """Create from dictionary"""
        return cls(**data)


class RakutenAuth:
    """
    Rakuten API authentication manager
    Handles OAuth 2.0 flow and token management
    """
    
    def __init__(self, credentials: RakutenCredentials):
        """
        Initialize auth manager
        
        Args:
            credentials: Rakuten API credentials
        """
        self.credentials = credentials
        self.token: Optional[RakutenToken] = None
        self.client = httpx.AsyncClient()
        self.logger = logger
        
    async def authenticate(self) -> bool:
        """
        Authenticate with Rakuten API
        
        Returns:
            True if authentication successful
        """
        try:
            if self.token and not self.token.is_expired:
                self.logger.info("Using existing valid token")
                return True
                
            # Get new token
            self.token = await self._get_access_token()
            return bool(self.token)
            
        except Exception as e:
            self.logger.error(f"Authentication failed: {e}")
            return False
            
    async def _get_access_token(self) -> Optional[RakutenToken]:
        """
        Get access token from Rakuten OAuth
        
        Returns:
            RakutenToken or None if failed
        """
        try:
            # Prepare request data
            data = {
                'grant_type': self.credentials.grant_type,
                'scope': 'rakuten_ichiba',
            }
            
            # Add credentials based on grant type
            if self.credentials.grant_type == 'client_credentials':
                data.update({
                    'client_id': self.credentials.service_secret,
                    'client_secret': self.credentials.license_key,
                })
            elif self.credentials.grant_type == 'refresh_token':
                data.update({
                    'refresh_token': self.credentials.refresh_token,
                    'client_id': self.credentials.service_secret,
                    'client_secret': self.credentials.license_key,
                })
                
            # Make request
            response = await self.client.post(
                self.credentials.token_url,
                data=data,
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            )
            
            response.raise_for_status()
            token_data = response.json()
            
            # Create token object
            token = RakutenToken(
                access_token=token_data['access_token'],
                token_type=token_data.get('token_type', 'Bearer'),
                expires_in=token_data.get('expires_in', 3600),
                scope=token_data.get('scope', ''),
                refresh_token=token_data.get('refresh_token')
            )
            
            self.logger.info(f"Got new access token, expires at {token.expires_at}")
            return token
            
        except httpx.HTTPStatusError as e:
            self.logger.error(f"OAuth request failed: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            self.logger.error(f"Failed to get access token: {e}")
            return None
            
    async def refresh_access_token(self) -> bool:
        """
        Refresh access token using refresh token
        
        Returns:
            True if refresh successful
        """
        if not self.token or not self.token.refresh_token:
            self.logger.error("No refresh token available")
            return False
            
        try:
            # Update credentials for refresh
            self.credentials.grant_type = 'refresh_token'
            self.credentials.refresh_token = self.token.refresh_token
            
            # Get new token
            new_token = await self._get_access_token()
            
            if new_token:
                self.token = new_token
                return True
            else:
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to refresh token: {e}")
            return False
            
    def get_auth_header(self) -> Dict[str, str]:
        """
        Get authorization header for API requests
        
        Returns:
            Dictionary with Authorization header
        """
        if not self.token:
            raise ValueError("Not authenticated")
            
        return {
            'Authorization': f'{self.token.token_type} {self.token.access_token}'
        }
        
    async def ensure_valid_token(self) -> bool:
        """
        Ensure we have a valid token
        
        Returns:
            True if token is valid or successfully refreshed
        """
        if not self.token:
            return await self.authenticate()
            
        if self.token.is_expired:
            if self.token.refresh_token:
                self.logger.info("Token expired, attempting refresh")
                return await self.refresh_access_token()
            else:
                self.logger.info("Token expired, re-authenticating")
                return await self.authenticate()
                
        return True
        
    def save_token(self, filepath: str, encryption_key: Optional[str] = None) -> None:
        """
        Save token to file with optional encryption
        
        Args:
            filepath: Path to save token
            encryption_key: Optional encryption key (base64 encoded)
        """
        if not self.token:
            raise ValueError("No token to save")
            
        try:
            import os
            token_data = self.token.to_dict()
            
            if encryption_key:
                # Use Fernet for encryption
                from cryptography.fernet import Fernet
                try:
                    cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
                except Exception:
                    # If key is not valid base64, encode it
                    from cryptography.hazmat.primitives import hashes
                    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
                    import base64
                    kdf = PBKDF2HMAC(
                        algorithm=hashes.SHA256(),
                        length=32,
                        salt=b'rakuten_salt_v1',  # Static salt for consistency
                        iterations=100000,
                    )
                    key = base64.urlsafe_b64encode(kdf.derive(encryption_key.encode()))
                    cipher = Fernet(key)
                
                encrypted_data = cipher.encrypt(json.dumps(token_data).encode())
                with open(filepath, 'wb') as f:
                    f.write(encrypted_data)
            else:
                # Warn about security risk
                self.logger.warning("Saving token without encryption is a security risk")
                with open(filepath, 'w') as f:
                    json.dump(token_data, f)
                    
            # Set appropriate file permissions (read/write for owner only)
            os.chmod(filepath, 0o600)
            self.logger.info(f"Token saved to {filepath}")
        except Exception as e:
            self.logger.error(f"Failed to save token: {e}")
            raise
            
    def load_token(self, filepath: str, encryption_key: Optional[str] = None) -> bool:
        """
        Load token from file with optional decryption
        
        Args:
            filepath: Path to load token from
            encryption_key: Optional encryption key (base64 encoded)
            
        Returns:
            True if token loaded successfully
        """
        try:
            import os
            if not os.path.exists(filepath):
                self.logger.warning(f"Token file {filepath} does not exist")
                return False
                
            if encryption_key:
                # Decrypt token
                from cryptography.fernet import Fernet
                try:
                    cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
                except Exception:
                    # If key is not valid base64, encode it
                    from cryptography.hazmat.primitives import hashes
                    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
                    import base64
                    kdf = PBKDF2HMAC(
                        algorithm=hashes.SHA256(),
                        length=32,
                        salt=b'rakuten_salt_v1',  # Static salt for consistency
                        iterations=100000,
                    )
                    key = base64.urlsafe_b64encode(kdf.derive(encryption_key.encode()))
                    cipher = Fernet(key)
                    
                with open(filepath, 'rb') as f:
                    encrypted_data = f.read()
                decrypted_data = cipher.decrypt(encrypted_data)
                token_data = json.loads(decrypted_data.decode())
            else:
                # Load unencrypted token
                self.logger.warning("Loading token without encryption - consider using encryption")
                with open(filepath, 'r') as f:
                    token_data = json.load(f)
                    
            self.token = RakutenToken.from_dict(token_data)
            self.logger.info(f"Token loaded from {filepath}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load token: {e}")
            return False
            
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()