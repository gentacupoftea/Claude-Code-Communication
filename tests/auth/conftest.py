"""
Test fixtures for authentication tests
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from src.auth.models import Base, User, Organization, OrganizationMember
from src.auth.security import PasswordManager, JWTManager
from src.auth.database import get_db
from src.auth.dependencies import get_auth_settings


@pytest.fixture(scope="session")
def test_database_url():
    """Test database URL"""
    return "sqlite:///./test.db"


@pytest.fixture(scope="session")
def test_engine(test_database_url):
    """Create test database engine"""
    engine = create_engine(
        test_database_url,
        connect_args={"check_same_thread": False}
    )
    return engine


@pytest.fixture(scope="session")
def test_session_factory(test_engine):
    """Create test session factory"""
    Base.metadata.create_all(bind=test_engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session(test_session_factory):
    """Get test database session"""
    session = test_session_factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def test_app(db_session):
    """Create test FastAPI application"""
    from src.main import app
    
    # Override database dependency
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield app
    
    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_settings():
    """Test authentication settings"""
    class TestAuthSettings:
        jwt_secret_key = "test-secret-key"
        jwt_algorithm = "HS256"
        access_token_expire_minutes = 15
        refresh_token_expire_minutes = 10080
        database_url = "sqlite:///./test.db"
        bcrypt_rounds = 4  # Lower rounds for faster tests
        api_token_expire_days = 365
        default_org_name = "Test Organization"
    
    return TestAuthSettings()


@pytest.fixture(scope="function")
def password_manager():
    """Get password manager instance"""
    return PasswordManager()


@pytest.fixture(scope="function")
def jwt_manager(test_settings):
    """Get JWT manager instance"""
    return JWTManager(
        secret_key=test_settings.jwt_secret_key,
        algorithm=test_settings.jwt_algorithm,
        access_token_expire_minutes=test_settings.access_token_expire_minutes,
        refresh_token_expire_minutes=test_settings.refresh_token_expire_minutes
    )


@pytest.fixture(scope="function")
def test_user(db_session, password_manager):
    """Create test user"""
    user = User(
        email="testuser@example.com",
        hashed_password=password_manager.get_password_hash("testpassword123"),
        full_name="Test User",
        is_active=True,
        is_superuser=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_superuser(db_session, password_manager):
    """Create test superuser"""
    user = User(
        email="admin@example.com",
        hashed_password=password_manager.get_password_hash("adminpassword123"),
        full_name="Admin User",
        is_active=True,
        is_superuser=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_organization(db_session):
    """Create test organization"""
    org = Organization(
        name="Test Organization",
        slug="test-org"
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture(scope="function")
def test_organization_with_owner(db_session, test_user, test_organization):
    """Create test organization with owner"""
    membership = OrganizationMember(
        user_id=test_user.id,
        organization_id=test_organization.id,
        role="owner"
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(membership)
    
    return {
        "organization": test_organization,
        "user": test_user,
        "membership": membership
    }


@pytest.fixture(scope="function")
def auth_headers(test_app, test_user):
    """Get authentication headers for test user"""
    client = TestClient(test_app)
    
    # Login to get tokens
    response = client.post("/api/v1/auth/login", data={
        "username": test_user.email,
        "password": "testpassword123"
    })
    
    assert response.status_code == 200
    tokens = response.json()
    
    return {
        "Authorization": f"Bearer {tokens['access_token']}"
    }


@pytest.fixture(scope="function")
def superuser_headers(test_app, test_superuser):
    """Get authentication headers for superuser"""
    client = TestClient(test_app)
    
    # Login to get tokens
    response = client.post("/api/v1/auth/login", data={
        "username": test_superuser.email,
        "password": "adminpassword123"
    })
    
    assert response.status_code == 200
    tokens = response.json()
    
    return {
        "Authorization": f"Bearer {tokens['access_token']}"
    }


@pytest.fixture(scope="function")
def api_token_headers(db_session, test_user):
    """Get API token headers for test user"""
    from src.auth.services import APITokenService
    
    token_service = APITokenService(db_session)
    token, token_value = token_service.create_token(
        user_id=test_user.id,
        name="Test API Token",
        scopes=["read:analytics", "read:store"]
    )
    
    return {
        "X-API-Key": token_value
    }


@pytest.fixture(autouse=True)
def reset_database(test_engine):
    """Reset database before each test"""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)