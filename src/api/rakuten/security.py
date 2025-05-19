"""
Security utilities for Rakuten API integration
Handles sensitive information sanitization
"""

import re
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class SecureSanitizer:
    """Sanitizes sensitive information from logs and error messages"""
    
    # Patterns for detecting sensitive information
    PATTERNS = {
        'token': re.compile(r'(Bearer\s+)[\w\-\.]+', re.IGNORECASE),
        'api_key': re.compile(r'(api[_\-]?key["\s:=]+)[\w\-]+', re.IGNORECASE),
        'secret': re.compile(r'(secret["\s:=]+)[\w\-]+', re.IGNORECASE),
        'password': re.compile(r'(password["\s:=]+)[\w\-]+', re.IGNORECASE),
        'auth': re.compile(r'(Authorization["\s:=]+)[\w\s\-\.]+', re.IGNORECASE),
        'client_id': re.compile(r'(client[_\-]?id["\s:=]+)[\w\-]+', re.IGNORECASE),
        'client_secret': re.compile(r'(client[_\-]?secret["\s:=]+)[\w\-]+', re.IGNORECASE),
        'service_secret': re.compile(r'(service[_\-]?secret["\s:=]+)[\w\-]+', re.IGNORECASE),
        'license_key': re.compile(r'(license[_\-]?key["\s:=]+)[\w\-]+', re.IGNORECASE),
    }
    
    @staticmethod
    def sanitize_message(message: str, additional_secrets: Optional[List[str]] = None) -> str:
        """
        Sanitize sensitive information from message
        
        Args:
            message: Message to sanitize
            additional_secrets: Additional secrets to mask
            
        Returns:
            Sanitized message
        """
        if not message:
            return message
            
        sanitized = message
        
        # Apply pattern-based sanitization
        for pattern_name, pattern in SecureSanitizer.PATTERNS.items():
            def replacer(match):
                prefix = match.group(1) if match.groups() else ''
                return f"{prefix}****REDACTED****"
            
            sanitized = pattern.sub(replacer, sanitized)
        
        # Mask additional secrets
        if additional_secrets:
            for secret in additional_secrets:
                if secret and len(secret) > 4:
                    # Keep first 2 and last 2 characters for debugging
                    if len(secret) > 8:
                        masked = f"{secret[:2]}{'*' * (len(secret) - 4)}{secret[-2:]}"
                    else:
                        masked = f"{secret[:2]}{'*' * (len(secret) - 2)}"
                    sanitized = sanitized.replace(secret, masked)
        
        return sanitized
    
    @staticmethod
    def sanitize_dict(data: Dict[str, Any], sensitive_keys: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Sanitize sensitive information from dictionary
        
        Args:
            data: Dictionary to sanitize
            sensitive_keys: Additional keys to mask
            
        Returns:
            Sanitized dictionary
        """
        if not data:
            return data
            
        # Default sensitive keys
        default_sensitive_keys = {
            'password', 'secret', 'token', 'api_key', 'apikey',
            'client_id', 'client_secret', 'service_secret', 
            'license_key', 'access_token', 'refresh_token',
            'Authorization', 'authorization'
        }
        
        if sensitive_keys:
            default_sensitive_keys.update(sensitive_keys)
        
        sanitized_dict = {}
        
        for key, value in data.items():
            if any(sensitive_key in key.lower() for sensitive_key in default_sensitive_keys):
                if isinstance(value, str) and len(value) > 4:
                    sanitized_dict[key] = f"{value[:2]}{'*' * (len(value) - 4)}{value[-2:]}"
                else:
                    sanitized_dict[key] = "****REDACTED****"
            elif isinstance(value, dict):
                sanitized_dict[key] = SecureSanitizer.sanitize_dict(value, sensitive_keys)
            elif isinstance(value, list):
                sanitized_dict[key] = [
                    SecureSanitizer.sanitize_dict(item, sensitive_keys) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized_dict[key] = value
        
        return sanitized_dict
    
    @staticmethod
    def sanitize_url(url: str) -> str:
        """
        Sanitize sensitive information from URL
        
        Args:
            url: URL to sanitize
            
        Returns:
            Sanitized URL
        """
        if not url:
            return url
            
        # Remove query parameters that might contain sensitive data
        if '?' in url:
            base_url, query_string = url.split('?', 1)
            # Parse and sanitize query parameters
            params = []
            for param in query_string.split('&'):
                if '=' in param:
                    key, value = param.split('=', 1)
                    if any(sensitive_key in key.lower() for sensitive_key in ['key', 'token', 'secret', 'auth']):
                        params.append(f"{key}=****REDACTED****")
                    else:
                        params.append(param)
                else:
                    params.append(param)
            
            return f"{base_url}?{'&'.join(params)}"
        
        return url


def create_safe_error_message(error: Exception, context: str = "") -> str:
    """
    Create a safe error message without sensitive information
    
    Args:
        error: The exception
        context: Additional context
        
    Returns:
        Safe error message
    """
    error_message = str(error)
    
    # Sanitize the error message
    safe_message = SecureSanitizer.sanitize_message(error_message)
    
    if context:
        return f"{context}: {safe_message}"
    
    return safe_message