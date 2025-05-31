"""Dependency injection for the data integration module."""

from typing import Generator, Optional
import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from src.data_integration.config.settings import get_settings
from src.data_integration.services.shopify_service import ShopifyService
from src.data_integration.services.analytics_service import AnalyticsService
from src.data_integration.services.email_service import EmailService
from src.data_integration.analytics.unified_analytics import UnifiedAnalyticsEngine
from src.data_integration.utils.cache_manager import CacheManager, LocalCacheManager
from src.data_integration.utils.metrics_collector import MetricsCollector
from src.data_integration.utils.error_handler import ErrorHandler
from src.data_integration.utils.logger import setup_logger

# Get settings
settings = get_settings()

# Setup logger
logger = setup_logger(
    "data_integration",
    level=settings.log_level,
    enable_json=settings.log_format == "json",
    log_file=settings.log_file
)

# Database
if settings.database_url:
    engine = create_engine(
        settings.database_url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        echo=settings.debug
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    SessionLocal = None

# Cache
if settings.environment == "test":
    cache_manager = LocalCacheManager()
else:
    try:
        cache_manager = CacheManager(
            redis_host=settings.redis_host,
            redis_port=settings.redis_port
        )
    except Exception as e:
        logger.warning(f"Failed to connect to Redis, using local cache: {e}")
        cache_manager = LocalCacheManager()

# Metrics
metrics_collector = MetricsCollector()

# Error handler
error_handler = ErrorHandler(logger=logger)

# Services
def get_shopify_service(
    api_key: Optional[str] = None,
    secret: Optional[str] = None,
    store_domain: Optional[str] = None
) -> ShopifyService:
    """Get Shopify service instance."""
    return ShopifyService(
        api_key=api_key or "dummy_key",
        secret=secret or "dummy_secret",
        store_domain=store_domain or "example.myshopify.com",
        cache_manager=cache_manager,
        metrics_collector=metrics_collector
    )

def get_analytics_service(
    api_key: Optional[str] = None
) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(
        api_key=api_key or "dummy_key",
        cache_manager=cache_manager,
        metrics_collector=metrics_collector
    )

def get_email_service(
    api_key: Optional[str] = None
) -> EmailService:
    """Get email service instance."""
    return EmailService(
        api_key=api_key or "dummy_key",
        cache_manager=cache_manager,
        metrics_collector=metrics_collector
    )

def get_analytics_engine() -> UnifiedAnalyticsEngine:
    """Get unified analytics engine instance."""
    return UnifiedAnalyticsEngine(
        cache_manager=cache_manager,
        metrics_collector=metrics_collector,
        error_handler=error_handler
    )

def get_db() -> Generator[Session, None, None]:
    """Get database session."""
    if SessionLocal is None:
        raise RuntimeError("Database not configured")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_cache() -> CacheManager:
    """Get cache manager instance."""
    return cache_manager

def get_metrics() -> MetricsCollector:
    """Get metrics collector instance."""
    return metrics_collector

def get_error_handler() -> ErrorHandler:
    """Get error handler instance."""
    return error_handler

def get_logger():
    """Get logger instance."""
    return logger

# Dependency injection for FastAPI
from fastapi import Depends

def get_shopify_service_dep(
    api_key: Optional[str] = None,
    secret: Optional[str] = None,
    store_domain: Optional[str] = None
) -> ShopifyService:
    """FastAPI dependency for Shopify service."""
    return get_shopify_service(api_key, secret, store_domain)

def get_analytics_service_dep(
    api_key: Optional[str] = None
) -> AnalyticsService:
    """FastAPI dependency for analytics service."""
    return get_analytics_service(api_key)

def get_email_service_dep(
    api_key: Optional[str] = None
) -> EmailService:
    """FastAPI dependency for email service."""
    return get_email_service(api_key)

def get_analytics_engine_dep() -> UnifiedAnalyticsEngine:
    """FastAPI dependency for analytics engine."""
    return get_analytics_engine()
