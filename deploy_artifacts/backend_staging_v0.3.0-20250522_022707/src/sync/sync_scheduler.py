"""
Sync Scheduler - Manages and schedules data synchronization jobs.

This module provides functionality for scheduling and managing sync jobs
with different frequencies (one-time, hourly, daily, weekly) and priorities.
It supports persistence to survive restarts and provides interfaces for
managing scheduled jobs.
"""

import asyncio
import json
import logging
import os
import pickle
import threading
import time
from datetime import datetime, timedelta
from enum import Enum
from heapq import heappush, heappop, heapify
from typing import Dict, List, Any, Optional, Callable, Tuple, Union, Set
import uuid

from .sync_manager import SyncManager, SyncDirection, SyncStatus, ConflictResolutionStrategy


class JobFrequency(Enum):
    """Enumeration of job execution frequencies."""
    ONE_TIME = "one_time"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class JobPriority(Enum):
    """Enumeration of job priorities."""
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BACKGROUND = 4


class SchedulerStatus(Enum):
    """Enumeration of scheduler statuses."""
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


class ScheduledJob:
    """
    Represents a scheduled synchronization job.
    
    Attributes:
        job_id: Unique identifier for the job
        name: Human-readable name for the job
        entity_type: Type of entity to synchronize
        direction: Direction of synchronization
        frequency: Frequency of job execution
        priority: Job execution priority
        next_run: Next scheduled execution time
        last_run: Last execution time
        filter_criteria: Criteria to filter entities for sync
        sync_all: Whether to sync all entities or incremental
        conflict_strategy: Strategy for resolving conflicts
        enabled: Whether the job is enabled
        created_at: Job creation timestamp
        args: Additional arguments for the job
    """
    
    def __init__(
        self,
        job_id: str,
        name: str,
        entity_type: str,
        direction: SyncDirection,
        frequency: JobFrequency,
        priority: JobPriority = JobPriority.NORMAL,
        next_run: Optional[datetime] = None,
        filter_criteria: Optional[Dict[str, Any]] = None,
        sync_all: bool = False,
        conflict_strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.NEWEST_WINS,
        enabled: bool = True,
        args: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize a scheduled job.
        
        Args:
            job_id: Unique identifier for the job
            name: Human-readable name for the job
            entity_type: Type of entity to synchronize
            direction: Direction of synchronization
            frequency: Frequency of job execution
            priority: Job execution priority
            next_run: Next scheduled execution time
            filter_criteria: Criteria to filter entities for sync
            sync_all: Whether to sync all entities or incremental
            conflict_strategy: Strategy for resolving conflicts
            enabled: Whether the job is enabled
            args: Additional arguments for the job
        """
        self.job_id = job_id
        self.name = name
        self.entity_type = entity_type
        self.direction = direction
        self.frequency = frequency
        self.priority = priority
        self.next_run = next_run or datetime.now()
        self.last_run = None
        self.filter_criteria = filter_criteria or {}
        self.sync_all = sync_all
        self.conflict_strategy = conflict_strategy
        self.enabled = enabled
        self.created_at = datetime.now()
        self.args = args or {}
        self.execution_count = 0
        self.error_count = 0
        self.last_error = None
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the job to a dictionary for serialization.
        
        Returns:
            Dictionary representation of the job
        """
        return {
            "job_id": self.job_id,
            "name": self.name,
            "entity_type": self.entity_type,
            "direction": self.direction.value,
            "frequency": self.frequency.value,
            "priority": self.priority.value,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "filter_criteria": self.filter_criteria,
            "sync_all": self.sync_all,
            "conflict_strategy": self.conflict_strategy.value,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat(),
            "args": self.args,
            "execution_count": self.execution_count,
            "error_count": self.error_count,
            "last_error": self.last_error
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ScheduledJob':
        """
        Create a job from a dictionary.
        
        Args:
            data: Dictionary representation of the job
            
        Returns:
            ScheduledJob instance
        """
        job = cls(
            job_id=data["job_id"],
            name=data["name"],
            entity_type=data["entity_type"],
            direction=SyncDirection(data["direction"]),
            frequency=JobFrequency(data["frequency"]),
            priority=JobPriority(data.get("priority", JobPriority.NORMAL.value)),
            next_run=datetime.fromisoformat(data["next_run"]) if data.get("next_run") else None,
            filter_criteria=data.get("filter_criteria", {}),
            sync_all=data.get("sync_all", False),
            conflict_strategy=ConflictResolutionStrategy(data.get("conflict_strategy", ConflictResolutionStrategy.NEWEST_WINS.value)),
            enabled=data.get("enabled", True),
            args=data.get("args", {})
        )
        
        if data.get("last_run"):
            job.last_run = datetime.fromisoformat(data["last_run"])
        
        job.created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        job.execution_count = data.get("execution_count", 0)
        job.error_count = data.get("error_count", 0)
        job.last_error = data.get("last_error")
        
        return job
    
    def update_next_run(self) -> None:
        """Calculate and update the next run time based on frequency."""
        now = datetime.now()
        
        if self.frequency == JobFrequency.ONE_TIME:
            # One-time jobs don't reschedule
            self.next_run = None
            return
        
        if not self.last_run:
            self.next_run = now
            return
        
        if self.frequency == JobFrequency.HOURLY:
            # Next hour
            self.next_run = self.last_run.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        
        elif self.frequency == JobFrequency.DAILY:
            # Next day at the same hour
            self.next_run = self.last_run.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        
        elif self.frequency == JobFrequency.WEEKLY:
            # Next week, same day of week
            self.next_run = self.last_run.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=7)
        
        elif self.frequency == JobFrequency.MONTHLY:
            # Next month, same day of month
            next_month = self.last_run.month + 1
            next_year = self.last_run.year
            
            if next_month > 12:
                next_month = 1
                next_year += 1
            
            # Get the last day of the next month if the current day exceeds it
            day = min(self.last_run.day, 28)  # Use a safe day to avoid invalid dates
            
            self.next_run = datetime(next_year, next_month, day, 0, 0, 0)
        
        # Ensure next run is not in the past
        if self.next_run < now:
            self.update_next_run()


class SyncScheduler:
    """
    Manages scheduling of synchronization jobs.
    
    This class provides functionality to schedule, manage, and execute
    synchronization jobs with different frequencies and priorities.
    """
    
    def __init__(
        self,
        sync_manager: SyncManager,
        scheduler_interval: int = 60,  # seconds
        max_concurrent_jobs: int = 3,
        state_persistence_path: Optional[str] = None
    ):
        """
        Initialize the Sync Scheduler.
        
        Args:
            sync_manager: SyncManager instance for executing jobs
            scheduler_interval: Interval in seconds for checking scheduled jobs
            max_concurrent_jobs: Maximum number of jobs to run concurrently
            state_persistence_path: Path to save scheduler state
        """
        self.sync_manager = sync_manager
        self.scheduler_interval = scheduler_interval
        self.max_concurrent_jobs = max_concurrent_jobs
        self.state_persistence_path = state_persistence_path
        
        # Job queue (priority queue)
        self.job_queue = []  # (next_run_timestamp, priority_value, job_id)
        
        # Jobs by ID
        self.jobs: Dict[str, ScheduledJob] = {}
        
        # Running jobs
        self.running_jobs: Set[str] = set()
        
        # Job execution results
        self.job_results: Dict[str, Dict[str, Any]] = {}
        
        # Thread for the scheduler
        self.scheduler_thread = None
        self.status = SchedulerStatus.STOPPED
        self.should_stop = threading.Event()
        
        # Locks for thread safety
        self.queue_lock = threading.RLock()
        self.jobs_lock = threading.RLock()
        
        # Setup logging
        self.logger = logging.getLogger("SyncScheduler")
    
    def start(self) -> None:
        """Start the scheduler thread."""
        if self.status == SchedulerStatus.RUNNING:
            self.logger.warning("Scheduler is already running")
            return
        
        # Reset stop flag
        self.should_stop.clear()
        
        # Try to load state if available
        self._load_state()
        
        # Start scheduler thread
        self.scheduler_thread = threading.Thread(
            target=self._scheduler_loop,
            daemon=True,
            name="SyncScheduler"
        )
        self.scheduler_thread.start()
        
        self.status = SchedulerStatus.RUNNING
        self.logger.info("Sync scheduler started")
    
    def stop(self, wait: bool = True) -> None:
        """
        Stop the scheduler thread.
        
        Args:
            wait: Whether to wait for the thread to finish
        """
        if self.status != SchedulerStatus.RUNNING:
            self.logger.warning("Scheduler is not running")
            return
        
        # Signal the thread to stop
        self.should_stop.set()
        
        # Wait for thread to finish if requested
        if wait and self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=60)
        
        self.status = SchedulerStatus.STOPPED
        self.logger.info("Sync scheduler stopped")
        
        # Save state before shutting down
        self._save_state()
    
    def pause(self) -> None:
        """Pause the scheduler (stop processing new jobs but don't stop the thread)."""
        if self.status != SchedulerStatus.RUNNING:
            self.logger.warning("Scheduler is not running")
            return
        
        self.status = SchedulerStatus.PAUSED
        self.logger.info("Sync scheduler paused")
    
    def resume(self) -> None:
        """Resume the scheduler after being paused."""
        if self.status != SchedulerStatus.PAUSED:
            self.logger.warning("Scheduler is not paused")
            return
        
        self.status = SchedulerStatus.RUNNING
        self.logger.info("Sync scheduler resumed")
    
    def schedule_job(
        self,
        name: str,
        entity_type: str,
        direction: SyncDirection,
        frequency: JobFrequency,
        next_run: Optional[datetime] = None,
        priority: JobPriority = JobPriority.NORMAL,
        filter_criteria: Optional[Dict[str, Any]] = None,
        sync_all: bool = False,
        conflict_strategy: Optional[ConflictResolutionStrategy] = None,
        args: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Schedule a new synchronization job.
        
        Args:
            name: Human-readable name for the job
            entity_type: Type of entity to synchronize
            direction: Direction of synchronization
            frequency: Frequency of job execution
            next_run: Next scheduled execution time
            priority: Job execution priority
            filter_criteria: Criteria to filter entities for sync
            sync_all: Whether to sync all entities or incremental
            conflict_strategy: Strategy for resolving conflicts
            args: Additional arguments for the job
            
        Returns:
            Job ID for the created job
        """
        job_id = str(uuid.uuid4())
        conflict_strategy = conflict_strategy or ConflictResolutionStrategy.NEWEST_WINS
        
        # Create job object
        job = ScheduledJob(
            job_id=job_id,
            name=name,
            entity_type=entity_type,
            direction=direction,
            frequency=frequency,
            priority=priority,
            next_run=next_run,
            filter_criteria=filter_criteria,
            sync_all=sync_all,
            conflict_strategy=conflict_strategy,
            args=args
        )
        
        # If next_run not specified, calculate based on frequency
        if not next_run:
            job.update_next_run()
        
        # Add to jobs dictionary
        with self.jobs_lock:
            self.jobs[job_id] = job
        
        # Add to priority queue
        with self.queue_lock:
            if job.next_run:
                heappush(
                    self.job_queue,
                    (job.next_run.timestamp(), job.priority.value, job_id)
                )
        
        self.logger.info(f"Scheduled {frequency.value} job {job_id} ({name}) for {entity_type}")
        
        # Save updated state
        self._save_state()
        
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get details for a specific job.
        
        Args:
            job_id: ID of the job
            
        Returns:
            Job details or None if not found
        """
        with self.jobs_lock:
            job = self.jobs.get(job_id)
            return job.to_dict() if job else None
    
    def get_jobs(
        self,
        frequency: Optional[JobFrequency] = None,
        entity_type: Optional[str] = None,
        enabled_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get a list of jobs with optional filtering.
        
        Args:
            frequency: Filter by job frequency
            entity_type: Filter by entity type
            enabled_only: Whether to include only enabled jobs
            
        Returns:
            List of matching jobs
        """
        result = []
        
        with self.jobs_lock:
            for job in self.jobs.values():
                # Skip if doesn't match filters
                if frequency and job.frequency != frequency:
                    continue
                if entity_type and job.entity_type != entity_type:
                    continue
                if enabled_only and not job.enabled:
                    continue
                
                # Add to results
                result.append(job.to_dict())
        
        # Sort by next run time
        result.sort(key=lambda x: x.get("next_run", "z") or "z")
        
        return result
    
    def update_job(
        self,
        job_id: str,
        **kwargs
    ) -> bool:
        """
        Update an existing job with new parameters.
        
        Args:
            job_id: ID of the job to update
            **kwargs: Job parameters to update
            
        Returns:
            True if job was updated, False otherwise
        """
        with self.jobs_lock:
            if job_id not in self.jobs:
                return False
            
            job = self.jobs[job_id]
            
            # Update job attributes
            for key, value in kwargs.items():
                if key == "next_run" and isinstance(value, str):
                    value = datetime.fromisoformat(value)
                elif key == "frequency" and isinstance(value, str):
                    value = JobFrequency(value)
                elif key == "priority" and isinstance(value, str):
                    value = JobPriority(value)
                elif key == "direction" and isinstance(value, str):
                    value = SyncDirection(value)
                elif key == "conflict_strategy" and isinstance(value, str):
                    value = ConflictResolutionStrategy(value)
                
                if hasattr(job, key):
                    setattr(job, key, value)
            
            # Rebuild queue if next_run or priority changed
            if "next_run" in kwargs or "priority" in kwargs:
                self._rebuild_queue()
        
        # Save updated state
        self._save_state()
        
        self.logger.info(f"Updated job {job_id}")
        return True
    
    def delete_job(self, job_id: str) -> bool:
        """
        Delete a job from the scheduler.
        
        Args:
            job_id: ID of the job to delete
            
        Returns:
            True if job was deleted, False otherwise
        """
        with self.jobs_lock:
            if job_id not in self.jobs:
                return False
            
            # Remove from jobs dictionary
            del self.jobs[job_id]
            
            # Rebuild queue
            self._rebuild_queue()
        
        # Save updated state
        self._save_state()
        
        self.logger.info(f"Deleted job {job_id}")
        return True
    
    def enable_job(self, job_id: str) -> bool:
        """
        Enable a job.
        
        Args:
            job_id: ID of the job to enable
            
        Returns:
            True if job was enabled, False otherwise
        """
        return self.update_job(job_id, enabled=True)
    
    def disable_job(self, job_id: str) -> bool:
        """
        Disable a job.
        
        Args:
            job_id: ID of the job to disable
            
        Returns:
            True if job was disabled, False otherwise
        """
        return self.update_job(job_id, enabled=False)
    
    def run_job_now(self, job_id: str) -> bool:
        """
        Run a job immediately, regardless of its scheduled time.
        
        Args:
            job_id: ID of the job to run
            
        Returns:
            True if job was triggered, False otherwise
        """
        with self.jobs_lock:
            if job_id not in self.jobs:
                return False
            
            job = self.jobs[job_id]
            job.next_run = datetime.now()
            
            # Rebuild queue to reflect updated next_run
            self._rebuild_queue()
        
        self.logger.info(f"Triggered immediate execution of job {job_id}")
        return True
    
    def get_job_result(self, job_id: str, run_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get the result of a job execution.
        
        Args:
            job_id: ID of the job
            run_id: Optional ID of the specific run (latest if not specified)
            
        Returns:
            Result or None if not found
        """
        if job_id not in self.job_results:
            return None
        
        if run_id:
            # Return specific run result
            for result in self.job_results[job_id]:
                if result.get("run_id") == run_id:
                    return result
            return None
        else:
            # Return latest result
            if self.job_results[job_id]:
                return self.job_results[job_id][-1]
            return None
    
    def _scheduler_loop(self) -> None:
        """Main scheduler loop that checks for due jobs and executes them."""
        while not self.should_stop.is_set():
            try:
                # Skip processing if paused
                if self.status == SchedulerStatus.PAUSED:
                    time.sleep(1)
                    continue
                
                # Check for due jobs
                self._process_due_jobs()
                
                # Wait for next interval
                time.sleep(self.scheduler_interval)
                
                # Periodically save state
                self._save_state()
                
            except Exception as e:
                self.logger.exception(f"Error in scheduler loop: {e}")
                self.status = SchedulerStatus.ERROR
                time.sleep(5)  # Wait a bit before retry
                self.status = SchedulerStatus.RUNNING
    
    def _process_due_jobs(self) -> None:
        """Check for jobs that are due and execute them."""
        now = datetime.now().timestamp()
        jobs_to_run = []
        
        with self.queue_lock:
            # Check if there are any jobs in the queue
            while self.job_queue and len(self.running_jobs) < self.max_concurrent_jobs:
                # Peek at the top job
                next_run, _, job_id = self.job_queue[0]
                
                # If the job is due, pop it
                if next_run <= now:
                    heappop(self.job_queue)
                    
                    # Make sure the job still exists
                    with self.jobs_lock:
                        if job_id in self.jobs and self.jobs[job_id].enabled:
                            # Add to running jobs
                            self.running_jobs.add(job_id)
                            jobs_to_run.append(job_id)
                else:
                    # No more due jobs
                    break
        
        # Execute due jobs
        for job_id in jobs_to_run:
            self._execute_job(job_id)
    
    def _execute_job(self, job_id: str) -> None:
        """
        Execute a job and update its status.
        
        Args:
            job_id: ID of the job to execute
        """
        with self.jobs_lock:
            if job_id not in self.jobs:
                self.running_jobs.discard(job_id)
                return
            
            job = self.jobs[job_id]
        
        self.logger.info(f"Executing job {job_id} ({job.name})")
        
        run_id = str(uuid.uuid4())
        run_start = datetime.now()
        result = {
            "run_id": run_id,
            "job_id": job_id,
            "start_time": run_start.isoformat(),
            "status": "in_progress"
        }
        
        try:
            # Create a sync job in the sync manager
            sync_job_id = self.sync_manager.create_sync_job(
                entity_type=job.entity_type,
                direction=job.direction,
                filter_criteria=job.filter_criteria,
                sync_all=job.sync_all,
                since_timestamp=job.last_run,
                conflict_strategy=job.conflict_strategy,
                priority=job.priority.value  # Pass priority value
            )
            
            # Wait for sync job to complete
            while True:
                # Check if scheduler should stop
                if self.should_stop.is_set():
                    self.sync_manager.cancel_sync_job(sync_job_id)
                    break
                
                # Get job status
                sync_job = self.sync_manager.get_sync_job(sync_job_id)
                if not sync_job:
                    raise ValueError(f"Sync job {sync_job_id} not found")
                
                status = sync_job["status"]
                if status in [SyncStatus.COMPLETED.value, SyncStatus.FAILED.value, 
                              SyncStatus.PARTIAL.value, SyncStatus.CANCELLED.value]:
                    # Job completed, update result
                    result.update({
                        "status": status,
                        "total_entities": sync_job.get("total_entities", 0),
                        "processed_entities": sync_job.get("processed_entities", 0),
                        "successful_entities": sync_job.get("successful_entities", 0),
                        "failed_entities": sync_job.get("failed_entities", 0),
                        "conflicts": sync_job.get("conflicts", 0),
                        "error_details": sync_job.get("error_details", [])
                    })
                    break
                
                # Sleep before checking again
                time.sleep(5)
            
            # Update job execution stats
            with self.jobs_lock:
                if job_id in self.jobs:
                    job = self.jobs[job_id]
                    job.last_run = run_start
                    job.execution_count += 1
                    
                    # Update next run time
                    job.update_next_run()
                    
                    # If job has future runs, add back to queue
                    if job.next_run:
                        with self.queue_lock:
                            heappush(
                                self.job_queue,
                                (job.next_run.timestamp(), job.priority.value, job_id)
                            )
            
            self.logger.info(f"Job {job_id} executed successfully")
            
        except Exception as e:
            error_message = str(e)
            self.logger.exception(f"Error executing job {job_id}: {error_message}")
            
            # Update result with error
            result.update({
                "status": "error",
                "error": error_message
            })
            
            # Update job error stats
            with self.jobs_lock:
                if job_id in self.jobs:
                    job = self.jobs[job_id]
                    job.last_run = run_start
                    job.execution_count += 1
                    job.error_count += 1
                    job.last_error = error_message
                    
                    # Update next run time
                    job.update_next_run()
                    
                    # If job has future runs, add back to queue
                    if job.next_run:
                        with self.queue_lock:
                            heappush(
                                self.job_queue,
                                (job.next_run.timestamp(), job.priority.value, job_id)
                            )
        
        finally:
            # Record completion time
            result["end_time"] = datetime.now().isoformat()
            
            # Store result
            if job_id not in self.job_results:
                self.job_results[job_id] = []
            
            # Limit stored results to last 10
            results = self.job_results[job_id]
            results.append(result)
            if len(results) > 10:
                results.pop(0)
            
            # Remove from running jobs
            self.running_jobs.discard(job_id)
            
            # Save state
            self._save_state()
    
    def _rebuild_queue(self) -> None:
        """Rebuild the priority queue from the current jobs."""
        with self.queue_lock:
            self.job_queue = []
            
            for job_id, job in self.jobs.items():
                if job.enabled and job.next_run and job_id not in self.running_jobs:
                    heappush(
                        self.job_queue,
                        (job.next_run.timestamp(), job.priority.value, job_id)
                    )
            
            heapify(self.job_queue)
    
    def _save_state(self) -> None:
        """Save scheduler state to disk for persistence."""
        if not self.state_persistence_path:
            return
        
        try:
            state = {
                "jobs": {job_id: job.to_dict() for job_id, job in self.jobs.items()},
                "job_results": self.job_results,
                "saved_at": datetime.now().isoformat()
            }
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.state_persistence_path), exist_ok=True)
            
            # Write to temp file first to avoid corruption
            temp_path = f"{self.state_persistence_path}.tmp"
            with open(temp_path, 'wb') as f:
                pickle.dump(state, f)
            
            # Rename to actual file
            os.replace(temp_path, self.state_persistence_path)
            
        except Exception as e:
            self.logger.error(f"Failed to save scheduler state: {e}")
    
    def _load_state(self) -> None:
        """Load scheduler state from disk."""
        if not self.state_persistence_path or not os.path.exists(self.state_persistence_path):
            return
        
        try:
            with open(self.state_persistence_path, 'rb') as f:
                state = pickle.load(f)
            
            # Restore jobs
            jobs = {}
            for job_id, job_dict in state.get("jobs", {}).items():
                try:
                    jobs[job_id] = ScheduledJob.from_dict(job_dict)
                except Exception as e:
                    self.logger.error(f"Failed to load job {job_id}: {e}")
            
            # Replace current jobs
            with self.jobs_lock:
                self.jobs = jobs
            
            # Restore job results
            self.job_results = state.get("job_results", {})
            
            # Rebuild queue
            self._rebuild_queue()
            
            self.logger.info(f"Loaded {len(self.jobs)} jobs from persistent storage")
            
        except Exception as e:
            self.logger.error(f"Failed to load scheduler state: {e}")
    
    def cleanup_old_results(self, days: int = 30) -> int:
        """
        Remove old job results beyond retention period.
        
        Args:
            days: Number of days to retain results
            
        Returns:
            Number of results removed
        """
        cutoff_date = datetime.now() - timedelta(days=days)
        count = 0
        
        for job_id in list(self.job_results.keys()):
            results = self.job_results[job_id]
            original_len = len(results)
            
            # Filter out old results
            filtered_results = [
                result for result in results
                if datetime.fromisoformat(result.get("start_time", datetime.now().isoformat())) >= cutoff_date
            ]
            
            count += original_len - len(filtered_results)
            self.job_results[job_id] = filtered_results
            
            # Remove empty job result entries
            if not filtered_results:
                del self.job_results[job_id]
        
        return count