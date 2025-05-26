"""
Tests for AutonomousOrchestrator
自律オーケストレーターの包括的テストスイート
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta

from autonomous_system.orchestrator import (
    AutonomousOrchestrator, 
    AutonomousTask, 
    TaskStatus, 
    TaskPriority,
    get_orchestrator
)


class TestAutonomousOrchestrator:
    """AutonomousOrchestrator unit tests"""
    
    @pytest.mark.unit
    def test_initialization(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test orchestrator initialization"""
        orchestrator = AutonomousOrchestrator()
        
        assert not orchestrator.is_running
        assert orchestrator.max_concurrent_tasks == 3
        assert orchestrator.auto_repair_enabled
        assert len(orchestrator.tasks) == 0
        assert len(orchestrator.task_queue) == 0
        assert 'total_tasks' in orchestrator.execution_stats
    
    @pytest.mark.unit
    def test_create_task(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test task creation"""
        orchestrator = AutonomousOrchestrator()
        
        task_id = orchestrator.create_task(
            task_type='strategic_analysis',
            description='Test task',
            data={'test': True},
            priority=TaskPriority.HIGH
        )
        
        assert task_id in orchestrator.tasks
        task = orchestrator.tasks[task_id]
        assert task.task_type == 'strategic_analysis'
        assert task.priority == TaskPriority.HIGH
        assert task.status == TaskStatus.PENDING
        assert task.assigned_agent == 'claude'  # Based on task routing
        assert task_id in orchestrator.task_queue
    
    @pytest.mark.unit
    def test_task_priority_queue(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test task queue prioritization"""
        orchestrator = AutonomousOrchestrator()
        
        # Create tasks with different priorities
        low_task = orchestrator.create_task('test', 'Low priority', {}, TaskPriority.LOW)
        critical_task = orchestrator.create_task('test', 'Critical task', {}, TaskPriority.CRITICAL)
        medium_task = orchestrator.create_task('test', 'Medium task', {}, TaskPriority.MEDIUM)
        
        # Check queue order (should be by priority: CRITICAL, MEDIUM, LOW)
        assert orchestrator.task_queue[0] == critical_task
        assert orchestrator.task_queue[1] == medium_task
        assert orchestrator.task_queue[2] == low_task
    
    @pytest.mark.unit
    def test_agent_selection(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test optimal agent selection for different task types"""
        orchestrator = AutonomousOrchestrator()
        
        test_cases = [
            ('strategic_analysis', 'claude'),
            ('code_generation', 'openai'),
            ('real_time_monitoring', 'gemini'),
            ('unknown_task', 'claude')  # Default fallback
        ]
        
        for task_type, expected_agent in test_cases:
            selected_agent = orchestrator._select_optimal_agent(task_type)
            assert selected_agent == expected_agent
    
    @pytest.mark.unit
    def test_dependency_checking(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test task dependency validation"""
        orchestrator = AutonomousOrchestrator()
        
        # Create independent task
        task1_id = orchestrator.create_task('test', 'Task 1', {})
        task1 = orchestrator.tasks[task1_id]
        
        # Create dependent task
        task2_id = orchestrator.create_task('test', 'Task 2', {}, dependencies=[task1_id])
        task2 = orchestrator.tasks[task2_id]
        
        # Task 2 should not be executable until Task 1 completes
        assert not orchestrator._check_dependencies(task2)
        
        # Complete Task 1
        task1.status = TaskStatus.COMPLETED
        assert orchestrator._check_dependencies(task2)
    
    @pytest.mark.async_test
    async def test_task_execution_success(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test successful task execution"""
        orchestrator = AutonomousOrchestrator()
        
        task_id = orchestrator.create_task(
            task_type='strategic_analysis',
            description='Test analysis',
            data={'problem': 'test'}
        )
        
        result = await orchestrator._execute_task(task_id)
        task = orchestrator.tasks[task_id]
        
        assert result['success']
        assert task.status == TaskStatus.COMPLETED
        assert task.started_at is not None
        assert task.completed_at is not None
        assert orchestrator.execution_stats['completed_tasks'] == 1
    
    @pytest.mark.async_test
    async def test_task_execution_failure_with_retry(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test task execution failure and retry mechanism"""
        orchestrator = AutonomousOrchestrator()
        
        # Mock agent to fail
        orchestrator.claude_agent.strategic_analysis = AsyncMock(
            side_effect=Exception("Test failure")
        )
        
        task_id = orchestrator.create_task(
            task_type='strategic_analysis',
            description='Failing task',
            data={'test': True}
        )
        
        result = await orchestrator._execute_task(task_id)
        task = orchestrator.tasks[task_id]
        
        assert not result['success']
        assert task.status == TaskStatus.RETRY
        assert task.retry_count == 1
        assert task.error == "Test failure"
        assert task_id in orchestrator.task_queue  # Re-queued for retry
    
    @pytest.mark.async_test
    async def test_task_execution_max_retries(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test task failure after max retries"""
        orchestrator = AutonomousOrchestrator()
        
        # Mock agent to always fail
        orchestrator.claude_agent.strategic_analysis = AsyncMock(
            side_effect=Exception("Persistent failure")
        )
        
        task_id = orchestrator.create_task(
            task_type='strategic_analysis',
            description='Failing task',
            data={'test': True}
        )
        task = orchestrator.tasks[task_id]
        task.retry_count = 3  # Set to max retries
        
        result = await orchestrator._execute_task(task_id)
        
        assert not result['success']
        assert task.status == TaskStatus.FAILED
        assert orchestrator.execution_stats['failed_tasks'] == 1
    
    @pytest.mark.async_test
    async def test_emergency_response(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test emergency response execution"""
        orchestrator = AutonomousOrchestrator()
        
        incident_data = {
            'type': 'system_failure',
            'severity': 'critical',
            'details': 'Database connection lost'
        }
        
        response = await orchestrator.execute_emergency_response(incident_data)
        
        assert 'emergency_id' in response
        assert 'tasks_executed' in response
        assert len(response['tasks_executed']) >= 2  # Analysis + monitoring tasks
        assert response['success']
        assert orchestrator.execution_stats['auto_repairs'] == 1
    
    @pytest.mark.async_test
    async def test_health_check(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test system health check"""
        orchestrator = AutonomousOrchestrator()
        
        health = await orchestrator.health_check()
        
        assert 'orchestrator' in health
        assert 'agents' in health
        assert 'llm_health' in health
        assert 'execution_stats' in health
        assert 'overall_health_score' in health
        assert 'status' in health
        assert isinstance(health['overall_health_score'], int)
        assert 0 <= health['overall_health_score'] <= 100
    
    @pytest.mark.unit
    def test_health_score_calculation(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test health score calculation logic"""
        orchestrator = AutonomousOrchestrator()
        
        # Test healthy system
        healthy_data = {
            'llm_health': {
                'claude': {'status': 'healthy'},
                'openai': {'status': 'healthy'},
                'gemini': {'status': 'healthy'}
            },
            'execution_stats': {
                'total_tasks': 10,
                'completed_tasks': 10,
                'failed_tasks': 0
            },
            'orchestrator': {'task_queue_size': 2}
        }
        
        score = orchestrator._calculate_health_score(healthy_data)
        assert score == 100
        
        # Test degraded system
        degraded_data = {
            'llm_health': {
                'claude': {'status': 'unhealthy'},
                'openai': {'status': 'healthy'}
            },
            'execution_stats': {
                'total_tasks': 10,
                'completed_tasks': 7,
                'failed_tasks': 3
            },
            'orchestrator': {'task_queue_size': 15}
        }
        
        score = orchestrator._calculate_health_score(degraded_data)
        assert score < 80  # Should be degraded
    
    @pytest.mark.unit
    def test_task_status_retrieval(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test task status retrieval"""
        orchestrator = AutonomousOrchestrator()
        
        task_id = orchestrator.create_task('test', 'Test task', {})
        task_status = orchestrator.get_task_status(task_id)
        
        assert task_status is not None
        assert task_status['id'] == task_id
        assert task_status['type'] == 'test'
        assert task_status['status'] == TaskStatus.PENDING.value
        assert 'created_at' in task_status
        
        # Test non-existent task
        assert orchestrator.get_task_status('non_existent') is None
    
    @pytest.mark.unit
    def test_system_overview(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test system overview generation"""
        orchestrator = AutonomousOrchestrator()
        
        # Create some tasks
        orchestrator.create_task('test', 'Task 1', {})
        orchestrator.create_task('test', 'Task 2', {}, priority=TaskPriority.CRITICAL)
        
        overview = orchestrator.get_system_overview()
        
        assert overview['orchestrator_status'] == 'stopped'
        assert overview['total_tasks'] == 2
        assert overview['pending_tasks'] == 2
        assert overview['queue_size'] == 2
        assert 'execution_stats' in overview
        assert 'uptime_hours' in overview
    
    @pytest.mark.unit
    def test_performance_metrics_collection(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test performance metrics collection"""
        orchestrator = AutonomousOrchestrator()
        
        # Add some execution history
        orchestrator.execution_stats['completed_tasks'] = 5
        orchestrator.execution_stats['failed_tasks'] = 1
        
        # Create and complete a task for avg calculation
        task_id = orchestrator.create_task('test', 'Test task', {})
        task = orchestrator.tasks[task_id]
        task.status = TaskStatus.COMPLETED
        task.started_at = datetime.now() - timedelta(seconds=5)
        task.completed_at = datetime.now()
        
        avg_time = orchestrator._calculate_avg_execution_time()
        assert avg_time > 0
        assert avg_time <= 10  # Should be around 5 seconds
    
    @pytest.mark.async_test
    async def test_auto_repair_mechanism(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test automatic repair mechanism"""
        orchestrator = AutonomousOrchestrator()
        
        # Create a failed task
        task_id = orchestrator.create_task('test', 'Failed task', {})
        task = orchestrator.tasks[task_id]
        task.status = TaskStatus.FAILED
        task.error = "Test error"
        task.retry_count = 3
        
        # Mock auto-repair
        with patch.object(orchestrator, '_attempt_auto_repair') as mock_repair:
            await orchestrator._execute_task(task_id)
            mock_repair.assert_called_once_with(task)


class TestTaskManagement:
    """Task management functionality tests"""
    
    @pytest.mark.unit
    def test_task_dataclass(self):
        """Test AutonomousTask dataclass functionality"""
        task = AutonomousTask(
            id="test_task",
            task_type="test",
            priority=TaskPriority.MEDIUM,
            description="Test task",
            data={"key": "value"}
        )
        
        assert task.id == "test_task"
        assert task.status == TaskStatus.PENDING
        assert task.retry_count == 0
        assert task.max_retries == 3
        assert task.dependencies == []
        assert task.created_at is not None
    
    @pytest.mark.unit
    def test_task_dependencies_initialization(self):
        """Test task dependencies are properly initialized"""
        # Test with explicit dependencies
        task1 = AutonomousTask(
            id="task1",
            task_type="test",
            priority=TaskPriority.MEDIUM,
            description="Test",
            data={},
            dependencies=["dep1", "dep2"]
        )
        assert task1.dependencies == ["dep1", "dep2"]
        
        # Test with None dependencies (should initialize to empty list)
        task2 = AutonomousTask(
            id="task2",
            task_type="test",
            priority=TaskPriority.MEDIUM,
            description="Test",
            data={}
        )
        assert task2.dependencies == []


class TestOrchestratorIntegration:
    """Integration tests for orchestrator components"""
    
    @pytest.mark.integration
    @pytest.mark.async_test
    async def test_end_to_end_task_execution(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test complete task lifecycle"""
        orchestrator = AutonomousOrchestrator()
        
        # Create a strategic analysis task
        task_id = orchestrator.create_task(
            task_type='strategic_analysis',
            description='E2E test task',
            data={'problem': 'Performance issue', 'urgency': 'high'}
        )
        
        # Execute the task
        result = await orchestrator._execute_task(task_id)
        task = orchestrator.tasks[task_id]
        
        # Verify execution
        assert result['success']
        assert task.status == TaskStatus.COMPLETED
        assert task.result is not None
        
        # Verify task was removed from queue
        assert task_id not in orchestrator.task_queue
        
        # Verify stats were updated
        assert orchestrator.execution_stats['completed_tasks'] == 1
    
    @pytest.mark.integration
    @pytest.mark.async_test 
    async def test_multi_task_dependency_resolution(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test complex dependency resolution"""
        orchestrator = AutonomousOrchestrator()
        
        # Create task chain: Task1 -> Task2 -> Task3
        task1_id = orchestrator.create_task('strategic_analysis', 'Task 1', {'step': 1})
        task2_id = orchestrator.create_task('code_generation', 'Task 2', {'step': 2}, dependencies=[task1_id])
        task3_id = orchestrator.create_task('real_time_monitoring', 'Task 3', {'step': 3}, dependencies=[task2_id])
        
        # Initially only task1 should be executable
        executable = orchestrator._get_executable_tasks()
        assert len(executable) == 1
        assert task1_id in executable
        
        # Execute task1
        await orchestrator._execute_task(task1_id)
        
        # Now task2 should be executable
        executable = orchestrator._get_executable_tasks()
        assert len(executable) == 1
        assert task2_id in executable
        
        # Execute task2
        await orchestrator._execute_task(task2_id)
        
        # Finally task3 should be executable
        executable = orchestrator._get_executable_tasks()
        assert len(executable) == 1
        assert task3_id in executable
    
    @pytest.mark.integration
    @pytest.mark.async_test
    async def test_emergency_response_workflow(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test complete emergency response workflow"""
        orchestrator = AutonomousOrchestrator()
        
        # Simulate critical incident
        incident = {
            'type': 'database_failure',
            'severity': 'critical',
            'affected_services': ['user_auth', 'order_processing'],
            'timestamp': datetime.now().isoformat()
        }
        
        # Execute emergency response
        response = await orchestrator.execute_emergency_response(incident)
        
        # Verify response structure
        assert response['success']
        assert len(response['tasks_executed']) >= 2
        assert 'emergency_id' in response
        assert 'handled_at' in response
        
        # Verify emergency tasks were created and executed
        emergency_tasks = [t for t in orchestrator.tasks.values() 
                          if t.priority == TaskPriority.CRITICAL]
        assert len(emergency_tasks) >= 2
        
        # Verify auto-repair counter incremented
        assert orchestrator.execution_stats['auto_repairs'] == 1


class TestSingletonPattern:
    """Test singleton pattern implementation"""
    
    @pytest.mark.unit
    def test_get_orchestrator_singleton(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test singleton pattern for get_orchestrator"""
        # Clear any existing singleton
        import autonomous_system.orchestrator
        autonomous_system.orchestrator._orchestrator = None
        
        # Get orchestrator instances
        orchestrator1 = get_orchestrator()
        orchestrator2 = get_orchestrator()
        
        # Should be the same instance
        assert orchestrator1 is orchestrator2
        assert id(orchestrator1) == id(orchestrator2)


class TestErrorHandling:
    """Error handling and edge case tests"""
    
    @pytest.mark.unit
    def test_invalid_task_type_handling(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test handling of invalid task types"""
        orchestrator = AutonomousOrchestrator()
        
        task_id = orchestrator.create_task(
            task_type='invalid_task_type',
            description='Invalid task',
            data={}
        )
        
        task = orchestrator.tasks[task_id]
        # Should default to claude for unknown task types
        assert task.assigned_agent == 'claude'
    
    @pytest.mark.async_test
    async def test_agent_dispatch_unknown_task(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test agent dispatch with unknown task type"""
        orchestrator = AutonomousOrchestrator()
        
        task = AutonomousTask(
            id="test",
            task_type="unknown_task",
            priority=TaskPriority.MEDIUM,
            description="Unknown task",
            data={},
            assigned_agent="claude"
        )
        
        result = await orchestrator._dispatch_task_to_agent(orchestrator.claude_agent, task)
        assert not result['success']
        assert 'Unknown task type' in result['error']
    
    @pytest.mark.unit
    def test_empty_task_queue_handling(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test handling of empty task queue"""
        orchestrator = AutonomousOrchestrator()
        
        executable_tasks = orchestrator._get_executable_tasks()
        assert len(executable_tasks) == 0
        
        # Should not raise any errors
        assert orchestrator.task_queue == []


class TestPerformanceOptimization:
    """Performance-related tests"""
    
    @pytest.mark.performance
    @pytest.mark.async_test
    async def test_concurrent_task_limit(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test concurrent task execution limits"""
        orchestrator = AutonomousOrchestrator()
        orchestrator.max_concurrent_tasks = 2
        
        # Create multiple tasks
        task_ids = []
        for i in range(5):
            task_id = orchestrator.create_task(f'test_{i}', f'Task {i}', {'index': i})
            task_ids.append(task_id)
        
        # Get executable tasks
        executable = orchestrator._get_executable_tasks()
        
        # Should respect concurrency limit in queue management
        assert len(executable) == len(task_ids)  # All tasks are executable (no dependencies)
        
        # Simulate running tasks limit
        for i in range(2):  # Fill up to max concurrent
            orchestrator.running_tasks[task_ids[i]] = AsyncMock()
        
        # Remaining tasks should wait for slots
        remaining_slots = orchestrator.max_concurrent_tasks - len(orchestrator.running_tasks)
        assert remaining_slots == 0
    
    @pytest.mark.performance
    def test_task_queue_performance(self, mock_orchestrator_dependencies, mock_env_vars):
        """Test task queue performance with many tasks"""
        orchestrator = AutonomousOrchestrator()
        
        start_time = time.time()
        
        # Create many tasks with different priorities
        for i in range(100):
            priority = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.CRITICAL][i % 4]
            orchestrator.create_task(f'test_{i}', f'Task {i}', {'index': i}, priority)
        
        creation_time = time.time() - start_time
        
        # Should complete task creation quickly (under 1 second)
        assert creation_time < 1.0
        
        # Verify queue is properly ordered by priority
        priorities = [orchestrator.tasks[task_id].priority.value for task_id in orchestrator.task_queue]
        assert priorities == sorted(priorities)  # Should be sorted by priority (lower number = higher priority)