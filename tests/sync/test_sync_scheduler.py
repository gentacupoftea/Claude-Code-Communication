"""
Test suite for the Sync Scheduler module.
"""

import os
import time
import pytest
import tempfile
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from src.sync.sync_scheduler import (
    SyncScheduler,
    ScheduledJob,
    JobFrequency,
    JobPriority,
    SchedulerStatus
)
from src.sync.sync_manager import (
    SyncManager,
    SyncDirection,
    SyncStatus,
    ConflictResolutionStrategy
)


class TestScheduledJob:
    """Test cases for the ScheduledJob class."""
    
    def test_scheduled_job_initialization(self):
        """Test that a ScheduledJob is properly initialized."""
        job = ScheduledJob(
            job_id="test-job-1",
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY,
            priority=JobPriority.NORMAL
        )
        
        assert job.job_id == "test-job-1"
        assert job.name == "Test Job"
        assert job.entity_type == "products"
        assert job.direction == SyncDirection.SHOPIFY_TO_EXTERNAL
        assert job.frequency == JobFrequency.DAILY
        assert job.priority == JobPriority.NORMAL
        assert job.enabled
        assert job.execution_count == 0
        assert job.error_count == 0
        assert job.last_error is None
    
    def test_to_dict_and_from_dict(self):
        """Test conversion to dictionary and back."""
        job = ScheduledJob(
            job_id="test-job-1",
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY,
            priority=JobPriority.HIGH,
            next_run=datetime(2023, 1, 1, 12, 0, 0)
        )
        
        # Convert to dict
        job_dict = job.to_dict()
        
        # Convert back to job
        restored_job = ScheduledJob.from_dict(job_dict)
        
        # Verify all attributes match
        assert restored_job.job_id == job.job_id
        assert restored_job.name == job.name
        assert restored_job.entity_type == job.entity_type
        assert restored_job.direction == job.direction
        assert restored_job.frequency == job.frequency
        assert restored_job.priority == job.priority
        assert restored_job.next_run == job.next_run
        assert restored_job.sync_all == job.sync_all
        assert restored_job.conflict_strategy == job.conflict_strategy
        assert restored_job.enabled == job.enabled
        assert restored_job.execution_count == job.execution_count
        assert restored_job.error_count == job.error_count
    
    def test_update_next_run_one_time(self):
        """Test that a one-time job does not reschedule."""
        job = ScheduledJob(
            job_id="test-job-1",
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.ONE_TIME,
            next_run=datetime(2023, 1, 1, 12, 0, 0)
        )
        
        # Set last run time
        job.last_run = datetime(2023, 1, 1, 12, 0, 0)
        
        # Update next run
        job.update_next_run()
        
        # One-time jobs should not reschedule
        assert job.next_run is None
    
    def test_update_next_run_hourly(self):
        """Test that an hourly job schedules for the next hour."""
        job = ScheduledJob(
            job_id="test-job-1",
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.HOURLY
        )
        
        # Set last run time
        job.last_run = datetime(2023, 1, 1, 12, 30, 0)
        
        # Update next run
        job.update_next_run()
        
        # Should be scheduled for the next hour
        expected_next_run = datetime(2023, 1, 1, 13, 0, 0)
        assert job.next_run == expected_next_run
    
    def test_update_next_run_daily(self):
        """Test that a daily job schedules for the next day."""
        job = ScheduledJob(
            job_id="test-job-1",
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY
        )
        
        # Set last run time
        job.last_run = datetime(2023, 1, 1, 12, 0, 0)
        
        # Update next run
        job.update_next_run()
        
        # Should be scheduled for the next day
        expected_next_run = datetime(2023, 1, 2, 0, 0, 0)
        assert job.next_run == expected_next_run


