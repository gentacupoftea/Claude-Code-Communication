"""
Test cases for CSV processor exceptions
"""

import pytest
from csv_processor.exceptions import (
    CSVProcessorError,
    EmailFetchError,
    FTPFetchError,
    CloudFetchError,
    SchemaDetectionError,
    ValidationError,
    EncodingError,
    ConnectionError,
    TimeoutError,
    RateLimitError
)


class TestExceptions:
    
    def test_csv_processor_error_basic(self):
        """Test basic CSVProcessorError creation"""
        error = CSVProcessorError("Test error")
        assert str(error) == "[UNKNOWN] Test error"
        assert error.message == "Test error"
        assert error.error_code == "UNKNOWN"
        assert error.original_exception is None
        assert error.context == {}
    
    def test_csv_processor_error_with_context(self):
        """Test CSVProcessorError with context"""
        error = CSVProcessorError(
            "Test error",
            error_code="TEST_CODE",
            context={"file": "test.csv", "row": 10}
        )
        assert str(error) == "[TEST_CODE] Test error (Context: file=test.csv, row=10)"
        assert error.context["file"] == "test.csv"
        assert error.context["row"] == 10
    
    def test_csv_processor_error_with_original_exception(self):
        """Test CSVProcessorError with original exception"""
        original = ValueError("Original error")
        error = CSVProcessorError(
            "Wrapped error",
            original_exception=original
        )
        assert error.original_exception == original
    
    def test_retryable_error_detection(self):
        """Test retryable error detection"""
        retryable_codes = ["CONNECTION_ERROR", "TIMEOUT_ERROR", "RATE_LIMIT_ERROR", "TEMPORARY_ERROR"]
        
        for code in retryable_codes:
            error = CSVProcessorError("Test", error_code=code)
            assert error.is_retryable()
        
        non_retryable = CSVProcessorError("Test", error_code="PERMANENT_ERROR")
        assert not non_retryable.is_retryable()
    
    def test_email_fetch_error(self):
        """Test EmailFetchError creation"""
        error = EmailFetchError("Email error", server="mail.example.com")
        assert error.error_code == "EMAIL_FETCH_ERROR"
        assert error.context["server"] == "mail.example.com"
        assert "email_fetch_error" in str(error).lower()
    
    def test_ftp_fetch_error(self):
        """Test FTPFetchError creation"""
        error = FTPFetchError("FTP error", host="ftp.example.com")
        assert error.error_code == "FTP_FETCH_ERROR"
        assert error.context["host"] == "ftp.example.com"
    
    def test_cloud_fetch_error(self):
        """Test CloudFetchError creation"""
        error = CloudFetchError("Cloud error", provider="s3")
        assert error.error_code == "CLOUD_FETCH_ERROR"
        assert error.context["provider"] == "s3"
    
    def test_schema_detection_error(self):
        """Test SchemaDetectionError creation"""
        error = SchemaDetectionError("Schema error", file_path="/path/to/file.csv")
        assert error.error_code == "SCHEMA_DETECTION_ERROR"
        assert error.context["file_path"] == "/path/to/file.csv"
    
    def test_validation_error(self):
        """Test ValidationError creation"""
        errors = ["Missing column", "Invalid data type"]
        error = ValidationError("Validation failed", errors=errors)
        assert error.error_code == "VALIDATION_ERROR"
        assert error.context["validation_errors"] == errors
    
    def test_encoding_error(self):
        """Test EncodingError creation"""
        error = EncodingError(
            "Encoding failed",
            source_encoding="shift-jis",
            target_encoding="utf-8"
        )
        assert error.error_code == "ENCODING_ERROR"
        assert error.context["source_encoding"] == "shift-jis"
        assert error.context["target_encoding"] == "utf-8"
    
    def test_connection_error(self):
        """Test ConnectionError creation"""
        error = ConnectionError("Connection failed")
        assert error.error_code == "CONNECTION_ERROR"
        assert error.is_retryable()
    
    def test_timeout_error(self):
        """Test TimeoutError creation"""
        error = TimeoutError("Operation timed out", timeout=30)
        assert error.error_code == "TIMEOUT_ERROR"
        assert error.context["timeout"] == 30
        assert error.is_retryable()
    
    def test_rate_limit_error(self):
        """Test RateLimitError creation"""
        error = RateLimitError("Rate limit exceeded", retry_after=60)
        assert error.error_code == "RATE_LIMIT_ERROR"
        assert error.context["retry_after"] == 60
        assert error.is_retryable()
    
    def test_exception_inheritance(self):
        """Test exception inheritance chain"""
        # All errors should inherit from CSVProcessorError
        errors = [
            EmailFetchError("test"),
            FTPFetchError("test"),
            SchemaDetectionError("test"),
            ValidationError("test"),
            EncodingError("test")
        ]
        
        for error in errors:
            assert isinstance(error, CSVProcessorError)
            assert isinstance(error, Exception)