"""
Logging utilities for CSV processor
Provides structured logging with context and error tracking
"""

import logging
import json
import sys
import traceback
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import inspect


class StructuredLogger:
    """
    Structured logger with context tracking and error handling
    """
    
    def __init__(self, name: str, log_file: Optional[str] = None):
        self.logger = logging.getLogger(name)
        self.context = {}
        
        # Configure formatter
        formatter = StructuredFormatter()
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # File handler if specified
        if log_file:
            file_handler = logging.FileHandler(log_file)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
        
        self.logger.setLevel(logging.DEBUG)
    
    def set_context(self, **kwargs):
        """Set persistent context for all log messages"""
        self.context.update(kwargs)
    
    def clear_context(self):
        """Clear the persistent context"""
        self.context = {}
    
    def _log(self, level: int, message: str, extra: Optional[Dict] = None, 
             exc_info: Optional[bool] = None, **kwargs):
        """Internal logging method with context merging"""
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'context': {**self.context, **kwargs}
        }
        
        if extra:
            log_data.update(extra)
        
        # Add caller information
        frame = inspect.currentframe().f_back.f_back
        log_data['caller'] = {
            'filename': frame.f_code.co_filename,
            'function': frame.f_code.co_name,
            'line': frame.f_lineno
        }
        
        self.logger.log(level, message, extra=log_data, exc_info=exc_info)
    
    def debug(self, message: str, **kwargs):
        """Log debug message"""
        self._log(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message"""
        self._log(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message"""
        self._log(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log error message with optional exception"""
        extra = {}
        if error:
            extra['error'] = {
                'type': type(error).__name__,
                'message': str(error),
                'traceback': traceback.format_exception(
                    type(error), error, error.__traceback__
                )
            }
            
            # Extract error context if available
            if hasattr(error, 'context'):
                extra['error_context'] = error.context
            if hasattr(error, 'error_code'):
                extra['error_code'] = error.error_code
                
        self._log(logging.ERROR, message, extra=extra, exc_info=bool(error), **kwargs)
    
    def critical(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log critical message"""
        extra = {}
        if error:
            extra['error'] = {
                'type': type(error).__name__,
                'message': str(error),
                'traceback': traceback.format_exception(
                    type(error), error, error.__traceback__
                )
            }
        
        self._log(logging.CRITICAL, message, extra=extra, exc_info=bool(error), **kwargs)
    
    def log_operation(self, operation: str, status: str, duration: float, **kwargs):
        """Log an operation with timing information"""
        self.info(
            f"Operation {operation} completed",
            operation=operation,
            status=status,
            duration_ms=duration * 1000,
            **kwargs
        )
    
    def log_metric(self, metric_name: str, value: float, unit: str = "count", **kwargs):
        """Log a metric value"""
        self.info(
            f"Metric: {metric_name}",
            metric_name=metric_name,
            metric_value=value,
            metric_unit=unit,
            **kwargs
        )


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs
    """
    
    def format(self, record: logging.LogRecord) -> str:
        # Create base log entry
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        # Add extra fields
        if hasattr(record, 'context'):
            log_entry['context'] = record.context
        
        if hasattr(record, 'caller'):
            log_entry['caller'] = record.caller
        
        if hasattr(record, 'error'):
            log_entry['error'] = record.error
        
        # Add any other extra fields
        for key, value in record.__dict__.items():
            if key not in {'name', 'msg', 'args', 'created', 'filename', 'funcName', 
                          'levelname', 'levelno', 'lineno', 'module', 'msecs', 
                          'pathname', 'process', 'processName', 'relativeCreated', 
                          'thread', 'threadName', 'exc_info', 'exc_text', 'stack_info',
                          'context', 'caller', 'error'}:
                log_entry[key] = value
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': self.formatException(record.exc_info)
            }
        
        return json.dumps(log_entry, ensure_ascii=False)


class LogContext:
    """
    Context manager for temporary logging context
    """
    
    def __init__(self, logger: StructuredLogger, **context):
        self.logger = logger
        self.context = context
        self.original_context = None
    
    def __enter__(self):
        self.original_context = self.logger.context.copy()
        self.logger.set_context(**self.context)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.logger.context = self.original_context
        
        if exc_type is not None:
            self.logger.error(
                f"Error in context {self.context}",
                error=exc_val,
                context_type='exit',
                **self.context
            )


class PerformanceLogger:
    """
    Logger for tracking performance metrics
    """
    
    def __init__(self, logger: StructuredLogger):
        self.logger = logger
        self.timings = {}
    
    def start_operation(self, operation: str, **context):
        """Start timing an operation"""
        self.timings[operation] = {
            'start_time': datetime.utcnow(),
            'context': context
        }
        
        self.logger.debug(
            f"Starting operation: {operation}",
            operation=operation,
            timing_phase='start',
            **context
        )
    
    def end_operation(self, operation: str, status: str = "success", **context):
        """End timing an operation and log the duration"""
        if operation not in self.timings:
            self.logger.warning(f"No start time found for operation: {operation}")
            return
        
        start_info = self.timings.pop(operation)
        duration = (datetime.utcnow() - start_info['start_time']).total_seconds()
        
        merged_context = {**start_info['context'], **context}
        
        self.logger.log_operation(
            operation=operation,
            status=status,
            duration=duration,
            **merged_context
        )
    
    def log_checkpoint(self, checkpoint: str, **context):
        """Log a checkpoint with timing since start"""
        self.logger.info(
            f"Checkpoint: {checkpoint}",
            checkpoint=checkpoint,
            **context
        )


def get_logger(name: str, log_file: Optional[str] = None) -> StructuredLogger:
    """
    Get a structured logger instance
    
    Args:
        name: Logger name
        log_file: Optional log file path
        
    Returns:
        StructuredLogger instance
    """
    return StructuredLogger(name, log_file)


def configure_logging(log_level: str = "INFO",
                     log_file: Optional[str] = None,
                     log_format: Optional[str] = None):
    """
    Configure default logging for the CSV processor
    
    Args:
        log_level: Logging level
        log_file: Optional log file path
        log_format: Optional log format string
    """
    # Set up root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Add structured formatter
    formatter = StructuredFormatter()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # File handler if specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)