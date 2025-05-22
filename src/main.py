"""
Main FastAPI application entry point
"""
import logging
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .auth.middleware import setup_middleware
from .auth.routes import router as auth_router
from .auth.database import init_db
from .environment.routes import router as environment_router
from .environment.database import init_db as init_environment_db
from .shopify.routes import router as shopify_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("Starting application...")
    # Initialize database
    init_db()
    init_environment_db()
    logger.info("Database initialized")
    
    yield
    
    logger.info("Shutting down application...")


# Create FastAPI app
app = FastAPI(
    title="Shopify MCP Server",
    description="API server for Shopify data integration",
    version="0.1.0",
    lifespan=lifespan
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup middleware
setup_middleware(app)

# Include routers
app.include_router(auth_router)
app.include_router(environment_router, prefix="/api/v1")
app.include_router(shopify_router)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)