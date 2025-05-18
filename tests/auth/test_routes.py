"""
Tests for authentication API endpoints
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4

from src.auth.models import User, Organization, OrganizationMember
from src.auth.security import PasswordManager


class TestAuthenticationEndpoints:
    """Test authentication-related endpoints"""
    
    @pytest.fixture
    def client(self, test_app):
        return TestClient(test_app)
    
    def test_register_user(self, client):
        response = client.post("/api/v1/auth/register", json={
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User"
        })
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["full_name"] == "New User"
        assert "id" in data
        assert "created_at" in data
    
    def test_register_duplicate_email(self, client, db_session):
        # Create existing user
        password_manager = PasswordManager()
        existing_user = User(
            email="existing@example.com",
            hashed_password=password_manager.get_password_hash("password123")
        )
        db_session.add(existing_user)
        db_session.commit()
        
        # Try to register with same email
        response = client.post("/api/v1/auth/register", json={
            "email": "existing@example.com",
            "password": "AnotherPass123!",
            "full_name": "Another User"
        })
        
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"].lower()
    
    def test_login_valid_credentials(self, client, db_session):
        # Create test user
        password_manager = PasswordManager()
        user = User(
            email="user@example.com",
            hashed_password=password_manager.get_password_hash("correctpassword")
        )
        db_session.add(user)
        db_session.commit()
        
        # Login
        response = client.post("/api/v1/auth/login", data={
            "username": "user@example.com",
            "password": "correctpassword"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self, client):
        response = client.post("/api/v1/auth/login", data={
            "username": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()
    
    def test_refresh_token(self, client, db_session):
        # Create and login user
        password_manager = PasswordManager()
        user = User(
            email="refresh@example.com",
            hashed_password=password_manager.get_password_hash("password123")
        )
        db_session.add(user)
        db_session.commit()
        
        # Get tokens
        login_response = client.post("/api/v1/auth/login", data={
            "username": "refresh@example.com",
            "password": "password123"
        })
        tokens = login_response.json()
        
        # Refresh token
        response = client.post("/api/v1/auth/refresh", json={
            "refresh_token": tokens["refresh_token"]
        })
        
        assert response.status_code == 200
        new_tokens = response.json()
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["access_token"] != tokens["access_token"]
    
    def test_get_current_user(self, client, auth_headers):
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "id" in data
        assert "full_name" in data
    
    def test_update_current_user(self, client, auth_headers):
        response = client.put("/api/v1/auth/me", 
                            headers=auth_headers,
                            json={"full_name": "Updated Name"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"


class TestOrganizationEndpoints:
    """Test organization-related endpoints"""
    
    @pytest.fixture
    def client(self, test_app):
        return TestClient(test_app)
    
    def test_create_organization(self, client, auth_headers):
        response = client.post("/api/v1/auth/organizations",
                             headers=auth_headers,
                             json={"name": "Test Organization"})
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Organization"
        assert data["slug"] == "test-organization"
        assert "id" in data
        assert "created_at" in data
    
    def test_get_user_organizations(self, client, auth_headers, db_session, test_user):
        # Create organization with user as member
        org = Organization(name="User Org", slug="user-org")
        db_session.add(org)
        db_session.flush()
        
        membership = OrganizationMember(
            user_id=test_user.id,
            organization_id=org.id,
            role="owner"
        )
        db_session.add(membership)
        db_session.commit()
        
        response = client.get("/api/v1/auth/organizations", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(org.id)
        assert data[0]["name"] == "User Org"
    
    def test_get_organization_details(self, client, auth_headers, test_organization):
        response = client.get(f"/api/v1/auth/organizations/{test_organization.id}",
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_organization.id)
        assert data["name"] == test_organization.name
    
    def test_add_organization_member(self, client, auth_headers, test_organization, db_session):
        # Create another user
        password_manager = PasswordManager()
        new_user = User(
            email="newmember@example.com",
            hashed_password=password_manager.get_password_hash("password123")
        )
        db_session.add(new_user)
        db_session.commit()
        
        response = client.post(
            f"/api/v1/auth/organizations/{test_organization.id}/members",
            headers=auth_headers,
            json={
                "user_email": "newmember@example.com",
                "role": "member"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == str(new_user.id)
        assert data["organization_id"] == str(test_organization.id)
        assert data["role"] == "member"
    
    def test_get_organization_members(self, client, auth_headers, test_organization):
        response = client.get(
            f"/api/v1/auth/organizations/{test_organization.id}/members",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1  # At least the owner
        member = next(m for m in data if m["role"] == "owner")
        assert member is not None


class TestAPITokenEndpoints:
    """Test API token-related endpoints"""
    
    @pytest.fixture
    def client(self, test_app):
        return TestClient(test_app)
    
    def test_create_api_token(self, client, auth_headers):
        response = client.post("/api/v1/auth/tokens",
                             headers=auth_headers,
                             json={
                                 "name": "Test API Token",
                                 "scopes": ["read:analytics", "read:store"],
                                 "expires_in_days": 30
                             })
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test API Token"
        assert data["scopes"] == ["read:analytics", "read:store"]
        assert "token" in data  # Only in creation response
        assert "id" in data
        assert "expires_at" in data
    
    def test_get_user_tokens(self, client, auth_headers):
        # Create a token first
        create_response = client.post("/api/v1/auth/tokens",
                                    headers=auth_headers,
                                    json={
                                        "name": "Test Token",
                                        "scopes": ["read:analytics"]
                                    })
        
        # Get user tokens
        response = client.get("/api/v1/auth/tokens", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        token = next(t for t in data if t["name"] == "Test Token")
        assert token is not None
        assert token["scopes"] == ["read:analytics"]
    
    def test_revoke_api_token(self, client, auth_headers):
        # Create a token
        create_response = client.post("/api/v1/auth/tokens",
                                    headers=auth_headers,
                                    json={
                                        "name": "Token to Revoke",
                                        "scopes": ["read:analytics"]
                                    })
        token_id = create_response.json()["id"]
        
        # Revoke the token
        response = client.delete(f"/api/v1/auth/tokens/{token_id}",
                               headers=auth_headers)
        
        assert response.status_code == 204
        
        # Verify token is gone
        tokens_response = client.get("/api/v1/auth/tokens", headers=auth_headers)
        tokens = tokens_response.json()
        assert not any(t["id"] == token_id for t in tokens)


class TestPermissionEndpoints:
    """Test permission-based access control"""
    
    @pytest.fixture
    def client(self, test_app):
        return TestClient(test_app)
    
    @pytest.fixture
    def member_user(self, db_session, test_organization):
        password_manager = PasswordManager()
        user = User(
            email="member@example.com",
            hashed_password=password_manager.get_password_hash("password123")
        )
        db_session.add(user)
        db_session.flush()
        
        membership = OrganizationMember(
            user_id=user.id,
            organization_id=test_organization.id,
            role="member"
        )
        db_session.add(membership)
        db_session.commit()
        
        return user
    
    def test_owner_can_manage_users(self, client, auth_headers, test_organization):
        # Owner should be able to add members
        response = client.post(
            f"/api/v1/auth/organizations/{test_organization.id}/members",
            headers=auth_headers,
            json={
                "user_email": "newuser@example.com",
                "role": "viewer"
            }
        )
        
        # Should fail because user doesn't exist, not because of permissions
        assert response.status_code == 404
    
    def test_member_cannot_manage_users(self, client, test_organization, member_user):
        # Get member's auth token
        login_response = client.post("/api/v1/auth/login", data={
            "username": "member@example.com",
            "password": "password123"
        })
        member_token = login_response.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}
        
        # Member should not be able to add members
        response = client.post(
            f"/api/v1/auth/organizations/{test_organization.id}/members",
            headers=member_headers,
            json={
                "user_email": "another@example.com",
                "role": "viewer"
            }
        )
        
        assert response.status_code == 403
        assert "permissions" in response.json()["detail"].lower()