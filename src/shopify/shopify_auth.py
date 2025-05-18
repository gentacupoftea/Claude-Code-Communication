"""Shopify OAuth2 authentication utilities."""

import logging
from urllib.parse import urlencode
from typing import Dict

import httpx

logger = logging.getLogger(__name__)


class ShopifyOAuth:
    """Handle OAuth2 flow for Shopify stores."""

    def __init__(self, api_key: str, api_secret: str, redirect_uri: str, scope: str):
        self.api_key = api_key
        self.api_secret = api_secret
        self.redirect_uri = redirect_uri
        self.scope = scope

    def authorization_url(self, shop: str, state: str) -> str:
        """Generate the Shopify authorization URL."""
        params = {
            "client_id": self.api_key,
            "scope": self.scope,
            "redirect_uri": self.redirect_uri,
            "state": state,
        }
        query = urlencode(params)
        return f"https://{shop}/admin/oauth/authorize?{query}"

    async def request_access_token(self, shop: str, code: str) -> Dict[str, str]:
        """Exchange authorization code for an access token."""
        url = f"https://{shop}/admin/oauth/access_token"
        data = {
            "client_id": self.api_key,
            "client_secret": self.api_secret,
            "code": code,
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, timeout=10)
            response.raise_for_status()
            return response.json()
