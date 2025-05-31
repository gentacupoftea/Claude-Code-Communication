"""
Secure key management for environment variables
"""
import os
import logging
from typing import Optional
from cryptography.fernet import Fernet
from pathlib import Path

logger = logging.getLogger(__name__)


class SecureKeyManager:
    """
    Secure key management with multiple backends support
    """
    
    def __init__(self):
        self._encryption_key: Optional[Fernet] = None
        self._initialize_encryption_key()
    
    def _initialize_encryption_key(self) -> None:
        """Initialize encryption key from secure source"""
        try:
            # Try different key sources in order of security preference
            key = self._get_key_from_vault() or \
                  self._get_key_from_file() or \
                  self._get_key_from_env() or \
                  self._generate_new_key()
            
            if key:
                self._encryption_key = Fernet(key)
                logger.info("Encryption key initialized successfully")
            else:
                logger.error("Failed to initialize encryption key")
                
        except Exception as e:
            logger.error(f"Error initializing encryption key: {e}")
            # In production, this should fail hard
            if os.getenv("NODE_ENV") == "production":
                raise
    
    def _get_key_from_vault(self) -> Optional[bytes]:
        """Get key from HashiCorp Vault or cloud key service"""
        try:
            # HashiCorp Vault implementation
            vault_addr = os.getenv("VAULT_ADDR")
            vault_token = os.getenv("VAULT_TOKEN")
            
            if vault_addr and vault_token:
                import hvac
                client = hvac.Client(url=vault_addr, token=vault_token)
                if client.is_authenticated():
                    secret = client.secrets.kv.v2.read_secret_version(
                        path="conea/encryption"
                    )
                    key_data = secret["data"]["data"]["key"]
                    return key_data.encode() if isinstance(key_data, str) else key_data
                    
        except ImportError:
            logger.warning("hvac not installed, skipping Vault key retrieval")
        except Exception as e:
            logger.warning(f"Failed to get key from Vault: {e}")
        
        try:
            # AWS KMS implementation
            aws_key_id = os.getenv("AWS_KMS_KEY_ID")
            if aws_key_id:
                import boto3
                kms = boto3.client('kms')
                response = kms.decrypt(
                    CiphertextBlob=bytes.fromhex(os.getenv("ENCRYPTED_KEY", ""))
                )
                return response['Plaintext']
                
        except ImportError:
            logger.warning("boto3 not installed, skipping AWS KMS")
        except Exception as e:
            logger.warning(f"Failed to get key from AWS KMS: {e}")
            
        return None
    
    def _get_key_from_file(self) -> Optional[bytes]:
        """Get key from secure file with proper permissions"""
        key_file_path = os.getenv("ENCRYPTION_KEY_FILE", "/etc/conea/encryption.key")
        
        try:
            key_path = Path(key_file_path)
            if key_path.exists():
                # Check file permissions (should be 600)
                stat = key_path.stat()
                if stat.st_mode & 0o077:
                    logger.warning(f"Key file {key_file_path} has insecure permissions")
                    if os.getenv("NODE_ENV") == "production":
                        raise ValueError("Key file has insecure permissions")
                
                with open(key_path, 'rb') as f:
                    return f.read().strip()
                    
        except Exception as e:
            logger.warning(f"Failed to read key from file {key_file_path}: {e}")
        
        return None
    
    def _get_key_from_env(self) -> Optional[bytes]:
        """Get key from environment variable (least secure, development only)"""
        key_str = os.getenv("ENVIRONMENT_ENCRYPTION_KEY")
        
        if key_str:
            if os.getenv("NODE_ENV") == "production":
                logger.warning("Using environment variable for encryption key in production is insecure!")
            
            try:
                return key_str.encode()
            except Exception as e:
                logger.error(f"Invalid encryption key format: {e}")
        
        return None
    
    def _generate_new_key(self) -> Optional[bytes]:
        """Generate new key and save to secure location"""
        try:
            new_key = Fernet.generate_key()
            
            # Try to save to secure location
            key_file_path = os.getenv("ENCRYPTION_KEY_FILE", "/tmp/conea_encryption.key")
            key_path = Path(key_file_path)
            
            # Create directory if needed
            key_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write key with secure permissions
            with open(key_path, 'wb') as f:
                f.write(new_key)
            
            # Set secure permissions (owner read/write only)
            os.chmod(key_path, 0o600)
            
            logger.warning(f"Generated new encryption key and saved to {key_file_path}")
            logger.warning("Please backup this key securely!")
            
            return new_key
            
        except Exception as e:
            logger.error(f"Failed to generate new encryption key: {e}")
            return None
    
    def encrypt(self, value: str) -> Optional[str]:
        """Encrypt a value"""
        if not self._encryption_key:
            logger.error("Encryption key not available")
            return None
        
        try:
            encrypted = self._encryption_key.encrypt(value.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return None
    
    def decrypt(self, encrypted_value: str) -> Optional[str]:
        """Decrypt a value"""
        if not self._encryption_key:
            logger.error("Encryption key not available")
            return None
        
        try:
            decrypted = self._encryption_key.decrypt(encrypted_value.encode())
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return None
    
    def is_available(self) -> bool:
        """Check if encryption is available"""
        return self._encryption_key is not None


# Global instance
key_manager = SecureKeyManager()