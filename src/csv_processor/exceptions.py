"""
CSV Processor Exceptions
Custom exception hierarchy for CSV processing operations
"""

from typing import Optional, Any, Dict


class CSVProcessorError(Exception):
    """Base exception for all CSV processor errors."""
    
    def __init__(
        self, 
        message: str, 
        error_code: str = "UNKNOWN", 
        original_exception: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.original_exception = original_exception
        self.context = context or {}
        
        # Build detailed message
        detailed_msg = f"[{error_code}] {message}"
        if context:
            context_str = ", ".join(f"{k}={v}" for k, v in context.items())
            detailed_msg += f" (Context: {context_str})"
        
        super().__init__(detailed_msg)
        
    def is_retryable(self) -> bool:
        """Check if this error is retryable"""
        return self.error_code in {
            "CONNECTION_ERROR",
            "TIMEOUT_ERROR",
            "RATE_LIMIT_ERROR",
            "TEMPORARY_ERROR"
        }


# Acquisition errors
class AcquisitionError(CSVProcessorError):
    """Base exception for acquisition related errors."""
    pass


class EmailFetchError(AcquisitionError):
    """Exception raised when fetching emails fails."""
    def __init__(self, message: str, server: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if server:
            context['server'] = server
        kwargs['context'] = context
        super().__init__(message, error_code="EMAIL_FETCH_ERROR", **kwargs)


class FTPFetchError(AcquisitionError):
    """Exception raised when FTP operations fail."""
    def __init__(self, message: str, host: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if host:
            context['host'] = host
        kwargs['context'] = context
        super().__init__(message, error_code="FTP_FETCH_ERROR", **kwargs)


class CloudFetchError(AcquisitionError):
    """Exception raised when cloud storage operations fail."""
    def __init__(self, message: str, provider: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if provider:
            context['provider'] = provider
        kwargs['context'] = context
        super().__init__(message, error_code="CLOUD_FETCH_ERROR", **kwargs)


# Schema errors
class SchemaError(CSVProcessorError):
    """Base exception for schema related errors."""
    pass


class SchemaDetectionError(SchemaError):
    """Exception raised when schema detection fails."""
    def __init__(self, message: str, file_path: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if file_path:
            context['file_path'] = file_path
        kwargs['context'] = context
        super().__init__(message, error_code="SCHEMA_DETECTION_ERROR", **kwargs)


class ValidationError(SchemaError):
    """Exception raised when data validation fails."""
    def __init__(self, message: str, errors: Optional[list] = None, **kwargs):
        context = kwargs.get('context', {})
        if errors:
            context['validation_errors'] = errors
        kwargs['context'] = context
        super().__init__(message, error_code="VALIDATION_ERROR", **kwargs)


class MappingError(SchemaError):
    """Exception raised when column mapping fails."""
    def __init__(self, message: str, column: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if column:
            context['column'] = column
        kwargs['context'] = context
        super().__init__(message, error_code="MAPPING_ERROR", **kwargs)


# Transformation errors
class TransformationError(CSVProcessorError):
    """Base exception for transformation related errors."""
    pass


class EncodingError(TransformationError):
    """Exception raised when encoding operations fail."""
    def __init__(self, message: str, source_encoding: Optional[str] = None, 
                target_encoding: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if source_encoding:
            context['source_encoding'] = source_encoding
        if target_encoding:
            context['target_encoding'] = target_encoding
        kwargs['context'] = context
        super().__init__(message, error_code="ENCODING_ERROR", **kwargs)


class FormatterError(TransformationError):
    """Exception raised when formatting operations fail."""
    def __init__(self, message: str, format_type: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if format_type:
            context['format_type'] = format_type
        kwargs['context'] = context
        super().__init__(message, error_code="FORMATTER_ERROR", **kwargs)


class CleaningError(TransformationError):
    """Exception raised when data cleaning fails."""
    def __init__(self, message: str, operation: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if operation:
            context['operation'] = operation
        kwargs['context'] = context
        super().__init__(message, error_code="CLEANING_ERROR", **kwargs)


# Ingestion errors
class IngestionError(CSVProcessorError):
    """Base exception for ingestion related errors."""
    pass


class PipelineError(IngestionError):
    """Exception raised when pipeline execution fails."""
    def __init__(self, message: str, stage: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if stage:
            context['stage'] = stage
        kwargs['context'] = context
        super().__init__(message, error_code="PIPELINE_ERROR", **kwargs)


class BatchProcessingError(IngestionError):
    """Exception raised when batch processing fails."""
    def __init__(self, message: str, batch_id: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if batch_id:
            context['batch_id'] = batch_id
        kwargs['context'] = context
        super().__init__(message, error_code="BATCH_PROCESSING_ERROR", **kwargs)


class IncrementalProcessingError(IngestionError):
    """Exception raised when incremental processing fails."""
    def __init__(self, message: str, file_hash: Optional[str] = None, **kwargs):
        context = kwargs.get('context', {})
        if file_hash:
            context['file_hash'] = file_hash
        kwargs['context'] = context
        super().__init__(message, error_code="INCREMENTAL_PROCESSING_ERROR", **kwargs)


# Specific error types for common scenarios
class ConnectionError(CSVProcessorError):
    """Exception for connection failures."""
    def __init__(self, message: str, **kwargs):
        super().__init__(message, error_code="CONNECTION_ERROR", **kwargs)


class TimeoutError(CSVProcessorError):
    """Exception for timeout errors."""
    def __init__(self, message: str, timeout: Optional[float] = None, **kwargs):
        context = kwargs.get('context', {})
        if timeout:
            context['timeout'] = timeout
        kwargs['context'] = context
        super().__init__(message, error_code="TIMEOUT_ERROR", **kwargs)


class RateLimitError(CSVProcessorError):
    """Exception for rate limit errors."""
    def __init__(self, message: str, retry_after: Optional[int] = None, **kwargs):
        context = kwargs.get('context', {})
        if retry_after:
            context['retry_after'] = retry_after
        kwargs['context'] = context
        super().__init__(message, error_code="RATE_LIMIT_ERROR", **kwargs)