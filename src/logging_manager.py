"""
Logging Manager for Shopify MCP Server.

This module provides a comprehensive logging system with the following features:
- Multiple logging destinations (console, file, syslog, etc.)
- Different log levels per component
- Structured logging (JSON format support)
- Log rotation
- Context information (request ID, correlation ID, etc.)
- Performance logging utilities
- Sensitive information filtering
- Log volume metrics
- Configuration via the config system
"""

import os
import sys
import time
import uuid
import json
import logging
import logging.config
import logging.handlers
import threading
import functools
import traceback
import inspect
import socket
import re
from typing import Dict, Any, Optional, List, Callable, Union, Set
from datetime import datetime
from contextlib import contextmanager
from pathlib import Path

# Import config_manager for configuration integration
from src.config_manager import get_logging_config, ConfigSectionFactory

# Setup module logger
logger = logging.getLogger(__name__)

# Thread-local storage for context variables
_thread_local = threading.local()

# Type aliases
LoggerAdapter = logging.LoggerAdapter
LogHandler = logging.Handler
LogRecord = logging.LogRecord
LogLevel = Union[int, str]


class LoggingContextConfig(object):
    """Configuration for the extended logging settings."""
    # Define a pydantic model for extended logging configuration
    fields = {
        "enable_json_logging": (bool, False, "Enable structured JSON logging format"),
        "log_dir": (str, "logs", "Directory to store log files"),
        "app_name": (str, "shopify-mcp-server", "Application name for logs"),
        "log_file_max_size": (int, 10 * 1024 * 1024, "Maximum size in bytes for log files before rotation"),
        "log_file_backup_count": (int, 5, "Number of backup log files to keep"),
        "enable_access_log": (bool, True, "Enable HTTP access logging"),
        "enable_metrics": (bool, True, "Enable log metrics collection"),
        "metrics_interval": (int, 60, "Interval in seconds for logging metrics"),
        "enable_syslog": (bool, False, "Enable logging to syslog"),
        "syslog_address": (str, "/dev/log", "Syslog socket address"),
        "syslog_facility": (int, 1, "Syslog facility code"),
        "sample_rate": (float, 1.0, "Sampling rate for logs (0.0-1.0)"),
        "sensitive_fields": (List[str], ["password", "token", "secret", "key", "auth", "credential"], 
                             "Fields to be redacted in logs"),
        "performance_threshold": (float, 1.0, "Threshold in seconds for performance warning logs"),
        "cloud_logging": (bool, False, "Enable cloud-specific logging features"),
        "component_levels": (Dict[str, str], {}, "Component-specific log levels"),
    }

    # Create a config section for extended logging
    @classmethod
    def get_config(cls):
        """Get extended logging configuration."""
        return ConfigSectionFactory.create_section("logging_extended", cls.fields)


