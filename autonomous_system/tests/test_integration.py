#!/usr/bin/env python3
"""
Integration Tests for Autonomous System
自律システム統合テスト
"""

import asyncio
import pytest
import logging
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

# Import autonomous system components
from autonomous_system import (
    AutonomousSystemMain,
    get_orchestrator,
    ConfigManager,
    SystemMonitor,
    ErrorDetector,
    TaskStatus,
    TaskPriority
)


class TestAutonomousSystemIntegration:
    """Integration tests for the autonomous system"""
    
    @pytest.fixture
    async def system(self):
        """Create a test system instance"""
        system = AutonomousSystemMain()
        # Mock external dependencies for testing
        with patch('autonomous_system.multi_llm_client.MultiLLMClient') as mock_client:
            mock_client.return_value.health_check = AsyncMock(return_value={
                'claude': {'status': 'healthy'},
                'openai': {'status': 'healthy'},
                'gemini': {'status': 'healthy'}
            })
            yield system
    
    @pytest.mark.asyncio
    async def test_system_initialization(self, system):
        """Test system initialization"""
        # Mock environment variables
        with patch.dict('os.environ', {
            'ANTHROPIC_API_KEY': 'test-key',
            'OPENAI_API_KEY': 'test-key',
            'GEMINI_API_KEY': 'test-key'
        }):
            # Mock network connectivity
            with patch('aiohttp.ClientSession.get') as mock_get:
                mock_response = Mock()
                mock_response.status = 401  # API reachable but unauthorized
                mock_get.return_value.__aenter__.return_value = mock_response
                
                result = await system.initialize()
                assert result is True
    
    @pytest.mark.asyncio
    async def test_orchestrator_functionality(self):
        """Test orchestrator basic functionality"""
        orchestrator = get_orchestrator()
        
        # Create a test task
        task_id = orchestrator.create_task(
            task_type="strategic_analysis",
            description="Test task",
            data={"test": True},
            priority=TaskPriority.MEDIUM
        )
        
        assert task_id is not None
        assert task_id in orchestrator.tasks
        
        # Check task status
        task_status = orchestrator.get_task_status(task_id)
        assert task_status is not None
        assert task_status['status'] == TaskStatus.PENDING.value
    
    @pytest.mark.asyncio
    async def test_health_check_system(self):
        """Test health check functionality"""
        orchestrator = get_orchestrator()
        
        # Mock LLM health check
        with patch.object(orchestrator.llm_client, 'health_check') as mock_health:
            mock_health.return_value = {
                'claude': {'status': 'healthy'},
                'openai': {'status': 'healthy'},
                'gemini': {'status': 'healthy'}
            }
            
            health = await orchestrator.health_check()
            assert 'overall_health_score' in health
            assert health['overall_health_score'] > 0
    
    @pytest.mark.asyncio
    async def test_emergency_response(self):
        """Test emergency response system"""
        orchestrator = get_orchestrator()
        
        # Mock agent responses
        with patch.object(orchestrator.claude_agent, 'strategic_analysis') as mock_analysis:
            mock_analysis.return_value = {
                'success': True,
                'structured_analysis': {
                    'agent_assignment': {'primary_agent': 'openai'}
                }
            }
            
            with patch.object(orchestrator.gemini_agent, 'real_time_monitoring') as mock_monitoring:
                mock_monitoring.return_value = {'success': True}
                
                incident_data = {
                    'type': 'test_emergency',
                    'severity': 'high',
                    'description': 'Test emergency incident'
                }
                
                result = await orchestrator.execute_emergency_response(incident_data)
                assert result['success'] is True
                assert 'emergency_id' in result
    
    def test_config_manager(self):
        """Test configuration manager"""
        config_manager = ConfigManager()
        
        # Test default config
        assert config_manager.validate_config() is True
        
        # Test with custom config
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            test_config = {
                'orchestrator': {
                    'max_concurrent_tasks': 5,
                    'health_check_interval': 30
                }
            }
            json.dump(test_config, f)
            f.flush()
            
            config_manager.load_config(f.name)
            loaded_config = config_manager.get_config()
            assert loaded_config['orchestrator']['max_concurrent_tasks'] == 5
    
    @pytest.mark.asyncio
    async def test_system_monitor(self):
        """Test system monitor functionality"""
        monitor = SystemMonitor()
        
        status = await monitor.get_system_status()
        assert 'status' in status
        assert 'cpu_usage' in status
        assert 'memory_usage' in status
    
    def test_error_detector(self):
        """Test error detector functionality"""
        detector = ErrorDetector()
        
        # Test error detection
        test_error = "Test error message"
        result = detector.detect_error(test_error)
        assert result is not None
        assert result['error_detected'] is True
        assert result['severity'] in ['low', 'medium', 'high', 'critical']
    
    @pytest.mark.asyncio
    async def test_task_lifecycle(self):
        """Test complete task lifecycle"""
        orchestrator = get_orchestrator()
        
        # Create task
        task_id = orchestrator.create_task(
            task_type="strategic_analysis", 
            description="Lifecycle test",
            data={"test_lifecycle": True}
        )
        
        # Check initial status
        task = orchestrator.tasks[task_id]
        assert task.status == TaskStatus.PENDING
        
        # Mock successful execution
        with patch.object(orchestrator.claude_agent, 'strategic_analysis') as mock_analysis:
            mock_analysis.return_value = {'success': True, 'result': 'test_result'}
            
            # Execute task
            result = await orchestrator._execute_task(task_id)
            
            assert result['success'] is True
            assert task.status == TaskStatus.COMPLETED
    
    @pytest.mark.asyncio
    async def test_system_startup_script_validation(self):
        """Test startup script validation logic"""
        from scripts.start_autonomous_system import AutonomousSystemStarter
        
        starter = AutonomousSystemStarter()
        
        # Test individual validation components
        assert starter._check_python_version() is True
        
        # Test with mocked environment
        with patch.dict('os.environ', {
            'ANTHROPIC_API_KEY': 'test-key',
            'OPENAI_API_KEY': 'test-key', 
            'GEMINI_API_KEY': 'test-key'
        }):
            assert starter._check_environment_variables() is True
    
    @pytest.mark.asyncio
    async def test_system_shutdown_script(self):
        """Test shutdown script functionality"""
        from scripts.stop_autonomous_system import AutonomousSystemStopper
        
        stopper = AutonomousSystemStopper()
        
        # Test health check
        await stopper._pre_shutdown_health_check()
        
        # Test backup creation
        with tempfile.TemporaryDirectory() as temp_dir:
            backup_dir = Path(temp_dir) / "test_backup"
            backup_dir.mkdir()
            
            await stopper._backup_runtime_data(backup_dir)
            
            # Check backup files were created
            assert (backup_dir / "runtime").exists()
            assert (backup_dir / "runtime" / "system_metrics.json").exists()
    
    @pytest.mark.asyncio
    async def test_package_imports(self):
        """Test that all package components can be imported"""
        # This test ensures all imports work correctly
        from autonomous_system import (
            __version__,
            get_orchestrator,
            AutonomousSystemMain,
            ConfigManager,
            SystemMonitor,
            ErrorDetector,
            ClaudeAnalysisAgent,
            OpenAICodeAgent,
            GeminiInfraAgent,
            GitHubIntegration,
            MultiLLMClient
        )
        
        assert __version__ == "1.0.0"
        assert get_orchestrator() is not None
    
    @pytest.mark.asyncio
    async def test_concurrent_task_execution(self):
        """Test concurrent task execution"""
        orchestrator = get_orchestrator()
        
        # Create multiple tasks
        task_ids = []
        for i in range(3):
            task_id = orchestrator.create_task(
                task_type="strategic_analysis",
                description=f"Concurrent test task {i}",
                data={"test_id": i}
            )
            task_ids.append(task_id)
        
        assert len(task_ids) == 3
        assert all(tid in orchestrator.tasks for tid in task_ids)
        
        # Check task queue
        assert len(orchestrator.task_queue) >= 3
    
    @pytest.mark.asyncio  
    async def test_system_recovery(self):
        """Test system recovery capabilities"""
        orchestrator = get_orchestrator()
        
        # Simulate system degradation
        health_data = {
            'overall_health_score': 30,  # Low health score
            'orchestrator': {'status': 'degraded'},
            'llm_health': {
                'claude': {'status': 'unhealthy'},
                'openai': {'status': 'healthy'},
                'gemini': {'status': 'healthy'}
            }
        }
        
        # Test auto-repair trigger
        await orchestrator._trigger_system_repair(health_data)
        
        # Should have created a repair task
        repair_tasks = [
            task for task in orchestrator.tasks.values() 
            if 'repair' in task.description.lower()
        ]
        assert len(repair_tasks) > 0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])