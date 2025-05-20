#!/usr/bin/env python
# -*- coding: utf-8 -*-

import logging
from typing import Any, Dict, Optional, Union

import requests

logger = logging.getLogger(__name__)

class APIError(Exception):
    """Base exception for API-related errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, 
                 response: Optional[requests.Response] = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)
    
    def __str__(self) -> str:
        if self.status_code:
            return f"{self.message} (Status: {self.status_code})"
        return self.message


class AuthenticationError(APIError):
    """Exception raised for authentication failures."""
    pass


class RateLimitError(APIError):
    """Exception raised when rate limits are exceeded."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, 
                 response: Optional[requests.Response] = None, 
                 retry_after: Optional[Union[int, float]] = None):
        super().__init__(message, status_code, response)
        self.retry_after = retry_after


class ResourceNotFoundError(APIError):
    """Exception raised when a requested resource is not found."""
    pass


class ValidationError(APIError):
    """Exception raised for data validation errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, 
                 response: Optional[requests.Response] = None, 
                 validation_errors: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code, response)
        self.validation_errors = validation_errors or {}


class ServerError(APIError):
    """Exception raised for server-side errors."""
    pass


def handle_request_exception(e: requests.exceptions.RequestException) -> APIError:
    """
    Convert requests exceptions to appropriate API exceptions.
    
    Args:
        e: The original requests exception
        
    Returns:
        An appropriate APIError subclass
    """
    response = getattr(e, 'response', None)
    status_code = response.status_code if response else None
    
    if status_code is None:
        # Connection errors, timeouts, etc.
        return APIError(f"Request failed: {str(e)}")
    
    # Try to parse response body as JSON
    error_data = {}
    try:
        if response and response.content:
            error_data = response.json()
    except (ValueError, TypeError):
        error_data = {"raw": response.text if response else ""}
    
    error_message = error_data.get('message', str(e))
    
    # Handle different error types based on status code
    if status_code == 401 or status_code == 403:
        return AuthenticationError(f"Authentication failed: {error_message}", status_code, response)
    
    elif status_code == 404:
        return ResourceNotFoundError(f"Resource not found: {error_message}", status_code, response)
    
    elif status_code == 422:
        return ValidationError(f"Validation error: {error_message}", status_code, response, 
                               error_data.get('errors', {}))
    
    elif status_code == 429:
        retry_after = None
        if response and 'Retry-After' in response.headers:
            try:
                retry_after = int(response.headers['Retry-After'])
            except (ValueError, TypeError):
                pass
        return RateLimitError(f"Rate limit exceeded: {error_message}", status_code, response, retry_after)
    
    elif status_code >= 500:
        return ServerError(f"Server error: {error_message}", status_code, response)
    
    # Default case
    return APIError(f"API error ({status_code}): {error_message}", status_code, response)