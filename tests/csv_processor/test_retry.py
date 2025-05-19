"""
Test cases for retry utilities
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, patch

from csv_processor.utils.retry import (
    retry,
    RetryContext,
    RetryExhaustedError,
    with_retry_context
)
from csv_processor.exceptions import ConnectionError, TimeoutError, RateLimitError


class TestRetryDecorator:
    
    def test_successful_execution_no_retry(self):
        """Test successful execution without retry"""
        mock_func = Mock(return_value="success")
        
        @retry(max_retries=3)
        def test_function():
            return mock_func()
        
        result = test_function()
        assert result == "success"
        assert mock_func.call_count == 1
    
    def test_retry_on_exception(self):
        """Test retry on exception"""
        mock_func = Mock(side_effect=[ConnectionError("fail"), ConnectionError("fail"), "success"])
        
        @retry(max_retries=3, initial_delay=0.01)
        def test_function():
            return mock_func()
        
        result = test_function()
        assert result == "success"
        assert mock_func.call_count == 3
    
    def test_max_retries_exceeded(self):
        """Test max retries exceeded"""
        mock_func = Mock(side_effect=ConnectionError("fail"))
        
        @retry(max_retries=2, initial_delay=0.01)
        def test_function():
            return mock_func()
        
        with pytest.raises(RetryExhaustedError) as exc_info:
            test_function()
        
        assert mock_func.call_count == 3  # Initial + 2 retries
        assert exc_info.value.attempts == 2
        assert isinstance(exc_info.value.last_error, ConnectionError)
    
    def test_retry_specific_exceptions(self):
        """Test retry only specific exceptions"""
        mock_func = Mock(side_effect=[ValueError("not retryable"), "never reached"])
        
        @retry(
            max_retries=3,
            retry_exceptions=[ConnectionError, TimeoutError],
            initial_delay=0.01
        )
        def test_function():
            return mock_func()
        
        with pytest.raises(ValueError):
            test_function()
        
        assert mock_func.call_count == 1  # No retry for ValueError
    
    def test_exponential_backoff(self):
        """Test exponential backoff timing"""
        attempts = []
        
        def track_attempts():
            attempts.append(time.time())
            if len(attempts) < 3:
                raise ConnectionError("fail")
            return "success"
        
        @retry(
            max_retries=3,
            initial_delay=0.1,
            backoff_factor=2.0,
            jitter_factor=0.0  # No jitter for predictable timing
        )
        def test_function():
            return track_attempts()
        
        start_time = time.time()
        result = test_function()
        
        assert result == "success"
        assert len(attempts) == 3
        
        # Check delays (approximately)
        delay1 = attempts[1] - attempts[0]
        delay2 = attempts[2] - attempts[1]
        
        assert 0.09 < delay1 < 0.11  # ~0.1s
        assert 0.19 < delay2 < 0.21  # ~0.2s (0.1 * 2)
    
    def test_rate_limit_error_handling(self):
        """Test special handling for rate limit errors"""
        error_with_retry_after = RateLimitError("rate limited", retry_after=0.05)
        mock_func = Mock(side_effect=[error_with_retry_after, "success"])
        
        @retry(max_retries=3, initial_delay=1.0)  # Would normally wait 1s
        def test_function():
            return mock_func()
        
        start_time = time.time()
        result = test_function()
        duration = time.time() - start_time
        
        assert result == "success"
        assert mock_func.call_count == 2
        assert 0.04 < duration < 0.10  # Used retry_after instead of initial_delay
    
    @pytest.mark.asyncio
    async def test_async_retry(self):
        """Test retry with async functions"""
        mock_func = Mock(side_effect=[ConnectionError("fail"), "success"])
        
        @retry(max_retries=3, initial_delay=0.01)
        async def test_async_function():
            return mock_func()
        
        result = await test_async_function()
        assert result == "success"
        assert mock_func.call_count == 2
    
    def test_on_retry_callback(self):
        """Test on_retry callback"""
        callback = Mock()
        mock_func = Mock(side_effect=[ConnectionError("fail"), "success"])
        
        @retry(
            max_retries=3,
            initial_delay=0.01,
            on_retry=callback
        )
        def test_function():
            return mock_func()
        
        result = test_function()
        assert result == "success"
        assert callback.call_count == 1
        
        # Check callback arguments
        call_args = callback.call_args[0]
        assert call_args[0] == 1  # attempt number
        assert isinstance(call_args[1], ConnectionError)  # exception
        assert isinstance(call_args[2], float)  # delay
    
    def test_non_retryable_error(self):
        """Test non-retryable error stops retries"""
        non_retryable_error = Mock(spec=ConnectionError)
        non_retryable_error.is_retryable.return_value = False
        mock_func = Mock(side_effect=non_retryable_error)
        
        @retry(max_retries=3, initial_delay=0.01)
        def test_function():
            return mock_func()
        
        with pytest.raises(Mock):
            test_function()
        
        assert mock_func.call_count == 1  # No retries


class TestRetryContext:
    
    def test_retry_context_success(self):
        """Test retry context with successful execution"""
        context = RetryContext(max_retries=3)
        attempt = 0
        
        while True:
            with context:
                attempt += 1
                if attempt < 3:
                    raise ConnectionError("fail")
                result = "success"
                break
        
        assert result == "success"
        assert context.attempt == 2
        assert len(context.exceptions) == 2
    
    def test_retry_context_max_retries(self):
        """Test retry context max retries exceeded"""
        context = RetryContext(max_retries=2)
        
        with pytest.raises(RetryExhaustedError):
            while True:
                with context:
                    raise ConnectionError("fail")
    
    def test_retry_context_non_retryable(self):
        """Test retry context with non-retryable exception"""
        context = RetryContext(max_retries=3)
        
        with pytest.raises(ValueError):
            with context:
                raise ValueError("not retryable")
        
        assert context.attempt == 0  # No retry attempted
    
    @pytest.mark.asyncio
    async def test_async_retry_context(self):
        """Test async retry context"""
        context = RetryContext(max_retries=2, initial_delay=0.01)
        attempt = 0
        
        while True:
            async with context:
                attempt += 1
                if attempt < 2:
                    raise ConnectionError("fail")
                result = "success"
                break
        
        assert result == "success"
        assert context.attempt == 1


class TestWithRetryContext:
    
    def test_with_retry_context_decorator(self):
        """Test with_retry_context decorator"""
        attempts = []
        
        @with_retry_context(max_retries=3)
        def test_function(context):
            attempts.append(context.attempt)
            if len(attempts) < 3:
                raise ConnectionError("fail")
            return "success"
        
        result = test_function()
        assert result == "success"
        assert len(attempts) == 3
        assert attempts == [0, 1, 2]
    
    def test_with_retry_context_max_retries(self):
        """Test with_retry_context max retries"""
        @with_retry_context(max_retries=2)
        def test_function(context):
            raise ConnectionError("always fail")
        
        with pytest.raises(RetryExhaustedError):
            test_function()