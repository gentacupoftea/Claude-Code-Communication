"""Main application entry point for data integration service."""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from src.data_integration.config.settings import get_settings
from src.data_integration.api.endpoints import router as api_router
from src.data_integration.tasks.scheduler import TaskScheduler
from src.data_integration.tasks.sync_tasks import SyncTasks
from src.data_integration.tasks.analytics_tasks import AnalyticsTasks
from src.data_integration.dependencies import (
    get_shopify_service,
    get_analytics_service,
    get_email_service,
    get_analytics_engine,
    get_cache,
    get_metrics,
    get_error_handler,
    get_logger
)

# Get settings and logger
settings = get_settings()
logger = get_logger()

# Initialize task scheduler
task_scheduler = TaskScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    logger.info(f"Starting {settings.app_name} in {settings.environment} mode")
    
    # Initialize services
    shopify_service = get_shopify_service()
    analytics_service = get_analytics_service()
    email_service = get_email_service()
    analytics_engine = get_analytics_engine()
    cache_manager = get_cache()
    metrics_collector = get_metrics()
    
    # Initialize tasks
    sync_tasks = SyncTasks(
        shopify_service=shopify_service,
        analytics_service=analytics_service,
        email_service=email_service,
        cache_manager=cache_manager,
        metrics_collector=metrics_collector
    )
    
    analytics_tasks = AnalyticsTasks(
        analytics_engine=analytics_engine,
        cache_manager=cache_manager,
        metrics_collector=metrics_collector
    )
    
    # Schedule recurring tasks
    task_scheduler.schedule_task(
        task_name="sync_shopify_data",
        task_function=sync_tasks.sync_shopify_data,
        schedule_type="interval",
        interval_minutes=30
    )
    
    task_scheduler.schedule_task(
        task_name="calculate_daily_metrics",
        task_function=analytics_tasks.calculate_daily_metrics,
        schedule_type="cron",
        cron_expression="0 2 * * *"  # Daily at 2 AM
    )
    
    task_scheduler.schedule_task(
        task_name="update_predictions",
        task_function=analytics_tasks.update_predictions,
        schedule_type="interval",
        interval_minutes=60
    )
    
    task_scheduler.schedule_task(
        task_name="cleanup_old_data",
        task_function=analytics_tasks.cleanup_old_data,
        schedule_type="cron",
        cron_expression="0 4 * * 0"  # Weekly on Sunday at 4 AM
    )
    
    # Start scheduler
    await task_scheduler.start()
    
    yield
    
    # Shutdown
    logger.info("Shutting down application")
    await task_scheduler.stop()

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    debug=settings.debug,
    lifespan=lifespan
)

# Add CORS middleware
if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API routes
app.include_router(
    api_router,
    prefix=f"{settings.api_prefix}/{settings.api_version}"
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    metrics = get_metrics()
    return {
        "status": "healthy",
        "environment": settings.environment,
        "version": settings.api_version,
        "metrics": metrics.get_summary()
    }

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    metrics_collector = get_metrics()
    return metrics_collector.export_metrics(format="prometheus")

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Handle 404 errors."""
    return {"detail": "Resource not found"}, 404

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Handle 500 errors."""
    error_handler = get_error_handler()
    error_context = error_handler.handle_error(
        exception=exc,
        category="api",
        severity="high",
        context={"request_path": request.url.path}
    )
    return {
        "detail": "Internal server error",
        "error_id": error_context.error_id
    }, 500

if __name__ == "__main__":
    """Run the application."""
    uvicorn.run(
        "src.data_integration.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
