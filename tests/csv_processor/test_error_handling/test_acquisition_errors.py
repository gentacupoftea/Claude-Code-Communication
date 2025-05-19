"""
Test cases for acquisition error handling
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import imaplib
import ftplib
import socket

from csv_processor.acquisition import EmailFetcher, FTPFetcher
from csv_processor.exceptions import (
    EmailFetchError,
    FTPFetchError,
    ConnectionError,
    TimeoutError
)


class TestEmailFetcherErrorHandling:
    
    @pytest.fixture
    def email_config(self):
        return {
            "server": "imap.example.com",
            "port": 993,
            "username": "test@example.com",
            "password": "password",
            "folder": "INBOX"
        }
    
    @pytest.fixture
    def email_fetcher(self, email_config):
        return EmailFetcher(email_config)
    
    @pytest.mark.asyncio
    async def test_connection_error_retry(self, email_fetcher):
        """Test connection error triggers retry"""
        with patch('imaplib.IMAP4_SSL') as mock_imap:
            # First two calls fail, third succeeds
            mock_conn = Mock()
            mock_imap.side_effect = [
                socket.error("Connection refused"),
                socket.timeout("Timeout"),
                mock_conn
            ]
            
            await email_fetcher.connect()
            
            assert mock_imap.call_count == 3
            assert email_fetcher.connection == mock_conn
    
    @pytest.mark.asyncio
    async def test_authentication_error_no_retry(self, email_fetcher):
        """Test authentication error doesn't trigger retry"""
        with patch('imaplib.IMAP4_SSL') as mock_imap:
            mock_conn = Mock()
            mock_conn.login.side_effect = imaplib.IMAP4.error("Authentication failed")
            mock_imap.return_value = mock_conn
            
            with pytest.raises(EmailFetchError) as exc_info:
                await email_fetcher.connect()
            
            assert exc_info.value.error_code == "EMAIL_FETCH_ERROR"
            assert "Authentication failed" in str(exc_info.value)
            assert mock_imap.call_count == 1  # No retry for auth errors
    
    @pytest.mark.asyncio
    async def test_fetch_partial_success(self, email_fetcher):
        """Test fetch continues with partial success"""
        # Mock connection
        email_fetcher.connection = Mock()
        
        # Mock email data - one succeeds, one fails
        email_fetcher.connection.search.return_value = ('OK', [b'1 2'])
        
        def fetch_side_effect(msg_id, *args):
            if msg_id == b'1':
                return ('OK', [(b'1', b'email data 1')])
            else:
                raise imaplib.IMAP4.error("Message fetch failed")
        
        email_fetcher.connection.fetch.side_effect = fetch_side_effect
        
        with patch.object(email_fetcher, '_process_attachments') as mock_process:
            mock_process.return_value = [{"filename": "test.csv"}]
            
            results = await email_fetcher.fetch()
            
            # Should process successful message despite one failure
            assert len(results) == 1
            assert results[0]["filename"] == "test.csv"
    
    @pytest.mark.asyncio
    async def test_network_timeout_handling(self, email_fetcher):
        """Test network timeout handling"""
        with patch('imaplib.IMAP4_SSL') as mock_imap:
            mock_imap.side_effect = socket.timeout("Connection timed out")
            
            with pytest.raises(TimeoutError) as exc_info:
                await email_fetcher.connect()
            
            assert exc_info.value.error_code == "TIMEOUT_ERROR"
            assert "Connection timed out" in str(exc_info.value)
    
    def test_attachment_processing_error_handling(self, email_fetcher):
        """Test attachment processing continues on individual errors"""
        # Create mock email message with attachments
        mock_msg = Mock()
        mock_msg.get.side_effect = lambda key, default="": {
            "Subject": "Test Email",
            "From": "sender@example.com",
            "Date": "2024-01-01"
        }.get(key, default)
        
        # Mock parts - one valid, one causing error
        valid_part = Mock()
        valid_part.get_content_disposition.return_value = "attachment"
        valid_part.get_filename.return_value = "valid.csv"
        valid_part.get_payload.return_value = b"csv data"
        
        error_part = Mock()
        error_part.get_content_disposition.return_value = "attachment"
        error_part.get_filename.side_effect = Exception("Decode error")
        
        mock_msg.walk.return_value = [valid_part, error_part]
        
        results = email_fetcher._process_attachments(mock_msg)
        
        # Should process valid attachment despite error
        assert len(results) == 1
        assert results[0]["filename"] == "valid.csv"


