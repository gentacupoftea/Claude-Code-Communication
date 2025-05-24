"""
Integration tests for enhanced authentication flow
"""
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, Mock

from src.auth.models import Base, User, UserSession, AuditLog
from src.auth.security_service import SecurityService
from src.main import app
from src.auth.database import get_db


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


class TestEnhancedAuthenticationFlow:
    """Integration tests for the complete authentication flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test database"""
        Base.metadata.create_all(bind=engine)
        yield
        Base.metadata.drop_all(bind=engine)
    
    def test_complete_registration_flow(self):
        """Test user registration with email verification"""
        # Register new user
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "SecurePass123!",
                "full_name": "Test User"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["email_verified"] is False
        
        # Try to login without email verification
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "test@example.com",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 403
        assert "Email not verified" in response.json()["detail"]
        
        # Verify email
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "test@example.com").first()
        verification_token = user.email_verification_token
        db.close()
        
        response = client.post(
            f"/api/v1/auth/verify-email?token={verification_token}"
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Now login should work
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "test@example.com",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 200
        assert "access_token" in response.json()
    
    def test_password_policy_enforcement(self):
        """Test password policy validation during registration"""
        test_cases = [
            ("weak", "at least 8 characters"),
            ("password123!", "uppercase letter"),
            ("PASSWORD123!", "lowercase letter"),
            ("Password!", "digit"),
            ("Password123", "special character")
        ]
        
        for password, expected_error in test_cases:
            response = client.post(
                "/api/v1/auth/register",
                json={
                    "email": f"test_{password}@example.com",
                    "password": password,
                    "full_name": "Test User"
                }
            )
            
            assert response.status_code == 400
            errors = response.json()["detail"]["errors"]
            assert any(expected_error in error for error in errors)
    
    def test_account_lockout_flow(self):
        """Test account lockout after failed login attempts"""
        # Create verified user
        db = TestingSessionLocal()
        user = User(
            email="lockout@example.com",
            hashed_password="$2b$12$test",  # Invalid hash
            full_name="Lockout Test",
            email_verified=True
        )
        db.add(user)
        db.commit()
        db.close()
        
        # Attempt login with wrong password 5 times
        for i in range(5):
            response = client.post(
                "/api/v1/auth/login",
                data={
                    "username": "lockout@example.com",
                    "password": "WrongPassword123!"
                }
            )
            assert response.status_code == 401
        
        # 6th attempt should be locked
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "lockout@example.com",
                "password": "WrongPassword123!"
            }
        )
        
        assert response.status_code == 423
        assert "Account locked" in response.json()["detail"]
    
    @patch('src.auth.security_service.SecurityService.generate_2fa_secret')
    @patch('src.auth.security_service.SecurityService.generate_2fa_qr_code')
    def test_2fa_setup_flow(self, mock_qr, mock_secret):
        """Test 2FA setup and login flow"""
        mock_secret.return_value = "JBSWY3DPEHPK3PXP"
        mock_qr.return_value = "base64_qr_code"
        
        # Create and login user
        db = TestingSessionLocal()
        from src.core.security import get_password_hash
        user = User(
            email="2fa@example.com",
            hashed_password=get_password_hash("SecurePass123!"),
            full_name="2FA Test",
            email_verified=True
        )
        db.add(user)
        db.commit()
        db.close()
        
        # Login to get token
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "2fa@example.com",
                "password": "SecurePass123!"
            }
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        
        # Setup 2FA
        response = client.post(
            "/api/v1/auth/2fa/setup",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "secret" in data
        assert "qr_code" in data
        assert "backup_codes" in data
        assert len(data["backup_codes"]) == 10
        
        # Verify 2FA with mock token
        with patch('src.auth.security_service.SecurityService.verify_2fa_token') as mock_verify:
            mock_verify.return_value = True
            
            response = client.post(
                "/api/v1/auth/2fa/verify",
                headers={"Authorization": f"Bearer {token}"},
                params={"token": "123456"}
            )
            
            assert response.status_code == 200
            assert response.json()["success"] is True
        
        # Test login with 2FA
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "2fa@example.com",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("requires_2fa") is True
        assert "user_id" in data
    
    def test_session_management(self):
        """Test session listing and revocation"""
        # Create user with session
        db = TestingSessionLocal()
        from src.core.security import get_password_hash
        user = User(
            id="test-user-id",
            email="session@example.com",
            hashed_password=get_password_hash("SecurePass123!"),
            full_name="Session Test",
            email_verified=True
        )
        db.add(user)
        db.commit()
        
        # Create multiple sessions
        for i in range(3):
            session = UserSession(
                user_id=user.id,
                token_hash=f"hash_{i}",
                ip_address=f"192.168.1.{i}",
                expires_at=datetime.utcnow() + timedelta(hours=24)
            )
            db.add(session)
        db.commit()
        session_id = session.id
        db.close()
        
        # Login to get token
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "session@example.com",
                "password": "SecurePass123!"
            }
        )
        token = response.json()["access_token"]
        
        # List sessions
        response = client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        sessions = response.json()
        assert len(sessions) >= 3
        
        # Revoke one session
        response = client.delete(
            f"/api/v1/auth/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        
        # Verify session was revoked
        response = client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        sessions = response.json()
        assert not any(s["id"] == str(session_id) for s in sessions)
    
    def test_audit_logging(self):
        """Test audit log generation"""
        # Register user
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "audit@example.com",
                "password": "SecurePass123!",
                "full_name": "Audit Test"
            }
        )
        
        # Check audit logs were created
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "audit@example.com").first()
        audit_logs = db.query(AuditLog).filter(AuditLog.user_id == user.id).all()
        
        assert len(audit_logs) > 0
        assert any(log.action == "user.registered" for log in audit_logs)
        
        db.close()
    
    def test_password_history(self):
        """Test password history enforcement"""
        # Create user
        db = TestingSessionLocal()
        from src.core.security import get_password_hash
        user = User(
            email="history@example.com",
            hashed_password=get_password_hash("OldPass123!"),
            full_name="History Test",
            email_verified=True
        )
        db.add(user)
        db.commit()
        
        # Add password to history
        from src.auth.models import PasswordHistory
        history = PasswordHistory(
            user_id=user.id,
            password_hash=user.hashed_password
        )
        db.add(history)
        db.commit()
        db.close()
        
        # Login
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "history@example.com",
                "password": "OldPass123!"
            }
        )
        token = response.json()["access_token"]
        
        # Try to change to same password
        response = client.put(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "OldPass123!",
                "new_password": "OldPass123!"
            }
        )
        
        assert response.status_code == 400
        assert "recently used" in response.json()["detail"]
    
    def test_remember_me_functionality(self):
        """Test remember me cookie setting"""
        # Create user
        db = TestingSessionLocal()
        from src.core.security import get_password_hash
        user = User(
            email="remember@example.com",
            hashed_password=get_password_hash("SecurePass123!"),
            full_name="Remember Test",
            email_verified=True
        )
        db.add(user)
        db.commit()
        db.close()
        
        # Login with remember_me
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "remember@example.com",
                "password": "SecurePass123!",
                "remember_me": "true"
            }
        )
        
        assert response.status_code == 200
        assert "remember_token" in response.cookies
        
        # Check session expiry is extended
        db = TestingSessionLocal()
        session = db.query(UserSession).filter(
            UserSession.user_id == user.id
        ).first()
        
        assert session.expires_at > datetime.utcnow() + timedelta(days=29)
        db.close()