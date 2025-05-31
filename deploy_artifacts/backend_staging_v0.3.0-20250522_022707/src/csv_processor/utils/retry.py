"""
Retry utilities for CSV processor
Implements retry decorators with exponential backoff
"""

import time
import random
import logging
import asyncio
from typing import TypeVar, Callable, Optional, Type, List, Any, Union
from functools import wraps
import inspect

from ..exceptions import (
    CSVProcessorError, 
    ConnectionError, 
    TimeoutError, 
    RateLimitError
)

T = TypeVar('T')

logger = logging.getLogger(__name__)


class RetryExhaustedError(CSVProcessorError):
    """Raised when all retry attempts are exhausted"""
    def __init__(self, message: str, attempts: int, last_error: Exception, **kwargs):
        context = kwargs.get('context', {})
        context['attempts'] = attempts
        context['last_error'] = str(last_error)
        kwargs['context'] = context
        super().__init__(message, error_code="RETRY_EXHAUSTED", original_exception=last_error, **kwargs)


def retry(
    max_retries: int = 3,
    retry_exceptions: List[Type[Exception]] = None,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    jitter_factor: float = 0.1,
    on_retry: Optional[Callable] = None
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Retry decorator with exponential backoff.
    
    Args:
        max_retries: Maximum number of retries before giving up
        retry_exceptions: List of exceptions that trigger a retry
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        backoff_factor: Multiplier applied to delay between retries
        jitter_factor: Random jitter factor to add to delay
        on_retry: Optional callback function called on each retry
        
    Returns:
        Decorated function
    """
    if retry_exceptions is None:
        retry_exceptions = [ConnectionError, TimeoutError, RateLimitError, CSVProcessorError]
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        is_async = inspect.iscoroutinefunction(func)
        
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            delay = initial_delay
            
            for attempt in range(max_retries + 1):
                try:
                    if attempt > 0:
                        logger.info(
                            f"Retry attempt {attempt}/{max_retries} for "
                            f"{func.__name__} after {delay:.2f}s delay"
                        )
                    
                    return await func(*args, **kwargs)
                    
                except tuple(retry_exceptions) as e:
                    last_exception = e
                    
                    # Check if this specific error is retryable
                    if hasattr(e, 'is_retryable') and not e.is_retryable():
                        logger.error(f"Non-retryable error in {func.__name__}: {str(e)}")
                        raise
                    
                    if attempt >= max_retries:
                        logger.error(
                            f"Maximum retries ({max_retries}) exceeded for "
                            f"{func.__name__}"
                        )
                        break
                    
                    # Calculate next delay with jitter
                    jitter = random.uniform(
                        -jitter_factor * delay, 
                        jitter_factor * delay
                    )
                    next_delay = min(delay * backoff_factor + jitter, max_delay)
                    
                    # Special handling for rate limit errors
                    if isinstance(e, RateLimitError) and hasattr(e, 'retry_after'):
                        next_delay = e.retry_after
                    
                    # Log exception details
                    logger.warning(
                        f"Exception in {func.__name__}, retrying in "
                        f"{next_delay:.2f}s: {str(e)}"
                    )
                    
                    # Call retry callback if provided
                    if on_retry:
                        on_retry(attempt, e, next_delay)
                    
                    await asyncio.sleep(next_delay)
                    delay = next_delay
            
            # If we get here, all retries failed
            raise RetryExhaustedError(
                f"Operation failed after {max_retries} retries",
                attempts=max_retries,
                last_error=last_exception,
                context={"function": func.__name__}
            )
        
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            delay = initial_delay
            
            for attempt in range(max_retries + 1):
                try:
                    if attempt > 0:
                        logger.info(
                            f"Retry attempt {attempt}/{max_retries} for "
                            f"{func.__name__} after {delay:.2f}s delay"
                        )
                    
                    return func(*args, **kwargs)
                    
                except tuple(retry_exceptions) as e:
                    last_exception = e
                    
                    # Check if this specific error is retryable
                    if hasattr(e, 'is_retryable') and not e.is_retryable():
                        logger.error(f"Non-retryable error in {func.__name__}: {str(e)}")
                        raise
                    
                    if attempt >= max_retries:
                        logger.error(
                            f"Maximum retries ({max_retries}) exceeded for "
                            f"{func.__name__}"
                        )
                        break
                    
                    # Calculate next delay with jitter
                    jitter = random.uniform(
                        -jitter_factor * delay, 
                        jitter_factor * delay
                    )
                    next_delay = min(delay * backoff_factor + jitter, max_delay)
                    
                    # Special handling for rate limit errors
                    if isinstance(e, RateLimitError) and hasattr(e, 'retry_after'):
                        next_delay = e.retry_after
                    
                    # Log exception details
                    logger.warning(
                        f"Exception in {func.__name__}, retrying in "
                        f"{next_delay:.2f}s: {str(e)}"
                    )
                    
                    # Call retry callback if provided
                    if on_retry:
                        on_retry(attempt, e, next_delay)
                    
                    time.sleep(next_delay)
                    delay = next_delay
            
            # If we get here, all retries failed
            raise RetryExhaustedError(
                f"Operation failed after {max_retries} retries",
                attempts=max_retries,
                last_error=last_exception,
                context={"function": func.__name__}
            )
        
        return async_wrapper if is_async else sync_wrapper
    
    return decorator


class RetryContext:
    """Context manager for retry operations with state tracking"""
    
    def __init__(self, 
                 max_retries: int = 3,
                 initial_delay: float = 1.0,
                 max_delay: float = 60.0,
                 backoff_factor: float = 2.0):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.attempt = 0
        self.delay = initial_delay
        self.exceptions = []
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type and self.should_retry(exc_val):
            self.attempt += 1
            self.exceptions.append(exc_val)
            
            if self.attempt > self.max_retries:
                raise RetryExhaustedError(
                    f"Maximum retries ({self.max_retries}) exceeded",
                    attempts=self.attempt,
                    last_error=exc_val
                )
            
            # Calculate next delay
            self.delay = min(self.delay * self.backoff_factor, self.max_delay)
            
            # Handle rate limit errors
            if isinstance(exc_val, RateLimitError) and hasattr(exc_val, 'retry_after'):
                self.delay = exc_val.retry_after
            
            logger.warning(f"Retry {self.attempt}/{self.max_retries} after {self.delay}s")
            time.sleep(self.delay)
            
            # Suppress the exception to continue retrying
            return True
        
        return False
    
    def should_retry(self, exception: Exception) -> bool:
        """Check if exception should trigger a retry"""
        retryable_types = (ConnectionError, TimeoutError, RateLimitError, CSVProcessorError)
        
        if not isinstance(exception, retryable_types):
            return False
            
        if hasattr(exception, 'is_retryable'):
            return exception.is_retryable()
            
        return True
    
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type and self.should_retry(exc_val):
            self.attempt += 1
            self.exceptions.append(exc_val)
            
            if self.attempt > self.max_retries:
                raise RetryExhaustedError(
                    f"Maximum retries ({self.max_retries}) exceeded",
                    attempts=self.attempt,
                    last_error=exc_val
                )
            
            # Calculate next delay
            self.delay = min(self.delay * self.backoff_factor, self.max_delay)
            
            # Handle rate limit errors
            if isinstance(exc_val, RateLimitError) and hasattr(exc_val, 'retry_after'):
                self.delay = exc_val.retry_after
            
            logger.warning(f"Retry {self.attempt}/{self.max_retries} after {self.delay}s")
            await asyncio.sleep(self.delay)
            
            # Suppress the exception to continue retrying
            return True
        
        return False


def with_retry_context(max_retries: int = 3, **kwargs):
    """
    Decorator that provides retry context to a function
    
    The decorated function will receive a RetryContext as its first argument
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **func_kwargs):
            context = RetryContext(max_retries=max_retries, **kwargs)
            
            while True:
                try:
                    with context:
                        return func(context, *args, **func_kwargs)
                except RetryExhaustedError:
                    raise
                except Exception as e:
                    if context.attempt >= max_retries:
                        raise RetryExhaustedError(
                            f"Maximum retries ({max_retries}) exceeded",
                            attempts=context.attempt,
                            last_error=e
                        )
                    continue
        
        return wrapper
    
    return decorator