class TestFTPFetcherErrorHandling:
    
    @pytest.fixture
    def ftp_config(self):
        return {
            "host": "ftp.example.com",
            "port": 21,
            "username": "ftpuser",
            "password": "password",
            "directory": "/data"
        }
    
    @pytest.fixture
    def ftp_fetcher(self, ftp_config):
        return FTPFetcher(ftp_config)
    
    @pytest.mark.asyncio
    async def test_ftp_connection_retry(self, ftp_fetcher):
        """Test FTP connection retry on temporary errors"""
        with patch('ftplib.FTP') as mock_ftp:
            mock_conn = Mock()
            mock_ftp.return_value = mock_conn
            
            # Simulate temporary connection errors
            mock_conn.connect.side_effect = [
                ftplib.error_temp("421 Service not available"),
                socket.error("Connection reset"),
                None  # Success on third attempt
            ]
            
            await ftp_fetcher.connect()
            
            assert mock_conn.connect.call_count == 3
    
    @pytest.mark.asyncio
    async def test_ftp_auth_error_no_retry(self, ftp_fetcher):
        """Test FTP authentication error doesn't retry"""
        with patch('ftplib.FTP') as mock_ftp:
            mock_conn = Mock()
            mock_ftp.return_value = mock_conn
            mock_conn.login.side_effect = ftplib.error_perm("530 Login incorrect")
            
            with pytest.raises(FTPFetchError) as exc_info:
                await ftp_fetcher.connect()
            
            assert "Authentication failed" in str(exc_info.value)
            assert mock_conn.connect.call_count == 1  # No retry
    
    @pytest.mark.asyncio
    async def test_ftp_file_download_error_handling(self, ftp_fetcher):
        """Test FTP file download error handling"""
        ftp_fetcher.connection = Mock()
        
        # Mock file listing
        ftp_fetcher.connection.nlst.return_value = ["file1.csv", "file2.csv"]
        
        # First file fails, second succeeds
        def retrbinary_side_effect(cmd, callback):
            if "file1.csv" in cmd:
                raise ftplib.error_temp("Transfer failed")
            else:
                callback(b"file data")
        
        ftp_fetcher.connection.retrbinary.side_effect = retrbinary_side_effect
        ftp_fetcher.connection.size.return_value = 1000
        
        results = await ftp_fetcher.fetch()
        
        # Should have one successful download
        assert len(results) == 1
        assert results[0]["filename"] == "file2.csv"
    
    @pytest.mark.asyncio
    async def test_sftp_connection_error_handling(self, ftp_fetcher):
        """Test SFTP connection error handling"""
        ftp_fetcher.use_sftp = True
        
        with patch('paramiko.SSHClient') as mock_ssh:
            mock_client = Mock()
            mock_ssh.return_value = mock_client
            mock_client.connect.side_effect = paramiko.SSHException("Connection failed")
            
            with pytest.raises(TimeoutError):  # Wrapped as timeout error
                await ftp_fetcher.connect()
    
    def test_ftp_directory_listing_error(self, ftp_fetcher):
        """Test FTP directory listing error handling"""
        ftp_fetcher.connection = Mock()
        ftp_fetcher.connection.retrlines.side_effect = ftplib.error_perm("550 Directory not found")
        
        with pytest.raises(FTPFetchError) as exc_info:
            ftp_fetcher._fetch_ftp_files()
        
        assert "permission error" in str(exc_info.value).lower()
        assert exc_info.value.context["operation"] == "list_files"


class TestAcquisitionManagerErrorHandling:
    
    @pytest.mark.asyncio
    async def test_partial_source_failure(self):
        """Test acquisition manager handles partial source failures"""
        from csv_processor.acquisition import AcquisitionManager
        
        config = {
            "email": {"enabled": True},
            "ftp": {"enabled": True}
        }
        
        manager = AcquisitionManager(config)
        
        # Mock fetchers
        mock_email_fetcher = AsyncMock()
        mock_ftp_fetcher = AsyncMock()
        
        # Email succeeds, FTP fails
        mock_email_fetcher.fetch.return_value = [{"filename": "email.csv"}]
        mock_ftp_fetcher.fetch.side_effect = FTPFetchError("FTP failed")
        
        manager.fetchers = {
            "email": mock_email_fetcher,
            "ftp": mock_ftp_fetcher
        }
        
        results = await manager.fetch_all()
        
        # Should return results from successful source
        assert len(results) == 1
        assert results[0]["filename"] == "email.csv"
        assert results[0]["source"] == "email"
    
    @pytest.mark.asyncio
    async def test_unknown_source_error(self):
        """Test acquisition manager handles unknown source error"""
        from csv_processor.acquisition import AcquisitionManager
        
        manager = AcquisitionManager({})
        
        with pytest.raises(ValueError) as exc_info:
            await manager.fetch_from_source("unknown_source")
        
        assert "Unknown source" in str(exc_info.value)