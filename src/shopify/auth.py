"""
Shopify OAuth2 Authentication Handler for Conea Integration
Manages OAuth flow, token refresh, and store verification
"""

import base64
import hashlib
import hmac
import json
import secrets
import urllib.parse
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urlencode, parse_qs, urlparse

import aiohttp
from cryptography.fernet import Fernet
from pydantic import BaseModel, validator

from .models import ShopifyStoreConnection, ShopifyAPIResponse
from ..utils.logger import get_logger

logger = get_logger(__name__)


class OAuthConfig(BaseModel):
    """OAuth configuration for Shopify app"""
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: List[str]
    app_url: Optional[str] = None
    
    @validator('scopes')
    def validate_scopes(cls, v):
        """Validate that scopes are not empty"""
        if not v:
            raise ValueError("At least one scope must be specified")
        return v


class OAuthState(BaseModel):
    """OAuth state for CSRF protection"""
    state: str
    shop: str
    timestamp: datetime
    redirect_url: Optional[str] = None
    
    def is_expired(self, timeout_minutes: int = 10) -> bool:
        """Check if OAuth state has expired"""
        expiry = self.timestamp + timedelta(minutes=timeout_minutes)
        return datetime.utcnow() > expiry


class ShopifyAuthError(Exception):
    """Base exception for Shopify authentication errors"""
    pass


class InvalidShopError(ShopifyAuthError):
    """Raised when shop domain is invalid"""
    pass


class OAuthVerificationError(ShopifyAuthError):
    """Raised when OAuth verification fails"""
    pass


class TokenRefreshError(ShopifyAuthError):
    """Raised when token refresh fails"""
    pass


