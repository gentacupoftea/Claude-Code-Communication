"""
Unified error handling for Shopify MCP Server
Based on PR #20 approach for consistent error handling across REST and GraphQL
"""

from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class ShopifyAPIError(Exception):
    """Base exception for all Shopify API errors"""
    
    def __init__(self, message: str, status_code: Optional[int] = None, 
                 response_data: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data or {}
        
    def __str__(self):
        if self.status_code:
            return f"{self.message} (Status: {self.status_code})"
        return self.message


class ShopifyRESTError(ShopifyAPIError):
    """REST API specific errors"""
    
    def __init__(self, message: str, status_code: int, 
                 response_data: Optional[Dict[str, Any]] = None,
                 request_id: Optional[str] = None):
        super().__init__(message, status_code, response_data)
        self.request_id = request_id
        
        # Extract specific error details from REST response
        if response_data and 'errors' in response_data:
            self.errors = response_data['errors']
        else:
            self.errors = []


class ShopifyGraphQLError(ShopifyAPIError):
    """GraphQL API specific errors"""
    
    def __init__(self, message: str, errors: Optional[List[Dict[str, Any]]] = None,
                 response: Optional[Any] = None):
        super().__init__(message)
        self.errors = errors or []
        self.response = response
        self.query_cost = None
        self.throttle_status = None
        
        # Parse GraphQL-specific error information
        self._parse_graphql_errors()
    
    def _parse_graphql_errors(self):
        """Parse GraphQL errors for additional context"""
        for error in self.errors:
            # Extract query cost information
            extensions = error.get('extensions', {})
            if 'cost' in extensions:
                self.query_cost = extensions['cost']
            
            # Extract throttle status
            if 'code' in extensions and extensions['code'] == 'THROTTLED':
                self.throttle_status = {
                    'status': 'THROTTLED',
                    'retry_after': extensions.get('retryAfter', 60)
                }
            
            # Log specific error types
            if error.get('message'):
                logger.warning(f"GraphQL error: {error['message']}")


class ShopifyRateLimitError(ShopifyAPIError):
    """Rate limit exceeded error"""
    
    def __init__(self, message: str = "Rate limit exceeded", 
                 retry_after: Optional[int] = None,
                 limit_info: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.retry_after = retry_after or 60  # Default to 60 seconds
        self.limit_info = limit_info or {}
        
    def __str__(self):
        return f"{self.message}. Retry after {self.retry_after} seconds."


class ShopifyNetworkError(ShopifyAPIError):
    """Network-related errors (connection, timeout, etc.)"""
    
    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message)
        self.original_error = original_error
        
    def __str__(self):
        if self.original_error:
            return f"{self.message}: {self.original_error}"
        return self.message


class ShopifyValidationError(ShopifyAPIError):
    """Input validation errors"""
    
    def __init__(self, message: str, field: Optional[str] = None,
                 validation_errors: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message)
        self.field = field
        self.validation_errors = validation_errors or []
        
    def __str__(self):
        if self.field:
            return f"{self.message} (Field: {self.field})"
        return self.message


class ShopifyAuthenticationError(ShopifyAPIError):
    """Authentication/authorization errors"""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)


# Error helper functions

def handle_rest_error(response) -> None:
    """
    Handle REST API response errors
    Raises appropriate exception based on response status
    """
    if response.status_code == 401:
        raise ShopifyAuthenticationError()
    elif response.status_code == 429:
        retry_after = response.headers.get('Retry-After', 60)
        raise ShopifyRateLimitError(retry_after=int(retry_after))
    elif response.status_code >= 400:
        try:
            error_data = response.json()
        except:
            error_data = {'message': response.text}
            
        raise ShopifyRESTError(
            message=error_data.get('message', 'API request failed'),
            status_code=response.status_code,
            response_data=error_data,
            request_id=response.headers.get('X-Request-Id')
        )


def handle_graphql_error(errors: List[Dict[str, Any]], response=None) -> None:
    """
    Handle GraphQL response errors
    Raises appropriate exception based on error content
    """
    # Check for specific error types
    for error in errors:
        extensions = error.get('extensions', {})
        
        # Rate limit error
        if extensions.get('code') == 'THROTTLED':
            retry_after = extensions.get('retryAfter', 60)
            raise ShopifyRateLimitError(
                message="GraphQL rate limit exceeded",
                retry_after=retry_after
            )
        
        # Authentication error
        if extensions.get('code') in ['UNAUTHORIZED', 'FORBIDDEN']:
            raise ShopifyAuthenticationError(error.get('message', 'Authentication failed'))
    
    # Generic GraphQL error
    raise ShopifyGraphQLError(
        message="GraphQL query failed",
        errors=errors,
        response=response
    )


def is_network_error(error: Exception) -> bool:
    """Check if an error is network-related"""
    import httpx
    import requests
    
    network_error_types = (
        httpx.NetworkError,
        httpx.ConnectError,
        httpx.TimeoutException,
        requests.ConnectionError,
        requests.Timeout,
        ConnectionError,
        TimeoutError
    )
    
    return isinstance(error, network_error_types)


def should_retry_error(error: Exception) -> bool:
    """Determine if an error should trigger a retry"""
    # Retry on network errors
    if is_network_error(error):
        return True
    
    # Retry on rate limit errors
    if isinstance(error, ShopifyRateLimitError):
        return True
    
    # Retry on specific GraphQL errors
    if isinstance(error, ShopifyGraphQLError):
        for err in error.errors:
            if err.get('extensions', {}).get('code') in ['INTERNAL_SERVER_ERROR', 'TIMEOUT']:
                return True
    
    # Don't retry on validation or authentication errors
    if isinstance(error, (ShopifyValidationError, ShopifyAuthenticationError)):
        return False
    
    return False