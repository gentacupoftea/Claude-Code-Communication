"""
Unified retry mechanism for Shopify MCP Server
Provides consistent retry behavior across all API types
"""

import asyncio
import functools
import logging
import random
import time
from typing import Optional, Callable, Type, List, Any, Dict, Union, TypeVar

from .errors import (
    ShopifyAPIError, ShopifyRateLimitError, ShopifyNetworkError,
    ShopifyGraphQLError, should_retry_error
)

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryStrategy:
    """Configuration for retry behavior"""
    
    def __init__(self, 
                 max_retries: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 60.0,
                 jitter: float = 0.1,
                 retry_exceptions: Optional[List[Type[Exception]]] = None):
        """
        Initialize retry strategy
        
        Args:
            max_retries: Maximum number of retry attempts
            base_delay: Base delay in seconds
            max_delay: Maximum delay in seconds
            jitter: Random jitter factor (0.0-1.0)
            retry_exceptions: List of exception types to retry
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter
        self.retry_exceptions = retry_exceptions or [
            ShopifyNetworkError,
            ShopifyRateLimitError
        ]
    
    def should_retry(self, 
                    error: Exception, 
                    retry_count: int,
                    custom_checker: Optional[Callable[[Exception], bool]] = None) -> bool:
        """
        Determine if retry should be attempted
        
        Args:
            error: The exception that occurred
            retry_count: Current retry count
            custom_checker: Optional custom retry check
            
        Returns:
            True if retry should be attempted
        """
        # Check max retries
        if retry_count >= self.max_retries:
            return False
            
        # Use provided checker function
        if custom_checker and custom_checker(error):
            return True
            
        # Check against exception types
        if any(isinstance(error, exc_type) for exc_type in self.retry_exceptions):
            return True
            
        # Use error-specific check
        if should_retry_error(error):
            return True
            
        return False
    
    def get_delay(self, retry_count: int, error: Optional[Exception] = None) -> float:
        """
        Calculate delay before next retry
        
        Args:
            retry_count: Current retry count
            error: The exception that occurred
            
        Returns:
            Delay in seconds
        """
        # Use explicit retry_after from rate limit error
        if isinstance(error, ShopifyRateLimitError) and error.retry_after:
            return error.retry_after
            
        # Calculate exponential backoff
        delay = self.base_delay * (2 ** retry_count)
        
        # Apply jitter: delay * (1 ± jitter)
        if self.jitter > 0:
            jitter_factor = 1 + (random.random() * self.jitter * 2) - self.jitter
            delay *= jitter_factor
            
        # Cap at max delay
        return min(delay, self.max_delay)


def retry_async(strategy: Optional[RetryStrategy] = None, 
               retry_checker: Optional[Callable[[Exception], bool]] = None):
    """
    Decorator for retrying asynchronous functions
    
    Args:
        strategy: RetryStrategy to use (or default if None)
        retry_checker: Optional custom retry check
        
    Returns:
        Decorated function
    """
    if strategy is None:
        strategy = RetryStrategy()
        
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            retry_count = 0
            last_exception = None
            
            while True:
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    # Check if we should retry
                    if not strategy.should_retry(e, retry_count, retry_checker):
                        logger.info(f"Not retrying after error: {e} (retry_count={retry_count})")
                        raise
                        
                    retry_count += 1
                    delay = strategy.get_delay(retry_count - 1, e)
                    
                    logger.warning(
                        f"Retry {retry_count}/{strategy.max_retries} after error: "
                        f"{e.__class__.__name__}: {e}. "
                        f"Waiting {delay:.2f}s before retry."
                    )
                    
                    await asyncio.sleep(delay)
                    
        return wrapper
    return decorator


def retry_sync(strategy: Optional[RetryStrategy] = None,
              retry_checker: Optional[Callable[[Exception], bool]] = None):
    """
    Decorator for retrying synchronous functions
    
    Args:
        strategy: RetryStrategy to use (or default if None)
        retry_checker: Optional custom retry check
        
    Returns:
        Decorated function
    """
    if strategy is None:
        strategy = RetryStrategy()
        
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            retry_count = 0
            last_exception = None
            
            while True:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    # Check if we should retry
                    if not strategy.should_retry(e, retry_count, retry_checker):
                        logger.info(f"Not retrying after error: {e} (retry_count={retry_count})")
                        raise
                        
                    retry_count += 1
                    delay = strategy.get_delay(retry_count - 1, e)
                    
                    logger.warning(
                        f"Retry {retry_count}/{strategy.max_retries} after error: "
                        f"{e.__class__.__name__}: {e}. "
                        f"Waiting {delay:.2f}s before retry."
                    )
                    
                    time.sleep(delay)
                    
        return wrapper
    return decorator