"""
Main application for Google Analytics MCP Server.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from src.google_analytics.config.settings import settings
from src.google_analytics.api import router as analytics_router
from src.google_analytics.dependencies import cleanup_dependencies
from src.google_analytics.middleware import (
    LoggingMiddleware,
    ErrorHandlerMiddleware,
    PerformanceMiddleware
)

# Configure logging
logging.config.dictConfig(settings.get_logging_config())
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down application")
    await cleanup_dependencies()


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Google Analytics integration for MCP Server",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(PerformanceMiddleware)
app.add_middleware(LoggingMiddleware)

# Include routers
app.include_router(
    analytics_router,
    prefix="/api/v1/google-analytics",
    tags=["google-analytics"]
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version
    }


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors."""
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not found",
            "path": request.url.path
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "src.google_analytics.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=settings.get_logging_config()
    )