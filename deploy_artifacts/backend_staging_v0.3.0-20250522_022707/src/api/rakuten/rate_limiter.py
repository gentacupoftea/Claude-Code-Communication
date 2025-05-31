"""
Rakuten API Rate Limiter
Enhanced rate limiting with adaptive backoff and metrics tracking
"""

import asyncio
import time
import logging
from typing import Dict, Any, Optional, List, Callable, Awaitable
from collections import deque
import math
import os
import random

logger = logging.getLogger(__name__)


class RakutenRateLimitState:
    """Current rate limit state"""
    
    def __init__(self, 
                 requests_limit: int = 30,
                 requests_remaining: int = 30,
                 reset_at: Optional[float] = None):
        """
        Initialize rate limit state
        
        Args:
            requests_limit: Maximum requests allowed
            requests_remaining: Remaining requests allowed
            reset_at: Time when rate limits reset (Unix timestamp)
        """
        self.timestamp = time.time()
        self.requests_limit = requests_limit
        self.requests_remaining = requests_remaining
        self.reset_at = reset_at or (self.timestamp + 60)  # Default 1 minute reset
        
    @property
    def usage_percentage(self) -> float:
        """Calculate current usage percentage"""
        if self.requests_limit <= 0:
            return 1.0
        return 1.0 - (self.requests_remaining / self.requests_limit)
    
    @property
    def time_to_reset(self) -> float:
        """Calculate time to reset in seconds"""
        now = time.time()
        return max(0, self.reset_at - now)