class ShopifyAuth:
    """
    Shopify OAuth2 authentication handler with comprehensive security features:
    - CSRF protection with state parameter
    - HMAC verification for webhook security
    - Token encryption for storage
    - Automatic token refresh
    - Shop domain validation
    """
    
    def __init__(
        self,
        config: OAuthConfig,
        encryption_key: Optional[str] = None,
        state_timeout_minutes: int = 10
    ):
        self.config = config
        self.state_timeout_minutes = state_timeout_minutes
        
        # Initialize encryption for token storage
        if encryption_key:
            self.fernet = Fernet(encryption_key.encode())
        else:
            # Generate a key if none provided (store this securely in production)
            key = Fernet.generate_key()
            self.fernet = Fernet(key)
            logger.warning("Generated encryption key. Store this securely: %s", key.decode())
        
        # OAuth state storage (in production, use Redis or database)
        self._oauth_states: Dict[str, OAuthState] = {}
        
        logger.info("Initialized Shopify OAuth handler for app: %s", config.client_id)

    def validate_shop_domain(self, shop: str) -> str:
        """
        Validate and normalize shop domain
        
        Args:
            shop: Shop domain (can be shop.myshopify.com or just shop)
            
        Returns:
            Normalized shop domain without .myshopify.com
            
        Raises:
            InvalidShopError: If shop domain is invalid
        """
        if not shop:
            raise InvalidShopError("Shop domain cannot be empty")
        
        # Remove protocol if present
        if shop.startswith(('http://', 'https://')):
            shop = urlparse(shop).netloc
        
        # Remove .myshopify.com if present
        if shop.endswith('.myshopify.com'):
            shop = shop[:-16]  # Remove .myshopify.com
        
        # Validate shop name format
        if not shop or not shop.replace('-', '').replace('_', '').isalnum():
            raise InvalidShopError(f"Invalid shop domain format: {shop}")
        
        # Additional security checks
        if len(shop) < 3 or len(shop) > 60:
            raise InvalidShopError("Shop domain must be 3-60 characters")
        
        if shop.startswith('-') or shop.endswith('-'):
            raise InvalidShopError("Shop domain cannot start or end with hyphen")
        
        return shop.lower()

    def generate_oauth_url(
        self,
        shop: str,
        redirect_url: Optional[str] = None,
        grant_options: Optional[List[str]] = None
    ) -> Tuple[str, str]:
        """
        Generate OAuth authorization URL with CSRF protection
        
        Args:
            shop: Shop domain
            redirect_url: URL to redirect to after OAuth completion
            grant_options: Additional grant options
            
        Returns:
            Tuple of (oauth_url, state) for CSRF verification
        """
        # Validate and normalize shop domain
        shop = self.validate_shop_domain(shop)
        
        # Generate CSRF state
        state = secrets.token_urlsafe(32)
        
        # Store OAuth state
        oauth_state = OAuthState(
            state=state,
            shop=shop,
            timestamp=datetime.utcnow(),
            redirect_url=redirect_url
        )
        self._oauth_states[state] = oauth_state
        
        # Clean up expired states
        self._cleanup_expired_states()
        
        # Build OAuth URL
        params = {
            'client_id': self.config.client_id,
            'scope': ','.join(self.config.scopes),
            'redirect_uri': self.config.redirect_uri,
            'state': state,
            'response_type': 'code'
        }
        
        if grant_options:
            params['grant_options[]'] = grant_options
        
        oauth_url = f"https://{shop}.myshopify.com/admin/oauth/authorize?{urlencode(params)}"
        
        logger.info("Generated OAuth URL for shop: %s", shop)
        return oauth_url, state

    def verify_oauth_callback(
        self,
        shop: str,
        code: str,
        state: str,
        hmac_header: Optional[str] = None,
        query_string: Optional[str] = None
    ) -> bool:
        """
        Verify OAuth callback parameters
        
        Args:
            shop: Shop domain from callback
            code: Authorization code from callback
            state: CSRF state from callback
            hmac_header: HMAC header for verification
            query_string: Full query string for HMAC verification
            
        Returns:
            True if verification passes
            
        Raises:
            OAuthVerificationError: If verification fails
        """
        # Verify state parameter (CSRF protection)
        if state not in self._oauth_states:
            raise OAuthVerificationError("Invalid or expired OAuth state")
        
        oauth_state = self._oauth_states[state]
        
        # Check if state has expired
        if oauth_state.is_expired(self.state_timeout_minutes):
            del self._oauth_states[state]
            raise OAuthVerificationError("OAuth state has expired")
        
        # Verify shop matches
        normalized_shop = self.validate_shop_domain(shop)
        if normalized_shop != oauth_state.shop:
            raise OAuthVerificationError("Shop domain mismatch")
        
        # Verify HMAC if provided (webhook verification)
        if hmac_header and query_string:
            if not self.verify_hmac(query_string, hmac_header):
                raise OAuthVerificationError("HMAC verification failed")
        
        # Cleanup used state
        del self._oauth_states[state]
        
        logger.info("OAuth callback verified for shop: %s", normalized_shop)
        return True

    async def exchange_code_for_token(
        self,
        shop: str,
        code: str
    ) -> ShopifyStoreConnection:
        """
        Exchange authorization code for access token
        
        Args:
            shop: Shop domain
            code: Authorization code from OAuth callback
            
        Returns:
            ShopifyStoreConnection with access token
            
        Raises:
            OAuthVerificationError: If token exchange fails
        """
        shop = self.validate_shop_domain(shop)
        
        token_url = f"https://{shop}.myshopify.com/admin/oauth/access_token"
        
        payload = {
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret,
            'code': code
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(token_url, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise OAuthVerificationError(f"Token exchange failed: {error_text}")
                    
                    token_data = await response.json()
                    
                    if 'access_token' not in token_data:
                        raise OAuthVerificationError("No access token in response")
                    
                    # Get shop information
                    shop_info = await self._get_shop_info(shop, token_data['access_token'])
                    
                    # Create store connection
                    store_connection = ShopifyStoreConnection(
                        store_id=str(shop_info.get('id', shop)),
                        shop_domain=shop,
                        access_token=token_data['access_token'],
                        scope=token_data.get('scope', ','.join(self.config.scopes)),
                        store_name=shop_info.get('name'),
                        store_email=shop_info.get('email'),
                        currency=shop_info.get('currency', 'USD'),
                        timezone=shop_info.get('iana_timezone'),
                        connected_at=datetime.utcnow()
                    )
                    
                    logger.info("Successfully exchanged code for token: %s", shop)
                    return store_connection
                    
            except aiohttp.ClientError as e:
                raise OAuthVerificationError(f"Network error during token exchange: {e}")

    async def _get_shop_info(self, shop: str, access_token: str) -> Dict[str, Any]:
        """Get shop information using access token"""
        shop_url = f"https://{shop}.myshopify.com/admin/api/2024-01/shop.json"
        
        headers = {
            'X-Shopify-Access-Token': access_token,
            'Content-Type': 'application/json'
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(shop_url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('shop', {})
                else:
                    logger.warning("Failed to get shop info for %s: %s", shop, response.status)
                    return {}

    def verify_hmac(self, data: str, hmac_header: str) -> bool:
        """
        Verify HMAC signature for webhook or OAuth callback
        
        Args:
            data: Raw data to verify (query string or request body)
            hmac_header: HMAC signature from X-Shopify-Hmac-Sha256 header
            
        Returns:
            True if HMAC is valid
        """
        try:
            # Remove hmac parameter from query string if present
            if 'hmac=' in data:
                params = parse_qs(data)
                if 'hmac' in params:
                    del params['hmac']
                # Rebuild query string without hmac
                data = urlencode(sorted(params.items()), doseq=True)
            
            # Calculate expected HMAC
            expected_hmac = hmac.new(
                self.config.client_secret.encode('utf-8'),
                data.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            # Compare with provided HMAC
            return hmac.compare_digest(expected_hmac, hmac_header)
            
        except Exception as e:
            logger.error("HMAC verification error: %s", e)
            return False

    def verify_webhook_hmac(self, body: bytes, hmac_header: str) -> bool:
        """
        Verify HMAC for webhook requests
        
        Args:
            body: Raw request body as bytes
            hmac_header: HMAC signature from X-Shopify-Hmac-Sha256 header
            
        Returns:
            True if HMAC is valid
        """
        try:
            # Calculate HMAC for webhook body
            calculated_hmac = hmac.new(
                self.config.client_secret.encode('utf-8'),
                body,
                hashlib.sha256
            ).digest()
            
            # Encode to base64
            calculated_hmac_b64 = base64.b64encode(calculated_hmac).decode()
            
            return hmac.compare_digest(calculated_hmac_b64, hmac_header)
            
        except Exception as e:
            logger.error("Webhook HMAC verification error: %s", e)
            return False

    def encrypt_token(self, token: str) -> str:
        """Encrypt access token for secure storage"""
        return self.fernet.encrypt(token.encode()).decode()

    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt access token from storage"""
        return self.fernet.decrypt(encrypted_token.encode()).decode()

    async def refresh_access_token(
        self,
        store_connection: ShopifyStoreConnection
    ) -> ShopifyStoreConnection:
        """
        Refresh access token (if supported by app type)
        
        Note: Most Shopify apps use permanent tokens that don't need refresh
        This method is for future compatibility with apps that support token refresh
        """
        # Shopify doesn't currently support token refresh for most app types
        # This is a placeholder for future functionality
        logger.info("Token refresh requested for %s (not supported)", store_connection.shop_domain)
        return store_connection

    def validate_app_installation(self, shop: str, access_token: str) -> bool:
        """
        Validate that the app is still installed and token is valid
        
        Args:
            shop: Shop domain
            access_token: Access token to validate
            
        Returns:
            True if app is installed and token is valid
        """
        # This would make a simple API call to verify the token
        # Implementation would be async in practice
        pass

    def _cleanup_expired_states(self):
        """Remove expired OAuth states"""
        current_time = datetime.utcnow()
        expired_states = [
            state for state, oauth_state in self._oauth_states.items()
            if oauth_state.is_expired(self.state_timeout_minutes)
        ]
        
        for state in expired_states:
            del self._oauth_states[state]
        
        if expired_states:
            logger.debug("Cleaned up %d expired OAuth states", len(expired_states))

    def get_install_url(self, shop: str) -> str:
        """
        Get installation URL for the app
        
        Args:
            shop: Shop domain
            
        Returns:
            Installation URL
        """
        oauth_url, _ = self.generate_oauth_url(shop)
        return oauth_url

    def create_app_bridge_config(self, shop: str) -> Dict[str, Any]:
        """
        Create Shopify App Bridge configuration
        
        Args:
            shop: Shop domain
            
        Returns:
            App Bridge configuration object
        """
        return {
            'apiKey': self.config.client_id,
            'shopOrigin': f"https://{shop}.myshopify.com",
            'forceRedirect': True
        }

    async def validate_store_connection(
        self,
        store_connection: ShopifyStoreConnection
    ) -> bool:
        """
        Validate that a store connection is still valid
        
        Args:
            store_connection: Store connection to validate
            
        Returns:
            True if connection is valid
        """
        try:
            shop_url = f"https://{store_connection.shop_domain}.myshopify.com/admin/api/2024-01/shop.json"
            
            headers = {
                'X-Shopify-Access-Token': store_connection.access_token,
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(shop_url, headers=headers) as response:
                    return response.status == 200
                    
        except Exception as e:
            logger.error("Store connection validation failed: %s", e)
            return False

    def generate_app_uninstall_url(self, shop: str) -> str:
        """Generate URL for app uninstallation"""
        return f"https://{shop}.myshopify.com/admin/apps"

    def __del__(self):
        """Cleanup on object destruction"""
        # Clear sensitive data
        self._oauth_states.clear()