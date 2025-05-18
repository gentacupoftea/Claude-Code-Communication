"""
Tests for authentication and authorization services
"""
import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from src.auth.models import User, Organization, OrganizationMember, APIToken
from src.auth.services import AuthService, AuthorizationService, APITokenService
from src.auth.security import PasswordManager, JWTManager, InvalidTokenError
from src.auth.permissions import RolePermissionManager, Permission


class TestPasswordManager:
    """Test password hashing and verification"""
    
    def test_password_hash_verify(self):
        manager = PasswordManager()
        password = "SecurePassword123!"
        
        # Hash password
        hashed = manager.get_password_hash(password)
        assert hashed != password
        
        # Verify correct password
        assert manager.verify_password(password, hashed)
        
        # Verify incorrect password
        assert not manager.verify_password("WrongPassword", hashed)
    
    def test_password_hash_uniqueness(self):
        manager = PasswordManager()
        password = "SecurePassword123!"
        
        # Same password should produce different hashes
        hash1 = manager.get_password_hash(password)
        hash2 = manager.get_password_hash(password)
        
        assert hash1 != hash2
        assert manager.verify_password(password, hash1)
        assert manager.verify_password(password, hash2)


class TestJWTManager:
    """Test JWT token creation and verification"""
    
    @pytest.fixture
    def jwt_manager(self):
        return JWTManager(secret_key="test-secret-key")
    
    def test_create_access_token(self, jwt_manager):
        data = {"user_id": "123", "email": "test@example.com"}
        token = jwt_manager.create_access_token(data)
        
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_create_refresh_token(self, jwt_manager):
        data = {"user_id": "123"}
        token = jwt_manager.create_refresh_token(data)
        
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_verify_valid_token(self, jwt_manager):
        data = {"user_id": "123", "email": "test@example.com"}
        token = jwt_manager.create_access_token(data)
        
        payload = jwt_manager.verify_token(token)
        assert payload["user_id"] == "123"
        assert payload["email"] == "test@example.com"
        assert payload["token_type"] == "access"
    
    def test_verify_invalid_token(self, jwt_manager):
        with pytest.raises(InvalidTokenError):
            jwt_manager.verify_token("invalid-token")
    
    def test_verify_expired_token(self, jwt_manager):
        # Create token with very short expiration
        jwt_manager.access_token_expire_minutes = -1  # Already expired
        token = jwt_manager.create_access_token({"user_id": "123"})
        
        with pytest.raises(InvalidTokenError):
            jwt_manager.verify_token(token)


class TestAuthService:
    """Test authentication service"""
    
    @pytest.fixture
    def auth_service(self, db_session):
        password_manager = PasswordManager()
        jwt_manager = JWTManager(secret_key="test-secret")
        return AuthService(db_session, password_manager, jwt_manager)
    
    @pytest.fixture
    def test_user(self, db_session):
        password_manager = PasswordManager()
        user = User(
            email="test@example.com",
            hashed_password=password_manager.get_password_hash("password123"),
            full_name="Test User"
        )
        db_session.add(user)
        db_session.commit()
        return user
    
    async def test_authenticate_valid_user(self, auth_service, test_user):
        result = await auth_service.authenticate_user("test@example.com", "password123")
        
        assert result is not None
        assert result.id == test_user.id
        assert result.email == test_user.email
    
    async def test_authenticate_invalid_password(self, auth_service, test_user):
        result = await auth_service.authenticate_user("test@example.com", "wrongpassword")
        assert result is None
    
    async def test_authenticate_nonexistent_user(self, auth_service):
        result = await auth_service.authenticate_user("nonexistent@example.com", "password")
        assert result is None
    
    async def test_create_tokens(self, auth_service, test_user):
        tokens = await auth_service.create_tokens(test_user)
        
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["token_type"] == "bearer"
    
    async def test_refresh_access_token(self, auth_service, test_user):
        tokens = await auth_service.create_tokens(test_user)
        refresh_token = tokens["refresh_token"]
        
        new_tokens = await auth_service.refresh_access_token(refresh_token)
        
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["access_token"] != tokens["access_token"]


