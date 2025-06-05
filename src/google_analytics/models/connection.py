"""
Google Analytics Connection Model
Handles secure storage of GA connection information and OAuth tokens
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Any

from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from cryptography.fernet import Fernet

from ..config import GoogleAnalyticsConfig
from ...security.encryption_key_manager import EncryptionKeyManager

Base = declarative_base()


class GoogleAnalyticsConnection(Base):
    """
    Google Analytics connection with encrypted credential storage
    """
    __tablename__ = 'google_analytics_connections'

    # Primary key and identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    
    # Connection metadata
    connection_name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Encrypted credentials
    encrypted_service_account_json = Column(Text)  # Encrypted service account JSON
    encrypted_oauth_tokens = Column(Text)  # Encrypted OAuth tokens if using OAuth
    
    # Connection configuration
    property_ids = Column(JSONB)  # List of accessible GA4 property IDs
    default_property_id = Column(String(50))
    
    # Status and metadata
    is_active = Column(Boolean, default=True, nullable=False)
    last_used_at = Column(DateTime(timezone=True))
    last_validated_at = Column(DateTime(timezone=True))
    validation_status = Column(String(50), default='pending')  # pending, valid, invalid, expired
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Connection settings
    settings = Column(JSONB, default=dict)  # Additional settings like timeouts, defaults etc.
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.key_manager = EncryptionKeyManager()
        
    @property
    def _encryption_key(self) -> bytes:
        """Get encryption key from key management service"""
        try:
            key_id = self.settings.get('encryption_key_id', 'default') if self.settings else 'default'
            return self.key_manager.get_or_create_key(key_id)
        except Exception as e:
            # Fallback: generate a key from connection_id (not ideal but better than plain text)
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
            from cryptography.fernet import Fernet
            import base64
            
            # Use connection_id as salt for deterministic key derivation
            salt = self.connection_id.encode() if self.connection_id else b'default_salt'
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(b'ga_connection_key'))
            return key

    def set_service_account_json(self, service_account_json: Dict[str, Any]) -> None:
        """Encrypt and store service account JSON"""
        try:
            fernet = Fernet(self._encryption_key)
            json_str = json.dumps(service_account_json)
            encrypted_data = fernet.encrypt(json_str.encode())
            self.encrypted_service_account_json = encrypted_data.decode()
        except Exception as e:
            raise ValueError(f"Failed to encrypt service account JSON: {e}")

    def get_service_account_json(self) -> Optional[Dict[str, Any]]:
        """Decrypt and return service account JSON"""
        if not self.encrypted_service_account_json:
            return None
            
        try:
            fernet = Fernet(self._encryption_key)
            decrypted_data = fernet.decrypt(self.encrypted_service_account_json.encode())
            return json.loads(decrypted_data.decode())
        except Exception as e:
            raise ValueError(f"Failed to decrypt service account JSON: {e}")

    def set_oauth_tokens(self, oauth_tokens: Dict[str, Any]) -> None:
        """Encrypt and store OAuth tokens"""
        try:
            fernet = Fernet(self._encryption_key)
            json_str = json.dumps(oauth_tokens)
            encrypted_data = fernet.encrypt(json_str.encode())
            self.encrypted_oauth_tokens = encrypted_data.decode()
        except Exception as e:
            raise ValueError(f"Failed to encrypt OAuth tokens: {e}")

    def get_oauth_tokens(self) -> Optional[Dict[str, Any]]:
        """Decrypt and return OAuth tokens"""
        if not self.encrypted_oauth_tokens:
            return None
            
        try:
            fernet = Fernet(self._encryption_key)
            decrypted_data = fernet.decrypt(self.encrypted_oauth_tokens.encode())
            return json.loads(decrypted_data.decode())
        except Exception as e:
            raise ValueError(f"Failed to decrypt OAuth tokens: {e}")

    def update_last_used(self) -> None:
        """Update last used timestamp"""
        self.last_used_at = datetime.utcnow()

    def mark_as_validated(self, is_valid: bool = True) -> None:
        """Mark connection as validated"""
        self.last_validated_at = datetime.utcnow()
        self.validation_status = 'valid' if is_valid else 'invalid'

    def is_expired(self, max_age_days: int = 30) -> bool:
        """Check if connection validation is expired"""
        if not self.last_validated_at:
            return True
        
        age = datetime.utcnow() - self.last_validated_at.replace(tzinfo=None)
        return age.days > max_age_days

    def to_dict(self, include_credentials: bool = False) -> Dict[str, Any]:
        """Convert connection to dictionary"""
        data = {
            'id': str(self.id),
            'connection_id': self.connection_id,
            'user_id': self.user_id,
            'connection_name': self.connection_name,
            'description': self.description,
            'property_ids': self.property_ids,
            'default_property_id': self.default_property_id,
            'is_active': self.is_active,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'last_validated_at': self.last_validated_at.isoformat() if self.last_validated_at else None,
            'validation_status': self.validation_status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'settings': self.settings or {}
        }
        
        if include_credentials:
            # Only include if explicitly requested and for admin/debug purposes
            data['has_service_account'] = bool(self.encrypted_service_account_json)
            data['has_oauth_tokens'] = bool(self.encrypted_oauth_tokens)
        
        return data

    def __repr__(self):
        return f"<GoogleAnalyticsConnection(id={self.id}, connection_id='{self.connection_id}', user_id='{self.user_id}')>"