class SensitiveFilter(logging.Filter):
    """Filter for redacting sensitive information in log records."""
    
    def __init__(self, sensitive_fields=None, replacement="[REDACTED]"):
        """
        Initialize the filter with a list of sensitive field names and a replacement string.
        
        Args:
            sensitive_fields: List of field names to redact
            replacement: String to replace sensitive information with
        """
        super().__init__()
        self.sensitive_fields = sensitive_fields or []
        self.replacement = replacement
        self._patterns = [
            # Compile regex patterns for each sensitive field
            re.compile(r'([\'"])(' + re.escape(field) + r')(\1):\s*([\'"])[^\4]+\4', re.IGNORECASE)
            for field in self.sensitive_fields
        ]
    
    def filter(self, record: LogRecord) -> bool:
        """
        Filter log records to redact sensitive information.
        
        Args:
            record: Log record to filter
            
        Returns:
            True to include the record (with modifications), False to exclude
        """
        # Always include the record, but modify its content
        if isinstance(record.msg, str):
            # Redact sensitive fields in string messages
            for pattern in self._patterns:
                record.msg = pattern.sub(r'\1\2\3: \4' + self.replacement + r'\4', record.msg)
        
        # Process args if present
        if record.args:
            # Handle dict args
            if len(record.args) == 1 and isinstance(record.args[0], dict):
                record.args = (self._redact_dict(record.args[0]),)
            # Handle string args that might contain sensitive data
            elif isinstance(record.args, tuple):
                args_list = list(record.args)
                for i, arg in enumerate(args_list):
                    if isinstance(arg, str):
                        for pattern in self._patterns:
                            args_list[i] = pattern.sub(r'\1\2\3: \4' + self.replacement + r'\4', arg)
                    elif isinstance(arg, dict):
                        args_list[i] = self._redact_dict(arg)
                record.args = tuple(args_list)
        
        # Also check for extras in the record
        for attr in dir(record):
            if attr.startswith('__'):
                continue
            value = getattr(record, attr)
            if isinstance(value, dict):
                setattr(record, attr, self._redact_dict(value))
        
        return True
    
    def _redact_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Redact sensitive information in a dictionary.
        
        Args:
            data: Dictionary to redact
            
        Returns:
            Redacted dictionary
        """
        result = {}
        for key, value in data.items():
            # Check if key matches any sensitive field
            if any(field.lower() in key.lower() for field in self.sensitive_fields):
                result[key] = self.replacement
            # Recursively handle nested dictionaries
            elif isinstance(value, dict):
                result[key] = self._redact_dict(value)
            # Handle lists that might contain dictionaries
            elif isinstance(value, list):
                result[key] = [
                    self._redact_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                result[key] = value
        return result


class ContextFilter(logging.Filter):
    """Filter that adds context information to log records."""
    
    def __init__(self, context_provider=None):
        """
        Initialize the context filter.
        
        Args:
            context_provider: Optional function to provide additional context
        """
        super().__init__()
        self.hostname = socket.gethostname()
        self.context_provider = context_provider
    
    def filter(self, record: LogRecord) -> bool:
        """
        Add context information to log records.
        
        Args:
            record: Log record to enhance
            
        Returns:
            True to include the record, False to exclude
        """
        # Add basic context
        record.hostname = self.hostname
        
        # Add timestamp for JSON logging
        record.timestamp = datetime.utcnow().isoformat() + 'Z'
        
        # Add request_id if available
        record.request_id = getattr(_thread_local, 'request_id', '')
        
        # Add correlation_id if available
        record.correlation_id = getattr(_thread_local, 'correlation_id', '')
        
        # Add user_id if available
        record.user_id = getattr(_thread_local, 'user_id', '')
        
        # Add the current component
        record.component = record.name.split('.')[-1]
        
        # Add application name
        record.app_name = getattr(_thread_local, 'app_name', 'shopify-mcp-server')
        
        # Add execution environment
        record.environment = os.environ.get('ENVIRONMENT', 'development')
        
        # Add custom context if provided
        if self.context_provider:
            try:
                custom_context = self.context_provider()
                for key, value in custom_context.items():
                    setattr(record, key, value)
            except Exception as e:
                # Log but don't fail if context provider fails
                print(f"Error in context provider: {e}")
        
        # Add any additional thread-local context
        context = getattr(_thread_local, 'context', {})
        for key, value in context.items():
            setattr(record, key, value)
        
        return True


class JsonFormatter(logging.Formatter):
    """Formatter for JSON log output."""
    
    def __init__(self, include_stack_info=False):
        """
        Initialize the JSON formatter.
        
        Args:
            include_stack_info: Whether to include stack information
        """
        super().__init__()
        self.include_stack_info = include_stack_info
    
    def format(self, record: LogRecord) -> str:
        """
        Format a log record as JSON.
        
        Args:
            record: Log record to format
            
        Returns:
            JSON string representation of the log record
        """
        # Extract basic record information
        message = record.getMessage()
        
        # Build the log data structure
        log_data = {
            "timestamp": getattr(record, 'timestamp', datetime.utcnow().isoformat() + 'Z'),
            "level": record.levelname,
            "logger": record.name,
            "message": message,
            "component": getattr(record, 'component', record.name.split('.')[-1]),
        }
        
        # Add context information if available
        for field in ['request_id', 'correlation_id', 'user_id', 'hostname', 
                     'app_name', 'environment']:
            if hasattr(record, field):
                log_data[field] = getattr(record, field)
        
        # Add exception info if available
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': self.formatException(record.exc_info),
            }
        
        # Add stack information if requested
        if self.include_stack_info and record.stack_info:
            log_data['stack_info'] = record.stack_info
        
        # Add any extra attributes from the record
        for key, value in record.__dict__.items():
            if key not in ['args', 'asctime', 'created', 'exc_info', 'exc_text', 'filename',
                          'funcName', 'id', 'levelname', 'levelno', 'lineno', 'module',
                          'msecs', 'message', 'msg', 'name', 'pathname', 'process',
                          'processName', 'relativeCreated', 'stack_info', 'thread', 'threadName',
                          'timestamp', 'level', 'logger', 'component', 'request_id', 
                          'correlation_id', 'user_id', 'hostname', 'app_name', 'environment']:
                if not key.startswith('_'):
                    log_data[key] = value
        
        # Convert to JSON
        return json.dumps(log_data)


class LogMetricsCollector:
    """Collector for log volume metrics."""
    
    def __init__(self, interval=60):
        """
        Initialize the metrics collector.
        
        Args:
            interval: Interval in seconds for logging metrics
        """
        self.interval = interval
        self.levels = {
            'debug': 0,
            'info': 0,
            'warning': 0,
            'error': 0,
            'critical': 0,
        }
        self.components = {}
        self.lock = threading.Lock()
        self.start_time = time.time()
        
        # Start collection thread
        self._start_collection()
    
    def increment(self, level: str, component: str) -> None:
        """
        Increment counters for a log event.
        
        Args:
            level: Log level name
            component: Component name
        """
        with self.lock:
            level = level.lower()
            if level in self.levels:
                self.levels[level] += 1
            
            if component not in self.components:
                self.components[component] = {}
            
            if level not in self.components[component]:
                self.components[component][level] = 0
            
            self.components[component][level] += 1
    
    def _start_collection(self) -> None:
        """Start the metrics collection thread."""
        def collect_metrics():
            while True:
                time.sleep(self.interval)
                self._log_metrics()
        
        thread = threading.Thread(target=collect_metrics, daemon=True)
        thread.start()
    
    def _log_metrics(self) -> None:
        """Log the collected metrics."""
        duration = time.time() - self.start_time
        
        with self.lock:
            # Prepare metrics data
            metrics = {
                'duration_seconds': round(duration, 2),
                'logs_per_level': dict(self.levels),
                'logs_per_component': dict(self.components),
                'total_logs': sum(self.levels.values()),
                'logs_per_second': round(sum(self.levels.values()) / duration, 2) if duration > 0 else 0,
            }
            
            # Reset counters
            for level in self.levels:
                self.levels[level] = 0
            self.components = {}
            self.start_time = time.time()
        
        # Log the metrics
        logger.info("Log metrics", extra={'metrics': metrics})


class MetricsHandler(logging.Handler):
    """Handler that collects metrics for logs."""
    
    def __init__(self, collector=None):
        """
        Initialize the metrics handler.
        
        Args:
            collector: Metrics collector instance
        """
        super().__init__()
        self.collector = collector or LogMetricsCollector()
    
    def emit(self, record: LogRecord) -> None:
        """
        Emit a log record (collect metrics).
        
        Args:
            record: Log record to process
        """
        try:
            level = record.levelname.lower()
            component = record.name.split('.')[-1]
            self.collector.increment(level, component)
        except Exception:
            self.handleError(record)


class SamplingHandler(logging.Handler):
    """Handler that samples log records based on a rate."""
    
    def __init__(self, target_handler: LogHandler, sample_rate: float = 1.0):
        """
        Initialize the sampling handler.
        
        Args:
            target_handler: The handler to which sampled logs should be forwarded
            sample_rate: Sampling rate (0.0-1.0)
        """
        super().__init__()
        self.target_handler = target_handler
        self.sample_rate = min(max(sample_rate, 0.0), 1.0)  # Clamp to 0.0-1.0
    
    def emit(self, record: LogRecord) -> None:
        """
        Emit a log record if it passes sampling.
        
        Args:
            record: Log record to process
        """
        try:
            # Always emit error and critical logs
            if record.levelno >= logging.ERROR or self.sample_rate >= 1.0:
                self.target_handler.emit(record)
            else:
                # Sample based on rate
                import random
                if random.random() < self.sample_rate:
                    self.target_handler.emit(record)
        except Exception:
            self.handleError(record)


class ContextualLogger(LoggerAdapter):
    """Logger adapter that adds context information."""
    
    def process(self, msg, kwargs):
        """
        Process the log message and add context information.
        
        Args:
            msg: Log message
            kwargs: Additional arguments
            
        Returns:
            Tuple of message and updated kwargs
        """
        # Ensure extra is in kwargs
        kwargs.setdefault('extra', {})
        
        # Add thread-local context
        context = getattr(_thread_local, 'context', {})
        kwargs['extra'].update(context)
        
        return msg, kwargs


def set_context(**kwargs) -> None:
    """
    Set context variables for the current thread.
    
    Args:
        **kwargs: Context variables to set
    """
    if not hasattr(_thread_local, 'context'):
        _thread_local.context = {}
    
    _thread_local.context.update(kwargs)


def clear_context() -> None:
    """Clear all context variables for the current thread."""
    if hasattr(_thread_local, 'context'):
        _thread_local.context = {}


def get_context(key: str, default=None) -> Any:
    """
    Get a context variable for the current thread.
    
    Args:
        key: Context variable name
        default: Default value if not found
        
    Returns:
        Context variable value
    """
    if not hasattr(_thread_local, 'context'):
        return default
    
    return _thread_local.context.get(key, default)


def set_request_id(request_id: Optional[str] = None) -> str:
    """
    Set the request ID for the current thread.
    
    Args:
        request_id: Request ID to set (or None to generate one)
        
    Returns:
        The set request ID
    """
    if request_id is None:
        request_id = str(uuid.uuid4())
    
    _thread_local.request_id = request_id
    return request_id


def get_request_id() -> str:
    """
    Get the request ID for the current thread.
    
    Returns:
        Current request ID or empty string if not set
    """
    return getattr(_thread_local, 'request_id', '')


def set_correlation_id(correlation_id: str) -> None:
    """
    Set the correlation ID for the current thread.
    
    Args:
        correlation_id: Correlation ID to set
    """
    _thread_local.correlation_id = correlation_id


def get_correlation_id() -> str:
    """
    Get the correlation ID for the current thread.
    
    Returns:
        Current correlation ID or empty string if not set
    """
    return getattr(_thread_local, 'correlation_id', '')


def set_user_id(user_id: str) -> None:
    """
    Set the user ID for the current thread.
    
    Args:
        user_id: User ID to set
    """
    _thread_local.user_id = user_id


def get_user_id() -> str:
    """
    Get the user ID for the current thread.
    
    Returns:
        Current user ID or empty string if not set
    """
    return getattr(_thread_local, 'user_id', '')


@contextmanager
def log_context(**context_vars):
    """
    Context manager for setting temporary log context.
    
    Args:
        **context_vars: Context variables to set
    """
    old_context = getattr(_thread_local, 'context', {}).copy()
    try:
        set_context(**context_vars)
        yield
    finally:
        _thread_local.context = old_context


@contextmanager
def request_context(request_id=None, correlation_id=None, user_id=None, **context_vars):
    """
    Context manager for setting request-related context.
    
    Args:
        request_id: Request ID to set
        correlation_id: Correlation ID to set
        user_id: User ID to set
        **context_vars: Additional context variables
    """
    old_request_id = getattr(_thread_local, 'request_id', '')
    old_correlation_id = getattr(_thread_local, 'correlation_id', '')
    old_user_id = getattr(_thread_local, 'user_id', '')
    old_context = getattr(_thread_local, 'context', {}).copy()
    
    try:
        if request_id is not None:
            _thread_local.request_id = request_id
        elif not old_request_id:
            _thread_local.request_id = str(uuid.uuid4())
        
        if correlation_id is not None:
            _thread_local.correlation_id = correlation_id
        
        if user_id is not None:
            _thread_local.user_id = user_id
        
        if context_vars:
            set_context(**context_vars)
        
        yield
    finally:
        _thread_local.request_id = old_request_id
        _thread_local.correlation_id = old_correlation_id
        _thread_local.user_id = old_user_id
        _thread_local.context = old_context


def performance_log(threshold: float = None):
    """
    Decorator to log function performance.
    
    Args:
        threshold: Time threshold in seconds for warnings
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get logger for the function
            func_logger = logging.getLogger(func.__module__)
            
            # Get threshold
            perf_threshold = threshold
            if perf_threshold is None:
                # Try to get from config
                try:
                    config = LoggingContextConfig.get_config()
                    perf_threshold = config.performance_threshold
                except Exception:
                    perf_threshold = 1.0  # Default to 1 second
            
            # Start timer
            start_time = time.time()
            
            try:
                # Call the function
                return func(*args, **kwargs)
            finally:
                # Calculate duration
                duration = time.time() - start_time
                
                # Log performance
                if duration >= perf_threshold:
                    func_logger.warning(
                        f"Performance warning: {func.__name__} took {duration:.3f}s",
                        extra={
                            "performance": True,
                            "function": func.__name__,
                            "duration_seconds": duration,
                            "threshold_seconds": perf_threshold
                        }
                    )
                else:
                    func_logger.debug(
                        f"Performance: {func.__name__} took {duration:.3f}s",
                        extra={
                            "performance": True,
                            "function": func.__name__,
                            "duration_seconds": duration
                        }
                    )
        
        return wrapper
    
    # Handle case where decorator is used without arguments
    if callable(threshold):
        func = threshold
        threshold = None
        return decorator(func)
    
    return decorator


