"""
Pytest Configuration for Autonomous System Tests
共通のフィクスチャ、モック、セットアップ設定
"""

import pytest
import asyncio
import os
import tempfile
import shutil
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# Test imports
import sys
sys.path.append('/Users/mourigenta/shopify-mcp-server')

from autonomous_system.orchestrator import AutonomousOrchestrator, AutonomousTask, TaskStatus, TaskPriority
from autonomous_system.multi_llm_client import MultiLLMClient
from autonomous_system.monitoring.error_detector import ErrorDetector, DetectedError, ErrorSeverity, ErrorCategory
from autonomous_system.monitoring.system_monitor import SystemMonitor
from autonomous_system.integrations.github_integration import GitHubIntegration
from autonomous_system.config.config_manager import ConfigManager


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop for async tests"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_dir():
    """Temporary directory for testing"""
    temp_path = tempfile.mkdtemp()
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)


@pytest.fixture
def mock_env_vars():
    """Mock environment variables"""
    env_vars = {
        'ANTHROPIC_API_KEY': 'test_anthropic_key',
        'OPENAI_API_KEY': 'test_openai_key',
        'GEMINI_API_KEY': 'test_gemini_key',
        'GITHUB_TOKEN': 'test_github_token',
        'MONITORING_INTERVAL': '1',
        'ERROR_DETECTION_ENABLED': 'true',
        'MAX_TOKENS_CLAUDE': '1000',
        'MAX_TOKENS_OPENAI': '1000',
        'MAX_TOKENS_GEMINI': '1000',
        'PARALLEL_EXECUTION_LIMIT': '3'
    }
    
    with patch.dict(os.environ, env_vars, clear=False):
        yield env_vars


@pytest.fixture
def mock_llm_clients():
    """Mock LLM clients for testing"""
    mock_anthropic = Mock()
    mock_openai = AsyncMock()
    mock_gemini = Mock()
    
    # Mock Anthropic response
    mock_anthropic_response = Mock()
    mock_anthropic_response.content = [Mock(text="Mock Claude response")]
    mock_anthropic_response.usage = Mock(input_tokens=10, output_tokens=20)
    mock_anthropic.messages.create = AsyncMock(return_value=mock_anthropic_response)
    
    # Mock OpenAI response
    mock_openai_response = Mock()
    mock_openai_response.choices = [Mock()]
    mock_openai_response.choices[0].message.content = "Mock OpenAI response"
    mock_openai_response.usage = Mock(total_tokens=30)
    mock_openai.chat.completions.create = AsyncMock(return_value=mock_openai_response)
    
    # Mock Gemini response
    mock_gemini_response = Mock()
    mock_gemini_response.text = "Mock Gemini response"
    mock_gemini.generate_content_async = AsyncMock(return_value=mock_gemini_response)
    
    return {
        'anthropic': mock_anthropic,
        'openai': mock_openai,
        'gemini': mock_gemini
    }


@pytest.fixture
def mock_multi_llm_client(mock_llm_clients):
    """Mock MultiLLMClient instance"""
    with patch('autonomous_system.multi_llm_client.Anthropic') as mock_anthropic_class, \
         patch('autonomous_system.multi_llm_client.openai.AsyncOpenAI') as mock_openai_class, \
         patch('autonomous_system.multi_llm_client.genai.GenerativeModel') as mock_gemini_class:
        
        # Configure class mocks
        mock_anthropic_class.return_value = mock_llm_clients['anthropic']
        mock_openai_class.return_value = mock_llm_clients['openai']
        mock_gemini_class.return_value = mock_llm_clients['gemini']
        
        client = MultiLLMClient()
        client.claude = mock_llm_clients['anthropic']
        client.openai = mock_llm_clients['openai']
        client.gemini_model = mock_llm_clients['gemini']
        
        yield client


@pytest.fixture
def sample_task_data():
    """Sample task data for testing"""
    return {
        'strategic_analysis': {
            'type': 'strategic_analysis',
            'description': 'Test strategic analysis',
            'data': {
                'problem': 'System performance degradation',
                'context': 'Production environment'
            },
            'priority': TaskPriority.HIGH
        },
        'code_generation': {
            'type': 'code_generation',
            'description': 'Test code generation',
            'data': {
                'requirements': 'Create a REST API endpoint',
                'tech_stack': 'Python FastAPI'
            },
            'priority': TaskPriority.MEDIUM
        },
        'real_time_monitoring': {
            'type': 'real_time_monitoring',
            'description': 'Test monitoring',
            'data': {
                'system_metrics': {'cpu': 85, 'memory': 75},
                'alert_threshold': 90
            },
            'priority': TaskPriority.CRITICAL
        }
    }


