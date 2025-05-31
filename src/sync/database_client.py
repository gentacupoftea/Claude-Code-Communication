"""
Database Client - Database interface for sync operations.

This module provides a client for interacting with the database,
implementing the operations needed for sync job tracking and status management.
"""

import logging
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime


class DatabaseClient:
    """
    Client for interacting with the database for sync operations.
    
    This client provides methods for storing and retrieving sync jobs,
    entity sync status, and other sync-related data.
    """
    
    def __init__(
        self,
        db_connection,
        table_prefix: str = "sync_"
    ):
        """
        Initialize the database client.
        
        Args:
            db_connection: Database connection object
            table_prefix: Prefix for sync-related tables
        """
        self.db = db_connection
        self.table_prefix = table_prefix
        
        # Define table names
        self.jobs_table = f"{table_prefix}jobs"
        self.entity_status_table = f"{table_prefix}entity_status"
        
        # Setup logging
        self.logger = logging.getLogger("DatabaseClient")
        
        # Ensure tables exist
        self._ensure_tables_exist()
    
    def _ensure_tables_exist(self) -> None:
        """
        Ensure required database tables exist, creating them if necessary.
        """
        try:
            # Create jobs table if not exists
            self.db.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.jobs_table} (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    filter_criteria TEXT,
                    sync_all INTEGER NOT NULL DEFAULT 0,
                    since_timestamp TEXT,
                    conflict_strategy TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT,
                    total_entities INTEGER NOT NULL DEFAULT 0,
                    processed_entities INTEGER NOT NULL DEFAULT 0,
                    successful_entities INTEGER NOT NULL DEFAULT 0,
                    failed_entities INTEGER NOT NULL DEFAULT 0,
                    conflicts INTEGER NOT NULL DEFAULT 0,
                    error_details TEXT,
                    priority INTEGER NOT NULL DEFAULT 1
                )
            """)
            
            # Create entity status table if not exists
            self.db.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.entity_status_table} (
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    last_sync TEXT,
                    shopify_updated_at TEXT,
                    external_updated_at TEXT,
                    shopify_hash TEXT,
                    external_hash TEXT,
                    sync_status TEXT,
                    PRIMARY KEY (entity_type, entity_id)
                )
            """)
            
            # Create indexes for efficient queries
            self.db.execute(f"""
                CREATE INDEX IF NOT EXISTS idx_{self.jobs_table}_status_entity_type 
                ON {self.jobs_table} (status, entity_type)
            """)
            
            self.db.execute(f"""
                CREATE INDEX IF NOT EXISTS idx_{self.jobs_table}_created_at 
                ON {self.jobs_table} (created_at DESC)
            """)
            
            self.db.execute(f"""
                CREATE INDEX IF NOT EXISTS idx_{self.entity_status_table}_last_sync 
                ON {self.entity_status_table} (last_sync DESC)
            """)
            
            self.db.commit()
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error ensuring database tables: {e}")
            raise
    
    def insert_sync_job(self, job: Dict[str, Any]) -> bool:
        """
        Insert a new sync job into the database.
        
        Args:
            job: Sync job data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert dict fields to JSON
            job_data = job.copy()
            
            if isinstance(job_data.get("filter_criteria"), dict):
                job_data["filter_criteria"] = json.dumps(job_data["filter_criteria"])
            
            if isinstance(job_data.get("error_details"), list):
                job_data["error_details"] = json.dumps(job_data["error_details"])
            
            # Convert boolean to integer for SQLite
            if "sync_all" in job_data:
                job_data["sync_all"] = 1 if job_data["sync_all"] else 0
            
            # Create placeholders for insert
            placeholders = ", ".join(["?"] * len(job_data))
            columns = ", ".join(job_data.keys())
            values = list(job_data.values())
            
            # Execute insert
            self.db.execute(
                f"INSERT INTO {self.jobs_table} ({columns}) VALUES ({placeholders})",
                values
            )
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error inserting sync job: {e}")
            return False
    
    def update_sync_job(self, job: Dict[str, Any]) -> bool:
        """
        Update an existing sync job in the database.
        
        Args:
            job: Updated sync job data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert dict fields to JSON
            job_data = job.copy()
            
            if isinstance(job_data.get("filter_criteria"), dict):
                job_data["filter_criteria"] = json.dumps(job_data["filter_criteria"])
            
            if isinstance(job_data.get("error_details"), list):
                job_data["error_details"] = json.dumps(job_data["error_details"])
            
            # Convert boolean to integer for SQLite
            if "sync_all" in job_data:
                job_data["sync_all"] = 1 if job_data["sync_all"] else 0
            
            # Extract job ID
            job_id = job_data.pop("id")
            
            # Create SET clause for update
            set_clause = ", ".join([f"{column} = ?" for column in job_data.keys()])
            values = list(job_data.values()) + [job_id]
            
            # Execute update
            self.db.execute(
                f"UPDATE {self.jobs_table} SET {set_clause} WHERE id = ?",
                values
            )
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error updating sync job: {e}")
            return False
    
    def get_sync_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a sync job by ID.
        
        Args:
            job_id: ID of the sync job
            
        Returns:
            Sync job data or None if not found
        """
        try:
            cursor = self.db.execute(
                f"SELECT * FROM {self.jobs_table} WHERE id = ?",
                (job_id,)
            )
            row = cursor.fetchone()
            
            if not row:
                return None
            
            # Convert row to dict
            job = {column[0]: row[i] for i, column in enumerate(cursor.description)}
            
            # Parse JSON fields
            if job.get("filter_criteria"):
                try:
                    job["filter_criteria"] = json.loads(job["filter_criteria"])
                except json.JSONDecodeError:
                    job["filter_criteria"] = {}
            
            if job.get("error_details"):
                try:
                    job["error_details"] = json.loads(job["error_details"])
                except json.JSONDecodeError:
                    job["error_details"] = []
            
            # Convert SQLite integer to boolean
            if "sync_all" in job:
                job["sync_all"] = bool(job["sync_all"])
            
            return job
            
        except Exception as e:
            self.logger.error(f"Error getting sync job: {e}")
            return None
    
    def get_sync_jobs(
        self,
        status: Optional[str] = None,
        entity_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get sync jobs with optional filtering.
        
        Args:
            status: Filter by job status
            entity_type: Filter by entity type
            limit: Maximum number of jobs to return
            offset: Offset for pagination
            
        Returns:
            List of matching sync jobs
        """
        try:
            query = f"SELECT * FROM {self.jobs_table}"
            params = []
            
            # Add filters if provided
            filters = []
            if status:
                filters.append("status = ?")
                params.append(status)
            
            if entity_type:
                filters.append("entity_type = ?")
                params.append(entity_type)
            
            if filters:
                query += " WHERE " + " AND ".join(filters)
            
            # Add order and limit
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            # Execute query
            cursor = self.db.execute(query, params)
            rows = cursor.fetchall()
            
            # Convert rows to dicts
            jobs = []
            for row in rows:
                job = {column[0]: row[i] for i, column in enumerate(cursor.description)}
                
                # Parse JSON fields
                if job.get("filter_criteria"):
                    try:
                        job["filter_criteria"] = json.loads(job["filter_criteria"])
                    except json.JSONDecodeError:
                        job["filter_criteria"] = {}
                
                if job.get("error_details"):
                    try:
                        job["error_details"] = json.loads(job["error_details"])
                    except json.JSONDecodeError:
                        job["error_details"] = []
                
                # Convert SQLite integer to boolean
                if "sync_all" in job:
                    job["sync_all"] = bool(job["sync_all"])
                
                jobs.append(job)
            
            return jobs
            
        except Exception as e:
            self.logger.error(f"Error getting sync jobs: {e}")
            return []
    
    def get_last_successful_sync(self, entity_type: str) -> Optional[Dict[str, Any]]:
        """
        Get the most recent successful sync job for an entity type.
        
        Args:
            entity_type: Type of entity
            
        Returns:
            Most recent successful sync job or None if none found
        """
        try:
            cursor = self.db.execute(
                f"""
                SELECT * FROM {self.jobs_table}
                WHERE entity_type = ? AND status = 'completed'
                ORDER BY completed_at DESC
                LIMIT 1
                """,
                (entity_type,)
            )
            row = cursor.fetchone()
            
            if not row:
                return None
            
            # Convert row to dict
            job = {column[0]: row[i] for i, column in enumerate(cursor.description)}
            
            # Parse JSON fields
            if job.get("filter_criteria"):
                try:
                    job["filter_criteria"] = json.loads(job["filter_criteria"])
                except json.JSONDecodeError:
                    job["filter_criteria"] = {}
            
            if job.get("error_details"):
                try:
                    job["error_details"] = json.loads(job["error_details"])
                except json.JSONDecodeError:
                    job["error_details"] = []
            
            # Convert SQLite integer to boolean
            if "sync_all" in job:
                job["sync_all"] = bool(job["sync_all"])
            
            return job
            
        except Exception as e:
            self.logger.error(f"Error getting last successful sync: {e}")
            return None
    
    def delete_old_sync_jobs(self, cutoff_date: datetime) -> int:
        """
        Delete sync jobs older than the cutoff date.
        
        Args:
            cutoff_date: Date before which to delete jobs
            
        Returns:
            Number of jobs deleted
        """
        try:
            cutoff_str = cutoff_date.isoformat()
            
            # Count records to be deleted
            cursor = self.db.execute(
                f"SELECT COUNT(*) FROM {self.jobs_table} WHERE created_at < ?",
                (cutoff_str,)
            )
            count = cursor.fetchone()[0]
            
            # Delete old records
            self.db.execute(
                f"DELETE FROM {self.jobs_table} WHERE created_at < ?",
                (cutoff_str,)
            )
            self.db.commit()
            
            return count
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error deleting old sync jobs: {e}")
            return 0
    
    def get_entity_sync_status(
        self,
        entity_type: str,
        entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get the sync status for a specific entity.
        
        Args:
            entity_type: Type of entity
            entity_id: ID of the entity
            
        Returns:
            Entity sync status or None if not found
        """
        try:
            cursor = self.db.execute(
                f"""
                SELECT * FROM {self.entity_status_table}
                WHERE entity_type = ? AND entity_id = ?
                """,
                (entity_type, entity_id)
            )
            row = cursor.fetchone()
            
            if not row:
                return None
            
            # Convert row to dict
            return {column[0]: row[i] for i, column in enumerate(cursor.description)}
            
        except Exception as e:
            self.logger.error(f"Error getting entity sync status: {e}")
            return None
    
    def update_entity_sync_status(self, status: Dict[str, Any]) -> bool:
        """
        Update the sync status for an entity.
        
        Args:
            status: Entity sync status data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create placeholders for insert or replace
            placeholders = ", ".join(["?"] * len(status))
            columns = ", ".join(status.keys())
            values = list(status.values())
            
            # Execute insert or replace
            self.db.execute(
                f"""
                INSERT OR REPLACE INTO {self.entity_status_table} ({columns})
                VALUES ({placeholders})
                """,
                values
            )
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error updating entity sync status: {e}")
            return False
    
    def delete_entity_sync_status(
        self,
        entity_type: str,
        entity_id: str
    ) -> bool:
        """
        Delete the sync status for an entity.
        
        Args:
            entity_type: Type of entity
            entity_id: ID of the entity
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.db.execute(
                f"""
                DELETE FROM {self.entity_status_table}
                WHERE entity_type = ? AND entity_id = ?
                """,
                (entity_type, entity_id)
            )
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error deleting entity sync status: {e}")
            return False