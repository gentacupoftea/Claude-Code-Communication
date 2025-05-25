#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import requests

from ..connectors.base_connector import BaseAPIConnector, RateLimitConfig
from ..utils.error_handling import APIError, AuthenticationError, handle_request_exception

logger = logging.getLogger(__name__)

class NextEngineConnector(BaseAPIConnector):
    """
    Connector for NextEngine API.
    """
    
    # API endpoints
    BASE_URL = "https://api.next-engine.org"
    AUTH_URL = f"{BASE_URL}/api_neauth"
    API_URL = f"{BASE_URL}/api_v1_"
    
    # Secret names in Secret Manager
    CLIENT_ID_SECRET = "nextengine-client-id"
    CLIENT_SECRET_SECRET = "nextengine-client-secret"
    REFRESH_TOKEN_SECRET = "nextengine-refresh-token"
    
    def __init__(self, project_id: str,
                 rate_limit_config: Optional[RateLimitConfig] = None):
        """
        Initialize the NextEngine API connector.
        
        Args:
            project_id: GCP project ID for Secret Manager
            rate_limit_config: Configuration for rate limiting API calls
        """
        super().__init__(project_id, rate_limit_config or RateLimitConfig(
            requests_per_second=1.0,  # Default to 1 request per second
            max_retries=3,
            retry_delay=1.0,
            retry_multiplier=2.0
        ))
        
        # Authentication state
        self.client_id = None
        self.client_secret = None
        self.refresh_token = None
        self.access_token = None
        self.access_token_expiry = datetime.now()
        self.company_id = None
        
    def authenticate(self) -> None:
        """
        Authenticate with the NextEngine API.
        
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
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token,
            "grant_type": "refresh_token"
        }
        
        try:
            response = self.client.post(f"{self.AUTH_URL}/refresh", data=auth_data)
            response.raise_for_status()
            token_data = response.json()
            
            if token_data.get("result") != "success":
                error_message = token_data.get("message", "Unknown error")
                raise AuthenticationError(f"Failed to refresh access token: {error_message}")
            
            access_data = token_data.get("access_token", {})
            self.access_token = access_data.get("value")
            expires_in = access_data.get("expires_in", 3600)  # Default to 1 hour
            self.company_id = token_data.get("company_id")
            
            # Set expiry time with a small buffer (5 minutes)
            self.access_token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            
            logger.info("Successfully refreshed NextEngine API access token")
            
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to refresh access token: {str(e)}")
    
    def generate_auth_url(self, redirect_uri: str) -> str:
        """
        Generate an OAuth authorization URL for NextEngine API.
        
        Args:
            redirect_uri: OAuth redirect URI
        
        Returns:
            Authorization URL string
        """
        if not self.client_id:
            try:
                self.client_id = self.get_secret(self.CLIENT_ID_SECRET)
            except Exception as e:
                raise AuthenticationError(f"Failed to retrieve client ID: {str(e)}")
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri
        }
        
        # Build query string manually
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        auth_url = f"{self.AUTH_URL}/?{query_string}"
        
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
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": auth_code,
            "redirect_uri": redirect_uri
        }
        
        try:
            response = self.client.post(f"{self.AUTH_URL}/token", data=auth_data)
            response.raise_for_status()
            token_data = response.json()
            
            if token_data.get("result") != "success":
                error_message = token_data.get("message", "Unknown error")
                raise AuthenticationError(f"Failed to exchange authorization code: {error_message}")
            
            # Update current access token
            access_data = token_data.get("access_token", {})
            self.access_token = access_data.get("value")
            expires_in = access_data.get("expires_in", 3600)  # Default to 1 hour
            
            refresh_data = token_data.get("refresh_token", {})
            self.refresh_token = refresh_data.get("value")
            
            self.company_id = token_data.get("company_id")
            
            # Set expiry time with a small buffer (5 minutes)
            self.access_token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            
            return token_data
            
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to exchange authorization code: {str(e)}")
    
    def _get_auth_params(self) -> Dict[str, str]:
        """
        Get authentication parameters for API requests.
        
        Returns:
            Dictionary of authentication parameters
        """
        if not self.is_authenticated():
            self.authenticate()
        
        return {
            "access_token": self.access_token,
            "company_id": self.company_id
        }
    
    def make_api_request(self, endpoint: str, method: str = "GET",
                       params: Optional[Dict[str, Any]] = None,
                       data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make an authenticated request to the NextEngine API.
        
        Args:
            endpoint: API endpoint (e.g., "receiveorder_base/search")
            method: HTTP method (GET, POST, etc.)
            params: Optional query parameters
            data: Optional request body data
        
        Returns:
            Response data as a dictionary
        
        Raises:
            APIError: If the request fails
        """
        url = f"{self.API_URL}{endpoint}"
        auth_params = self._get_auth_params()
        
        # Combine auth params with custom params
        request_params = {**auth_params, **(params or {})}
        
        try:
            response = self.make_request(
                method=method,
                url=url,
                params=request_params if method == "GET" else None,
                data=request_params if method == "POST" and not data else None,
                json=data
            )
            
            response_data = response.json()
            
            # Check if API request was successful
            if response_data.get("result") != "success":
                error_message = response_data.get("message", "Unknown error")
                raise APIError(error_message, response.status_code, response)
            
            return response_data
            
        except requests.exceptions.RequestException as e:
            raise handle_request_exception(e)
    
    def get_master_products(self, 
                          search_params: Optional[Dict[str, Any]] = None,
                          limit: int = 100,
                          offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get product master data from NextEngine.
        
        Args:
            search_params: Optional search parameters
            limit: Maximum number of results to return
            offset: Result offset for pagination
        
        Returns:
            List of product master data dictionaries
        
        Raises:
            APIError: If the request fails
        """
        params = {
            "fields": "goods_id,goods_name,goods_code,goods_jan_code,goods_model_number",
            "limit": str(limit),
            "offset": str(offset)
        }
        
        # Add custom search parameters
        if search_params:
            for key, value in search_params.items():
                params[key] = value
        
        response = self.make_api_request(
            endpoint="goods_master/search",
            method="POST",
            params=params
        )
        
        return response.get("data", [])
    
    def get_receive_orders(self, 
                         search_params: Optional[Dict[str, Any]] = None,
                         limit: int = 100,
                         offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get receive order data from NextEngine.
        
        Args:
            search_params: Optional search parameters
            limit: Maximum number of results to return
            offset: Result offset for pagination
        
        Returns:
            List of receive order data dictionaries
        
        Raises:
            APIError: If the request fails
        """
        params = {
            "fields": "receive_order_id,receive_order_shop_id,receive_order_date,receive_order_status,receive_order_type",
            "limit": str(limit),
            "offset": str(offset)
        }
        
        # Add custom search parameters
        if search_params:
            for key, value in search_params.items():
                params[key] = value
        
        response = self.make_api_request(
            endpoint="receiveorder_base/search",
            method="POST",
            params=params
        )
        
        return response.get("data", [])
    
    def get_receive_order_rows(self, receive_order_id: str) -> List[Dict[str, Any]]:
        """
        Get receive order row data from NextEngine.
        
        Args:
            receive_order_id: Receive order ID
        
        Returns:
            List of receive order row data dictionaries
        
        Raises:
            APIError: If the request fails
        """
        params = {
            "fields": "receive_order_id,receive_order_row_goods_id,receive_order_row_quantity,receive_order_row_unit_price",
            "receive_order_id-eq": receive_order_id
        }
        
        response = self.make_api_request(
            endpoint="receiveorder_row/search",
            method="POST",
            params=params
        )
        
        return response.get("data", [])
    
    def update_product(self, goods_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a product in NextEngine.
        
        Args:
            goods_id: Product ID
            update_data: Data to update
        
        Returns:
            Response data dictionary
        
        Raises:
            APIError: If the request fails
        """
        params = {
            "goods_id": goods_id
        }
        
        response = self.make_api_request(
            endpoint="goods_master/update",
            method="POST",
            params=params,
            data=update_data
        )
        
        return response