class TestSyncScheduler:
    """Test cases for the SyncScheduler class."""
    
    @pytest.fixture
    def mock_sync_manager(self):
        """Create a mock SyncManager for testing."""
        mock_manager = MagicMock(spec=SyncManager)
        
        # Mock create_sync_job method
        mock_manager.create_sync_job.return_value = "sync-job-1"
        
        # Mock get_sync_job method
        mock_manager.get_sync_job.return_value = {
            "status": SyncStatus.COMPLETED.value,
            "total_entities": 10,
            "processed_entities": 10,
            "successful_entities": 9,
            "failed_entities": 1,
            "conflicts": 0,
            "error_details": []
        }
        
        return mock_manager
    
    @pytest.fixture
    def temp_state_file(self):
        """Create a temporary file for state persistence."""
        fd, path = tempfile.mkstemp()
        os.close(fd)
        yield path
        # Cleanup
        if os.path.exists(path):
            os.unlink(path)
    
    @pytest.fixture
    def scheduler(self, mock_sync_manager, temp_state_file):
        """Create a SyncScheduler for testing."""
        scheduler = SyncScheduler(
            sync_manager=mock_sync_manager,
            scheduler_interval=1,  # Short interval for faster tests
            max_concurrent_jobs=3,
            state_persistence_path=temp_state_file
        )
        return scheduler
    
    def test_scheduler_initialization(self, scheduler):
        """Test that the scheduler is initialized properly."""
        assert scheduler.status == SchedulerStatus.STOPPED
        assert len(scheduler.jobs) == 0
        assert len(scheduler.job_queue) == 0
        assert len(scheduler.running_jobs) == 0
    
    def test_schedule_job(self, scheduler):
        """Test scheduling a new job."""
        job_id = scheduler.schedule_job(
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY,
            priority=JobPriority.NORMAL
        )
        
        # Verify job was added
        assert job_id in scheduler.jobs
        job = scheduler.jobs[job_id]
        assert job.name == "Test Job"
        assert job.entity_type == "products"
        assert job.direction == SyncDirection.SHOPIFY_TO_EXTERNAL
        assert job.frequency == JobFrequency.DAILY
        assert job.priority == JobPriority.NORMAL
        
        # Verify job is in queue
        assert len(scheduler.job_queue) == 1
        
        # Verify we can retrieve the job
        job_dict = scheduler.get_job(job_id)
        assert job_dict is not None
        assert job_dict["name"] == "Test Job"
    
    def test_get_jobs_with_filtering(self, scheduler):
        """Test retrieving jobs with filtering."""
        # Add multiple jobs
        job1 = scheduler.schedule_job(
            name="Daily Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY
        )
        
        job2 = scheduler.schedule_job(
            name="Hourly Job",
            entity_type="orders",
            direction=SyncDirection.EXTERNAL_TO_SHOPIFY,
            frequency=JobFrequency.HOURLY
        )
        
        job3 = scheduler.schedule_job(
            name="Weekly Job",
            entity_type="products",
            direction=SyncDirection.BIDIRECTIONAL,
            frequency=JobFrequency.WEEKLY
        )
        
        # Filter by frequency
        hourly_jobs = scheduler.get_jobs(frequency=JobFrequency.HOURLY)
        assert len(hourly_jobs) == 1
        assert hourly_jobs[0]["name"] == "Hourly Job"
        
        # Filter by entity_type
        product_jobs = scheduler.get_jobs(entity_type="products")
        assert len(product_jobs) == 2
        assert {job["name"] for job in product_jobs} == {"Daily Job", "Weekly Job"}
        
        # Multiple filters
        filtered_jobs = scheduler.get_jobs(
            entity_type="products",
            frequency=JobFrequency.DAILY
        )
        assert len(filtered_jobs) == 1
        assert filtered_jobs[0]["name"] == "Daily Job"
    
    def test_update_job(self, scheduler):
        """Test updating a job."""
        # Add a job
        job_id = scheduler.schedule_job(
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY
        )
        
        # Update the job
        updated = scheduler.update_job(
            job_id=job_id,
            name="Updated Job",
            priority=JobPriority.HIGH,
            filter_criteria={"updated_at_min": "2023-01-01"}
        )
        
        # Verify update succeeded
        assert updated
        
        # Verify job was updated
        job = scheduler.jobs[job_id]
        assert job.name == "Updated Job"
        assert job.priority == JobPriority.HIGH
        assert job.filter_criteria == {"updated_at_min": "2023-01-01"}
    
    def test_delete_job(self, scheduler):
        """Test deleting a job."""
        # Add a job
        job_id = scheduler.schedule_job(
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY
        )
        
        # Delete the job
        deleted = scheduler.delete_job(job_id)
        
        # Verify deletion succeeded
        assert deleted
        
        # Verify job was removed
        assert job_id not in scheduler.jobs
        assert scheduler.get_job(job_id) is None
    
    def test_enable_disable_job(self, scheduler):
        """Test enabling and disabling a job."""
        # Add a job
        job_id = scheduler.schedule_job(
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY
        )
        
        # Initially enabled
        assert scheduler.jobs[job_id].enabled
        
        # Disable the job
        disabled = scheduler.disable_job(job_id)
        assert disabled
        assert not scheduler.jobs[job_id].enabled
        
        # Enable the job
        enabled = scheduler.enable_job(job_id)
        assert enabled
        assert scheduler.jobs[job_id].enabled
    
    def test_run_job_now(self, scheduler):
        """Test running a job immediately."""
        # Add a job with future next_run
        future_time = datetime.now() + timedelta(hours=1)
        job_id = scheduler.schedule_job(
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY,
            next_run=future_time
        )
        
        # Original next_run time is in the future
        assert scheduler.jobs[job_id].next_run > datetime.now()
        
        # Run the job now
        ran = scheduler.run_job_now(job_id)
        
        # Verify operation succeeded
        assert ran
        
        # Verify next_run is now (or very close)
        now = datetime.now()
        job_next_run = scheduler.jobs[job_id].next_run
        assert (now - job_next_run).total_seconds() < 2  # Within 2 seconds
    
    @patch('threading.Thread')
    def test_start_stop_scheduler(self, mock_thread, scheduler):
        """Test starting and stopping the scheduler."""
        # Start the scheduler
        scheduler.start()
        
        # Verify thread was started
        mock_thread.assert_called_once()
        mock_thread.return_value.start.assert_called_once()
        
        # Verify status is running
        assert scheduler.status == SchedulerStatus.RUNNING
        
        # Stop the scheduler
        scheduler.stop()
        
        # Verify stop flag was set
        assert scheduler.should_stop.is_set()
        
        # Verify status is stopped
        assert scheduler.status == SchedulerStatus.STOPPED
    
    def test_pause_resume_scheduler(self, scheduler):
        """Test pausing and resuming the scheduler."""
        # Start the scheduler
        scheduler.start()
        
        # Pause the scheduler
        scheduler.pause()
        
        # Verify status is paused
        assert scheduler.status == SchedulerStatus.PAUSED
        
        # Resume the scheduler
        scheduler.resume()
        
        # Verify status is running
        assert scheduler.status == SchedulerStatus.RUNNING
        
        # Cleanup
        scheduler.stop()
    
    def test_state_persistence(self, scheduler, temp_state_file):
        """Test that scheduler state is persisted and restored."""
        # Add jobs
        job1 = scheduler.schedule_job(
            name="Persisted Job 1",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY
        )
        
        job2 = scheduler.schedule_job(
            name="Persisted Job 2",
            entity_type="orders",
            direction=SyncDirection.BIDIRECTIONAL,
            frequency=JobFrequency.HOURLY,
            priority=JobPriority.HIGH
        )
        
        # Force save state
        scheduler._save_state()
        
        # Create a new scheduler that loads from the same state file
        new_scheduler = SyncScheduler(
            sync_manager=scheduler.sync_manager,
            state_persistence_path=temp_state_file
        )
        
        # Load state
        new_scheduler._load_state()
        
        # Verify all jobs were restored
        assert len(new_scheduler.jobs) == 2
        assert job1 in new_scheduler.jobs
        assert job2 in new_scheduler.jobs
        
        # Verify job attributes were restored
        assert new_scheduler.jobs[job1].name == "Persisted Job 1"
        assert new_scheduler.jobs[job1].entity_type == "products"
        assert new_scheduler.jobs[job1].frequency == JobFrequency.DAILY
        
        assert new_scheduler.jobs[job2].name == "Persisted Job 2"
        assert new_scheduler.jobs[job2].entity_type == "orders"
        assert new_scheduler.jobs[job2].frequency == JobFrequency.HOURLY
        assert new_scheduler.jobs[job2].priority == JobPriority.HIGH
    
    def test_cleanup_old_results(self, scheduler):
        """Test cleaning up old job results."""
        # Add a job and create some results
        job_id = scheduler.schedule_job(
            name="Test Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.DAILY
        )
        
        # Add old results
        old_date = (datetime.now() - timedelta(days=40)).isoformat()
        scheduler.job_results[job_id] = [
            {"run_id": "run1", "start_time": old_date, "status": "completed"},
            {"run_id": "run2", "start_time": old_date, "status": "completed"}
        ]
        
        # Add recent results
        recent_date = (datetime.now() - timedelta(days=10)).isoformat()
        scheduler.job_results[job_id].append(
            {"run_id": "run3", "start_time": recent_date, "status": "completed"}
        )
        
        # Cleanup results older than 30 days
        removed = scheduler.cleanup_old_results(days=30)
        
        # Verify 2 results were removed
        assert removed == 2
        
        # Verify only recent result remains
        assert len(scheduler.job_results[job_id]) == 1
        assert scheduler.job_results[job_id][0]["run_id"] == "run3"
    
    @pytest.mark.integration
    def test_scheduler_e2e(self, scheduler):
        """
        End-to-end test of scheduler operation.
        
        Note: This test runs the actual scheduler thread and watches for job execution.
        It's marked as an integration test and may take a few seconds to complete.
        """
        # Add a job to run immediately
        job_id = scheduler.schedule_job(
            name="Immediate Job",
            entity_type="products",
            direction=SyncDirection.SHOPIFY_TO_EXTERNAL,
            frequency=JobFrequency.ONE_TIME,
            next_run=datetime.now()
        )
        
        # Start the scheduler
        scheduler.start()
        
        # Wait for job to be executed
        max_wait = 10  # seconds
        start_time = time.time()
        while time.time() - start_time < max_wait:
            # Check if job result exists
            result = scheduler.get_job_result(job_id)
            if result and result.get("status") in ["completed", "error"]:
                break
            time.sleep(0.5)
        
        # Stop the scheduler
        scheduler.stop()
        
        # Verify job was executed
        result = scheduler.get_job_result(job_id)
        assert result is not None
        assert result.get("status") == "completed"
        
        # Verify sync manager was called
        scheduler.sync_manager.create_sync_job.assert_called_once()
        
        # Verify job was updated
        job = scheduler.jobs[job_id]
        assert job.execution_count == 1
        assert job.last_run is not None
        assert job.next_run is None  # One-time job