"""
Test suite for the rate limiter implementation
"""

import unittest
import time
from unittest.mock import MagicMock, patch
import threading
from utils import RateLimiter, shopify_rate_limiter


class TestRateLimiter(unittest.TestCase):
    """Test cases for the RateLimiter class"""
    
    def setUp(self):
        # Create a rate limiter with high requests per second for testing
        self.rate_limiter = RateLimiter(
            requests_per_second=10.0,  # Fast for testing
            max_burst=5,
            backoff_factor=1.5,
            max_backoff=0.5,  # Low for faster tests
            enable_log=False  # Disable logging for tests
        )
    
    def test_initialization(self):
        """Test that rate limiter initializes with correct parameters"""
        self.assertEqual(self.rate_limiter.requests_per_second, 10.0)
        self.assertEqual(self.rate_limiter.request_interval, 0.1)
        self.assertEqual(self.rate_limiter.max_burst, 5)
        self.assertEqual(self.rate_limiter.backoff_factor, 1.5)
        self.assertEqual(self.rate_limiter.max_backoff, 0.5)
        self.assertEqual(self.rate_limiter.enable_log, False)
        
    def test_wait_without_throttling(self):
        """Test that wait() returns quickly when not throttled"""
        start_time = time.time()
        self.rate_limiter.wait()
        elapsed = time.time() - start_time
        
        # Should return almost immediately
        self.assertLess(elapsed, 0.05, "Wait should return quickly when not throttled")
    
    def test_wait_with_throttling(self):
        """Test that wait() implements throttling under load"""
        # Simulate burst exceeding max_burst
        self.rate_limiter.request_times = [time.time() for _ in range(10)]
        
        start_time = time.time()
        self.rate_limiter.wait()
        elapsed = time.time() - start_time
        
        # Should wait at least the request interval due to throttling
        self.assertGreater(elapsed, 0.05, "Wait should implement throttling")
    
    def test_consecutive_throttles_increase_backoff(self):
        """Test that consecutive throttling increases backoff time"""
        # Simulate consecutive throttles
        self.rate_limiter.request_times = [time.time() for _ in range(10)]
        self.rate_limiter.consecutive_throttles = 2
        self.rate_limiter.current_backoff = 0.1
        
        self.rate_limiter.wait()
        
        # Backoff should increase by the backoff factor
        self.assertGreater(self.rate_limiter.current_backoff, 0.1)
    
    def test_decorator_application(self):
        """Test the rate limiter as a decorator"""
        test_func = MagicMock(return_value="test_result")
        decorated_func = self.rate_limiter(test_func)
        
        # Call the decorated function
        result = decorated_func(1, test=2)
        
        # The original function should be called with the same args
        test_func.assert_called_once_with(1, test=2)
        self.assertEqual(result, "test_result")
    
    def test_decorator_retries_on_rate_limit_error(self):
        """Test that the decorator retries on rate limit errors"""
        test_func = MagicMock(side_effect=[
            Exception("rate limit exceeded"),  # First call fails
            "test_result"                      # Second call succeeds
        ])
        
        # Patch sleep to avoid waiting in tests
        with patch('time.sleep') as mock_sleep:
            decorated_func = self.rate_limiter(test_func)
            result = decorated_func()
            
            # Should have called the function twice
            self.assertEqual(test_func.call_count, 2)
            self.assertEqual(result, "test_result")
            
            # Should have slept for backoff
            mock_sleep.assert_called()
    
    def test_get_stats(self):
        """Test that get_stats returns expected structure"""
        # Prepare some test data
        self.rate_limiter.total_requests = 100
        self.rate_limiter.throttled_requests = 20
        self.rate_limiter.consecutive_throttles = 1
        self.rate_limiter.current_backoff = 0.2
        self.rate_limiter.retry_counts = [0, 1, 2, 0, 0]
        
        stats = self.rate_limiter.get_stats()
        
        # Check stats format and values
        self.assertEqual(stats["total_requests"], 100)
        self.assertEqual(stats["throttled_requests"], 20)
        self.assertEqual(stats["throttle_rate"], 0.2)
        self.assertEqual(stats["current_backoff"], 0.2)
        self.assertEqual(stats["consecutive_throttles"], 1)
        self.assertAlmostEqual(stats["average_retry_count"], 0.6)
    
    def test_thread_safety(self):
        """Test that rate limiter is thread-safe"""
        # Counter to track successful operations
        counter = {'value': 0}
        
        def increment_counter():
            # Get a reference that will be waited on by rate limiter
            time.sleep(0.01)  # Small delay to ensure thread overlap
            self.rate_limiter.wait()
            # Access to the counter is not synchronized, but that's ok for this test
            counter['value'] += 1
        
        # Create multiple threads to test concurrency
        threads = []
        for _ in range(20):
            thread = threading.Thread(target=increment_counter)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All threads should have successfully incremented the counter
        self.assertEqual(counter['value'], 20)


class TestShopifyRateLimiter(unittest.TestCase):
    """Test the shopify_rate_limiter instance"""
    
    def test_singleton_instance(self):
        """Test that the shopify_rate_limiter is properly initialized"""
        # The singleton should be initialized with default values or from env vars
        self.assertIsInstance(shopify_rate_limiter, RateLimiter)


if __name__ == '__main__':
    unittest.main()