def setup_logging(config=None, log_dir=None, app_name=None):
    """
    Set up the logging system based on configuration.
    
    Args:
        config: Optional configuration object
        log_dir: Directory for log files
        app_name: Application name for logs
    """
    # Get basic logging config from config manager
    basic_config = get_logging_config()
    
    # Get extended logging config
    try:
        extended_config = LoggingContextConfig.get_config()
    except Exception:
        # If getting extended config fails, create a default one
        extended_config = object()
        for field, default_config in LoggingContextConfig.fields.items():
            setattr(extended_config, field, default_config[1])
    
    # Override with parameters if provided
    if log_dir is not None:
        extended_config.log_dir = log_dir
    
    if app_name is not None:
        extended_config.app_name = app_name
        _thread_local.app_name = app_name
    else:
        _thread_local.app_name = extended_config.app_name
    
    # Create log directory if it doesn't exist
    log_dir = Path(extended_config.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Create a metrics collector if metrics are enabled
    metrics_collector = None
    if extended_config.enable_metrics:
        metrics_collector = LogMetricsCollector(interval=extended_config.metrics_interval)
    
    # Parse component-specific log levels
    component_levels = extended_config.component_levels
    
    # Create formatters
    if extended_config.enable_json_logging or basic_config.json_format:
        formatter = JsonFormatter(include_stack_info=True)
    else:
        formatter = logging.Formatter(basic_config.format)
    
    # Configure the root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, basic_config.level))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create handlers
    handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    handlers.append(console_handler)
    
    # File handler with rotation
    if basic_config.file or extended_config.log_dir:
        log_file = basic_config.file
        if not log_file:
            # Create a log file if not specified
            timestamp = datetime.now().strftime("%Y%m%d")
            log_file = log_dir / f"{extended_config.app_name}_{timestamp}.log"
        
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=extended_config.log_file_max_size,
            backupCount=extended_config.log_file_backup_count
        )
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)
    
    # Add access log if enabled
    if extended_config.enable_access_log:
        access_log_file = log_dir / "access.log"
        access_handler = logging.handlers.RotatingFileHandler(
            access_log_file,
            maxBytes=extended_config.log_file_max_size,
            backupCount=extended_config.log_file_backup_count
        )
        access_handler.setFormatter(formatter)
        
        # Create a separate logger for access logs
        access_logger = logging.getLogger('access')
        access_logger.setLevel(logging.INFO)
        access_logger.propagate = False
        access_logger.addHandler(access_handler)
    
    # Add syslog handler if enabled
    if extended_config.enable_syslog or basic_config.syslog:
        try:
            syslog_handler = logging.handlers.SysLogHandler(
                address=extended_config.syslog_address,
                facility=extended_config.syslog_facility
            )
            syslog_handler.setFormatter(formatter)
            handlers.append(syslog_handler)
        except (ImportError, FileNotFoundError):
            print("Syslog handler requested but not available")
    
    # Add metrics handler if metrics are enabled
    if metrics_collector:
        metrics_handler = MetricsHandler(metrics_collector)
        handlers.append(metrics_handler)
    
    # Apply sampling if configured
    if extended_config.sample_rate < 1.0:
        # Wrap each handler with sampling
        for i, handler in enumerate(handlers):
            handlers[i] = SamplingHandler(handler, extended_config.sample_rate)
    
    # Create filters
    sensitive_filter = SensitiveFilter(extended_config.sensitive_fields)
    context_filter = ContextFilter()
    
    # Apply filters and handlers to root logger
    for handler in handlers:
        handler.addFilter(sensitive_filter)
        handler.addFilter(context_filter)
        root_logger.addHandler(handler)
    
    # Apply component-specific log levels
    for component, level in component_levels.items():
        component_logger = logging.getLogger(component)
        component_logger.setLevel(getattr(logging, level.upper()))
    
    logger.info(f"Logging initialized for {extended_config.app_name}")


def get_logger(name: str) -> LoggerAdapter:
    """
    Get a contextual logger for a component.
    
    Args:
        name: Logger name (usually __name__)
        
    Returns:
        Contextual logger adapter
    """
    base_logger = logging.getLogger(name)
    return ContextualLogger(base_logger, {})


# Initialize logging based on configuration when module is imported
try:
    setup_logging()
except Exception as e:
    # Basic fallback setup if configuration fails
    print(f"Failed to initialize logging from configuration: {e}")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )