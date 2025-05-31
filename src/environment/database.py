"""
Database initialization for environment variables
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database configuration with security enhancements
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shopify_mcp.db")

# Add SSL configuration for production PostgreSQL
if "postgresql" in DATABASE_URL and "sslmode" not in DATABASE_URL:
    ssl_mode = os.getenv("DB_SSL_MODE", "prefer")
    if os.getenv("NODE_ENV") == "production":
        ssl_mode = "require"
    DATABASE_URL += f"?sslmode={ssl_mode}"

# Create engine with connection pooling and security settings
engine_config = {
    "echo": os.getenv("DEBUG", "false").lower() == "true",
    "pool_pre_ping": True,
}

# Add connection pooling for production
if "postgresql" in DATABASE_URL:
    engine_config.update({
        "pool_size": int(os.getenv("DB_POOL_SIZE", "20")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "30")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "3600")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
    })

engine = create_engine(DATABASE_URL, **engine_config)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables"""
    # Import models to register them with Base
    from . import models
    Base.metadata.create_all(bind=engine)