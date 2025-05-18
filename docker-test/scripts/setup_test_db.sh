#!/bin/bash
set -e

echo "Setting up test database..."

# Set environment variables for database connection
export PGPASSWORD=$POSTGRES_PASSWORD

# Create the database if it doesn't exist
psql -h test-db -U test_user -tc "SELECT 1 FROM pg_database WHERE datname = 'conea_test'" | grep -q 1 || \
    psql -h test-db -U test_user -c "CREATE DATABASE conea_test"

# Run migrations using SQLAlchemy
python -c "
from sqlalchemy import create_engine
from src.auth.database import Base
from src.auth.models import User, Permission, UserPermission
from src.google_analytics.models.analytics import AnalyticsData, PropertyConnection
import os

# Create engine
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://test_user:test_password@test-db:5432/conea_test')
engine = create_engine(DATABASE_URL)

# Create all tables
Base.metadata.create_all(bind=engine)

print('Database tables created successfully')
"

# Insert test data
python -c "
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.auth.models import User, Permission
from src.auth.services import create_user, get_password_hash
import os
from datetime import datetime

# Create engine and session
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://test_user:test_password@test-db:5432/conea_test')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Create test users
    if not db.query(User).filter(User.email == 'test@example.com').first():
        test_user = User(
            email='test@example.com',
            username='testuser',
            hashed_password=get_password_hash('testpassword'),
            is_active=True,
            is_superuser=False,
            created_at=datetime.utcnow()
        )
        db.add(test_user)
        db.commit()
        print('Test user created')
    
    # Create admin user
    if not db.query(User).filter(User.email == 'admin@example.com').first():
        admin_user = User(
            email='admin@example.com',
            username='admin',
            hashed_password=get_password_hash('adminpassword'),
            is_active=True,
            is_superuser=True,
            created_at=datetime.utcnow()
        )
        db.add(admin_user)
        db.commit()
        print('Admin user created')
    
    # Create permissions
    permissions = [
        'read:shopify_products',
        'write:shopify_products',
        'read:google_analytics',
        'write:google_analytics'
    ]
    
    for perm_name in permissions:
        if not db.query(Permission).filter(Permission.name == perm_name).first():
            permission = Permission(name=perm_name)
            db.add(permission)
    
    db.commit()
    print('Permissions created')
    
finally:
    db.close()
"

echo "Test database setup complete!"