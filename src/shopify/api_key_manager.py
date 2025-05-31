"""Simple encrypted API key management."""

import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class APIKeyManager:
    """Manage encrypted API keys."""

    def __init__(self, secret_key: bytes):
        self.fernet = Fernet(secret_key)

    def encrypt(self, value: str) -> str:
        """Encrypt a value."""
        return self.fernet.encrypt(value.encode()).decode()

    def decrypt(self, token: str) -> str:
        """Decrypt an encrypted value."""
        return self.fernet.decrypt(token.encode()).decode()

    def rotate(self, new_secret_key: bytes) -> None:
        """Rotate encryption key."""
        self.fernet = Fernet(new_secret_key)
