"""Error handling utilities for Google Analytics API."""
import time
import random
from typing import Callable, Any, Optional, TypeVar, Dict, List
from functools import wraps
from googleapiclient.errors import HttpError
from google.auth.exceptions import RefreshError

from ..schemas.errors import ErrorResponse, ErrorDetail

T = TypeVar('T')


class GoogleAnalyticsError(Exception):
    """Base exception for Google Analytics errors."""
    def __init__(self, message: str, error_code: Optional[str] = None, details: Optional[List[ErrorDetail]] = None):
        super().__init__(message)
        self.error_code = error_code or "GA_ERROR"
        self.details = details or []
    
    def to_error_response(self, status_code: int = 400, request_id: Optional[str] = None) -> ErrorResponse:
        """Convert exception to ErrorResponse."""
        return ErrorResponse(
            error_code=self.error_code,
            message=str(self),
            details=self.details,
            status_code=status_code,
            request_id=request_id
        )


class AuthenticationError(GoogleAnalyticsError):
    """Authentication related errors."""
    def __init__(self, message: str):
        super().__init__(message, error_code="AUTH_ERROR")


class APIError(GoogleAnalyticsError):
    """API related errors."""
    def __init__(self, message: str, http_error: Optional[HttpError] = None):
        error_code = "API_ERROR"
        details = []
        
        if http_error:
            error_code = f"HTTP_{http_error.resp.status}"
            try:
                error_content = http_error.error_details
                if isinstance(error_content, list):
                    for detail in error_content:
                        details.append(ErrorDetail(
                            field=detail.get("fieldPath"),
                            reason=detail.get("reason", "Unknown"),
                            message=detail.get("message", "Unknown error")
                        ))
            except:
                pass
        
        super().__init__(message, error_code=error_code, details=details)


class PropertyNotFoundError(GoogleAnalyticsError):
    """Property not found errors."""
    def __init__(self, property_id: str):
        super().__init__(
            f"Property {property_id} not found or inaccessible",
            error_code="PROPERTY_NOT_FOUND"
        )


def exponential_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    retry_exceptions: tuple = (HttpError, RefreshError)
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator for exponential backoff retry logic.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        backoff_factor: Factor to multiply delay by after each retry
        jitter: Whether to add random jitter to delays
        retry_exceptions: Tuple of exception types to retry on
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retry_exceptions as e:
                    last_exception = e
                    
                    # Check if this is a retryable error
                    if isinstance(e, HttpError):
                        if e.resp.status in [429, 500, 502, 503, 504]:
                            # Retryable error
                            pass
                        else:
                            # Non-retryable error
                            raise
                    
                    if attempt < max_retries:
                        # Calculate next delay
                        if jitter:
                            actual_delay = delay * (0.5 + random.random())
                        else:
                            actual_delay = delay
                        
                        # Sleep with the calculated delay
                        time.sleep(min(actual_delay, max_delay))
                        
                        # Increase delay for next attempt
                        delay *= backoff_factor
                        delay = min(delay, max_delay)
                    else:
                        # Max retries exceeded
                        raise APIError(f"Max retries exceeded: {str(e)}", http_error=e if isinstance(e, HttpError) else None)
                except Exception as e:
                    # Non-retryable exception
                    raise
            
            # Should never reach here, but just in case
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator


def handle_api_error(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator to handle API errors and convert them to proper exceptions.
    """
    @wraps(func)
    def wrapper(*args, **kwargs) -> T:
        try:
            return func(*args, **kwargs)
        except RefreshError as e:
            raise AuthenticationError(f"Authentication failed: {str(e)}")
        except HttpError as e:
            if e.resp.status == 401:
                raise AuthenticationError("Invalid credentials or expired token")
            elif e.resp.status == 403:
                raise AuthenticationError("Insufficient permissions")
            elif e.resp.status == 404:
                # Try to extract property ID from error message
                error_msg = str(e)
                if "properties/" in error_msg:
                    property_id = error_msg.split("properties/")[1].split()[0]
                    raise PropertyNotFoundError(property_id)
                raise APIError(f"Resource not found: {error_msg}", http_error=e)
            else:
                raise APIError(f"API error: {str(e)}", http_error=e)
        except GoogleAnalyticsError:
            # Re-raise our custom exceptions
            raise
        except Exception as e:
            # Wrap any other exceptions
            raise GoogleAnalyticsError(f"Unexpected error: {str(e)}")
    
    return wrapper