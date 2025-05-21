"""Tests for the logging_manager module."""

import os
import json
import logging
import tempfile
import unittest
from unittest.mock import patch, MagicMock, call
from pathlib import Path
import threading
import time
import uuid
import io
import sys

# Import the module to test
from src.logging_manager import (
    setup_logging,
    get_logger,
    LoggingContextConfig,
    SensitiveFilter,
    ContextFilter,
    JsonFormatter,
    LogMetricsCollector,
    MetricsHandler,
    SamplingHandler,
    set_context,
    clear_context,
    get_context,
    set_request_id,
    get_request_id,
    set_correlation_id,
    get_correlation_id,
    set_user_id,
    get_user_id,
    log_context,
    request_context,
    performance_log,
)


class TestLoggingManager(unittest.TestCase):
    """Test cases for the logging_manager module."""

    def setUp(self):
        """Set up test fixtures."""
        # Create a temporary directory for logs
        self.temp_dir = tempfile.TemporaryDirectory()
        self.log_dir = Path(self.temp_dir.name)
        
        # Capture stdout for testing
        self.stdout_capture = io.StringIO()
        self.old_stdout = sys.stdout
        sys.stdout = self.stdout_capture
        
        # Clear thread-local storage
        if hasattr(threading.local(), 'context'):
            delattr(threading.local(), 'context')
        if hasattr(threading.local(), 'request_id'):
            delattr(threading.local(), 'request_id')
        if hasattr(threading.local(), 'correlation_id'):
            delattr(threading.local(), 'correlation_id')
        if hasattr(threading.local(), 'user_id'):
            delattr(threading.local(), 'user_id')
    
    def tearDown(self):
        """Tear down test fixtures."""
        # Restore stdout
        sys.stdout = self.old_stdout
        
        # Clean up temporary directory
        self.temp_dir.cleanup()
        
        # Reset the root logger
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        root_logger.setLevel(logging.WARNING)
        
        # Clear thread-local storage
        clear_context()
        if hasattr(threading.local(), 'request_id'):
            delattr(threading.local(), 'request_id')
        if hasattr(threading.local(), 'correlation_id'):
            delattr(threading.local(), 'correlation_id')
        if hasattr(threading.local(), 'user_id'):
            delattr(threading.local(), 'user_id')
    
    @patch('src.logging_manager.LoggingContextConfig.get_config')
    @patch('src.logging_manager.get_logging_config')
    def test_setup_logging_basic(self, mock_get_logging_config, mock_get_extended_config):
        """Test basic logging setup."""
        # Mock configurations
        mock_basic_config = MagicMock()
        mock_basic_config.level = "INFO"
        mock_basic_config.format = "%(levelname)s: %(message)s"
        mock_basic_config.file = None
        mock_basic_config.syslog = False
        mock_basic_config.json_format = False
        mock_get_logging_config.return_value = mock_basic_config
        
        # Mock extended config
        mock_extended_config = MagicMock()
        mock_extended_config.enable_json_logging = False
        mock_extended_config.log_dir = str(self.log_dir)
        mock_extended_config.app_name = "test-app"
        mock_extended_config.log_file_max_size = 1024
        mock_extended_config.log_file_backup_count = 3
        mock_extended_config.enable_access_log = False
        mock_extended_config.enable_metrics = False
        mock_extended_config.enable_syslog = False
        mock_extended_config.sample_rate = 1.0
        mock_extended_config.sensitive_fields = ["password"]
        mock_extended_config.component_levels = {}
        mock_get_extended_config.return_value = mock_extended_config
        
        # Set up logging
        setup_logging(log_dir=self.log_dir, app_name="test-app")
        
        # Get root logger and check handlers
        root_logger = logging.getLogger()
        self.assertEqual(root_logger.level, logging.INFO)
        self.assertTrue(len(root_logger.handlers) >= 1)
        
        # Log a test message
        root_logger.info("Test message")
        
        # Check that the message was logged to stdout
        log_output = self.stdout_capture.getvalue()
        self.assertIn("Test message", log_output)
    
    def test_sensitive_filter(self):
        """Test the sensitive information filter."""
        # Create a filter
        sensitive_filter = SensitiveFilter(sensitive_fields=["password", "secret", "token"])
        
        # Create a log record with sensitive information
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg='User logged in with "password": "secret123"',
            args=(),
            exc_info=None
        )
        
        # Apply the filter
        sensitive_filter.filter(record)
        
        # Check that sensitive information was redacted
        self.assertIn("[REDACTED]", record.msg)
        self.assertNotIn("secret123", record.msg)
        
        # Test with dictionary args
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="User data: %s",
            args=({
                "username": "testuser",
                "password": "secret123",
                "token": "abc123",
                "nested": {
                    "api_secret": "xyz789"
                }
            },),
            exc_info=None
        )
        
        # Apply the filter
        sensitive_filter.filter(record)
        
        # Check that sensitive information was redacted
        self.assertEqual(record.args[0]["username"], "testuser")
        self.assertEqual(record.args[0]["password"], "[REDACTED]")
        self.assertEqual(record.args[0]["token"], "[REDACTED]")
        self.assertEqual(record.args[0]["nested"]["api_secret"], "[REDACTED]")
    
    def test_context_filter(self):
        """Test the context filter."""
        # Create a filter
        context_filter = ContextFilter()
        
        # Set some context
        set_request_id("req-123")
        set_correlation_id("corr-456")
        set_user_id("user-789")
        set_context(tenant_id="tenant-101", session_id="sess-202")
        
        # Create a log record
        record = logging.LogRecord(
            name="test.component",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Test message",
            args=(),
            exc_info=None
        )
        
        # Apply the filter
        context_filter.filter(record)
        
        # Check that context was added
        self.assertEqual(record.request_id, "req-123")
        self.assertEqual(record.correlation_id, "corr-456")
        self.assertEqual(record.user_id, "user-789")
        self.assertEqual(record.tenant_id, "tenant-101")
        self.assertEqual(record.session_id, "sess-202")
        self.assertEqual(record.component, "component")
    
    def test_json_formatter(self):
        """Test the JSON formatter."""
        # Create a formatter
        formatter = JsonFormatter()
        
        # Create a log record with context
        record = logging.LogRecord(
            name="test.component",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Test message",
            args=(),
            exc_info=None
        )
        record.request_id = "req-123"
        record.correlation_id = "corr-456"
        record.user_id = "user-789"
        record.component = "component"
        
        # Format the record
        formatted = formatter.format(record)
        
        # Parse the JSON
        log_data = json.loads(formatted)
        
        # Check contents
        self.assertEqual(log_data["level"], "INFO")
        self.assertEqual(log_data["logger"], "test.component")
        self.assertEqual(log_data["message"], "Test message")
        self.assertEqual(log_data["component"], "component")
        self.assertEqual(log_data["request_id"], "req-123")
        self.assertEqual(log_data["correlation_id"], "corr-456")
        self.assertEqual(log_data["user_id"], "user-789")
    
    def test_log_metrics_collector(self):
        """Test the log metrics collector."""
        # Create a collector
        collector = LogMetricsCollector(interval=0.1)
        
        # Generate some logs
        collector.increment("info", "api")
        collector.increment("info", "api")
        collector.increment("error", "api")
        collector.increment("debug", "database")
        
        # Check metrics
        self.assertEqual(collector.levels["info"], 2)
        self.assertEqual(collector.levels["error"], 1)
        self.assertEqual(collector.levels["debug"], 1)
        self.assertEqual(collector.components["api"]["info"], 2)
        self.assertEqual(collector.components["api"]["error"], 1)
        self.assertEqual(collector.components["database"]["debug"], 1)
        
        # Wait for metrics to be logged and reset
        time.sleep(0.2)
        
        # Check that metrics were reset
        self.assertEqual(collector.levels["info"], 0)
        self.assertEqual(collector.levels["error"], 0)
        self.assertEqual(collector.levels["debug"], 0)
        self.assertEqual(len(collector.components), 0)
    
    def test_metrics_handler(self):
        """Test the metrics handler."""
        # Create a collector and handler
        collector = LogMetricsCollector(interval=1000)  # High interval to prevent auto-reset
        handler = MetricsHandler(collector)
        
        # Create a log record
        record = logging.LogRecord(
            name="test.component",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Test message",
            args=(),
            exc_info=None
        )
        
        # Emit the record
        handler.emit(record)
        
        # Check that metrics were collected
        self.assertEqual(collector.levels["info"], 1)
        self.assertEqual(collector.components["component"]["info"], 1)
    
    def test_sampling_handler(self):
        """Test the sampling handler."""
        # Create a mock target handler
        target_handler = MagicMock()
        
        # Create a sampling handler with 0.0 rate (none should pass)
        handler = SamplingHandler(target_handler, sample_rate=0.0)
        
        # Create a normal log record
        info_record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Info message",
            args=(),
            exc_info=None
        )
        
        # Emit the record multiple times
        for _ in range(10):
            handler.emit(info_record)
        
        # No INFO records should have been forwarded
        self.assertEqual(target_handler.emit.call_count, 0)
        
        # Create an error record
        error_record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="",
            lineno=0,
            msg="Error message",
            args=(),
            exc_info=None
        )
        
        # Emit the error record
        handler.emit(error_record)
        
        # Error records should always be forwarded
        self.assertEqual(target_handler.emit.call_count, 1)
        target_handler.emit.assert_called_with(error_record)
        
        # Reset the mock
        target_handler.reset_mock()
        
        # Create a sampling handler with 1.0 rate (all should pass)
        handler = SamplingHandler(target_handler, sample_rate=1.0)
        
        # Emit the info record
        handler.emit(info_record)
        
        # Info record should be forwarded
        self.assertEqual(target_handler.emit.call_count, 1)
        target_handler.emit.assert_called_with(info_record)
    
    def test_thread_local_context(self):
        """Test thread-local context management."""
        # Set values in the main thread
        set_request_id("main-req")
        set_correlation_id("main-corr")
        set_user_id("main-user")
        set_context(tenant="main-tenant")
        
        # Function to run in a thread
        def thread_func():
            # Set different values in the thread
            set_request_id("thread-req")
            set_correlation_id("thread-corr")
            set_user_id("thread-user")
            set_context(tenant="thread-tenant")
            
            # Check thread values
            self.assertEqual(get_request_id(), "thread-req")
            self.assertEqual(get_correlation_id(), "thread-corr")
            self.assertEqual(get_user_id(), "thread-user")
            self.assertEqual(get_context("tenant"), "thread-tenant")
        
        # Run in a separate thread
        thread = threading.Thread(target=thread_func)
        thread.start()
        thread.join()
        
        # Check that main thread values are unchanged
        self.assertEqual(get_request_id(), "main-req")
        self.assertEqual(get_correlation_id(), "main-corr")
        self.assertEqual(get_user_id(), "main-user")
        self.assertEqual(get_context("tenant"), "main-tenant")
    
    def test_context_managers(self):
        """Test context managers for logging context."""
        # Set initial values
        set_request_id("initial-req")
        set_correlation_id("initial-corr")
        set_user_id("initial-user")
        set_context(tenant="initial-tenant")
        
        # Use the log_context context manager
        with log_context(tenant="temp-tenant", operation="query"):
            # Check temporary values
            self.assertEqual(get_context("tenant"), "temp-tenant")
            self.assertEqual(get_context("operation"), "query")
            self.assertEqual(get_request_id(), "initial-req")  # Unchanged
        
        # Check restored values
        self.assertEqual(get_context("tenant"), "initial-tenant")
        self.assertIsNone(get_context("operation"))
        
        # Use the request_context context manager
        with request_context(request_id="temp-req", correlation_id="temp-corr", user_id="temp-user", api="users"):
            # Check temporary values
            self.assertEqual(get_request_id(), "temp-req")
            self.assertEqual(get_correlation_id(), "temp-corr")
            self.assertEqual(get_user_id(), "temp-user")
            self.assertEqual(get_context("api"), "users")
        
        # Check restored values
        self.assertEqual(get_request_id(), "initial-req")
        self.assertEqual(get_correlation_id(), "initial-corr")
        self.assertEqual(get_user_id(), "initial-user")
        self.assertIsNone(get_context("api"))
    
    @patch('time.time')
    def test_performance_log_decorator(self, mock_time):
        """Test the performance logging decorator."""
        # Configure time.time to return increasing values
        mock_time.side_effect = [0.0, 2.0]  # 2 second difference
        
        # Create a mock logger
        mock_logger = MagicMock()
        
        # Decorated function
        @performance_log(threshold=1.0)
        def slow_function():
            """Test function."""
            return "result"
        
        # Patch the logging module to use our mock
        with patch('logging.getLogger', return_value=mock_logger):
            # Call the function
            result = slow_function()
            
            # Check the result
            self.assertEqual(result, "result")
            
            # Check that a warning was logged (duration > threshold)
            mock_logger.warning.assert_called_once()
            self.assertIn("Performance warning", mock_logger.warning.call_args[0][0])
            self.assertEqual(mock_logger.warning.call_args[1]["extra"]["function"], "slow_function")
            self.assertEqual(mock_logger.warning.call_args[1]["extra"]["duration_seconds"], 2.0)
            self.assertEqual(mock_logger.warning.call_args[1]["extra"]["threshold_seconds"], 1.0)
        
        # Reset mocks
        mock_logger.reset_mock()
        mock_time.side_effect = [0.0, 0.5]  # 0.5 second difference
        
        # Call again with shorter duration
        with patch('logging.getLogger', return_value=mock_logger):
            slow_function()
            
            # Check that a debug message was logged (duration < threshold)
            mock_logger.debug.assert_called_once()
            self.assertIn("Performance", mock_logger.debug.call_args[0][0])
            self.assertEqual(mock_logger.debug.call_args[1]["extra"]["function"], "slow_function")
            self.assertEqual(mock_logger.debug.call_args[1]["extra"]["duration_seconds"], 0.5)
    
    def test_get_logger(self):
        """Test the get_logger function."""
        # Get a logger
        logger = get_logger("test.module")
        
        # Check that it's a LoggerAdapter
        from src.logging_manager import ContextualLogger
        self.assertIsInstance(logger, ContextualLogger)
        
        # Set some context
        set_request_id("req-123")
        set_context(tenant="tenant-101")
        
        # Patch the underlying logger to capture calls
        base_logger = logger.logger
        original_debug = base_logger.debug
        debug_calls = []
        
        def mock_debug(msg, *args, **kwargs):
            debug_calls.append((msg, args, kwargs))
            return original_debug(msg, *args, **kwargs)
        
        base_logger.debug = mock_debug
        
        try:
            # Log a message
            logger.debug("Test debug message")
            
            # Check that the context was included
            self.assertEqual(len(debug_calls), 1)
            msg, args, kwargs = debug_calls[0]
            self.assertEqual(msg, "Test debug message")
            self.assertIn("extra", kwargs)
            self.assertEqual(kwargs["extra"]["tenant"], "tenant-101")
        finally:
            # Restore original method
            base_logger.debug = original_debug


if __name__ == "__main__":
    unittest.main()