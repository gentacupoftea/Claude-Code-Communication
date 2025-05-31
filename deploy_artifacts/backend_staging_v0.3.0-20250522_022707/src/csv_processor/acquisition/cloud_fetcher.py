import boto3
from google.cloud import storage as gcs
from google.oauth2 import service_account
import dropbox
from typing import List, Dict, Any, Optional
from pathlib import Path
import asyncio
from datetime import datetime
import re


class CloudFetcher:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.temp_dir = Path("/tmp/csv_processor/cloud")
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.file_pattern = config.get("file_pattern", r".*\.csv$")
        
        # Initialize cloud clients
        self.clients = {}
        if "s3" in config:
            self.clients["s3"] = self._init_s3(config["s3"])
        if "gcs" in config:
            self.clients["gcs"] = self._init_gcs(config["gcs"])
        if "dropbox" in config:
            self.clients["dropbox"] = self._init_dropbox(config["dropbox"])
            
    def _init_s3(self, config: Dict[str, Any]):
        """Initialize S3 client"""
        return boto3.client(
            's3',
            aws_access_key_id=config["access_key"],
            aws_secret_access_key=config["secret_key"],
            region_name=config.get("region", "us-east-1")
        )
        
    def _init_gcs(self, config: Dict[str, Any]):
        """Initialize Google Cloud Storage client"""
        credentials = service_account.Credentials.from_service_account_info(
            config["credentials"]
        )
        return gcs.Client(credentials=credentials)
        
    def _init_dropbox(self, config: Dict[str, Any]):
        """Initialize Dropbox client"""
        return dropbox.Dropbox(config["access_token"])
        
    async def fetch(self) -> List[Dict[str, Any]]:
        """Fetch CSV files from all configured cloud storage"""
        results = []
        
        for provider, client in self.clients.items():
            provider_config = self.config[provider]
            
            if provider == "s3":
                results.extend(await self._fetch_s3(client, provider_config))
            elif provider == "gcs":
                results.extend(await self._fetch_gcs(client, provider_config))
            elif provider == "dropbox":
                results.extend(await self._fetch_dropbox(client, provider_config))
                
        return results
        
    async def _fetch_s3(self, client, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch files from S3"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_s3_sync, client, config)
        
    def _fetch_s3_sync(self, client, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Synchronous S3 fetching"""
        results = []
        bucket_name = config["bucket"]
        prefix = config.get("prefix", "")
        
        try:
            # List objects in bucket
            paginator = client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket_name, Prefix=prefix)
            
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        key = obj['Key']
                        
                        if re.match(self.file_pattern, key):
                            filename = Path(key).name
                            local_path = self.temp_dir / filename
                            
                            # Download file
                            client.download_file(bucket_name, key, str(local_path))
                            
                            results.append({
                                "filename": filename,
                                "path": str(local_path),
                                "size": obj['Size'],
                                "cloud_path": f"s3://{bucket_name}/{key}",
                                "provider": "s3",
                                "last_modified": obj['LastModified'],
                                "fetched_at": datetime.utcnow(),
                            })
                            
        except Exception as e:
            raise Exception(f"S3 fetch error: {e}")
            
        return results
        
    async def _fetch_gcs(self, client, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch files from Google Cloud Storage"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_gcs_sync, client, config)
        
    def _fetch_gcs_sync(self, client, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Synchronous GCS fetching"""
        results = []
        bucket_name = config["bucket"]
        prefix = config.get("prefix", "")
        
        try:
            bucket = client.bucket(bucket_name)
            blobs = bucket.list_blobs(prefix=prefix)
            
            for blob in blobs:
                if re.match(self.file_pattern, blob.name):
                    filename = Path(blob.name).name
                    local_path = self.temp_dir / filename
                    
                    # Download file
                    blob.download_to_filename(str(local_path))
                    
                    results.append({
                        "filename": filename,
                        "path": str(local_path),
                        "size": blob.size,
                        "cloud_path": f"gs://{bucket_name}/{blob.name}",
                        "provider": "gcs",
                        "last_modified": blob.updated,
                        "fetched_at": datetime.utcnow(),
                    })
                    
        except Exception as e:
            raise Exception(f"GCS fetch error: {e}")
            
        return results
        
    async def _fetch_dropbox(self, client, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch files from Dropbox"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_dropbox_sync, client, config)
        
    def _fetch_dropbox_sync(self, client, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Synchronous Dropbox fetching"""
        results = []
        folder = config.get("folder", "")
        
        try:
            # List files in folder
            list_result = client.files_list_folder(folder)
            
            for entry in list_result.entries:
                if isinstance(entry, dropbox.files.FileMetadata):
                    if re.match(self.file_pattern, entry.name):
                        local_path = self.temp_dir / entry.name
                        
                        # Download file
                        metadata, response = client.files_download(entry.path_lower)
                        with open(local_path, 'wb') as f:
                            f.write(response.content)
                            
                        results.append({
                            "filename": entry.name,
                            "path": str(local_path),
                            "size": entry.size,
                            "cloud_path": entry.path_display,
                            "provider": "dropbox",
                            "last_modified": entry.server_modified,
                            "fetched_at": datetime.utcnow(),
                        })
                        
        except Exception as e:
            raise Exception(f"Dropbox fetch error: {e}")
            
        return results
        
    def cleanup(self):
        """Clean up temporary files"""
        for file in self.temp_dir.iterdir():
            if file.is_file():
                file.unlink()