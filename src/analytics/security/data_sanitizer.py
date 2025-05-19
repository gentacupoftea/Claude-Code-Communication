"""Data sanitizer for analytics module to ensure security."""

import re
import logging
from typing import Any, Dict, List, Union
from datetime import datetime

logger = logging.getLogger(__name__)


class DataSanitizer:
    """Sanitize data for analytics to prevent security issues."""
    
    # Patterns for sensitive data
    SENSITIVE_PATTERNS = {
        'email': re.compile(r'[\w\.-]+@[\w\.-]+\.\w+'),
        'credit_card': re.compile(r'\b(?:\d[ -]*?){13,16}\b'),
        'phone': re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'),
        'ssn': re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
        'api_key': re.compile(r'(?i)(api[_-]?key|apikey)[\s:=]+[\w\-]+'),
        'password': re.compile(r'(?i)(password|passwd|pwd)[\s:=]+[\S]+'),
    }
    
    # Fields that should be redacted
    REDACT_FIELDS = {
        'password', 'passwd', 'pwd', 'secret', 'token', 'api_key',
        'credit_card', 'cc_number', 'cvv', 'ssn', 'social_security'
    }
    
    @classmethod
    def sanitize_value(cls, value: Any, field_name: str = None) -> Any:
        """Sanitize a single value."""
        if value is None:
            return value
        
        # Check if field should be redacted
        if field_name and field_name.lower() in cls.REDACT_FIELDS:
            return "[REDACTED]"
        
        # Sanitize string values
        if isinstance(value, str):
            # Check for sensitive patterns
            for pattern_name, pattern in cls.SENSITIVE_PATTERNS.items():
                if pattern.search(value):
                    logger.warning(f"Sensitive {pattern_name} detected in field {field_name}")
                    return cls._mask_sensitive_data(value, pattern)
            
            # Escape HTML/JS to prevent XSS
            value = cls._escape_html(value)
        
        return value
    
    @classmethod
    def sanitize_dict(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize a dictionary recursively."""
        sanitized = {}
        
        for key, value in data.items():
            if isinstance(value, dict):
                sanitized[key] = cls.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = cls.sanitize_list(value)
            else:
                sanitized[key] = cls.sanitize_value(value, key)
        
        return sanitized
    
    @classmethod
    def sanitize_list(cls, data: List[Any]) -> List[Any]:
        """Sanitize a list recursively."""
        sanitized = []
        
        for item in data:
            if isinstance(item, dict):
                sanitized.append(cls.sanitize_dict(item))
            elif isinstance(item, list):
                sanitized.append(cls.sanitize_list(item))
            else:
                sanitized.append(cls.sanitize_value(item))
        
        return sanitized
    
    @classmethod
    def sanitize_data(cls, data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
        """Main entry point for data sanitization."""
        if isinstance(data, dict):
            return cls.sanitize_dict(data)
        elif isinstance(data, list):
            return cls.sanitize_list(data)
        else:
            return cls.sanitize_value(data)
    
    @staticmethod
    def _mask_sensitive_data(value: str, pattern: re.Pattern) -> str:
        """Mask sensitive data while preserving some structure."""
        def mask_match(match):
            matched = match.group()
            if len(matched) <= 4:
                return "*" * len(matched)
            else:
                # Show first and last 2 characters
                return matched[:2] + "*" * (len(matched) - 4) + matched[-2:]
        
        return pattern.sub(mask_match, value)
    
    @staticmethod
    def _escape_html(value: str) -> str:
        """Escape HTML special characters."""
        html_escape_table = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#x27;",
            "/": "&#x2F;",
        }
        
        return "".join(html_escape_table.get(c, c) for c in value)
    
    @classmethod
    def validate_date_input(cls, date_str: str) -> str:
        """Validate and sanitize date input."""
        try:
            # Parse and validate date
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            
            # Check for reasonable date range (not too far in past or future)
            now = datetime.utcnow()
            if dt < now - timedelta(days=365 * 5):  # 5 years ago
                raise ValueError("Date too far in the past")
            if dt > now + timedelta(days=365):  # 1 year in future
                raise ValueError("Date too far in the future")
            
            return dt.isoformat() + 'Z'
        
        except Exception as e:
            logger.error(f"Invalid date input: {date_str} - {e}")
            raise ValueError(f"Invalid date format: {date_str}")
    
    @classmethod
    def sanitize_export_data(cls, data: Any) -> Any:
        """Special sanitization for data being exported."""
        sanitized = cls.sanitize_data(data)
        
        # Additional checks for export
        if isinstance(sanitized, dict):
            # Remove any internal fields
            internal_fields = ['_id', '_rev', 'internal_id']
            for field in internal_fields:
                sanitized.pop(field, None)
        
        return sanitized


class SQLInjectionProtector:
    """Protect against SQL injection in analytics queries."""
    
    # Patterns that might indicate SQL injection
    SQL_PATTERNS = [
        re.compile(r'(?i)\b(union|select|insert|update|delete|drop|create)\b'),
        re.compile(r'(?i)\b(or|and)\s+["\']?\d+["\']?\s*=\s*["\']?\d+'),
        re.compile(r'["\'];'),
        re.compile(r'--'),
        re.compile(r'/\*.*\*/'),
    ]
    
    @classmethod
    def is_safe(cls, value: str) -> bool:
        """Check if a value is safe from SQL injection."""
        if not isinstance(value, str):
            return True
        
        for pattern in cls.SQL_PATTERNS:
            if pattern.search(value):
                logger.warning(f"Potential SQL injection detected: {value}")
                return False
        
        return True
    
    @classmethod
    def sanitize_parameter(cls, param: Any) -> Any:
        """Sanitize a parameter for SQL queries."""
        if isinstance(param, str):
            if not cls.is_safe(param):
                raise ValueError("Unsafe parameter detected")
            
            # Additional escaping
            param = param.replace("'", "''")
            param = param.replace("\\", "\\\\")
        
        return param