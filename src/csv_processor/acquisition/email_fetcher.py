import imaplib
import email
from email.header import decode_header
from typing import List, Dict, Any, Optional
import os
from pathlib import Path
import asyncio
from datetime import datetime
import re
import socket

from ..exceptions import EmailFetchError, ConnectionError, TimeoutError
from ..utils import retry, get_logger, LogContext, PerformanceLogger

logger = get_logger(__name__)


class EmailFetcher:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.server = config["server"]
        self.port = config.get("port", 993)
        self.username = config["username"]
        self.password = config["password"]
        self.folder = config.get("folder", "INBOX")
        self.file_pattern = config.get("file_pattern", r".*\.csv$")
        self.temp_dir = Path("/tmp/csv_processor/email")
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.connection = None
        self.perf_logger = PerformanceLogger(logger)
        
        logger.info(
            "EmailFetcher initialized",
            server=self.server,
            port=self.port,
            folder=self.folder
        )
    
    @retry(
        max_retries=3,
        retry_exceptions=[
            ConnectionError, 
            TimeoutError, 
            imaplib.IMAP4.error,
            socket.timeout,
            socket.error
        ],
        initial_delay=2.0,
        backoff_factor=2.0
    )
    async def connect(self) -> None:
        """Connect to email server with retry"""
        with LogContext(logger, operation="email_connect", server=self.server):
            try:
                logger.info(f"Connecting to {self.server}:{self.port}")
                
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._connect_sync)
                
                logger.info("Successfully connected to email server")
                
            except imaplib.IMAP4.error as e:
                error_msg = f"IMAP error connecting to {self.server}: {str(e)}"
                logger.error(error_msg, error=e)
                
                if "authentication" in str(e).lower() or "login" in str(e).lower():
                    raise EmailFetchError(
                        "Authentication failed",
                        server=self.server,
                        context={"error_type": "auth_error"}
                    )
                else:
                    raise ConnectionError(error_msg)
            
            except (socket.timeout, socket.error) as e:
                error_msg = f"Network error connecting to {self.server}: {str(e)}"
                logger.error(error_msg, error=e)
                raise TimeoutError(
                    error_msg,
                    timeout=30,
                    context={"server": self.server, "port": self.port}
                )
            
            except Exception as e:
                error_msg = f"Unexpected error connecting to email server: {str(e)}"
                logger.error(error_msg, error=e)
                raise EmailFetchError(
                    error_msg,
                    server=self.server,
                    original_exception=e
                )
    
    def _connect_sync(self) -> None:
        """Synchronous connection logic"""
        if self.port == 993:
            self.connection = imaplib.IMAP4_SSL(self.server, self.port)
        else:
            self.connection = imaplib.IMAP4(self.server, self.port)
        
        self.connection.login(self.username, self.password)
        self.connection.select(self.folder)
    
    async def fetch(self) -> List[Dict[str, Any]]:
        """Fetch CSV attachments from email"""
        self.perf_logger.start_operation("email_fetch")
        
        try:
            # Ensure connection
            if not self.connection:
                await self.connect()
            
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(None, self._fetch_sync)
            
            self.perf_logger.end_operation(
                "email_fetch",
                status="success",
                file_count=len(results)
            )
            
            logger.info(
                f"Successfully fetched {len(results)} CSV files from email",
                file_count=len(results)
            )
            
            return results
            
        except Exception as e:
            self.perf_logger.end_operation("email_fetch", status="error")
            
            if isinstance(e, EmailFetchError):
                raise
            
            error_msg = f"Failed to fetch emails: {str(e)}"
            logger.error(error_msg, error=e)
            raise EmailFetchError(
                error_msg,
                server=self.server,
                original_exception=e
            )
    
    def _fetch_sync(self) -> List[Dict[str, Any]]:
        """Synchronous email fetching with error handling"""
        results = []
        
        try:
            # Search for emails
            _, message_ids = self.connection.search(None, "ALL")
            
            if not message_ids[0]:
                logger.info("No messages found in folder", folder=self.folder)
                return results
            
            total_messages = len(message_ids[0].split())
            logger.info(f"Found {total_messages} messages to process")
            
            for idx, msg_id in enumerate(message_ids[0].split()):
                try:
                    logger.debug(f"Processing message {idx+1}/{total_messages}")
                    
                    _, msg_data = self.connection.fetch(msg_id, "(RFC822)")
                    
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            
                            # Process attachments
                            attachment_results = self._process_attachments(msg)
                            results.extend(attachment_results)
                            
                except Exception as e:
                    logger.warning(
                        f"Error processing message {msg_id}: {str(e)}",
                        message_id=msg_id,
                        error=e
                    )
                    continue
            
            return results
            
        except imaplib.IMAP4.error as e:
            error_msg = f"IMAP error during fetch: {str(e)}"
            logger.error(error_msg, error=e)
            raise EmailFetchError(
                error_msg,
                server=self.server,
                context={"operation": "fetch"}
            )
        except Exception as e:
            error_msg = f"Unexpected error during fetch: {str(e)}"
            logger.error(error_msg, error=e)
            raise EmailFetchError(
                error_msg,
                server=self.server,
                original_exception=e
            )
    
    def _process_attachments(self, msg: email.message.Message) -> List[Dict[str, Any]]:
        """Process email attachments with error handling"""
        results = []
        subject = msg.get("Subject", "")
        sender = msg.get("From", "")
        date = msg.get("Date", "")
        
        for part in msg.walk():
            try:
                if part.get_content_disposition() == "attachment":
                    filename = part.get_filename()
                    
                    if not filename:
                        logger.debug("Attachment without filename, skipping")
                        continue
                    
                    # Decode filename if needed
                    if isinstance(filename, bytes):
                        filename = filename.decode('utf-8', errors='ignore')
                    
                    if re.match(self.file_pattern, filename):
                        file_info = self._save_attachment(
                            part, filename, subject, sender, date
                        )
                        if file_info:
                            results.append(file_info)
                    else:
                        logger.debug(
                            f"Filename '{filename}' doesn't match pattern '{self.file_pattern}'"
                        )
                        
            except Exception as e:
                logger.warning(f"Error processing attachment: {str(e)}", error=e)
                continue
        
        return results
    
    def _save_attachment(self, part: email.message.Message, filename: str,
                        subject: str, sender: str, date: str) -> Optional[Dict[str, Any]]:
        """Save attachment to disk with error handling"""
        try:
            # Get attachment content
            content = part.get_payload(decode=True)
            
            if not content:
                logger.warning(f"Empty attachment: {filename}")
                return None
            
            # Generate safe filename
            safe_filename = self._sanitize_filename(filename)
            file_path = self.temp_dir / safe_filename
            
            # Avoid overwriting existing files
            counter = 1
            while file_path.exists():
                name, ext = os.path.splitext(safe_filename)
                file_path = self.temp_dir / f"{name}_{counter}{ext}"
                counter += 1
            
            # Save file
            with open(file_path, "wb") as f:
                f.write(content)
            
            file_info = {
                "filename": filename,
                "path": str(file_path),
                "size": len(content),
                "email_subject": subject,
                "email_from": sender,
                "email_date": date,
                "fetched_at": datetime.utcnow(),
            }
            
            logger.debug(
                f"Saved attachment: {filename} ({len(content)} bytes)",
                filename=filename,
                size=len(content)
            )
            
            return file_info
            
        except Exception as e:
            logger.error(
                f"Failed to save attachment {filename}: {str(e)}",
                filename=filename,
                error=e
            )
            return None
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        # Remove path components
        filename = os.path.basename(filename)
        
        # Replace unsafe characters
        safe_chars = re.sub(r'[^\w\s.-]', '_', filename)
        
        # Limit length
        if len(safe_chars) > 255:
            name, ext = os.path.splitext(safe_chars)
            safe_chars = name[:255-len(ext)] + ext
            
        return safe_chars
    
    async def disconnect(self) -> None:
        """Disconnect from email server"""
        if self.connection:
            try:
                self.connection.logout()
                logger.info("Disconnected from email server")
            except Exception as e:
                logger.warning(f"Error during logout: {str(e)}", error=e)
            finally:
                self.connection = None
    
    def cleanup(self):
        """Clean up temporary files"""
        try:
            for file in self.temp_dir.iterdir():
                if file.is_file():
                    file.unlink()
                    logger.debug(f"Deleted temp file: {file}")
            
            logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}", error=e)
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()
        if exc_type is None:
            self.cleanup()