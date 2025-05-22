"""
Sync Manager - Core synchronization management module.

This module provides the core functionality for managing data synchronization
between Shopify and other systems, with support for incremental syncing,
batching, retry handling, and conflict resolution.
"""

import time
import logging
import hashlib
import json
import uuid
import threading
import queue
from typing import Dict, List, Any, Optional, Callable, Tuple, Union, Set
from datetime import datetime, timedelta
from enum import Enum


class SyncDirection(Enum):
    """Enumeration of sync directions."""
    SHOPIFY_TO_EXTERNAL = "shopify_to_external"
    EXTERNAL_TO_SHOPIFY = "external_to_shopify"
    BIDIRECTIONAL = "bidirectional"


class SyncStatus(Enum):
    """Enumeration of sync job statuses."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


class ConflictResolutionStrategy(Enum):
    """Enumeration of conflict resolution strategies."""
    SHOPIFY_WINS = "shopify_wins"
    EXTERNAL_WINS = "external_wins"
    NEWEST_WINS = "newest_wins"
    MANUAL = "manual"


class SyncManager:
    """
    Core synchronization manager for handling data sync operations.
    
    This class manages the synchronization of data between Shopify and
    external systems, handling incremental syncs, batching, retries,
    and conflict resolution.
    """
    
    def __init__(
        self,
        shopify_client=None,
        external_client=None,
        cache_manager=None,
        database_client=None,
        batch_size: int = 50,
        max_retries: int = 3,
        retry_delay: int = 5,
        sync_history_retention: int = 30,  # days
        workers: int = 2,
        conflict_strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.NEWEST_WINS
    ):
        """
        Initialize the Sync Manager.
        
        Args:
            shopify_client: Client for Shopify API
            external_client: Client for external system API
            cache_manager: Cache manager for storing sync state
            database_client: Database client for persistent storage
            batch_size: Number of items to process in each batch
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            sync_history_retention: Number of days to retain sync history
            workers: Number of worker threads for parallel processing
            conflict_strategy: Strategy for resolving conflicts
        """
        self.shopify_client = shopify_client
        self.external_client = external_client
        self.cache_manager = cache_manager
        self.database_client = database_client
        
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.sync_history_retention = sync_history_retention
        self.workers = workers
        self.conflict_strategy = conflict_strategy
        
        # Active sync jobs
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        
        # Thread-safe queues for worker threads
        self.task_queue = queue.Queue()
        self.result_queue = queue.Queue()
        
        # Thread pool for parallel processing
        self.worker_threads = []
        self.running = False
        
        # Locks for thread safety
        self.job_lock = threading.RLock()
        
        # Setup logging
        self.logger = logging.getLogger("SyncManager")
    
    def start_workers(self) -> None:
        """Start worker threads for processing sync tasks."""
        if self.running:
            return
        
        self.running = True
        self.worker_threads = []
        
        for i in range(self.workers):
            thread = threading.Thread(
                target=self._worker_loop,
                daemon=True,
                name=f"SyncWorker-{i+1}"
            )
            thread.start()
            self.worker_threads.append(thread)
        
        self.logger.info(f"Started {self.workers} sync worker threads")
    
    def stop_workers(self, wait: bool = True) -> None:
        """
        Stop worker threads.
        
        Args:
            wait: Whether to wait for threads to finish
        """
        if not self.running:
            return
        
        self.running = False
        
        # Add termination signals to queue
        for _ in range(self.workers):
            self.task_queue.put(None)
        
        if wait:
            for thread in self.worker_threads:
                thread.join(timeout=10)
                
        self.worker_threads = []
        self.logger.info("Stopped sync worker threads")
    
    def create_sync_job(
        self,
        entity_type: str,
        direction: SyncDirection,
        filter_criteria: Optional[Dict[str, Any]] = None,
        sync_all: bool = False,
        since_timestamp: Optional[datetime] = None,
        conflict_strategy: Optional[ConflictResolutionStrategy] = None,
        priority: int = 1
    ) -> str:
        """
        Create a new synchronization job.
        
        Args:
            entity_type: Type of entity to synchronize (products, orders, etc.)
            direction: Direction of synchronization
            filter_criteria: Optional criteria to filter entities
            sync_all: Whether to sync all entities (vs. incremental)
            since_timestamp: For incremental sync, only since this time
            conflict_strategy: Strategy for resolving conflicts
            priority: Job priority (lower number = higher priority)
            
        Returns:
            Job ID for the created sync job
        """
        job_id = str(uuid.uuid4())
        
        # Create job record
        job = {
            "id": job_id,
            "entity_type": entity_type,
            "direction": direction,
            "filter_criteria": filter_criteria or {},
            "sync_all": sync_all,
            "since_timestamp": since_timestamp.isoformat() if since_timestamp else None,
            "conflict_strategy": (conflict_strategy or self.conflict_strategy).value,
            "status": SyncStatus.PENDING.value,
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "total_entities": 0,
            "processed_entities": 0,
            "successful_entities": 0,
            "failed_entities": 0,
            "conflicts": 0,
            "error_details": [],
            "priority": priority
        }
        
        # Store job in active jobs
        with self.job_lock:
            self.active_jobs[job_id] = job
        
        # Store in database for persistence
        if self.database_client:
            self.database_client.insert_sync_job(job)
        
        self.logger.info(f"Created sync job {job_id} for {entity_type} ({direction.value})")
        
        # Queue the job for execution
        self._queue_job(job_id)
        
        return job_id
    
    def get_sync_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get details for a specific sync job.
        
        Args:
            job_id: ID of the sync job
            
        Returns:
            Job details or None if not found
        """
        with self.job_lock:
            if job_id in self.active_jobs:
                return self.active_jobs[job_id].copy()
        
        # Try to get from database if not in active jobs
        if self.database_client:
            return self.database_client.get_sync_job(job_id)
        
        return None
    
    def get_sync_jobs(
        self,
        status: Optional[SyncStatus] = None,
        entity_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get a list of sync jobs with optional filtering.
        
        Args:
            status: Filter by job status
            entity_type: Filter by entity type
            limit: Maximum number of jobs to return
            offset: Offset for pagination
            
        Returns:
            List of matching sync jobs
        """
        result = []
        
        # Start with jobs from database for complete history
        if self.database_client:
            # Convert enum to string value if needed
            status_val = status.value if status else None
            db_jobs = self.database_client.get_sync_jobs(
                status=status_val,
                entity_type=entity_type,
                limit=limit,
                offset=offset
            )
            result.extend(db_jobs)
        
        # Add active jobs not yet in database
        with self.job_lock:
            for job in self.active_jobs.values():
                # Skip if doesn't match filters
                if status and job["status"] != status.value:
                    continue
                if entity_type and job["entity_type"] != entity_type:
                    continue
                
                # Add if not already in results
                if not any(j["id"] == job["id"] for j in result):
                    result.append(job.copy())
        
        # Sort by created_at descending
        result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        # Apply limit and offset
        return result[offset:offset+limit]
    
    def cancel_sync_job(self, job_id: str) -> bool:
        """
        Cancel a running or pending sync job.
        
        Args:
            job_id: ID of the sync job to cancel
            
        Returns:
            True if job was cancelled, False otherwise
        """
        with self.job_lock:
            if job_id not in self.active_jobs:
                return False
            
            job = self.active_jobs[job_id]
            
            # Only cancel if pending or in progress
            if job["status"] not in [SyncStatus.PENDING.value, SyncStatus.IN_PROGRESS.value]:
                return False
            
            job["status"] = SyncStatus.CANCELLED.value
            job["completed_at"] = datetime.now().isoformat()
            
            # Update in database
            if self.database_client:
                self.database_client.update_sync_job(job)
            
            self.logger.info(f"Cancelled sync job {job_id}")
            return True
    
    def get_sync_status(
        self,
        entity_type: str,
        entity_id: str
    ) -> Dict[str, Any]:
        """
        Get the sync status for a specific entity.
        
        Args:
            entity_type: Type of entity (products, orders, etc.)
            entity_id: ID of the entity
            
        Returns:
            Dictionary with sync status information
        """
        key = f"sync_status:{entity_type}:{entity_id}"
        
        # Try to get from cache first
        if self.cache_manager:
            status = self.cache_manager.get(key)
            if status:
                return status
        
        # Fall back to database
        if self.database_client:
            status = self.database_client.get_entity_sync_status(entity_type, entity_id)
            
            # Cache the result if found
            if status and self.cache_manager:
                self.cache_manager.set(key, status, ttl=3600)  # 1 hour TTL
            
            if status:
                return status
        
        # No status found
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "last_sync": None,
            "shopify_updated_at": None,
            "external_updated_at": None,
            "shopify_hash": None,
            "external_hash": None,
            "sync_status": "unknown"
        }
    
    def mark_entity_synced(
        self,
        entity_type: str,
        entity_id: str,
        shopify_data: Optional[Dict[str, Any]] = None,
        external_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Mark an entity as successfully synchronized.
        
        Args:
            entity_type: Type of entity
            entity_id: ID of the entity
            shopify_data: Current Shopify data for the entity
            external_data: Current external system data for the entity
            
        Returns:
            Updated sync status
        """
        now = datetime.now().isoformat()
        
        # Calculate data hashes for change detection
        shopify_hash = self._calculate_hash(shopify_data) if shopify_data else None
        external_hash = self._calculate_hash(external_data) if external_data else None
        
        status = {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "last_sync": now,
            "shopify_updated_at": shopify_data.get("updated_at") if shopify_data else None,
            "external_updated_at": external_data.get("updated_at") if external_data else None,
            "shopify_hash": shopify_hash,
            "external_hash": external_hash,
            "sync_status": "synced"
        }
        
        # Save to database
        if self.database_client:
            self.database_client.update_entity_sync_status(status)
        
        # Update cache
        if self.cache_manager:
            key = f"sync_status:{entity_type}:{entity_id}"
            self.cache_manager.set(key, status, ttl=3600)  # 1 hour TTL
        
        return status
    
    def _queue_job(self, job_id: str) -> None:
        """
        Queue a job for execution by worker threads.
        
        Args:
            job_id: ID of the sync job to queue
        """
        if not self.running:
            self.start_workers()
        
        # Ensure task is added to the queue
        self.task_queue.put(("process_job", job_id))
        self.logger.debug(f"Queued job {job_id} for processing")
    
    def _worker_loop(self) -> None:
        """Worker thread function to process tasks from the queue."""
        while self.running:
            try:
                # Get task from queue with timeout
                try:
                    task = self.task_queue.get(timeout=1)
                except queue.Empty:
                    continue
                
                # None is a signal to terminate
                if task is None:
                    break
                
                # Process the task
                task_type, *args = task
                
                if task_type == "process_job":
                    job_id = args[0]
                    self._process_sync_job(job_id)
                elif task_type == "process_batch":
                    job_id, batch_data = args
                    self._process_batch(job_id, batch_data)
                
                # Mark task as done
                self.task_queue.task_done()
                
            except Exception as e:
                self.logger.exception(f"Error in sync worker thread: {e}")
    
    def _process_sync_job(self, job_id: str) -> None:
        """
        Process a sync job.
        
        Args:
            job_id: ID of the sync job to process
        """
        # Get job details
        with self.job_lock:
            if job_id not in self.active_jobs:
                self.logger.warning(f"Job {job_id} not found in active jobs")
                return
            
            job = self.active_jobs[job_id]
            
            # Check if job is still pending
            if job["status"] != SyncStatus.PENDING.value:
                self.logger.info(f"Skipping job {job_id} with status {job['status']}")
                return
            
            # Mark as in progress
            job["status"] = SyncStatus.IN_PROGRESS.value
            job["started_at"] = datetime.now().isoformat()
        
        # Update job in database
        if self.database_client:
            self.database_client.update_sync_job(job)
        
        self.logger.info(f"Processing sync job {job_id}")
        
        try:
            # Get entities to sync based on criteria
            entities = self._get_entities_for_sync(job)
            
            if not entities:
                self.logger.info(f"No entities to sync for job {job_id}")
                self._complete_job(job_id, SyncStatus.COMPLETED)
                return
            
            # Update total entity count
            with self.job_lock:
                job = self.active_jobs[job_id]
                job["total_entities"] = len(entities)
            
            if self.database_client:
                self.database_client.update_sync_job(job)
            
            # Process entities in batches
            for i in range(0, len(entities), self.batch_size):
                batch = entities[i:i+self.batch_size]
                
                # Check if job was cancelled
                with self.job_lock:
                    if self.active_jobs[job_id]["status"] == SyncStatus.CANCELLED.value:
                        self.logger.info(f"Job {job_id} was cancelled, stopping processing")
                        return
                
                # Process batch
                self._queue_batch(job_id, batch)
            
            self.logger.info(f"Queued {len(entities)} entities in batches for job {job_id}")
            
        except Exception as e:
            self.logger.exception(f"Error processing job {job_id}: {e}")
            
            # Mark job as failed
            with self.job_lock:
                if job_id in self.active_jobs:
                    job = self.active_jobs[job_id]
                    job["status"] = SyncStatus.FAILED.value
                    job["completed_at"] = datetime.now().isoformat()
                    job["error_details"].append(str(e))
            
            if self.database_client:
                self.database_client.update_sync_job(job)
    
    def _queue_batch(self, job_id: str, batch: List[Dict[str, Any]]) -> None:
        """
        Queue a batch of entities for processing.
        
        Args:
            job_id: ID of the sync job
            batch: List of entities to process
        """
        self.task_queue.put(("process_batch", job_id, batch))
    
    def _process_batch(self, job_id: str, batch: List[Dict[str, Any]]) -> None:
        """
        Process a batch of entities for a sync job.
        
        Args:
            job_id: ID of the sync job
            batch: List of entities to process
        """
        # Check if job still exists and is in progress
        with self.job_lock:
            if job_id not in self.active_jobs:
                return
            
            job = self.active_jobs[job_id]
            if job["status"] not in [SyncStatus.IN_PROGRESS.value, SyncStatus.PENDING.value]:
                return
        
        self.logger.debug(f"Processing batch of {len(batch)} entities for job {job_id}")
        
        # Process each entity in the batch
        successful = 0
        failed = 0
        conflicts = 0
        
        for entity in batch:
            try:
                result = self._sync_entity(
                    job_id=job_id,
                    entity_type=job["entity_type"],
                    direction=SyncDirection(job["direction"]),
                    entity=entity,
                    conflict_strategy=ConflictResolutionStrategy(job["conflict_strategy"])
                )
                
                if result["success"]:
                    successful += 1
                    if result.get("conflict_resolved", False):
                        conflicts += 1
                else:
                    failed += 1
                    with self.job_lock:
                        job = self.active_jobs[job_id]
                        job["error_details"].append(
                            f"Entity {entity.get('id')}: {result.get('error', 'Unknown error')}"
                        )
            
            except Exception as e:
                self.logger.exception(f"Error syncing entity {entity.get('id')}: {e}")
                failed += 1
                with self.job_lock:
                    job = self.active_jobs[job_id]
                    job["error_details"].append(
                        f"Entity {entity.get('id')}: {str(e)}"
                    )
        
        # Update job progress
        with self.job_lock:
            if job_id in self.active_jobs:
                job = self.active_jobs[job_id]
                job["processed_entities"] += len(batch)
                job["successful_entities"] += successful
                job["failed_entities"] += failed
                job["conflicts"] += conflicts
                
                # Check if all entities are processed
                if job["processed_entities"] >= job["total_entities"]:
                    # Determine final status
                    if job["failed_entities"] == 0:
                        status = SyncStatus.COMPLETED
                    elif job["successful_entities"] == 0:
                        status = SyncStatus.FAILED
                    else:
                        status = SyncStatus.PARTIAL
                    
                    self._complete_job(job_id, status)
        
        # Update job in database
        if self.database_client:
            self.database_client.update_sync_job(job)
        
        self.logger.debug(
            f"Batch completed for job {job_id}: "
            f"{successful} successful, {failed} failed, {conflicts} conflicts"
        )
    
    def _complete_job(self, job_id: str, status: SyncStatus) -> None:
        """
        Mark a job as complete with the given status.
        
        Args:
            job_id: ID of the sync job
            status: Final status for the job
        """
        with self.job_lock:
            if job_id not in self.active_jobs:
                return
            
            job = self.active_jobs[job_id]
            job["status"] = status.value
            job["completed_at"] = datetime.now().isoformat()
        
        # Update job in database
        if self.database_client:
            self.database_client.update_sync_job(job)
        
        self.logger.info(f"Completed sync job {job_id} with status {status.value}")
    
    def _get_entities_for_sync(self, job: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Get entities to synchronize based on job criteria.
        
        Args:
            job: Sync job details
            
        Returns:
            List of entities to synchronize
        """
        entity_type = job["entity_type"]
        direction = SyncDirection(job["direction"])
        filter_criteria = job["filter_criteria"]
        sync_all = job["sync_all"]
        since_timestamp = job.get("since_timestamp")
        
        # Convert since_timestamp from string to datetime if needed
        if since_timestamp and isinstance(since_timestamp, str):
            since_timestamp = datetime.fromisoformat(since_timestamp)
        
        # Default to last sync time if not doing a full sync
        if not sync_all and not since_timestamp:
            since_timestamp = self._get_last_sync_time(entity_type)
        
        # Get entities based on direction
        if direction in [SyncDirection.SHOPIFY_TO_EXTERNAL, SyncDirection.BIDIRECTIONAL]:
            shopify_entities = self._get_shopify_entities(
                entity_type, filter_criteria, since_timestamp
            )
        else:
            shopify_entities = []
        
        if direction in [SyncDirection.EXTERNAL_TO_SHOPIFY, SyncDirection.BIDIRECTIONAL]:
            external_entities = self._get_external_entities(
                entity_type, filter_criteria, since_timestamp
            )
        else:
            external_entities = []
        
        # For bidirectional sync, merge entities from both sources
        if direction == SyncDirection.BIDIRECTIONAL:
            entities = self._merge_entities(shopify_entities, external_entities)
        else:
            entities = shopify_entities or external_entities
        
        return entities
    
    def _get_shopify_entities(
        self,
        entity_type: str,
        filter_criteria: Dict[str, Any],
        since_timestamp: Optional[datetime]
    ) -> List[Dict[str, Any]]:
        """
        Get entities from Shopify based on criteria.
        
        Args:
            entity_type: Type of entity to retrieve
            filter_criteria: Criteria to filter entities
            since_timestamp: Only get entities updated since this time
            
        Returns:
            List of entities from Shopify
        """
        if not self.shopify_client:
            self.logger.error("No Shopify client configured")
            return []
        
        # Add updated_at filter if since_timestamp provided
        criteria = filter_criteria.copy()
        if since_timestamp:
            criteria["updated_at_min"] = since_timestamp.isoformat()
        
        # Get entities from Shopify
        try:
            method_name = f"get_{entity_type}"
            if hasattr(self.shopify_client, method_name):
                method = getattr(self.shopify_client, method_name)
                entities = method(**criteria)
                self.logger.info(f"Retrieved {len(entities)} {entity_type} from Shopify")
                return entities
            else:
                self.logger.error(f"Method {method_name} not found in Shopify client")
                return []
        except Exception as e:
            self.logger.exception(f"Error getting {entity_type} from Shopify: {e}")
            return []
    
    def _get_external_entities(
        self,
        entity_type: str,
        filter_criteria: Dict[str, Any],
        since_timestamp: Optional[datetime]
    ) -> List[Dict[str, Any]]:
        """
        Get entities from external system based on criteria.
        
        Args:
            entity_type: Type of entity to retrieve
            filter_criteria: Criteria to filter entities
            since_timestamp: Only get entities updated since this time
            
        Returns:
            List of entities from external system
        """
        if not self.external_client:
            self.logger.error("No external client configured")
            return []
        
        # Add updated_at filter if since_timestamp provided
        criteria = filter_criteria.copy()
        if since_timestamp:
            criteria["updated_at_min"] = since_timestamp.isoformat()
        
        # Get entities from external system
        try:
            method_name = f"get_{entity_type}"
            if hasattr(self.external_client, method_name):
                method = getattr(self.external_client, method_name)
                entities = method(**criteria)
                self.logger.info(f"Retrieved {len(entities)} {entity_type} from external system")
                return entities
            else:
                self.logger.error(f"Method {method_name} not found in external client")
                return []
        except Exception as e:
            self.logger.exception(f"Error getting {entity_type} from external system: {e}")
            return []
    
    def _merge_entities(
        self,
        shopify_entities: List[Dict[str, Any]],
        external_entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Merge entities from Shopify and external system for bidirectional sync.
        
        Args:
            shopify_entities: Entities from Shopify
            external_entities: Entities from external system
            
        Returns:
            Merged list of entities with source information
        """
        # Create lookup dictionaries
        shopify_dict = {str(e.get("id")): e for e in shopify_entities}
        external_dict = {str(e.get("id")): e for e in external_entities}
        
        # Get all unique IDs
        all_ids = set(shopify_dict.keys()) | set(external_dict.keys())
        
        # Merge entities
        merged = []
        for entity_id in all_ids:
            shopify_entity = shopify_dict.get(entity_id)
            external_entity = external_dict.get(entity_id)
            
            if shopify_entity and external_entity:
                # Entity exists in both systems, include both versions for conflict resolution
                merged.append({
                    "id": entity_id,
                    "shopify_entity": shopify_entity,
                    "external_entity": external_entity,
                    "needs_conflict_resolution": True
                })
            elif shopify_entity:
                # Only in Shopify
                merged.append({
                    "id": entity_id,
                    "shopify_entity": shopify_entity,
                    "external_entity": None,
                    "needs_conflict_resolution": False
                })
            elif external_entity:
                # Only in external system
                merged.append({
                    "id": entity_id,
                    "shopify_entity": None,
                    "external_entity": external_entity,
                    "needs_conflict_resolution": False
                })
        
        return merged
    
    def _sync_entity(
        self,
        job_id: str,
        entity_type: str,
        direction: SyncDirection,
        entity: Dict[str, Any],
        conflict_strategy: ConflictResolutionStrategy
    ) -> Dict[str, Any]:
        """
        Synchronize a single entity based on direction and conflict strategy.
        
        Args:
            job_id: ID of the sync job
            entity_type: Type of entity to sync
            direction: Direction of synchronization
            entity: Entity data to sync
            conflict_strategy: Strategy for resolving conflicts
            
        Returns:
            Result dictionary with sync status
        """
        entity_id = str(entity.get("id"))
        
        # Check for conflicts in bidirectional sync
        if direction == SyncDirection.BIDIRECTIONAL and entity.get("needs_conflict_resolution"):
            shopify_entity = entity.get("shopify_entity")
            external_entity = entity.get("external_entity")
            
            # Resolve conflict according to strategy
            resolved_entity, source = self._resolve_conflict(
                shopify_entity, external_entity, conflict_strategy
            )
            
            # Sync in the appropriate direction based on conflict resolution
            if source == "shopify":
                return self._sync_shopify_to_external(
                    job_id, entity_type, entity_id, resolved_entity
                )
            else:
                return self._sync_external_to_shopify(
                    job_id, entity_type, entity_id, resolved_entity
                )
        
        # Handle unidirectional sync
        if direction == SyncDirection.SHOPIFY_TO_EXTERNAL:
            shopify_entity = entity.get("shopify_entity", entity)
            return self._sync_shopify_to_external(
                job_id, entity_type, entity_id, shopify_entity
            )
        elif direction == SyncDirection.EXTERNAL_TO_SHOPIFY:
            external_entity = entity.get("external_entity", entity)
            return self._sync_external_to_shopify(
                job_id, entity_type, entity_id, external_entity
            )
        elif direction == SyncDirection.BIDIRECTIONAL:
            # For entities that only exist in one system (no conflict)
            if entity.get("shopify_entity") and not entity.get("external_entity"):
                return self._sync_shopify_to_external(
                    job_id, entity_type, entity_id, entity["shopify_entity"]
                )
            elif entity.get("external_entity") and not entity.get("shopify_entity"):
                return self._sync_external_to_shopify(
                    job_id, entity_type, entity_id, entity["external_entity"]
                )
        
        # Fallback case (should not happen in normal operation)
        return {"success": False, "error": "Invalid sync direction or entity format"}
    
    def _sync_shopify_to_external(
        self,
        job_id: str,
        entity_type: str,
        entity_id: str,
        shopify_entity: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synchronize an entity from Shopify to external system.
        
        Args:
            job_id: ID of the sync job
            entity_type: Type of entity to sync
            entity_id: ID of the entity
            shopify_entity: Entity data from Shopify
            
        Returns:
            Result dictionary with sync status
        """
        if not self.external_client:
            return {"success": False, "error": "No external client configured"}
        
        # Check if entity needs sync by comparing latest data
        sync_status = self.get_sync_status(entity_type, entity_id)
        shopify_hash = self._calculate_hash(shopify_entity)
        
        if (sync_status.get("shopify_hash") == shopify_hash and 
            sync_status.get("external_hash") is not None):
            # Entity is already in sync
            self.logger.debug(f"Entity {entity_type}:{entity_id} already in sync, skipping")
            return {"success": True, "action": "skipped"}
        
        # Prepare entity for external system
        try:
            method_name = f"transform_{entity_type}_to_external"
            if hasattr(self, method_name):
                transform_method = getattr(self, method_name)
                external_entity = transform_method(shopify_entity)
            else:
                # Default transformation (pass through)
                external_entity = shopify_entity.copy()
        except Exception as e:
            self.logger.exception(f"Error transforming {entity_type} for external system: {e}")
            return {"success": False, "error": f"Transformation error: {str(e)}"}
        
        # Send to external system with retry logic
        for attempt in range(self.max_retries):
            try:
                method_name = f"update_{entity_type}"
                if not hasattr(self.external_client, method_name):
                    method_name = f"create_or_update_{entity_type}"
                    if not hasattr(self.external_client, method_name):
                        return {
                            "success": False,
                            "error": f"Method {method_name} not found in external client"
                        }
                
                method = getattr(self.external_client, method_name)
                result = method(external_entity)
                
                # Update sync status
                self.mark_entity_synced(
                    entity_type, entity_id,
                    shopify_data=shopify_entity,
                    external_data=result
                )
                
                return {"success": True, "action": "updated", "result": result}
                
            except Exception as e:
                self.logger.warning(
                    f"Error syncing {entity_type}:{entity_id} to external system "
                    f"(attempt {attempt+1}/{self.max_retries}): {e}"
                )
                
                if attempt < self.max_retries - 1:
                    # Wait before retry
                    time.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
                else:
                    # Last attempt failed
                    return {"success": False, "error": str(e)}
    
    def _sync_external_to_shopify(
        self,
        job_id: str,
        entity_type: str,
        entity_id: str,
        external_entity: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synchronize an entity from external system to Shopify.
        
        Args:
            job_id: ID of the sync job
            entity_type: Type of entity to sync
            entity_id: ID of the entity
            external_entity: Entity data from external system
            
        Returns:
            Result dictionary with sync status
        """
        if not self.shopify_client:
            return {"success": False, "error": "No Shopify client configured"}
        
        # Check if entity needs sync by comparing latest data
        sync_status = self.get_sync_status(entity_type, entity_id)
        external_hash = self._calculate_hash(external_entity)
        
        if (sync_status.get("external_hash") == external_hash and 
            sync_status.get("shopify_hash") is not None):
            # Entity is already in sync
            self.logger.debug(f"Entity {entity_type}:{entity_id} already in sync, skipping")
            return {"success": True, "action": "skipped"}
        
        # Prepare entity for Shopify
        try:
            method_name = f"transform_{entity_type}_to_shopify"
            if hasattr(self, method_name):
                transform_method = getattr(self, method_name)
                shopify_entity = transform_method(external_entity)
            else:
                # Default transformation (pass through)
                shopify_entity = external_entity.copy()
        except Exception as e:
            self.logger.exception(f"Error transforming {entity_type} for Shopify: {e}")
            return {"success": False, "error": f"Transformation error: {str(e)}"}
        
        # Send to Shopify with retry logic
        for attempt in range(self.max_retries):
            try:
                method_name = f"update_{entity_type}"
                if not hasattr(self.shopify_client, method_name):
                    method_name = f"create_or_update_{entity_type}"
                    if not hasattr(self.shopify_client, method_name):
                        return {
                            "success": False,
                            "error": f"Method {method_name} not found in Shopify client"
                        }
                
                method = getattr(self.shopify_client, method_name)
                result = method(shopify_entity)
                
                # Update sync status
                self.mark_entity_synced(
                    entity_type, entity_id,
                    shopify_data=result,
                    external_data=external_entity
                )
                
                return {"success": True, "action": "updated", "result": result}
                
            except Exception as e:
                self.logger.warning(
                    f"Error syncing {entity_type}:{entity_id} to Shopify "
                    f"(attempt {attempt+1}/{self.max_retries}): {e}"
                )
                
                if attempt < self.max_retries - 1:
                    # Wait before retry
                    time.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
                else:
                    # Last attempt failed
                    return {"success": False, "error": str(e)}
    
    def _resolve_conflict(
        self,
        shopify_entity: Dict[str, Any],
        external_entity: Dict[str, Any],
        strategy: ConflictResolutionStrategy
    ) -> Tuple[Dict[str, Any], str]:
        """
        Resolve a conflict between Shopify and external entity versions.
        
        Args:
            shopify_entity: Entity data from Shopify
            external_entity: Entity data from external system
            strategy: Conflict resolution strategy
            
        Returns:
            Tuple of (resolved entity, source system name)
        """
        if strategy == ConflictResolutionStrategy.SHOPIFY_WINS:
            return shopify_entity, "shopify"
        
        elif strategy == ConflictResolutionStrategy.EXTERNAL_WINS:
            return external_entity, "external"
        
        elif strategy == ConflictResolutionStrategy.NEWEST_WINS:
            # Compare updated_at timestamps
            try:
                shopify_updated = self._parse_datetime(shopify_entity.get("updated_at"))
                external_updated = self._parse_datetime(external_entity.get("updated_at"))
                
                if shopify_updated and external_updated:
                    if shopify_updated >= external_updated:
                        return shopify_entity, "shopify"
                    else:
                        return external_entity, "external"
                elif shopify_updated:
                    return shopify_entity, "shopify"
                elif external_updated:
                    return external_entity, "external"
                else:
                    # No timestamps, default to Shopify
                    return shopify_entity, "shopify"
            except Exception:
                # Error parsing dates, default to Shopify
                return shopify_entity, "shopify"
        
        elif strategy == ConflictResolutionStrategy.MANUAL:
            # In a real implementation, this might queue the conflict for manual resolution
            # For now, we'll default to Shopify
            return shopify_entity, "shopify"
        
        # Default fallback
        return shopify_entity, "shopify"
    
    def _get_last_sync_time(self, entity_type: str) -> Optional[datetime]:
        """
        Get the timestamp of the last successful sync for an entity type.
        
        Args:
            entity_type: Type of entity
            
        Returns:
            Datetime of last sync or None if no previous sync
        """
        if not self.database_client:
            return None
        
        # Query database for most recent completed sync job for this entity type
        last_job = self.database_client.get_last_successful_sync(entity_type)
        
        if last_job and last_job.get("completed_at"):
            try:
                return datetime.fromisoformat(last_job["completed_at"])
            except ValueError:
                return None
        
        return None
    
    def _calculate_hash(self, data: Optional[Dict[str, Any]]) -> Optional[str]:
        """
        Calculate a hash for entity data to detect changes.
        
        Args:
            data: Entity data to hash
            
        Returns:
            Hash string or None if data is None
        """
        if data is None:
            return None
        
        # Normalize data for consistent hashing
        normalized = json.dumps(data, sort_keys=True)
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        """
        Parse a datetime string in various formats.
        
        Args:
            dt_str: Datetime string to parse
            
        Returns:
            Datetime object or None if parsing fails
        """
        if not dt_str:
            return None
        
        # Try different formats
        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%fZ",  # ISO format with microseconds
            "%Y-%m-%dT%H:%M:%SZ",     # ISO format without microseconds
            "%Y-%m-%dT%H:%M:%S.%f",   # ISO format without Z
            "%Y-%m-%dT%H:%M:%S",      # ISO format without Z or microseconds
            "%Y-%m-%d %H:%M:%S.%f",   # SQL-like format
            "%Y-%m-%d %H:%M:%S"       # SQL-like format without microseconds
        ]:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        
        # If all formats fail, try isoformat parser
        try:
            return datetime.fromisoformat(dt_str)
        except ValueError:
            return None
    
    def cleanup_old_sync_history(self) -> int:
        """
        Remove old sync history beyond retention period.
        
        Returns:
            Number of records removed
        """
        if not self.database_client:
            return 0
        
        # Calculate cutoff date
        cutoff_date = datetime.now() - timedelta(days=self.sync_history_retention)
        
        # Remove old records from database
        count = self.database_client.delete_old_sync_jobs(cutoff_date)
        self.logger.info(f"Removed {count} old sync job records")
        
        return count