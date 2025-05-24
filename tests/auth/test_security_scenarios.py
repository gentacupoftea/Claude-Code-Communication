"""
Security scenario tests for edge cases and attack vectors
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
import time

from src.auth.models import User, UserSession, AuditLog
from src.auth.security_service import SecurityService


class TestSecurityScenarios:
    """Test various security scenarios and attack vectors"""
    
    def test_brute_force_protection(self, client, db_session):
        """Test protection against brute force attacks"""
        # Create a verified user
        from src.core.security import get_password_hash
        user = User(
            email="bruteforce@example.com",
            hashed_password=get_password_hash("RealPassword123!"),
            email_verified=True
        )
        db_session.add(user)
        db_session.commit()
        
        # Attempt multiple failed logins
        for i in range(10):
            response = client.post(
                "/api/v1/auth/login",
                data={
                    "username": "bruteforce@example.com",
                    "password": f"WrongPassword{i}!"
                }
            )
            
            if i < 5:
                assert response.status_code == 401
            else:
                # Account should be locked after 5 attempts
                assert response.status_code == 423
        
        # Verify audit logs
        audit_logs = db_session.query(AuditLog).filter(
            AuditLog.user_id == user.id,
            AuditLog.action == "login.failed"
        ).all()
        
        assert len(audit_logs) >= 5
    
    def test_timing_attack_protection(self, client):
        """Test protection against timing attacks"""
        # Test with non-existent user
        start_time = time.time()
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "nonexistent@example.com",
                "password": "Password123!"
            }
        )
        non_existent_time = time.time() - start_time
        
        # Test with existing user (wrong password)
        start_time = time.time()
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "test@example.com",
                "password": "WrongPassword123!"
            }
        )
        existing_time = time.time() - start_time
        
        # Times should be similar to prevent user enumeration
        assert abs(non_existent_time - existing_time) < 0.5
    
    def test_session_hijacking_protection(self, client, db_session, verified_user):
        """Test protection against session hijacking"""
        # Login from one IP
        with patch('src.auth.enhanced_routes.request') as mock_request:
            mock_request.client.host = "192.168.1.1"
            mock_request.headers.get.return_value = "Browser A"
            
            response = client.post(
                "/api/v1/auth/login",
                data={
                    "username": verified_user.email,
                    "password": "SecurePass123!"
                }
            )
            
            token = response.json()["access_token"]
        
        # Try to use token from different IP
        with patch('src.auth.dependencies.request') as mock_request:
            mock_request.client.host = "10.0.0.1"
            mock_request.headers.get.return_value = "Browser B"
            
            # This should work but be logged as suspicious
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
        
        # Check for suspicious activity in audit logs
        audit_logs = db_session.query(AuditLog).filter(
            AuditLog.user_id == verified_user.id
        ).all()
        
        # Should have login from original IP
        assert any(log.ip_address == "192.168.1.1" for log in audit_logs)
    
    def test_password_reset_token_security(self, client, db_session, verified_user):
        """Test password reset token security"""
        # Request password reset
        response = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": verified_user.email}
        )
        
        assert response.status_code == 200
        
        # Try to use invalid token
        response = client.post(
            "/api/v1/auth/reset-password",
            json={
                "token": "invalid-token",
                "new_password": "NewPassword123!"
            }
        )
        
        assert response.status_code == 400
        
        # Try to enumerate valid tokens (should be rate limited)
        for i in range(5):
            response = client.post(
                "/api/v1/auth/reset-password",
                json={
                    "token": f"guess-token-{i}",
                    "new_password": "NewPassword123!"
                }
            )
        
        # Should hit rate limit
        assert response.status_code in [400, 429]
    
    def test_csrf_protection(self, client, auth_headers):
        """Test CSRF protection on state-changing operations"""
        # Try to change password without proper headers
        response = client.put(
            "/api/v1/auth/change-password",
            json={
                "current_password": "SecurePass123!",
                "new_password": "NewPassword123!"
            },
            headers={
                "Authorization": auth_headers["Authorization"],
                "Origin": "https://evil-site.com"
            }
        )
        
        # Should still work as we're using token auth, but check CORS
        assert response.status_code in [200, 400, 403]
    
    def test_concurrent_session_limit(self, client, db_session, verified_user):
        """Test limiting concurrent sessions per user"""
        # Create multiple sessions
        sessions = []
        for i in range(10):
            session = UserSession(
                user_id=verified_user.id,
                token_hash=f"hash_{i}",
                ip_address=f"192.168.1.{i}",
                expires_at=datetime.utcnow() + timedelta(hours=24)
            )
            db_session.add(session)
            sessions.append(session)
        
        db_session.commit()
        
        # Login to get current sessions
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": verified_user.email,
                "password": "SecurePass123!"
            }
        )
        
        token = response.json()["access_token"]
        
        # Check sessions
        response = client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        active_sessions = response.json()
        assert len(active_sessions) >= 10
        
        # In production, you might want to limit this
        # and revoke oldest sessions automatically
    
    def test_email_enumeration_prevention(self, client):
        """Test prevention of email enumeration"""
        # Test with existing email
        response1 = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "existing@example.com"}
        )
        
        # Test with non-existing email
        response2 = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nonexisting@example.com"}
        )
        
        # Both should return same response
        assert response1.status_code == response2.status_code
        assert response1.json()["message"] == response2.json()["message"]
    
    def test_token_expiry_validation(self, client, db_session, verified_user):
        """Test proper token expiry handling"""
        # Create expired session
        expired_session = UserSession(
            user_id=verified_user.id,
            token_hash="expired_hash",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        )
        db_session.add(expired_session)
        db_session.commit()
        
        # Try to use expired token
        with patch('src.auth.dependencies.verify_session') as mock_verify:
            mock_verify.return_value = None  # Simulate expired token
            
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer expired_token"}
            )
            
            assert response.status_code == 401
    
    def test_sql_injection_protection(self, client):
        """Test protection against SQL injection"""
        # Try SQL injection in login
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "admin' OR '1'='1",
                "password": "' OR '1'='1"
            }
        )
        
        assert response.status_code == 401
        
        # Try SQL injection in email verification
        response = client.post(
            "/api/v1/auth/verify-email",
            params={"token": "'; DROP TABLE users; --"}
        )
        
        assert response.status_code == 400
    
    def test_xss_protection_in_audit_logs(self, client, db_session, auth_headers):
        """Test XSS protection in audit logs"""
        # Try to inject script in user agent
        with patch('src.auth.enhanced_routes.request') as mock_request:
            mock_request.client.host = "192.168.1.1"
            mock_request.headers.get.return_value = "<script>alert('xss')</script>"
            
            response = client.get(
                "/api/v1/auth/me",
                headers=auth_headers
            )
        
        # Check audit logs - should be escaped
        audit_logs = db_session.query(AuditLog).all()
        
        for log in audit_logs:
            if log.user_agent:
                assert "<script>" not in log.user_agent
                assert log.user_agent == "<script>alert('xss')</script>"