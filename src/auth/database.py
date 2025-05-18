"""
Database configuration and session management
"""
import logging
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from .config import get_auth_settings

logger = logging.getLogger(__name__)

# Get database configuration
settings = get_auth_settings()

# Create database engine
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False  # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session
    
    Yields:
        Session: Database session
    """
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.error(f"Database error: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager for database sessions
    
    Yields:
        Session: Database session
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except SQLAlchemyError as e:
        logger.error(f"Database error: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    try:
        # Import all models to ensure they are registered
        from .models import User, Organization, OrganizationMember, APIToken, ShopifyStore
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {str(e)}")
        raise


def drop_db():
    """Drop all database tables (use with caution!)"""
    try:
        Base.metadata.drop_all(bind=engine)
        logger.warning("All database tables dropped")
    except Exception as e:
        logger.error(f"Error dropping database tables: {str(e)}")
        raise