@pytest.fixture
def sample_detected_errors():
    """Sample detected errors for testing"""
    return [
        DetectedError(
            id="test_error_1",
            category=ErrorCategory.APPLICATION,
            severity=ErrorSeverity.HIGH,
            title="Application Error",
            description="Module not found error",
            source="test_app.py",
            timestamp=datetime.now(),
            data={'line_number': 42},
            auto_fixable=True,
            fix_confidence=0.8
        ),
        DetectedError(
            id="test_error_2",
            category=ErrorCategory.SYSTEM,
            severity=ErrorSeverity.CRITICAL,
            title="System Error",
            description="High CPU usage detected",
            source="system_monitor",
            timestamp=datetime.now() - timedelta(minutes=5),
            data={'cpu_percent': 95},
            auto_fixable=True,
            fix_confidence=0.7
        ),
        DetectedError(
            id="test_error_3",
            category=ErrorCategory.BUILD,
            severity=ErrorSeverity.MEDIUM,
            title="Build Error",
            description="TypeScript compilation failed",
            source="build.log",
            timestamp=datetime.now() - timedelta(minutes=10),
            data={'build_errors': ['TS2304: Cannot find name']},
            auto_fixable=True,
            fix_confidence=0.6
        )
    ]


@pytest.fixture
def mock_orchestrator_dependencies():
    """Mock dependencies for AutonomousOrchestrator"""
    with patch('autonomous_system.orchestrator.MultiLLMClient') as mock_llm, \
         patch('autonomous_system.orchestrator.ClaudeAnalysisAgent') as mock_claude, \
         patch('autonomous_system.orchestrator.OpenAICodeAgent') as mock_openai, \
         patch('autonomous_system.orchestrator.GeminiInfraAgent') as mock_gemini:
        
        # Configure mock agents
        mock_claude_instance = Mock()
        mock_claude_instance.strategic_analysis = AsyncMock(return_value={'success': True, 'result': 'analysis'})
        mock_claude_instance.get_agent_info = Mock(return_value={'status': 'healthy'})
        mock_claude.return_value = mock_claude_instance
        
        mock_openai_instance = Mock()
        mock_openai_instance.generate_fix_code = AsyncMock(return_value={'success': True, 'code': 'fixed_code'})
        mock_openai_instance.get_agent_info = Mock(return_value={'status': 'healthy'})
        mock_openai.return_value = mock_openai_instance
        
        mock_gemini_instance = Mock()
        mock_gemini_instance.real_time_monitoring = AsyncMock(return_value={'success': True, 'metrics': {}})
        mock_gemini_instance.get_agent_info = Mock(return_value={'status': 'healthy'})
        mock_gemini.return_value = mock_gemini_instance
        
        mock_llm_instance = Mock()
        mock_llm_instance.health_check = AsyncMock(return_value={'claude': {'status': 'healthy'}})
        mock_llm_instance.get_execution_stats = Mock(return_value={})
        mock_llm_instance.task_routing = {'strategic_analysis': 'claude'}
        mock_llm.return_value = mock_llm_instance
        
        yield {
            'multi_llm': mock_llm_instance,
            'claude_agent': mock_claude_instance,
            'openai_agent': mock_openai_instance,
            'gemini_agent': mock_gemini_instance
        }


@pytest.fixture
def mock_system_resources():
    """Mock system resource monitoring"""
    with patch('autonomous_system.monitoring.error_detector.psutil') as mock_psutil:
        # Mock CPU
        mock_psutil.cpu_percent.return_value = 45.0
        
        # Mock memory
        mock_memory = Mock()
        mock_memory.percent = 60.0
        mock_memory.available = 8 * (1024**3)  # 8GB
        mock_psutil.virtual_memory.return_value = mock_memory
        
        # Mock disk
        mock_disk = Mock()
        mock_disk.total = 500 * (1024**3)  # 500GB
        mock_disk.used = 200 * (1024**3)   # 200GB
        mock_disk.free = 300 * (1024**3)   # 300GB
        mock_psutil.disk_usage.return_value = mock_disk
        
        yield mock_psutil


@pytest.fixture
def mock_subprocess():
    """Mock subprocess calls for system commands"""
    with patch('autonomous_system.monitoring.error_detector.subprocess') as mock_sub:
        # Mock successful subprocess result
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Success"
        mock_result.stderr = ""
        mock_sub.run.return_value = mock_result
        
        yield mock_sub


