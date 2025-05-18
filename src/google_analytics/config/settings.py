"""
Configuration settings for Google Analytics integration.
"""
import os
from typing import Optional, Dict, Any
from pydantic import BaseSettings, Field, validator
from pathlib import Path


class GoogleAnalyticsSettings(BaseSettings):
    """Google Analytics configuration settings."""

    # Service Account Credentials
    ga_credentials_path: Optional[str] = Field(
        default=None,
        env="GA_CREDENTIALS_PATH",
        description="Path to Google Analytics service account JSON file"
    )
    ga_credentials_json: Optional[str] = Field(
        default=None,
        env="GA_CREDENTIALS_JSON",
        description="Google Analytics service account JSON content"
    )

    # Default Property ID
    ga_property_id: Optional[str] = Field(
        default=None,
        env="GA_PROPERTY_ID",
        description="Default Google Analytics property ID"
    )

    # Cache Configuration
    cache_enabled: bool = Field(
        default=True,
        env="GA_CACHE_ENABLED",
        description="Enable caching for GA reports"
    )
    cache_ttl: int = Field(
        default=300,  # 5 minutes
        env="GA_CACHE_TTL",
        description="Cache TTL in seconds"
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        env="REDIS_URL",
        description="Redis connection URL"
    )

    # API Configuration
    api_timeout: int = Field(
        default=30,
        env="GA_API_TIMEOUT",
        description="API request timeout in seconds"
    )
    max_retries: int = Field(
        default=3,
        env="GA_MAX_RETRIES",
        description="Maximum number of API retries"
    )
    retry_delay: float = Field(
        default=1.0,
        env="GA_RETRY_DELAY",
        description="Delay between retries in seconds"
    )

    # Rate Limiting
    rate_limit_enabled: bool = Field(
        default=True,
        env="GA_RATE_LIMIT_ENABLED",
        description="Enable rate limiting"
    )
    rate_limit_requests: int = Field(
        default=50,
        env="GA_RATE_LIMIT_REQUESTS",
        description="Maximum requests per minute"
    )

    # Batch Processing
    batch_size: int = Field(
        default=5,
        env="GA_BATCH_SIZE",
        description="Maximum batch size for reports"
    )

    # Report Defaults
    default_limit: int = Field(
        default=1000,
        env="GA_DEFAULT_LIMIT",
        description="Default row limit for reports"
    )
    max_limit: int = Field(
        default=10000,
        env="GA_MAX_LIMIT",
        description="Maximum row limit for reports"
    )
    default_date_range: str = Field(
        default="30daysAgo",
        env="GA_DEFAULT_DATE_RANGE",
        description="Default date range for reports"
    )

    # Logging
    log_level: str = Field(
        default="INFO",
        env="GA_LOG_LEVEL",
        description="Logging level"
    )
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        env="GA_LOG_FORMAT",
        description="Log format string"
    )

    # Application Configuration
    app_name: str = Field(
        default="Google Analytics MCP Server",
        env="APP_NAME",
        description="Application name"
    )
    app_version: str = Field(
        default="1.0.0",
        env="APP_VERSION",
        description="Application version"
    )

    # Security
    cors_origins: list = Field(
        default=["*"],
        env="CORS_ORIGINS",
        description="Allowed CORS origins"
    )
    api_key_header: str = Field(
        default="X-API-Key",
        env="API_KEY_HEADER",
        description="API key header name"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @validator("ga_credentials_path")
    def validate_credentials_path(cls, v):
        """Validate credentials path exists."""
        if v and not Path(v).exists():
            raise ValueError(f"Credentials file not found: {v}")
        return v

    @validator("cache_ttl")
    def validate_cache_ttl(cls, v):
        """Validate cache TTL is positive."""
        if v < 0:
            raise ValueError("Cache TTL must be non-negative")
        return v

    @validator("log_level")
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()

    @validator("cors_origins", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    def get_credentials(self) -> Optional[Dict[str, Any]]:
        """Get Google Analytics credentials."""
        if self.ga_credentials_json:
            import json
            return json.loads(self.ga_credentials_json)
        elif self.ga_credentials_path:
            import json
            with open(self.ga_credentials_path, 'r') as f:
                return json.load(f)
        return None

    def get_redis_config(self) -> Dict[str, Any]:
        """Get Redis configuration."""
        from urllib.parse import urlparse
        
        parsed = urlparse(self.redis_url)
        return {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 6379,
            "db": int(parsed.path.lstrip("/")) if parsed.path else 0,
            "password": parsed.password,
            "decode_responses": True
        }

    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging configuration."""
        return {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": self.log_format
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "level": self.log_level
                }
            },
            "root": {
                "level": self.log_level,
                "handlers": ["console"]
            }
        }


# Global settings instance
settings = GoogleAnalyticsSettings()