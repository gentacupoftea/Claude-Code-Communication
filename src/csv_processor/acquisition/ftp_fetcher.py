import ftplib
import paramiko
from typing import List, Dict, Any, Optional
from pathlib import Path
import asyncio
from datetime import datetime
import re
import socket
import os

from ..exceptions import FTPFetchError, ConnectionError, TimeoutError
from ..utils import retry, get_logger, LogContext, PerformanceLogger

logger = get_logger(__name__)


class FTPFetcher:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.host = config["host"]
        self.port = config.get("port", 21)
        self.username = config["username"]
        self.password = config["password"]
        self.directory = config.get("directory", "/")
        self.file_pattern = config.get("file_pattern", r".*\.csv$")
        self.use_sftp = config.get("use_sftp", False)
        self.temp_dir = Path("/tmp/csv_processor/ftp")
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.connection = None
        self.perf_logger = PerformanceLogger(logger)
        
        logger.info(
            "FTPFetcher initialized",
            host=self.host,
            port=self.port,
            directory=self.directory,
            protocol="SFTP" if self.use_sftp else "FTP"
        )
    
    @retry(
        max_retries=3,
        retry_exceptions=[
            ConnectionError,
            TimeoutError,
            ftplib.error_temp,
            socket.timeout,
            socket.error,
            paramiko.SSHException
        ],
        initial_delay=2.0,
        backoff_factor=2.0
    )
    async def connect(self) -> None:
        """Connect to FTP/SFTP server with retry"""
        with LogContext(logger, operation="ftp_connect", host=self.host):
            try:
                logger.info(f"Connecting to {self.host}:{self.port}")
                
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._connect_sync)
                
                logger.info(f"Successfully connected to {'SFTP' if self.use_sftp else 'FTP'} server")
                
            except (ftplib.error_perm, paramiko.AuthenticationException) as e:
                error_msg = f"Authentication failed for {self.host}: {str(e)}"
                logger.error(error_msg, error=e)
                raise FTPFetchError(
                    error_msg,
                    host=self.host,
                    context={"error_type": "auth_error"}
                )
            
            except (socket.timeout, socket.error, ftplib.error_temp) as e:
                error_msg = f"Network error connecting to {self.host}: {str(e)}"
                logger.error(error_msg, error=e)
                raise TimeoutError(
                    error_msg,
                    timeout=30,
                    context={"host": self.host, "port": self.port}
                )
            
            except Exception as e:
                error_msg = f"Unexpected error connecting to FTP server: {str(e)}"
                logger.error(error_msg, error=e)
                raise FTPFetchError(
                    error_msg,
                    host=self.host,
                    original_exception=e
                )
    
    def _connect_sync(self) -> None:
        """Synchronous connection logic"""
        if self.use_sftp:
            self._connect_sftp()
        else:
            self._connect_ftp()
    
    def _connect_ftp(self) -> None:
        """Connect via FTP"""
        self.connection = ftplib.FTP()
        self.connection.connect(self.host, self.port)
        self.connection.login(self.username, self.password)
        self.connection.cwd(self.directory)
    
    def _connect_sftp(self) -> None:
        """Connect via SFTP"""
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            self.host,
            port=self.config.get("sftp_port", 22),
            username=self.username,
            password=self.password
        )
        self.connection = ssh.open_sftp()
        self.connection.chdir(self.directory)
        self._ssh_client = ssh  # Keep SSH client reference
    
    async def fetch(self) -> List[Dict[str, Any]]:
        """Fetch CSV files from FTP/SFTP server"""
        self.perf_logger.start_operation("ftp_fetch")
        
        try:
            # Ensure connection
            if not self.connection:
                await self.connect()
            
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(None, self._fetch_sync)
            
            self.perf_logger.end_operation(
                "ftp_fetch",
                status="success",
                file_count=len(results)
            )
            
            logger.info(
                f"Successfully fetched {len(results)} CSV files from FTP",
                file_count=len(results),
                protocol="SFTP" if self.use_sftp else "FTP"
            )
            
            return results
            
        except Exception as e:
            self.perf_logger.end_operation("ftp_fetch", status="error")
            
            if isinstance(e, FTPFetchError):
                raise
            
            error_msg = f"Failed to fetch files from FTP: {str(e)}"
            logger.error(error_msg, error=e)
            raise FTPFetchError(
                error_msg,
                host=self.host,
                original_exception=e
            )
    
    def _fetch_sync(self) -> List[Dict[str, Any]]:
        """Synchronous FTP/SFTP fetching"""
        if self.use_sftp:
            return self._fetch_sftp_files()
        else:
            return self._fetch_ftp_files()
    
    def _fetch_ftp_files(self) -> List[Dict[str, Any]]:
        """Fetch files via FTP with error handling"""
        results = []
        
        try:
            # List files in directory
            files = []
            self.connection.retrlines('LIST', lambda x: files.append(x))
            
            logger.info(f"Found {len(files)} files in {self.directory}")
            
            for file_info in files:
                try:
                    # Parse file info
                    parts = file_info.split()
                    filename = parts[-1]
                    
                    if not re.match(self.file_pattern, filename):
                        logger.debug(f"Skipping {filename} - doesn't match pattern")
                        continue
                    
                    file_data = self._download_ftp_file(filename)
                    if file_data:
                        results.append(file_data)
                        
                except Exception as e:
                    logger.warning(
                        f"Error processing file {filename}: {str(e)}",
                        filename=filename,
                        error=e
                    )
                    continue
            
            return results
            
        except ftplib.error_perm as e:
            error_msg = f"FTP permission error: {str(e)}"
            logger.error(error_msg, error=e)
            raise FTPFetchError(
                error_msg,
                host=self.host,
                context={"operation": "list_files"}
            )
        except Exception as e:
            error_msg = f"FTP error during fetch: {str(e)}"
            logger.error(error_msg, error=e)
            raise FTPFetchError(
                error_msg,
                host=self.host,
                original_exception=e
            )
    
    def _download_ftp_file(self, filename: str) -> Optional[Dict[str, Any]]:
        """Download a single file via FTP"""
        try:
            local_path = self.temp_dir / filename
            
            # Avoid overwriting existing files
            counter = 1
            while local_path.exists():
                name, ext = os.path.splitext(filename)
                local_path = self.temp_dir / f"{name}_{counter}{ext}"
                counter += 1
            
            # Download file
            with open(local_path, 'wb') as f:
                self.connection.retrbinary(f'RETR {filename}', f.write)
            
            # Get file size
            try:
                file_size = self.connection.size(filename)
            except:
                file_size = local_path.stat().st_size
            
            file_info = {
                "filename": filename,
                "path": str(local_path),
                "size": file_size,
                "remote_path": f"{self.directory}/{filename}",
                "fetched_at": datetime.utcnow(),
                "protocol": "FTP"
            }
            
            logger.debug(
                f"Downloaded file: {filename} ({file_size} bytes)",
                filename=filename,
                size=file_size
            )
            
            return file_info
            
        except Exception as e:
            logger.error(
                f"Failed to download file {filename}: {str(e)}",
                filename=filename,
                error=e
            )
            return None
    
    def _fetch_sftp_files(self) -> List[Dict[str, Any]]:
        """Fetch files via SFTP with error handling"""
        results = []
        
        try:
            # List files in directory
            files = self.connection.listdir_attr()
            
            logger.info(f"Found {len(files)} files in {self.directory}")
            
            for file_attr in files:
                try:
                    filename = file_attr.filename
                    
                    if not re.match(self.file_pattern, filename):
                        logger.debug(f"Skipping {filename} - doesn't match pattern")
                        continue
                    
                    file_data = self._download_sftp_file(filename, file_attr)
                    if file_data:
                        results.append(file_data)
                        
                except Exception as e:
                    logger.warning(
                        f"Error processing file {filename}: {str(e)}",
                        filename=filename,
                        error=e
                    )
                    continue
            
            return results
            
        except paramiko.SSHException as e:
            error_msg = f"SFTP error: {str(e)}"
            logger.error(error_msg, error=e)
            raise FTPFetchError(
                error_msg,
                host=self.host,
                context={"operation": "list_files", "protocol": "SFTP"}
            )
        except Exception as e:
            error_msg = f"SFTP error during fetch: {str(e)}"
            logger.error(error_msg, error=e)
            raise FTPFetchError(
                error_msg,
                host=self.host,
                original_exception=e
            )
    
    def _download_sftp_file(self, filename: str, file_attr) -> Optional[Dict[str, Any]]:
        """Download a single file via SFTP"""
        try:
            local_path = self.temp_dir / filename
            
            # Avoid overwriting existing files
            counter = 1
            while local_path.exists():
                name, ext = os.path.splitext(filename)
                local_path = self.temp_dir / f"{name}_{counter}{ext}"
                counter += 1
            
            # Download file
            self.connection.get(filename, str(local_path))
            
            file_info = {
                "filename": filename,
                "path": str(local_path),
                "size": file_attr.st_size,
                "remote_path": f"{self.directory}/{filename}",
                "modified_time": datetime.fromtimestamp(file_attr.st_mtime),
                "fetched_at": datetime.utcnow(),
                "protocol": "SFTP"
            }
            
            logger.debug(
                f"Downloaded file: {filename} ({file_attr.st_size} bytes)",
                filename=filename,
                size=file_attr.st_size
            )
            
            return file_info
            
        except Exception as e:
            logger.error(
                f"Failed to download file {filename}: {str(e)}",
                filename=filename,
                error=e
            )
            return None
    
    async def disconnect(self) -> None:
        """Disconnect from FTP/SFTP server"""
        if self.connection:
            try:
                if self.use_sftp:
                    self.connection.close()
                    if hasattr(self, '_ssh_client'):
                        self._ssh_client.close()
                else:
                    self.connection.quit()
                    
                logger.info(f"Disconnected from {'SFTP' if self.use_sftp else 'FTP'} server")
            except Exception as e:
                logger.warning(f"Error during disconnect: {str(e)}", error=e)
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