@pytest.fixture
def mock_github_api():
    """Mock GitHub API responses"""
    mock_repo = Mock()
    mock_repo.full_name = "test/repo"
    mock_repo.default_branch = "main"
    
    mock_pr = Mock()
    mock_pr.number = 123
    mock_pr.title = "Test PR"
    mock_pr.html_url = "https://github.com/test/repo/pull/123"
    
    mock_issue = Mock()
    mock_issue.number = 456
    mock_issue.title = "Test Issue"
    mock_issue.html_url = "https://github.com/test/repo/issues/456"
    
    return {
        'repo': mock_repo,
        'pull_request': mock_pr,
        'issue': mock_issue
    }


@pytest.fixture
def performance_test_data():
    """Performance test data and metrics"""
    return {
        'response_times': [100, 150, 200, 120, 180],  # milliseconds
        'throughput_targets': {
            'tasks_per_second': 10,
            'max_response_time': 500,
            'error_rate_threshold': 0.01
        },
        'load_test_config': {
            'concurrent_tasks': 50,
            'duration_seconds': 30,
            'ramp_up_time': 5
        }
    }


@pytest.fixture
def integration_test_config():
    """Integration test configuration"""
    return {
        'test_timeouts': {
            'task_execution': 10,
            'health_check': 5,
            'system_startup': 15
        },
        'retry_config': {
            'max_retries': 3,
            'retry_delay': 1
        },
        'validation_rules': {
            'required_components': ['orchestrator', 'multi_llm_client', 'error_detector'],
            'health_score_threshold': 70
        }
    }


class AsyncContextManager:
    """Helper for async context managers in tests"""
    def __init__(self, coro):
        self.coro = coro
        
    async def __aenter__(self):
        return await self.coro
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.fixture
def async_mock_context():
    """Async context manager mock helper"""
    return AsyncContextManager


class TestDataGenerator:
    """Helper class for generating test data"""
    
    @staticmethod
    def create_task(task_id: str = None, **kwargs) -> AutonomousTask:
        """Create a test task"""
        defaults = {
            'id': task_id or f'test_task_{datetime.now().timestamp()}',
            'task_type': 'test_task',
            'priority': TaskPriority.MEDIUM,
            'description': 'Test task description',
            'data': {'test': True}
        }
        defaults.update(kwargs)
        return AutonomousTask(**defaults)
    
    @staticmethod
    def create_error(error_id: str = None, **kwargs) -> DetectedError:
        """Create a test error"""
        defaults = {
            'id': error_id or f'test_error_{datetime.now().timestamp()}',
            'category': ErrorCategory.APPLICATION,
            'severity': ErrorSeverity.MEDIUM,
            'title': 'Test Error',
            'description': 'Test error description',
            'source': 'test_source',
            'timestamp': datetime.now(),
            'data': {'test': True}
        }
        defaults.update(kwargs)
        return DetectedError(**defaults)
    
    @staticmethod
    def create_llm_response(success: bool = True, **kwargs) -> Dict[str, Any]:
        """Create a mock LLM response"""
        defaults = {
            'success': success,
            'content': 'Mock LLM response',
            'llm': 'test_llm',
            'model': 'test_model',
            'task_type': 'test_task',
            'tokens_used': 100,
            'timestamp': datetime.now().isoformat()
        }
        defaults.update(kwargs)
        return defaults


@pytest.fixture
def test_data_generator():
    """Test data generator fixture"""
    return TestDataGenerator


# Pytest markers for categorizing tests
pytest_markers = [
    "unit: Unit tests",
    "integration: Integration tests",
    "performance: Performance tests",
    "async_test: Async tests",
    "slow: Slow running tests",
    "requires_env: Tests requiring environment setup"
]

def pytest_configure(config):
    """Configure pytest markers"""
    for marker in pytest_markers:
        config.addinivalue_line("markers", marker)


# Test utilities
class TestUtils:
    """Utility functions for tests"""
    
    @staticmethod
    async def wait_for_condition(condition_func, timeout=5, interval=0.1):
        """Wait for a condition to become true"""
        end_time = datetime.now() + timedelta(seconds=timeout)
        while datetime.now() < end_time:
            if condition_func():
                return True
            await asyncio.sleep(interval)
        return False
    
    @staticmethod
    def assert_task_state(task: AutonomousTask, expected_status: TaskStatus):
        """Assert task is in expected state"""
        assert task.status == expected_status, f"Expected {expected_status}, got {task.status}"
    
    @staticmethod
    def assert_error_properties(error: DetectedError, **expected_props):
        """Assert error has expected properties"""
        for prop, expected_value in expected_props.items():
            actual_value = getattr(error, prop)
            assert actual_value == expected_value, f"Expected {prop}={expected_value}, got {actual_value}"


@pytest.fixture
def test_utils():
    """Test utilities fixture"""
    return TestUtils