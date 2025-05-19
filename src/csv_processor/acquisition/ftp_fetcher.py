import ftplib
import paramiko
from typing import List, Dict, Any, Optional
from pathlib import Path
import asyncio
from datetime import datetime
import re


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
        
    async def fetch(self) -> List[Dict[str, Any]]:
        """Fetch CSV files from FTP/SFTP server"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_sync)
        
    def _fetch_sync(self) -> List[Dict[str, Any]]:
        """Synchronous FTP/SFTP fetching"""
        if self.use_sftp:
            return self._fetch_sftp()
        else:
            return self._fetch_ftp()
            
    def _fetch_ftp(self) -> List[Dict[str, Any]]:
        """Fetch files via FTP"""
        results = []
        
        ftp = ftplib.FTP()
        try:
            ftp.connect(self.host, self.port)
            ftp.login(self.username, self.password)
            ftp.cwd(self.directory)
            
            # List files in directory
            files = []
            ftp.retrlines('LIST', lambda x: files.append(x))
            
            for file_info in files:
                # Parse file info
                parts = file_info.split()
                filename = parts[-1]
                
                if re.match(self.file_pattern, filename):
                    local_path = self.temp_dir / filename
                    
                    # Download file
                    with open(local_path, 'wb') as f:
                        ftp.retrbinary(f'RETR {filename}', f.write)
                        
                    # Get file size
                    file_size = ftp.size(filename)
                    
                    results.append({
                        "filename": filename,
                        "path": str(local_path),
                        "size": file_size,
                        "remote_path": f"{self.directory}/{filename}",
                        "fetched_at": datetime.utcnow(),
                    })
                    
            ftp.quit()
            
        except Exception as e:
            raise Exception(f"FTP fetch error: {e}")
            
        return results
        
    def _fetch_sftp(self) -> List[Dict[str, Any]]:
        """Fetch files via SFTP"""
        results = []
        
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            ssh.connect(
                self.host,
                port=self.config.get("sftp_port", 22),
                username=self.username,
                password=self.password
            )
            
            sftp = ssh.open_sftp()
            sftp.chdir(self.directory)
            
            # List files in directory
            files = sftp.listdir_attr()
            
            for file_attr in files:
                filename = file_attr.filename
                
                if re.match(self.file_pattern, filename):
                    local_path = self.temp_dir / filename
                    
                    # Download file
                    sftp.get(filename, str(local_path))
                    
                    results.append({
                        "filename": filename,
                        "path": str(local_path),
                        "size": file_attr.st_size,
                        "remote_path": f"{self.directory}/{filename}",
                        "modified_time": datetime.fromtimestamp(file_attr.st_mtime),
                        "fetched_at": datetime.utcnow(),
                    })
                    
            sftp.close()
            ssh.close()
            
        except Exception as e:
            raise Exception(f"SFTP fetch error: {e}")
            
        return results
        
    def cleanup(self):
        """Clean up temporary files"""
        for file in self.temp_dir.iterdir():
            if file.is_file():
                file.unlink()