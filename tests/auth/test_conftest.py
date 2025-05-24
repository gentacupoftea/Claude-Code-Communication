"""
Pytest configuration for authentication tests
"""
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from src.main import app
from src.auth.database import get_db
from src.auth.models import Base


# Test database URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth.db"


@pytest.fixture(scope="session")
def engine():
    """Create test database engine"""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    return engine


@pytest.fixture(scope="session")
def tables(engine):
    """Create all tables"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(engine, tables) -> Generator[Session, None, None]:
    """Create a new database session for a test"""
    connection = engine.connect()
    transaction = connection.begin()
    
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=connection
    )
    
    session = TestingSessionLocal()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session) -> Generator[TestClient, None, None]:
    """Create a test client with overridden dependencies"""
    
    def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Standard test user data"""
    return {
        "email": "test@example.com",
        "password": "SecurePass123!",
        "full_name": "Test User"
    }


@pytest.fixture
def verified_user(db_session, test_user_data):
    """Create a verified user for testing"""
    from src.auth.models import User
    from src.core.security import get_password_hash
    
    user = User(
        email=test_user_data["email"],
        hashed_password=get_password_hash(test_user_data["password"]),
        full_name=test_user_data["full_name"],
        email_verified=True,
        is_active=True
    )
    
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    return user


@pytest.fixture
def auth_headers(client, verified_user, test_user_data):
    """Get authentication headers for a verified user"""
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user_data["email"],
            "password": test_user_data["password"]
        }
    )
    
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_user(db_session):
    """Create an admin user for testing"""
    from src.auth.models import User
    from src.core.security import get_password_hash
    
    user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Admin User",
        email_verified=True,
        is_active=True,
        is_superuser=True
    )
    
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    return user


@pytest.fixture
def organization_with_user(db_session, verified_user):
    """Create an organization with a user"""
    from src.auth.models import Organization, OrganizationMember
    
    org = Organization(
        name="Test Organization",
        slug="test-org"
    )
    
    db_session.add(org)
    db_session.flush()
    
    membership = OrganizationMember(
        user_id=verified_user.id,
        organization_id=org.id,
        role="owner"
    )
    
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(org)
    
    return org, membership