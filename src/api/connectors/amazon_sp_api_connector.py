#!/usr/bin/env python
# -*- coding: utf-8 -*-

import base64
import json
import logging
import time
import urllib.parse
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import requests

from ..connectors.base_connector import BaseAPIConnector, RateLimitConfig
from ..utils.error_handling import APIError, AuthenticationError, handle_request_exception

logger = logging.getLogger(__name__)

class AmazonSPAPIConnector(BaseAPIConnector):
    """
    Connector for Amazon Selling Partner API.
    """
    
    # Endpoint URLs
    OAUTH_ENDPOINT = "https://api.amazon.com/auth/o2/token"
    API_ENDPOINT = "https://sellingpartnerapi-na.amazon.com"  # North America endpoint
    
    # Secret names in Secret Manager
    CLIENT_ID_SECRET = "amazon-sp-api-client-id"
    CLIENT_SECRET_SECRET = "amazon-sp-api-client-secret"
    REFRESH_TOKEN_SECRET = "amazon-sp-api-refresh-token"
    
    # API scopes
    DEFAULT_SCOPES = [
        "sellingpartnerapi::notifications",
        "sellingpartnerapi::migration"
    ]
    
    def __init__(self, project_id: str, region: str = "na",
                 rate_limit_config: Optional[RateLimitConfig] = None):
        """
        Initialize the Amazon SP API connector.
        
        Args:
            project_id: GCP project ID for Secret Manager
            region: Amazon SP API region (na, eu, fe)
            rate_limit_config: Configuration for rate limiting API calls
        """
        super().__init__(project_id, rate_limit_config or RateLimitConfig(
            requests_per_second=0.5,  # Default to 2 seconds between requests to be safe
            max_retries=5,
            retry_delay=2.0,
            retry_multiplier=2.0
        ))
        
        # Set endpoint based on region
        region_endpoints = {
            "na": "https://sellingpartnerapi-na.amazon.com",
            "eu": "https://sellingpartnerapi-eu.amazon.com",
            "fe": "https://sellingpartnerapi-fe.amazon.com"
        }
        self.api_endpoint = region_endpoints.get(region.lower(), self.API_ENDPOINT)
        
        # Authentication state
        self.client_id = None
        self.client_secret = None
        self.refresh_token = None
        self.access_token = None
        self.access_token_expiry = datetime.now()
        
    def authenticate(self) -> None:
        """
        Authenticate with the Amazon SP API using OAuth 2.0.
        
        Raises:
            AuthenticationError: If authentication fails
        """
        # Get credentials from Secret Manager
        try:
            self.client_id = self.get_secret(self.CLIENT_ID_SECRET)
            self.client_secret = self.get_secret(self.CLIENT_SECRET_SECRET)
            self.refresh_token = self.get_secret(self.REFRESH_TOKEN_SECRET)
        except Exception as e:
            raise AuthenticationError(f"Failed to retrieve authentication credentials: {str(e)}")
        
        if not all([self.client_id, self.client_secret, self.refresh_token]):
            raise AuthenticationError("Missing required authentication credentials")
        
        # If access token exists and is not expired, no need to re-authenticate
        if self.access_token and self.access_token_expiry > datetime.now():
            return
        
        # Get access token using refresh token
        self._refresh_access_token()
    
    def is_authenticated(self) -> bool:
        """
        Check if the connector is authenticated.
        
        Returns:
            True if authenticated, False otherwise
        """
        return bool(self.access_token) and self.access_token_expiry > datetime.now()
    
    def _refresh_access_token(self) -> None:
        """
        Refresh the API access token.
        
        Raises:
            AuthenticationError: If token refresh fails
        """
        auth_data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            response = self.client.post(self.OAUTH_ENDPOINT, data=auth_data)
            response.raise_for_status()
            token_data = response.json()
            
            self.access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)  # Default to 1 hour
            
            # Set expiry time with a small buffer (5 minutes)
            self.access_token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            
            logger.info("Successfully refreshed Amazon SP API access token")
            
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to refresh access token: {str(e)}")
    
    def generate_auth_url(self, redirect_uri: str, state: Optional[str] = None,
                         scopes: Optional[List[str]] = None) -> str:
        """
        Generate an OAuth authorization URL for Amazon SP API.
        
        Args:
            redirect_uri: OAuth redirect URI
            state: Optional state parameter for OAuth flow
            scopes: Optional list of API scopes to request
        
        Returns:
            Authorization URL string
        """
        if not self.client_id:
            try:
                self.client_id = self.get_secret(self.CLIENT_ID_SECRET)
            except Exception as e:
                raise AuthenticationError(f"Failed to retrieve client ID: {str(e)}")
        
        # Use default scopes if none provided
        scopes = scopes or self.DEFAULT_SCOPES
        
        # Important: Join scopes with a space, not comma or another character
        scope_str = " ".join(scopes)
        
        params = {
            "application_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": scope_str,
            "response_type": "code"
        }
        
        if state:
            params["state"] = state
        
        auth_url = f"https://sellercentral.amazon.com/apps/authorize?{urllib.parse.urlencode(params)}"
        return auth_url
    
    def exchange_auth_code(self, auth_code: str, redirect_uri: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens.
        
        Args:
            auth_code: Authorization code from OAuth redirect
            redirect_uri: OAuth redirect URI
        
        Returns:
            Dictionary containing token information
        
        Raises:
            AuthenticationError: If token exchange fails
        """
        if not all([self.client_id, self.client_secret]):
            try:
                self.client_id = self.get_secret(self.CLIENT_ID_SECRET)
                self.client_secret = self.get_secret(self.CLIENT_SECRET_SECRET)
            except Exception as e:
                raise AuthenticationError(f"Failed to retrieve authentication credentials: {str(e)}")
        
        auth_data = {
            "grant_type": "authorization_code",
            "code": auth_code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            response = self.client.post(self.OAUTH_ENDPOINT, data=auth_data)
            response.raise_for_status()
            token_data = response.json()
            
            # Update current access token
            self.access_token = token_data.get("access_token")
            self.refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)  # Default to 1 hour
            
            # Set expiry time with a small buffer (5 minutes)
            self.access_token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            
            return token_data
            
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to exchange authorization code: {str(e)}")
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """
        Get authentication headers for API requests.
        
        Returns:
            Dictionary of request headers
        """
        if not self.is_authenticated():
            self.authenticate()
        
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def make_api_request(self, method: str, endpoint: str, 
                       params: Optional[Dict[str, Any]] = None,
                       data: Optional[Any] = None) -> Dict[str, Any]:
        """
        Make an authenticated request to the Amazon SP API.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path (e.g., "/orders/v0/orders")
            params: Optional query parameters
            data: Optional request body data
        
        Returns:
            Response data as a dictionary
        
        Raises:
            APIError: If the request fails
        """
        url = f"{self.api_endpoint}{endpoint}"
        headers = self._get_auth_headers()
        
        try:
            response = self.make_request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=data
            )
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise handle_request_exception(e)
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """
        Get current rate limits from the SP API.
        
        Returns:
            Dictionary with rate limit information
        
        Raises:
            APIError: If the request fails
        """
        try:
            response = self.make_api_request(
                method="GET",
                endpoint="/notifications/v1/subscriptions"
            )
            
            # Extract rate limit info from headers
            rate_limit_info = {
                "rate_limit": response.get("rateLimit", {}),
                "quota_available": response.get("quotaRemaining", "unknown"),
                "quota_reset_time": response.get("quotaResetOn", "unknown")
            }
            
            return rate_limit_info
            
        except Exception as e:
            logger.warning(f"Failed to get rate limits: {str(e)}")
            return {"error": str(e)}
    
    def get_orders(self, created_after: Optional[datetime] = None,
                 status_list: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Get orders from Amazon SP API.
        
        Args:
            created_after: Optional filter for orders created after this time
            status_list: Optional list of order statuses to filter
        
        Returns:
            List of order data dictionaries
        
        Raises:
            APIError: If the request fails
        """
        params = {}
        
        if created_after:
            params["CreatedAfter"] = created_after.isoformat()
            
        if status_list:
            params["OrderStatuses"] = ",".join(status_list)
        
        response = self.make_api_request(
            method="GET",
            endpoint="/orders/v0/orders",
            params=params
        )
        
        return response.get("payload", {}).get("Orders", [])
    
    def get_products(self, marketplace_id: str, sku_list: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Get products from Amazon SP API.
        
        Args:
            marketplace_id: Amazon marketplace ID
            sku_list: Optional list of SKUs to filter
        
        Returns:
            List of product data dictionaries
        
        Raises:
            APIError: If the request fails
        """
        params = {
            "MarketplaceId": marketplace_id
        }
        
        if sku_list:
            # For multiple SKUs, use POST endpoint with body instead
            endpoint = "/listings/2021-08-01/items"
            data = {
                "marketplaceIds": [marketplace_id],
                "issueLocale": "en_US",
                "sellerSkus": sku_list
            }
            response = self.make_api_request(
                method="POST",
                endpoint=endpoint,
                data=data
            )
        else:
            # For all products, use GET endpoint
            endpoint = "/listings/2021-08-01/items"
            response = self.make_api_request(
                method="GET",
                endpoint=endpoint,
                params=params
            )
        
        return response.get("items", [])