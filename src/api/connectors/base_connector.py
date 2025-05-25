#!/usr/bin/env python
# -*- coding: utf-8 -*-

import abc
import logging
import time
from typing import Any, Dict, List, Optional, Union

import requests
from google.cloud import secretmanager

logger = logging.getLogger(__name__)

class RateLimitConfig:
    """Rate limit configuration for API connectors."""
    
    def __init__(self, 
                 requests_per_second: float = 1.0,
                 max_retries: int = 3,
                 retry_delay: float = 1.0,
                 retry_multiplier: float = 2.0):
        """
        Initialize rate limit configuration.
        
        Args:
            requests_per_second: Maximum number of requests per second
            max_retries: Maximum number of retries for rate limited requests
            retry_delay: Initial delay between retries in seconds
            retry_multiplier: Multiplier for retry delay on subsequent retries
        """
        self.requests_per_second = requests_per_second
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.retry_multiplier = retry_multiplier
        self.last_request_time = 0.0
        
    def wait_if_needed(self):
        """Wait if necessary to comply with rate limits."""
        current_time = time.time()
        min_interval = 1.0 / self.requests_per_second
        elapsed = current_time - self.last_request_time
        
        if elapsed < min_interval:
            sleep_time = min_interval - elapsed
            logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f}s")
            time.sleep(sleep_time)
            
        self.last_request_time = time.time()


class BaseAPIConnector(abc.ABC):
    """Base class for API connectors with common functionality."""
    
    def __init__(self, 
                 project_id: str,
                 rate_limit_config: Optional[RateLimitConfig] = None):
        """
        Initialize the base API connector.
        
        Args:
            project_id: GCP project ID for Secret Manager
            rate_limit_config: Configuration for rate limiting API calls
        """
        self.project_id = project_id
        self.rate_limit = rate_limit_config or RateLimitConfig()
        self.client = requests.Session()
        self.secret_manager = secretmanager.SecretManagerServiceClient()
        
    def get_secret(self, secret_name: str) -> str:
        """
        Get a secret from GCP Secret Manager.
        
        Args:
            secret_name: Name of the secret
            
        Returns:
            The secret value as a string
        """
        name = f"projects/{self.project_id}/secrets/{secret_name}/versions/latest"
        response = self.secret_manager.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    
    def make_request(self, 
                   method: str, 
                   url: str, 
                   headers: Optional[Dict[str, str]] = None,
                   params: Optional[Dict[str, Any]] = None,
                   data: Optional[Any] = None,
                   json: Optional[Dict[str, Any]] = None) -> requests.Response:
        """
        Make an API request with rate limiting and retry logic.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: URL to request
            headers: Optional request headers
            params: Optional query parameters
            data: Optional request body data
            json: Optional JSON request body
            
        Returns:
            Response object
        
        Raises:
            requests.exceptions.RequestException: If the request fails after all retries
        """
        headers = headers or {}
        retries = 0
        delay = self.rate_limit.retry_delay
        
        while retries <= self.rate_limit.max_retries:
            self.rate_limit.wait_if_needed()
            
            try:
                response = self.client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    data=data,
                    json=json,
                    timeout=30
                )
                
                # Check for rate limiting response
                if response.status_code == 429:
                    retries += 1
                    if retries > self.rate_limit.max_retries:
                        response.raise_for_status()
                    
                    # Get retry-after header if available
                    retry_after = response.headers.get('Retry-After')
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except (ValueError, TypeError):
                            delay = self.rate_limit.retry_delay * (self.rate_limit.retry_multiplier ** retries)
                    else:
                        delay = self.rate_limit.retry_delay * (self.rate_limit.retry_multiplier ** retries)
                    
                    logger.warning(f"Rate limited. Retrying in {delay:.2f}s (attempt {retries}/{self.rate_limit.max_retries})")
                    time.sleep(delay)
                    continue
                
                # Raise exception for other error status codes
                response.raise_for_status()
                return response
                
            except requests.exceptions.RequestException as e:
                if retries >= self.rate_limit.max_retries:
                    logger.error(f"Request failed after {retries} retries: {str(e)}")
                    raise
                
                retries += 1
                logger.warning(f"Request error: {str(e)}. Retrying in {delay:.2f}s (attempt {retries}/{self.rate_limit.max_retries})")
                time.sleep(delay)
                delay *= self.rate_limit.retry_multiplier
    
    @abc.abstractmethod
    def authenticate(self) -> None:
        """
        Authenticate with the API.
        
        This method must be implemented by subclasses.
        """
        pass
    
    @abc.abstractmethod
    def is_authenticated(self) -> bool:
        """
        Check if the connector is authenticated.
        
        This method must be implemented by subclasses.
        
        Returns:
            True if authenticated, False otherwise
        """
        pass