class RakutenRateLimiter:
    """
    Adaptive rate limiter for Rakuten API with:
    - Request counting and limiting
    - Adaptive backoff when approaching limits
    - Automatic retry for rate-limited requests
    - Detailed metrics tracking
    """
    
    def __init__(self, 
                 requests_per_minute: int = 30,
                 max_burst: int = 10,
                 backoff_factor: float = 1.5,
                 max_backoff: float = 30.0,
                 max_retries: int = 3,
                 enable_log: bool = True):
        """
        Initialize rate limiter
        
        Args:
            requests_per_minute: Maximum requests per minute
            max_burst: Maximum burst size for short periods
            backoff_factor: Exponential backoff multiplier
            max_backoff: Maximum backoff time in seconds
            max_retries: Maximum retry attempts for rate-limited requests
            enable_log: Enable detailed logging
        """
        # Configuration
        self.requests_per_minute = requests_per_minute
        self.request_interval = 60.0 / requests_per_minute
        self.max_burst = max_burst
        self.backoff_factor = backoff_factor
        self.max_backoff = max_backoff
        self.max_retries = max_retries
        self.enable_log = enable_log
        
        # State
        self.lock = asyncio.Lock()
        self.state = RakutenRateLimitState(
            requests_limit=requests_per_minute,
            requests_remaining=requests_per_minute
        )
        self.request_times = deque(maxlen=100)
        self.retry_counts = deque(maxlen=100)
        
        # Adaptive state
        self.current_backoff = 0.0
        
        # Metrics
        self.total_requests = 0
        self.throttled_requests = 0
        self.consecutive_throttles = 0
        self.retry_successes = 0
        self.retry_failures = 0
        
        self.logger = logging.getLogger("rakuten_rate_limiter")
    
    def log(self, message: str, level: int = logging.INFO):
        """Log message if logging is enabled"""
        if self.enable_log:
            self.logger.log(level, message)
    
    async def wait(self) -> float:
        """
        Wait based on rate limit state
        
        Returns:
            float: Wait time in seconds
        """
        async with self.lock:
            now = time.time()
            self.total_requests += 1
            
            # Calculate requests in the last minute
            minute_ago = now - 60
            recent_requests = sum(1 for t in self.request_times 
                               if t > minute_ago)
            
            # Calculate requests in the last second (burst control)
            second_ago = now - 1
            burst_requests = sum(1 for t in self.request_times
                              if t > second_ago)
            
            # Determine wait time
            if recent_requests >= self.requests_per_minute:
                # Approaching the minute-based limit
                wait_time = max(
                    self.request_interval, 
                    self.current_backoff,
                    self.state.time_to_reset
                )
                self.throttled_requests += 1
                self.consecutive_throttles += 1
                
                # Increase backoff if consecutively throttled
                if self.consecutive_throttles > 1:
                    self.current_backoff = min(
                        self.current_backoff * self.backoff_factor,
                        self.max_backoff
                    )
                    self.log(
                        f"バックオフ時間を増加: {self.current_backoff:.2f}秒", 
                        logging.WARNING
                    )
            elif burst_requests >= self.max_burst:
                # Control bursts
                wait_time = max(
                    self.request_interval,
                    self.current_backoff
                )
                self.throttled_requests += 1
                
                # Small backoff for burst control
                self.current_backoff = max(
                    self.current_backoff,
                    0.1 * self.backoff_factor
                )
            elif self.state.requests_remaining <= self.max_burst:
                # Getting close to API limits based on headers
                limit_factor = 1.0 - (self.state.requests_remaining / self.max_burst)
                wait_time = self.request_interval * (1 + limit_factor * 2)
                
                self.log(
                    f"残りリクエスト数が少ないため調整: {self.state.requests_remaining}/{self.state.requests_limit}",
                    logging.INFO
                )
            else:
                # Normal operation - minimal wait
                elapsed = now - self.last_request_time if hasattr(self, 'last_request_time') else self.request_interval
                wait_time = max(0, self.request_interval - elapsed)
                
                # Reset consecutive throttle counter
                self.consecutive_throttles = 0
                
                # Gradually reduce backoff during normal operation
                if self.current_backoff > 0:
                    self.current_backoff = self.current_backoff / self.backoff_factor
            
            # Enforce max wait time
            wait_time = min(wait_time, self.max_backoff)
            
            if wait_time > 0.5:  # Only log significant waits
                self.log(f"レート制限のため {wait_time:.2f}秒待機中...")
                
            # Actually wait
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            
            # Update state
            self.last_request_time = time.time()
            self.request_times.append(self.last_request_time)
            
            # Simulate decrementing the remaining requests
            # (Will be updated properly when headers arrive)
            if self.state.requests_remaining > 0:
                self.state.requests_remaining -= 1
                
            return wait_time
    
    def update_from_headers(self, headers: Dict[str, str]):
        """
        Update rate limit state from response headers
        
        Args:
            headers: HTTP response headers
        """
        # Rakuten uses standard rate limit headers
        if 'X-RateLimit-Limit' in headers:
            try:
                self.state.requests_limit = int(headers['X-RateLimit-Limit'])
            except (ValueError, TypeError):
                pass
                
        if 'X-RateLimit-Remaining' in headers:
            try:
                self.state.requests_remaining = int(headers['X-RateLimit-Remaining'])
            except (ValueError, TypeError):
                pass
                
        if 'X-RateLimit-Reset' in headers:
            try:
                self.state.reset_at = float(headers['X-RateLimit-Reset'])
            except (ValueError, TypeError):
                # If header parsing fails, set a default reset time
                self.state.reset_at = time.time() + 60  # Default 1 minute
        
        # Log current limits after update
        if self.enable_log:
            usage_pct = self.state.usage_percentage * 100
            if usage_pct > 70:  # Only log high usage
                self.log(
                    f"Rakuten API レート制限: {self.state.requests_remaining}/{self.state.requests_limit} "
                    f"({usage_pct:.1f}% 使用中)",
                    logging.WARNING if usage_pct > 90 else logging.INFO
                )
    
    def wrap_async_function(self, func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        """
        Wraps an async function with rate limiting
        
        Args:
            func: Async function to wrap
            
        Returns:
            Wrapped async function with rate limiting
        """
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            await self.wait()
            
            for attempt in range(self.max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    # Check for rate limit errors
                    is_rate_limit = False
                    
                    if hasattr(e, 'response') and getattr(e, 'response', None):
                        if getattr(e.response, 'status_code', 0) == 429:
                            is_rate_limit = True
                        
                    if hasattr(e, 'code') and e.code in ['RATE_LIMIT', 'TOO_MANY_REQUESTS']:
                        is_rate_limit = True
                        
                    if is_rate_limit and attempt < self.max_retries:
                        # Track throttle
                        self.consecutive_throttles += 1
                        self.throttled_requests += 1
                        
                        # Calculate backoff with jitter
                        backoff = min(
                            self.max_backoff,
                            (self.backoff_factor ** attempt) * (1 + random.random() * 0.1)
                        )
                        
                        # Check for Retry-After header
                        retry_after = None
                        if (hasattr(e, 'response') and 
                            getattr(e, 'response', None) and 
                            'Retry-After' in e.response.headers):
                            try:
                                retry_after = float(e.response.headers['Retry-After'])
                            except (ValueError, TypeError):
                                pass
                        
                        # Use the larger of calculated backoff or Retry-After
                        if retry_after:
                            backoff = max(backoff, retry_after)
                            
                        self.log(
                            f"レート制限エラー, リトライ {attempt+1}/{self.max_retries} "
                            f"({backoff:.2f}秒後)",
                            logging.WARNING
                        )
                        
                        await asyncio.sleep(backoff)
                        
                        # Zero out remaining requests to prevent further calls
                        self.state.requests_remaining = 0
                        
                        # Try again after the backoff
                        continue
                    
                    # Other error or max retries exceeded
                    if is_rate_limit:
                        self.retry_failures += 1
                    raise
            
            # This shouldn't be reached due to the raise above
            return None
        
        return wrapper
    
    def __call__(self, func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        """
        Decorator for rate-limiting an async function
        
        Args:
            func: Async function to decorate
            
        Returns:
            Rate-limited wrapped function
        """
        return self.wrap_async_function(func)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get rate limiter statistics
        
        Returns:
            Dictionary of statistics
        """
        average_retry = sum(self.retry_counts) / len(self.retry_counts) if self.retry_counts else 0
        
        now = time.time()
        minute_ago = now - 60
        second_ago = now - 1
        
        return {
            "total_requests": self.total_requests,
            "throttled_requests": self.throttled_requests,
            "throttle_rate": self.throttled_requests / max(1, self.total_requests),
            "current_backoff": self.current_backoff,
            "consecutive_throttles": self.consecutive_throttles,
            "average_retry_count": average_retry,
            "retry_success_rate": self.retry_successes / max(1, self.retry_successes + self.retry_failures),
            "requests_per_minute": sum(1 for t in self.request_times if t > minute_ago),
            "requests_per_second": sum(1 for t in self.request_times if t > second_ago),
            "max_requests_per_minute": self.requests_per_minute,
            "max_burst": self.max_burst,
            
            # Current state from headers
            "api_requests_remaining": self.state.requests_remaining,
            "api_requests_limit": self.state.requests_limit,
            "api_usage_percentage": self.state.usage_percentage * 100,
            "api_reset_in_seconds": self.state.time_to_reset
        }


# シングルトンインスタンスを作成
# 環境変数から設定を読み込む
rakuten_rate_limiter = RakutenRateLimiter(
    requests_per_minute=int(os.getenv('RAKUTEN_RATE_LIMIT_RPM', '30')),
    max_burst=int(os.getenv('RAKUTEN_RATE_LIMIT_BURST', '10')),
    max_retries=int(os.getenv('RAKUTEN_RATE_LIMIT_RETRIES', '3')),
    enable_log=os.getenv('RAKUTEN_RATE_LIMIT_LOG', 'true').lower() in ('true', '1', 'yes')
)