"""Configuration settings for data integration module."""

import os
from typing import Optional, Dict, Any
from pydantic import BaseSettings, Field, validator

class Settings(BaseSettings):
    """Application settings."""
    
    # App settings
    app_name: str = "Data Integration Service"
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="production", env="ENVIRONMENT")
    
    # API settings
    api_version: str = "v1"
    api_prefix: str = "/api"
    
    # Shopify settings
    shopify_api_version: str = Field(default="2023-10", env="SHOPIFY_API_VERSION")
    shopify_webhook_secret: Optional[str] = Field(default=None, env="SHOPIFY_WEBHOOK_SECRET")
    
    # Cache settings
    redis_host: str = Field(default="localhost", env="REDIS_HOST")
    redis_port: int = Field(default=6379, env="REDIS_PORT")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    redis_db: int = Field(default=0, env="REDIS_DB")
    cache_ttl: int = Field(default=3600, env="CACHE_TTL")  # 1 hour default
    
    # Database settings
    database_url: Optional[str] = Field(default=None, env="DATABASE_URL")
    database_pool_size: int = Field(default=10, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=20, env="DATABASE_MAX_OVERFLOW")
    
    # Task settings
    celery_broker_url: Optional[str] = Field(default=None, env="CELERY_BROKER_URL")
    celery_result_backend: Optional[str] = Field(default=None, env="CELERY_RESULT_BACKEND")
    task_default_retry_delay: int = Field(default=60, env="TASK_DEFAULT_RETRY_DELAY")
    task_max_retries: int = Field(default=3, env="TASK_MAX_RETRIES")
    
    # Analytics settings
    analytics_batch_size: int = Field(default=1000, env="ANALYTICS_BATCH_SIZE")
    analytics_time_window: int = Field(default=86400, env="ANALYTICS_TIME_WINDOW")  # 24 hours
    prediction_confidence_threshold: float = Field(default=0.7, env="PREDICTION_CONFIDENCE_THRESHOLD")
    
    # Performance settings
    max_concurrent_requests: int = Field(default=100, env="MAX_CONCURRENT_REQUESTS")
    request_timeout: int = Field(default=30, env="REQUEST_TIMEOUT")
    batch_processing_size: int = Field(default=100, env="BATCH_PROCESSING_SIZE")
    
    # Security settings
    secret_key: str = Field(..., env="SECRET_KEY")
    allowed_origins: str = Field(default="*", env="ALLOWED_ORIGINS")
    enable_cors: bool = Field(default=True, env="ENABLE_CORS")
    
    # Logging settings
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")
    log_file: Optional[str] = Field(default=None, env="LOG_FILE")
    
    # Monitoring settings
    enable_metrics: bool = Field(default=True, env="ENABLE_METRICS")
    metrics_port: int = Field(default=9090, env="METRICS_PORT")
    tracing_enabled: bool = Field(default=False, env="TRACING_ENABLED")
    tracing_endpoint: Optional[str] = Field(default=None, env="TRACING_ENDPOINT")
    
    @validator("allowed_origins")
    def parse_allowed_origins(cls, v):
        """Parse allowed origins from comma-separated string."""
        if v == "*":
            return ["*"]
        return [origin.strip() for origin in v.split(",")]
    
    @validator("redis_host")
    def validate_redis_host(cls, v):
        """Validate Redis host."""
        if not v:
            raise ValueError("Redis host is required")
        return v
    
    @validator("secret_key")
    def validate_secret_key(cls, v):
        """Validate secret key."""
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters")
        return v
    
    def get_redis_url(self) -> str:
        """Get Redis connection URL."""
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    def get_database_config(self) -> Dict[str, Any]:
        """Get database configuration."""
        return {
            "url": self.database_url,
            "pool_size": self.database_pool_size,
            "max_overflow": self.database_max_overflow,
            "echo": self.debug
        }
    
    def get_celery_config(self) -> Dict[str, Any]:
        """Get Celery configuration."""
        return {
            "broker_url": self.celery_broker_url or self.get_redis_url(),
            "result_backend": self.celery_result_backend or self.get_redis_url(),
            "task_default_retry_delay": self.task_default_retry_delay,
            "task_max_retries": self.task_max_retries
        }
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()

# Environment-specific settings
class DevelopmentSettings(Settings):
    """Development environment settings."""
    debug: bool = True
    environment: str = "development"
    log_level: str = "DEBUG"

class TestSettings(Settings):
    """Test environment settings."""
    environment: str = "test"
    redis_db: int = 1
    database_url: str = "sqlite:///:memory:"

class ProductionSettings(Settings):
    """Production environment settings."""
    debug: bool = False
    environment: str = "production"
    log_level: str = "WARNING"
    
    @validator("database_url")
    def validate_database_url(cls, v):
        """Ensure database URL is set in production."""
        if not v:
            raise ValueError("Database URL must be set in production")
        return v

# Factory function to get appropriate settings
def get_settings() -> Settings:
    """Get settings based on environment."""
    env = os.getenv("ENVIRONMENT", "production").lower()
    
    if env == "development":
        return DevelopmentSettings()
    elif env == "test":
        return TestSettings()
    else:
        return ProductionSettings()