class TestAuthorizationService:
    """Test authorization service"""
    
    @pytest.fixture
    def auth_service(self, db_session):
        role_manager = RolePermissionManager()
        return AuthorizationService(db_session, role_manager)
    
    @pytest.fixture
    def test_setup(self, db_session):
        # Create test user
        user = User(
            email="test@example.com",
            hashed_password="hashed",
            full_name="Test User"
        )
        db_session.add(user)
        
        # Create test organization
        org = Organization(
            name="Test Org",
            slug="test-org"
        )
        db_session.add(org)
        
        # Create membership
        membership = OrganizationMember(
            user=user,
            organization=org,
            role="admin"
        )
        db_session.add(membership)
        
        db_session.commit()
        return {"user": user, "org": org, "membership": membership}
    
    async def test_get_user_organizations(self, auth_service, test_setup):
        user = test_setup["user"]
        orgs = await auth_service.get_user_organizations(user.id)
        
        assert len(orgs) == 1
        assert orgs[0].id == test_setup["org"].id
    
    async def test_get_user_role_in_organization(self, auth_service, test_setup):
        user = test_setup["user"]
        org = test_setup["org"]
        
        role = await auth_service.get_user_role_in_organization(user.id, org.id)
        assert role == "admin"
    
    async def test_check_permission_valid(self, auth_service, test_setup):
        user = test_setup["user"]
        org = test_setup["org"]
        
        # Admin should have write analytics permission
        has_permission = await auth_service.check_permission(
            user.id, org.id, Permission.WRITE_ANALYTICS.value
        )
        assert has_permission
    
    async def test_check_permission_invalid(self, auth_service, test_setup):
        user = test_setup["user"]
        org = test_setup["org"]
        
        # Admin should not have admin permission
        has_permission = await auth_service.check_permission(
            user.id, org.id, Permission.ADMIN.value
        )
        assert not has_permission
    
    async def test_add_user_to_organization(self, auth_service, test_setup, db_session):
        # Create another user
        new_user = User(
            email="new@example.com",
            hashed_password="hashed",
            full_name="New User"
        )
        db_session.add(new_user)
        db_session.commit()
        
        org = test_setup["org"]
        
        # Add user to organization
        membership = await auth_service.add_user_to_organization(
            new_user.id, org.id, "member"
        )
        
        assert membership is not None
        assert membership.user_id == new_user.id
        assert membership.organization_id == org.id
        assert membership.role == "member"


class TestAPITokenService:
    """Test API token service"""
    
    @pytest.fixture
    def token_service(self, db_session):
        return APITokenService(db_session)
    
    @pytest.fixture
    def test_user(self, db_session):
        user = User(
            email="test@example.com",
            hashed_password="hashed",
            full_name="Test User"
        )
        db_session.add(user)
        db_session.commit()
        return user
    
    async def test_create_token(self, token_service, test_user):
        token, token_value = await token_service.create_token(
            user_id=test_user.id,
            name="Test Token",
            scopes=["read:analytics"],
            expires_in_days=30
        )
        
        assert token.user_id == test_user.id
        assert token.name == "Test Token"
        assert token.scopes == ["read:analytics"]
        assert token.expires_at is not None
        assert isinstance(token_value, str)
        assert len(token_value) > 0
    
    async def test_verify_valid_token(self, token_service, test_user):
        token, token_value = await token_service.create_token(
            user_id=test_user.id,
            name="Test Token",
            scopes=["read:analytics"]
        )
        
        verified_token = await token_service.verify_token(token_value)
        
        assert verified_token is not None
        assert verified_token.id == token.id
        assert verified_token.user_id == test_user.id
    
    async def test_verify_invalid_token(self, token_service):
        verified_token = await token_service.verify_token("invalid-token")
        assert verified_token is None
    
    async def test_verify_expired_token(self, token_service, test_user, db_session):
        # Create expired token
        token, token_value = await token_service.create_token(
            user_id=test_user.id,
            name="Expired Token",
            scopes=["read:analytics"],
            expires_in_days=0
        )
        
        # Manually set expiration to past
        token.expires_at = datetime.utcnow() - timedelta(days=1)
        db_session.commit()
        
        verified_token = await token_service.verify_token(token_value)
        assert verified_token is None
    
    async def test_revoke_token(self, token_service, test_user):
        token, _ = await token_service.create_token(
            user_id=test_user.id,
            name="Test Token",
            scopes=["read:analytics"]
        )
        
        success = await token_service.revoke_token(token.id, test_user.id)
        assert success
        
        # Try to revoke non-existent token
        success = await token_service.revoke_token(uuid4(), test_user.id)
        assert not success