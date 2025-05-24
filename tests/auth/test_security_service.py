"""
Test cases for SecurityService
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session

from src.auth.security_service import SecurityService
from src.auth.models import User, PasswordHistory, UserSession, AuditLog


class TestSecurityService:
    """Test cases for security service functionality"""
    
    def test_generate_verification_token(self):
        """Test email verification token generation"""
        token = SecurityService.generate_verification_token()
        assert token is not None
        assert len(token) > 20
        assert isinstance(token, str)
    
    def test_generate_2fa_secret(self):
        """Test 2FA secret generation"""
        secret = SecurityService.generate_2fa_secret()
        assert secret is not None
        assert len(secret) == 32  # Base32 encoded
        assert isinstance(secret, str)
    
    def test_generate_backup_codes(self):
        """Test backup code generation"""
        codes = SecurityService.generate_backup_codes()
        assert len(codes) == 10
        assert all(len(code) == 8 for code in codes)
        assert len(set(codes)) == 10  # All unique
    
    def test_password_policy_validation(self):
        """Test password policy validation"""
        # Test weak passwords
        is_valid, errors = SecurityService.check_password_policy("weak")
        assert not is_valid
        assert len(errors) > 0
        
        # Test password without uppercase
        is_valid, errors = SecurityService.check_password_policy("password123!")
        assert not is_valid
        assert any("uppercase" in error for error in errors)
        
        # Test password without lowercase
        is_valid, errors = SecurityService.check_password_policy("PASSWORD123!")
        assert not is_valid
        assert any("lowercase" in error for error in errors)
        
        # Test password without digit
        is_valid, errors = SecurityService.check_password_policy("Password!")
        assert not is_valid
        assert any("digit" in error for error in errors)
        
        # Test password without special character
        is_valid, errors = SecurityService.check_password_policy("Password123")
        assert not is_valid
        assert any("special" in error for error in errors)
        
        # Test valid password
        is_valid, errors = SecurityService.check_password_policy("Password123!")
        assert is_valid
        assert len(errors) == 0
    
    def test_account_lockout_check(self):
        """Test account lockout verification"""
        user = User()
        
        # Test unlocked account
        is_locked, message = SecurityService.check_account_lockout(user)
        assert not is_locked
        assert message is None
        
        # Test locked account
        user.account_locked_until = datetime.utcnow() + timedelta(minutes=10)
        is_locked, message = SecurityService.check_account_lockout(user)
        assert is_locked
        assert "locked until" in message
        
        # Test expired lockout
        user.account_locked_until = datetime.utcnow() - timedelta(minutes=10)
        is_locked, message = SecurityService.check_account_lockout(user)
        assert not is_locked
        assert message is None
    
    def test_handle_failed_login(self):
        """Test failed login handling"""
        db = Mock(spec=Session)
        user = User()
        user.failed_login_attempts = 0
        
        # First failed attempt
        SecurityService.handle_failed_login(db, user)
        assert user.failed_login_attempts == 1
        assert user.last_failed_login_at is not None
        assert user.account_locked_until is None
        
        # Fifth failed attempt (should lock)
        user.failed_login_attempts = 4
        SecurityService.handle_failed_login(db, user)
        assert user.failed_login_attempts == 5
        assert user.account_locked_until is not None
        assert user.account_locked_until > datetime.utcnow()
        
        db.commit.assert_called()
    
    def test_handle_successful_login(self):
        """Test successful login handling"""
        db = Mock(spec=Session)
        user = User()
        user.failed_login_attempts = 3
        user.account_locked_until = datetime.utcnow() + timedelta(minutes=10)
        
        SecurityService.handle_successful_login(db, user)
        
        assert user.failed_login_attempts == 0
        assert user.last_login is not None
        assert user.account_locked_until is None
        db.commit.assert_called()
    
    def test_create_session(self):
        """Test session creation"""
        db = Mock(spec=Session)
        user_id = "test-user-id"
        token = "test-token"
        ip_address = "192.168.1.1"
        user_agent = "Test Browser"
        
        # Test regular session
        session = SecurityService.create_session(
            db, user_id, token, ip_address, user_agent, remember_me=False
        )
        
        assert session.user_id == user_id
        assert session.ip_address == ip_address
        assert session.device_info["user_agent"] == user_agent
        assert session.expires_at > datetime.utcnow()
        assert session.expires_at < datetime.utcnow() + timedelta(days=2)
        
        # Test remember me session
        session = SecurityService.create_session(
            db, user_id, token, ip_address, user_agent, remember_me=True
        )
        
        assert session.expires_at > datetime.utcnow() + timedelta(days=29)
        assert session.expires_at < datetime.utcnow() + timedelta(days=31)
    
    @patch('src.auth.security_service.verify_password')
    def test_check_password_history(self, mock_verify):
        """Test password history checking"""
        db = Mock(spec=Session)
        user_id = "test-user-id"
        password = "NewPassword123!"
        
        # Mock password history
        history_entries = [
            Mock(password_hash="hash1"),
            Mock(password_hash="hash2"),
            Mock(password_hash="hash3")
        ]
        
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = history_entries
        
        # Test new password (not in history)
        mock_verify.return_value = False
        result = SecurityService.check_password_history(db, user_id, password)
        assert result is True
        
        # Test password in history
        mock_verify.side_effect = [True, False, False]  # First hash matches
        result = SecurityService.check_password_history(db, user_id, password)
        assert result is False
    
    def test_log_audit_event(self):
        """Test audit event logging"""
        db = Mock(spec=Session)
        
        SecurityService.log_audit_event(
            db=db,
            action="test.action",
            user_id="user-123",
            organization_id="org-456",
            resource_type="test_resource",
            resource_id="resource-789",
            ip_address="192.168.1.1",
            user_agent="Test Browser",
            metadata={"key": "value"}
        )
        
        # Verify audit log was created
        db.add.assert_called_once()
        audit_log = db.add.call_args[0][0]
        assert isinstance(audit_log, AuditLog)
        assert audit_log.action == "test.action"
        assert audit_log.user_id == "user-123"
        assert audit_log.metadata == {"key": "value"}
        
        db.commit.assert_called_once()
    
    def test_verify_2fa_token(self):
        """Test 2FA token verification"""
        # This would require mocking pyotp
        with patch('pyotp.TOTP') as mock_totp:
            mock_totp_instance = Mock()
            mock_totp.return_value = mock_totp_instance
            mock_totp_instance.verify.return_value = True
            
            result = SecurityService.verify_2fa_token("secret", "123456")
            assert result is True
            
            mock_totp_instance.verify.assert_called_once_with("123456", valid_window=1)
    
    def test_cleanup_expired_sessions(self):
        """Test expired session cleanup"""
        db = Mock(spec=Session)
        
        SecurityService.cleanup_expired_sessions(db)
        
        # Verify query was constructed correctly
        db.query.assert_called_with(UserSession)
        db.query.return_value.filter.assert_called()
        db.query.return_value.filter.return_value.delete.assert_called()
        db.commit.assert_called_once()
    
    def test_verify_email_token(self):
        """Test email verification token validation"""
        db = Mock(spec=Session)
        token = "test-token"
        
        # Test valid token
        user = User()
        user.email_verification_token = token
        user.email_verified = False
        user.email_verification_sent_at = datetime.utcnow() - timedelta(hours=1)
        
        db.query.return_value.filter.return_value.first.return_value = user
        
        result = SecurityService.verify_email_token(db, token)
        assert result == user
        
        # Test expired token
        user.email_verification_sent_at = datetime.utcnow() - timedelta(hours=25)
        result = SecurityService.verify_email_token(db, token)
        assert result is None
        
        # Test no user found
        db.query.return_value.filter.return_value.first.return_value = None
        result = SecurityService.verify_email_token(db, token)
        assert result is None