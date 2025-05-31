"""Error handling utilities for the data integration module."""

import traceback
import logging
from typing import Dict, Any, List, Optional, Callable, Type
from enum import Enum
import time
from dataclasses import dataclass
import json

class ErrorSeverity(Enum):
    """Error severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(Enum):
    """Error categories."""
    VALIDATION = "validation"
    NETWORK = "network"
    DATABASE = "database"
    API = "api"
    AUTHENTICATION = "authentication"
    RATE_LIMIT = "rate_limit"
    DATA_PROCESSING = "data_processing"
    UNKNOWN = "unknown"

@dataclass
class ErrorContext:
    """Context information for an error."""
    error_id: str
    timestamp: float
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    details: Dict[str, Any]
    stack_trace: Optional[str] = None
    retry_count: int = 0
    user_id: Optional[str] = None
    store_domain: Optional[str] = None

class ErrorHandler:
    """Comprehensive error handling and recovery."""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)
        self.error_registry: List[ErrorContext] = []
        self.handlers: Dict[ErrorCategory, List[Callable]] = {
            category: [] for category in ErrorCategory
        }
        self.error_count = 0
        self._setup_default_handlers()
    
    def _setup_default_handlers(self):
        """Setup default error handlers."""
        self.register_handler(ErrorCategory.RATE_LIMIT, self._handle_rate_limit)
        self.register_handler(ErrorCategory.NETWORK, self._handle_network_error)
        self.register_handler(ErrorCategory.AUTHENTICATION, self._handle_auth_error)
    
    def register_handler(self, category: ErrorCategory, handler: Callable):
        """Register a handler for a specific error category."""
        self.handlers[category].append(handler)
    
    def handle_error(
        self,
        exception: Exception,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        store_domain: Optional[str] = None
    ) -> ErrorContext:
        """Handle an error and return error context."""
        self.error_count += 1
        
        error_context = ErrorContext(
            error_id=f"err_{int(time.time())}_{self.error_count}",
            timestamp=time.time(),
            category=category,
            severity=severity,
            message=str(exception),
            details=context or {},
            stack_trace=traceback.format_exc(),
            user_id=user_id,
            store_domain=store_domain
        )
        
        self.error_registry.append(error_context)
        
        # Log the error
        self._log_error(error_context)
        
        # Execute handlers for this category
        for handler in self.handlers[category]:
            try:
                handler(error_context, exception)
            except Exception as handler_error:
                self.logger.error(f"Error in handler: {handler_error}")
        
        return error_context
    
    def _log_error(self, context: ErrorContext):
        """Log error based on severity."""
        log_data = {
            "error_id": context.error_id,
            "category": context.category.value,
            "severity": context.severity.value,
            "message": context.message,
            "details": context.details,
            "user_id": context.user_id,
            "store_domain": context.store_domain
        }
        
        if context.severity == ErrorSeverity.CRITICAL:
            self.logger.critical(json.dumps(log_data))
        elif context.severity == ErrorSeverity.HIGH:
            self.logger.error(json.dumps(log_data))
        elif context.severity == ErrorSeverity.MEDIUM:
            self.logger.warning(json.dumps(log_data))
        else:
            self.logger.info(json.dumps(log_data))
    
    def _handle_rate_limit(self, context: ErrorContext, exception: Exception):
        """Handle rate limit errors."""
        retry_after = context.details.get('retry_after', 60)
        self.logger.info(f"Rate limit hit. Retrying after {retry_after} seconds")
        context.details['retry_strategy'] = 'exponential_backoff'
        context.details['retry_after'] = retry_after
    
    def _handle_network_error(self, context: ErrorContext, exception: Exception):
        """Handle network errors."""
        self.logger.warning("Network error occurred. Check connectivity")
        context.details['retry_strategy'] = 'linear_backoff'
        context.details['max_retries'] = 3
    
    def _handle_auth_error(self, context: ErrorContext, exception: Exception):
        """Handle authentication errors."""
        self.logger.error("Authentication failed. Token may need refresh")
        context.details['action_required'] = 'refresh_token'
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of errors."""
        summary = {
            "total_errors": len(self.error_registry),
            "by_category": {},
            "by_severity": {},
            "recent_errors": []
        }
        
        for error in self.error_registry:
            category = error.category.value
            severity = error.severity.value
            
            summary["by_category"][category] = summary["by_category"].get(category, 0) + 1
            summary["by_severity"][severity] = summary["by_severity"].get(severity, 0) + 1
        
        # Get 10 most recent errors
        summary["recent_errors"] = [
            {
                "error_id": e.error_id,
                "timestamp": e.timestamp,
                "category": e.category.value,
                "severity": e.severity.value,
                "message": e.message
            }
            for e in sorted(self.error_registry, key=lambda x: x.timestamp, reverse=True)[:10]
        ]
        
        return summary
    
    def clear_old_errors(self, older_than_hours: int = 24):
        """Clear errors older than specified hours."""
        cutoff_time = time.time() - (older_than_hours * 3600)
        self.error_registry = [
            error for error in self.error_registry
            if error.timestamp > cutoff_time
        ]

class RetryHandler:
    """Handle retry logic for failed operations."""
    
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
    
    def exponential_backoff(self, attempt: int) -> float:
        """Calculate exponential backoff delay."""
        return self.base_delay * (2 ** attempt)
    
    def linear_backoff(self, attempt: int) -> float:
        """Calculate linear backoff delay."""
        return self.base_delay * (attempt + 1)
    
    def retry_with_backoff(
        self,
        func: Callable,
        backoff_strategy: str = "exponential",
        error_categories: List[Type[Exception]] = None
    ) -> Any:
        """Retry a function with backoff strategy."""
        error_categories = error_categories or [Exception]
        
        for attempt in range(self.max_retries):
            try:
                return func()
            except tuple(error_categories) as e:
                if attempt == self.max_retries - 1:
                    raise e
                
                if backoff_strategy == "exponential":
                    delay = self.exponential_backoff(attempt)
                else:
                    delay = self.linear_backoff(attempt)
                
                time.sleep(delay)
        
        raise Exception("Max retries exceeded")
